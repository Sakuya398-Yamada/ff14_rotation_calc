import { useState, useCallback, useMemo, useRef } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from "@dnd-kit/core";
import type { Skill, ResolvedTimelineEntry } from "../../types/skill";
import { calcInsertIndex } from "./helpers";
import { PX_PER_SEC } from "./constants";
import { TIMELINE_DROPZONE_ID, DELETE_ZONE_ID, getEventClientX } from "./dnd-types";
import type { TimelineDragData } from "./dnd-types";

interface UseTimelineDndArgs {
  resolvedEntries: ResolvedTimelineEntry[];
  skillMap: Map<string, Skill>;
  getResolvedEntryRecast: (entry: ResolvedTimelineEntry, skill: Skill) => number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  shouldAutoScrollRef: React.MutableRefObject<boolean>;
  onAddEntry: (skillId: string, insertBeforeUid?: string) => void;
  onRemoveEntry: (uid: string) => void;
  onMoveEntry: (uid: string, insertBeforeUid?: string) => void;
}

/**
 * タイムラインの DnD（パレットからの追加／タイムライン内並び替え／削除ゾーン）の
 * state・挿入位置計算・イベント処理を束ねたフック。
 *
 * dnd-kit の DndContext（App.tsx）配下で useDndMonitor によりドラッグイベントを購読する。
 * HTML5 ネイティブ DnD はモバイルのタッチ操作で発火しないため使わない（Issue #284）。
 */
