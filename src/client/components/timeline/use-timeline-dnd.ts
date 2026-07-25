import { useState, useCallback, useMemo, useRef } from "react";
import type { Skill, ResolvedTimelineEntry, ResourceDefinition, BuffDefinition, CharacterStats, BossUntargetableWindow, MultiTargetWindow } from "../../types/skill";
import { resolveTimeline } from "../../logic/resolve-timeline";
import { calcInsertIndex } from "./helpers";
import { PX_PER_SEC } from "./constants";

interface UseTimelineDndArgs {
  resolvedEntries: ResolvedTimelineEntry[];
  skillMap: Map<string, Skill>;
  resources: ResourceDefinition[];
  stats: CharacterStats;
  buffs: BuffDefinition[];
  untargetableWindows: BossUntargetableWindow[];
  multiTargetWindows: MultiTargetWindow[];
  getResolvedEntryRecast: (entry: ResolvedTimelineEntry, skill: Skill) => number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  shouldAutoScrollRef: React.MutableRefObject<boolean>;
  onAddEntry: (skillId: string, insertBeforeUid?: string) => void;
  onRemoveEntry: (uid: string) => void;
  onMoveEntry: (uid: string, insertBeforeUid?: string) => void;
}

/**
 * タイムラインの DnD（パレットからの追加／タイムライン内並び替え／削除ゾーン）の
 * state・挿入位置計算・イベントハンドラを束ねたフック。
 */
export function useTimelineDnd({
  resolvedEntries,
  skillMap,
  resources,
  stats,
  buffs,
  untargetableWindows,
  multiTargetWindows,
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
  /** ドラッグオーバーのrAFスロットリング用 */
  const dragRafRef = useRef<number | null>(null);
  /** dragenter/dragleaveの子要素間移動を無視するためのカウンター */
  const dragEnterCountRef = useRef(0);

  /**
   * 挿入位置計算用の resolvedEntries。
   * - パレットからのD&D（draggingEntryUid === null）: resolvedEntries をそのまま再利用。
   *   既に App.tsx の resolveTimeline が計算した startTime / 各エントリの post-entry state
   *   （gcdAvailableAt / actionAvailableAt）をそのまま使う。
   * - タイムライン内D&D（draggingEntryUid !== null）: ドラッグ中エントリを除外した
   *   生エントリ列で resolveTimeline を再実行する。これにより「ドロップ後の並び」における
   *   各エントリの startTime と post-entry state が正確に得られ、パレットD&D時と
   *   同一アルゴリズムで算出されるため、インジケーター位置が必ず一致する。
   *
   * 再実行コストは draggingEntryUid 変化時のみ（ドラッグ開始/終了）で、
   * drag over の rAF コールバック内では useMemo のキャッシュを参照するだけ。
   */
  const insertionResolvedEntries = useMemo(() => {
    if (draggingEntryUid === null) return resolvedEntries;
    const filteredRaw = resolvedEntries
      .filter((e) => e.uid !== draggingEntryUid)
      .map((e) => ({ uid: e.uid, skillId: e.skillId }));
    return resolveTimeline(filteredRaw, skillMap, resources, stats, buffs, untargetableWindows, multiTargetWindows).entries;
  }, [resolvedEntries, draggingEntryUid, skillMap, resources, stats, buffs, untargetableWindows, multiTargetWindows]);

  /**
   * マウス位置と突き合わせる用の「見えている並び」。
   * タイムライン内D&D中は、画面に表示されているエントリは元の resolvedEntries の
   * startTime で配置されている（ドラッグ中エントリは半透明で残り、他は動かない）。
   * 一方 insertionResolvedEntries は「ドラッグ中エントリを除いた並びで再 resolve」した結果で、
   * 後続エントリの startTime が前詰めで左に寄っている。
   *
   * マウス位置は「見えている並び」に対するユーザー操作なので、calcInsertIndex での
   * 中央時刻判定は insertionResolvedEntries ではなくこの「見えている並び」で行う必要がある。
   * （insertionResolvedEntries で判定すると、マウスが見えている C-D 間にある時に
   *   論理上の D（=前詰めで C の右隣）より右と判定されてしまい、挿入位置が 1 つ右にズレる）
   *
   * 一方で uid 順序は insertionResolvedEntries と一致するため、calcInsertIndex が返す
   * idx は insertionResolvedEntries にもそのまま使える（indicatorX / drop target 特定）。
   */
  const visibleEntriesForInsert = useMemo(() => {
    if (draggingEntryUid === null) return resolvedEntries;
    return resolvedEntries.filter((e) => e.uid !== draggingEntryUid);
  }, [resolvedEntries, draggingEntryUid]);

  /** ドラッグ中のスキルタイプを検出 */
  const detectDragType = useCallback((e: React.DragEvent): "gcd" | "ogcd" => {
    return e.dataTransfer.types.includes("application/skill-type-gcd") ? "gcd" : "ogcd";
  }, []);

  /** ドラッグ元を検出（タイムライン内エントリのD&D か、パレットからの新規追加か） */
  const detectDragSource = useCallback((e: React.DragEvent): "timeline" | "palette" => {
    return e.dataTransfer.types.includes("application/timeline-entry-uid") ? "timeline" : "palette";
  }, []);

  const handleEntryDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, entry: { uid: string; skillId: string }, skill: Skill) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/timeline-entry-uid", entry.uid);
      e.dataTransfer.setData("application/skill-id", entry.skillId);
      e.dataTransfer.setData(`application/skill-type-${skill.type}`, "1");
      setDraggingEntryUid(entry.uid);
    },
    []
  );

  const handleEntryDragEnd = useCallback(() => {
    setDraggingEntryUid(null);
    setOverDeleteZone(false);
    setInsertIndex(null);
    setDragType(null);
    dragEnterCountRef.current = 0;
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }, []);

  const handleDeleteZoneDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("application/timeline-entry-uid")) return;
    setOverDeleteZone(true);
  }, []);

  const handleDeleteZoneDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/timeline-entry-uid")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDeleteZoneDragLeave = useCallback(() => {
    setOverDeleteZone(false);
  }, []);

  const handleDeleteZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const uid = e.dataTransfer.getData("application/timeline-entry-uid");
      setOverDeleteZone(false);
      setDraggingEntryUid(null);
      setInsertIndex(null);
      setDragType(null);
      if (uid) {
        shouldAutoScrollRef.current = false;
        onRemoveEntry(uid);
      }
    },
    [onRemoveEntry, shouldAutoScrollRef]
  );

  /**
   * 挿入位置計算用の GCDエントリ（タイムライン内D&D中はドラッグ中エントリを除外）。
   * ドラッグ中エントリを含めるとインデックス計算や no-op 判定でズレが生じるため、
   * 挿入計算は必ずこの除外版を参照する。
   */
  const insertionGcdResolvedEntries = useMemo(
    () => insertionResolvedEntries.filter((entry) => {
      const skill = skillMap.get(entry.skillId);
      return skill && skill.type === "gcd";
    }),
    [insertionResolvedEntries, skillMap]
  );

  /**
   * マウス位置判定用 GCD-only エントリ（見えている並び準拠）。
   * uid 順序は insertionGcdResolvedEntries と一致するため idx は互換。
   */
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
      if (gcdIdx >= insertionGcdResolvedEntries.length) {
        // 末尾に追加: 最後のGCD以降のoGCDも含めた末尾
        return insertionResolvedEntries.length;
      }
      // gcdIdx番目のGCDエントリの前に挿入
      const targetEntry = insertionGcdResolvedEntries[gcdIdx];
      return insertionResolvedEntries.findIndex((e) => e.uid === targetEntry.uid);
    },
    [insertionResolvedEntries, insertionGcdResolvedEntries]
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
   * ドラッグ中のマウス位置から挿入インデックス（insertionResolvedEntries上）を計算する。
   * マウス位置は「見えている並び」（resolvedEntries の startTime 準拠）に対する操作なので、
   * 中央時刻の比較は visibleEntriesForInsert / visibleGcdEntriesForInsert で行う。
   * 返される idx は uid 順序を揃えてあるので insertionResolvedEntries にもそのまま使える。
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragEnterCountRef.current++;
    setDragOver(true);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // ドラッグ元（パレット=copy / タイムライン内並び替え=move）に合わせる。
      // effectAllowed（dragstart で "copy" or "move" を設定）と dropEffect が不一致だと
      // ブラウザが drop を拒否し、handleDrop が発火せず並び替えが無言で失敗する。
      e.dataTransfer.dropEffect = detectDragSource(e) === "timeline" ? "move" : "copy";

      // rAFでスロットリング: 前フレームの更新がまだ処理中なら新しいリクエストをスキップ
      if (dragRafRef.current !== null) return;

      const type = detectDragType(e);
      const mouseX = scrollRef.current ? e.clientX - scrollRef.current.getBoundingClientRect().left : 0;
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;

      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        setDragType(type);

        if (scrollRef.current && insertionResolvedEntries.length > 0) {
          const idx = calcCombinedInsertIndex(mouseX, scrollLeft, type);
          setInsertIndex(idx);
        } else {
          setInsertIndex(null);
        }
      });
    },
    [insertionResolvedEntries, detectDragType, detectDragSource, calcCombinedInsertIndex, scrollRef]
  );

  const handleDragLeave = useCallback(() => {
    dragEnterCountRef.current--;
    if (dragEnterCountRef.current > 0) return;

    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    setDragOver(false);
    setInsertIndex(null);
    setDragType(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      dragEnterCountRef.current = 0;
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      e.preventDefault();
      setDragOver(false);

      const source = detectDragSource(e);
      const skillId = e.dataTransfer.getData("application/skill-id");
      if (!skillId) {
        setInsertIndex(null);
        setDragType(null);
        setDraggingEntryUid(null);
        return;
      }

      const skill = skillMap.get(skillId);
      const type: "gcd" | "ogcd" = skill?.type === "gcd" ? "gcd" : "ogcd";

      if (source === "timeline") {
        const movingUid = e.dataTransfer.getData("application/timeline-entry-uid");
        if (movingUid && scrollRef.current && insertionResolvedEntries.length > 0) {
          const rect = scrollRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const idx = calcCombinedInsertIndex(mouseX, scrollRef.current.scrollLeft, type);
          // insertionResolvedEntries はドラッグ中エントリを除外しているため、
          // ここで得られる targetEntry が自分自身になることはない（= 不要な no-op 判定が消える）
          const targetEntry = idx < insertionResolvedEntries.length ? insertionResolvedEntries[idx] : undefined;
          shouldAutoScrollRef.current = false;
          onMoveEntry(movingUid, targetEntry?.uid);
        }
      } else {
        if (scrollRef.current && insertionResolvedEntries.length > 0) {
          const rect = scrollRef.current.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const idx = calcCombinedInsertIndex(mouseX, scrollRef.current.scrollLeft, type);
          const isInsertMiddle = idx < insertionResolvedEntries.length;
          if (isInsertMiddle) {
            shouldAutoScrollRef.current = false;
          }
          onAddEntry(skillId, isInsertMiddle ? insertionResolvedEntries[idx].uid : undefined);
        } else {
          onAddEntry(skillId);
        }
      }

      setInsertIndex(null);
      setDragType(null);
      setDraggingEntryUid(null);
    },
    [onAddEntry, onMoveEntry, insertionResolvedEntries, skillMap, calcCombinedInsertIndex, detectDragSource, scrollRef, shouldAutoScrollRef]
  );

  /**
   * 挿入インジケーターのX座標。
   * 画面に描画されているエントリアイコンと同じ座標系で描画する必要があるため、
   * 「見えている並び」(visibleEntriesForInsert) の post-entry state を使う。
   *
   * insertionResolvedEntries（= ドラッグ中エントリを除いて再 resolve した結果）は
   * ドラッグ中エントリが抜けた分、後続エントリの startTime / gcdAvailableAt が前詰めされており、
   * これを indicatorX に使うと画面上のアイコンより 1 スロット分左にズレてしまう
   * （特に末尾側へドラッグした際に顕著で、最右スロットにインジケーターが出ない症状を引き起こす）。
   *
   * 一方 visibleEntriesForInsert は元 resolvedEntries をドラッグ中エントリだけフィルタした並びで、
   * 各エントリの startTime / gcdAvailableAt / actionAvailableAt は画面描画に使われている値と同一。
   * calcInsertIndex も visibleEntriesForInsert を基準に idx を決めているので、
   * idx と indicatorX の座標系が完全に一致する。
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
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleEntryDragStart,
    handleEntryDragEnd,
    handleDeleteZoneDragEnter,
    handleDeleteZoneDragOver,
    handleDeleteZoneDragLeave,
    handleDeleteZoneDrop,
  };
}