export function useTimelineDnd({
  resolvedEntries,
  skillMap,
  getResolvedEntryRecast,
  scrollRef,
  shouldAutoScrollRef,
  onAddEntry,
  onRemoveEntry,
  onMoveEntry,
}: UseTimelineDndArgs) {
  const [dragOver, setDragOver] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<"gcd" | "ogcd" | null>(null);
  /** タイムライン内ドラッグ中のエントリUID（null = パレットドラッグ中 or 非ドラッグ） */
  const [draggingEntryUid, setDraggingEntryUid] = useState<string | null>(null);
  /** 削除ドロップエリア上にカーソルがあるか */
  const [overDeleteZone, setOverDeleteZone] = useState(false);
  /** ドラッグムーブのrAFスロットリング用 */
  const dragRafRef = useRef<number | null>(null);
  /**
   * ドラッグ中の実ポインタ clientX。
   * dnd-kit の event.delta は「ポインタ移動量 + スクロール可能祖先のスクロール差分」
   * （scrollAdjustedTranslate）なので、activatorEvent.clientX + delta.x では
   * autoScroll 中にスクロール量が二重加算される。window リスナーで実座標を追跡する。
   */
  const pointerClientXRef = useRef<number | null>(null);

  const trackPointerMove = useCallback((e: PointerEvent) => {
    pointerClientXRef.current = e.clientX;
  }, []);
  const trackTouchMove = useCallback((e: TouchEvent) => {
    const t = e.touches[0];
    if (t) pointerClientXRef.current = t.clientX;
  }, []);

  /**
   * 挿入位置の計算に使う「見えている並び」。タイムライン内D&D中は、ドラッグ中エントリだけを除く。
   * ドラッグ中エントリを含めると、元の位置の近くでインデックスが 1 つずれ、ドロップ先が自分自身になり得る。
   *
   * ここから使うのは、uid の並び（挿入インデックスとドロップ先）、スキルの種類（GCD か）、
   * 画面に描かれている時刻（マウス位置の判定とインジケーターの位置）だけ。
   * ドラッグ中もアイコンは元の resolvedEntries の時刻のまま動かない（ドラッグ中エントリは半透明で残る）ので、
   * 時刻はこの並びの値をそのまま使う。ドラッグ中エントリを除いた並びで resolveTimeline をやり直すと、
   * 後続の時刻が前詰めされて画面とずれる（#190）。並びとスキルの種類はやり直しても変わらないので、やり直さない（#962）。
   */
  const visibleEntriesForInsert = useMemo(() => {
    if (draggingEntryUid === null) return resolvedEntries;
    return resolvedEntries.filter((e) => e.uid !== draggingEntryUid);
  }, [resolvedEntries, draggingEntryUid]);

  /** 見えている並びの GCD だけ（GCD の挿入位置の判定用） */
  const visibleGcdEntriesForInsert = useMemo(
    () => visibleEntriesForInsert.filter((entry) => {
      const skill = skillMap.get(entry.skillId);
      return skill && skill.type === "gcd";
    }),
    [visibleEntriesForInsert, skillMap]
  );

  /** GCDフィルタ済みインデックスを挿入用エントリリスト上のインデックスに変換 */
  const mapGcdIndexToInsertion = useCallback(
    (gcdIdx: number): number => {
      if (gcdIdx >= visibleGcdEntriesForInsert.length) {
        // 末尾に追加: 最後のGCD以降のoGCDも含めた末尾
        return visibleEntriesForInsert.length;
      }
      // gcdIdx番目のGCDエントリの前に挿入
      const targetEntry = visibleGcdEntriesForInsert[gcdIdx];
      return visibleEntriesForInsert.findIndex((e) => e.uid === targetEntry.uid);
    },
    [visibleEntriesForInsert, visibleGcdEntriesForInsert]
  );

  /**
   * oGCD挿入用の幅関数: アニメーションロックを基準にする。
   * GCDのリキャスト幅（2.5s）ではなく、アニメーションロック（0.65s）を使うことで、
   * GCDリキャスト中のウィービング位置を正しく判定する。
   */
  const getAnimLockWidth = useCallback(
    (_entry: ResolvedTimelineEntry, skill: Skill): number => skill.animationLock,
    []
  );

  /**
   * ドラッグ中のポインタ位置から挿入インデックス（visibleEntriesForInsert 上）を計算する。
   * GCD: GCDエントリのみで計算し、insertion変換（GCDリキャスト境界間に配置）
   * oGCD: 全エントリで計算、アニメーションロック基準の中央で判定（ウィービング対応）
   */
  const calcCombinedInsertIndex = useCallback(
    (mouseX: number, scrollLeft: number, type: "gcd" | "ogcd"): number => {
      if (type === "gcd") {
        const gcdIdx = calcInsertIndex(mouseX, scrollLeft, visibleGcdEntriesForInsert, skillMap, getResolvedEntryRecast);
        return mapGcdIndexToInsertion(gcdIdx);
      }
      return calcInsertIndex(mouseX, scrollLeft, visibleEntriesForInsert, skillMap, getAnimLockWidth);
    },
    [visibleEntriesForInsert, visibleGcdEntriesForInsert, skillMap, getResolvedEntryRecast, getAnimLockWidth, mapGcdIndexToInsertion]
  );

  /** ドラッグイベントの active からドラッグデータを取り出す（型は Draggable 側で保証） */
  const getDragData = (event: { active: { data: { current?: unknown } } }): TimelineDragData | null => {
    const data = event.active.data.current as TimelineDragData | undefined;
    return data ?? null;
  };

  const clearDragState = useCallback(() => {
    setDragOver(false);
    setInsertIndex(null);
    setDragType(null);
    setDraggingEntryUid(null);
    setOverDeleteZone(false);
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    pointerClientXRef.current = null;
    window.removeEventListener("pointermove", trackPointerMove);
    window.removeEventListener("touchmove", trackTouchMove);
  }, [trackPointerMove, trackTouchMove]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = getDragData(event);
    if (!data) return;
    // 挿入インジケーターの時刻計算にだけ使う。GCD リキャストも発生させる oGCD（黙想）は GCD と同じくリキャスト明けを待つ
    setDragType(skillMap.get(data.skillId)?.triggersGcdRecast ? "gcd" : data.skillType);
    if (data.source === "timeline") {
      setDraggingEntryUid(data.uid);
    }
    pointerClientXRef.current = getEventClientX(event.activatorEvent);
    window.addEventListener("pointermove", trackPointerMove, { passive: true });
    window.addEventListener("touchmove", trackTouchMove, { passive: true });
  }, [trackPointerMove, trackTouchMove, skillMap]);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const data = getDragData(event);
      if (!data) return;

      const overId = event.over?.id ?? null;
      setDragOver(overId === TIMELINE_DROPZONE_ID);
      setOverDeleteZone(overId === DELETE_ZONE_ID && data.source === "timeline");

      if (overId !== TIMELINE_DROPZONE_ID) {
        // ゾーン外: 発火待ちの rAF を先にキャンセルしないと直後に insertIndex が復活し、
        // インジケーターがゾーン外でも残留する
        if (dragRafRef.current !== null) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        setInsertIndex(null);
        return;
      }

      // rAFでスロットリング: 前フレームの更新がまだ処理中なら新しいリクエストをスキップ
      if (dragRafRef.current !== null) return;

      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        const clientX = pointerClientXRef.current;
        if (clientX !== null && scrollRef.current && visibleEntriesForInsert.length > 0) {
          const mouseX = clientX - scrollRef.current.getBoundingClientRect().left;
          setInsertIndex(calcCombinedInsertIndex(mouseX, scrollRef.current.scrollLeft, data.skillType));
        } else {
          setInsertIndex(null);
        }
      });
    },
    [visibleEntriesForInsert, calcCombinedInsertIndex, scrollRef]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const data = getDragData(event);
      const overId = event.over?.id ?? null;

      if (!data || overId === null) {
        clearDragState();
        return;
      }

      if (overId === DELETE_ZONE_ID) {
        if (data.source === "timeline") {
          shouldAutoScrollRef.current = false;
          onRemoveEntry(data.uid);
        }
        clearDragState();
        return;
      }

      if (overId !== TIMELINE_DROPZONE_ID) {
        clearDragState();
        return;
      }

      const clientX = pointerClientXRef.current;

      if (data.source === "timeline") {
        if (scrollRef.current && clientX !== null && visibleEntriesForInsert.length > 0) {
          const mouseX = clientX - scrollRef.current.getBoundingClientRect().left;
          const idx = calcCombinedInsertIndex(mouseX, scrollRef.current.scrollLeft, data.skillType);
          // visibleEntriesForInsert はドラッグ中エントリを除外しているため、
          // ここで得られる targetEntry が自分自身になることはない（= 不要な no-op 判定が消える）
          const targetEntry = idx < visibleEntriesForInsert.length ? visibleEntriesForInsert[idx] : undefined;
          shouldAutoScrollRef.current = false;
          onMoveEntry(data.uid, targetEntry?.uid);
        }
      } else {
        if (scrollRef.current && clientX !== null && visibleEntriesForInsert.length > 0) {
          const mouseX = clientX - scrollRef.current.getBoundingClientRect().left;
          const idx = calcCombinedInsertIndex(mouseX, scrollRef.current.scrollLeft, data.skillType);
          const isInsertMiddle = idx < visibleEntriesForInsert.length;
          if (isInsertMiddle) {
            shouldAutoScrollRef.current = false;
          }
          onAddEntry(data.skillId, isInsertMiddle ? visibleEntriesForInsert[idx].uid : undefined);
        } else {
          onAddEntry(data.skillId);
        }
      }

      clearDragState();
    },
    [onAddEntry, onMoveEntry, onRemoveEntry, visibleEntriesForInsert, calcCombinedInsertIndex, scrollRef, shouldAutoScrollRef, clearDragState]
  );

  useDndMonitor({
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: clearDragState,
  });

  /**
   * 挿入インジケーターのX座標。
   * 画面に描画されているエントリアイコンと同じ座標系にするため、「見えている並び」(visibleEntriesForInsert) の
   * post-entry state（gcdAvailableAt / actionAvailableAt）を使う。calcInsertIndex も同じ並びで idx を決めているので、
   * idx と indicatorX の座標系が一致する。
   */
  const indicatorX = useMemo(() => {
    if (insertIndex === null || dragType === null) return null;

    let startTime: number;
    if (insertIndex <= 0) {
      // 先頭に挿入: 時刻0から開始
      startTime = 0;
    } else {
      const prevEntry = visibleEntriesForInsert[insertIndex - 1];
      if (!prevEntry) {
        startTime = 0;
      } else if (dragType === "gcd") {
        // GCD: max(GCDリキャスト明け, 直前アクション硬直明け)
        startTime = Math.max(prevEntry.gcdAvailableAt, prevEntry.actionAvailableAt);
      } else {
        // oGCD: 直前アクション硬直明け
        startTime = prevEntry.actionAvailableAt;
      }
    }

    return startTime * PX_PER_SEC;
  }, [insertIndex, dragType, visibleEntriesForInsert]);

  return {
    dragOver,
    draggingEntryUid,
    overDeleteZone,
    indicatorX,
  };
}
