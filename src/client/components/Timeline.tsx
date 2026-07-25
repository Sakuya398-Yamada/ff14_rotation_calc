import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Skill, ResolvedTimelineEntry, ResourceDefinition, BuffDefinition, ActiveBuff, CharacterStats, DoTTick, ActiveDoT, BossUntargetableWindow, MultiTargetWindow, PpsRange } from "../types/skill";
import { calcGcd, calcExpectedMultiplier } from "../logic/stat-calc";
import { calcEntryPotencyBreakdown } from "../logic/expected-potency";
import { computeBuffTimespans } from "../logic/buff-timespans";
import { resolveTimeline } from "../logic/resolve-timeline";
import {
  PX_PER_SEC,
  ICON_SIZE,
  LANE_HEIGHT,
  RESOURCE_LANE_HEIGHT,
  BUFF_LANE_HEIGHT,
  DOT_LANE_HEIGHT,
  RECAST_LANE_HEIGHT,
  RULER_HEIGHT,
  LANE_LABEL_WIDTH,
  RESOURCE_DOT_SIZE,
  RESOURCE_DOT_GAP,
} from "./timeline/constants";
import { styles } from "./timeline/styles";
import { formatTargetBreakdown, calcInsertIndex } from "./timeline/helpers";
import { ManualStartTimeBadge } from "./timeline/ManualStartTimeBadge";
import { PpsRangeEditor } from "./timeline/PpsRangeEditor";
import { UntargetableWindowEditor } from "./timeline/UntargetableWindowEditor";
import { MultiTargetWindowEditor } from "./timeline/MultiTargetWindowEditor";
import "./timeline.css";

interface TimelineProps {
  skills: Skill[];
  allSkillMap: Map<string, Skill>;
  resolvedEntries: ResolvedTimelineEntry[];
  onAddEntry: (skillId: string, insertBeforeUid?: string) => void;
  onRemoveEntry: (uid: string) => void;
  onMoveEntry: (uid: string, insertBeforeUid?: string) => void;
  resources: ResourceDefinition[];
  buffs: BuffDefinition[];
  totalExpectedPotency: number;
  dotExpectedPotency: number;
  stats: CharacterStats;
  dotTicks: DoTTick[];
  activeDoTs: ActiveDoT[];
  untargetableWindows: BossUntargetableWindow[];
  onUntargetableWindowsChange: (windows: BossUntargetableWindow[]) => void;
  multiTargetWindows: MultiTargetWindow[];
  onMultiTargetWindowsChange: (windows: MultiTargetWindow[]) => void;
  overallPps: { pps: number; totalPotency: number; directPotency: number; dotPotency: number } | null;
  rangePps: { pps: number; totalPotency: number; directPotency: number; dotPotency: number } | null;
  ppsRange: PpsRange | null;
  onPpsRangeChange: (range: PpsRange | null) => void;
  lastGcdEndTime: number;
  selectedEntryUid: string | null;
  onSelectEntry: (uid: string | null) => void;
}

export function Timeline({
  skills,
  allSkillMap,
  resolvedEntries,
  onAddEntry,
  onRemoveEntry,
  onMoveEntry,
  resources,
  buffs,
  totalExpectedPotency,
  dotExpectedPotency,
  stats,
  dotTicks,
  activeDoTs,
  untargetableWindows,
  onUntargetableWindowsChange,
  multiTargetWindows,
  onMultiTargetWindowsChange,
  overallPps,
  rangePps,
  ppsRange,
  onPpsRangeChange,
  lastGcdEndTime,
  selectedEntryUid,
  onSelectEntry,
}: TimelineProps) {
  const [dragOver, setDragOver] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<"gcd" | "ogcd" | null>(null);
  /** タイムライン内ドラッグ中のエントリUID（null = パレットドラッグ中 or 非ドラッグ） */
  const [draggingEntryUid, setDraggingEntryUid] = useState<string | null>(null);
  /** 削除ドロップエリア上にカーソルがあるか */
  const [overDeleteZone, setOverDeleteZone] = useState(false);
  const [showResources, setShowResources] = useState(true);

  // リソースをdisplayGroupでグループ化（同じグループは1行にまとめる）
  const resourceGroups = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      resources: typeof resources;
      /** displayGroupPriority 昇順で並べたリソース（統合スロット描画時の充填順） */
      sortedResources: typeof resources;
      /** グループ合計の最大スタック数（統合スロット描画する場合のみ設定） */
      groupMaxStacks?: number;
      /** 統合スロット描画時の1行あたりドット数 */
      stacksPerRow?: number;
    }[] = [];
    const seen = new Set<string>();
    for (const res of resources) {
      if (res.displayGroup) {
        if (!seen.has(res.displayGroup)) {
          seen.add(res.displayGroup);
          const groupResources = resources.filter((r) => r.displayGroup === res.displayGroup);
          const groupMaxStacks = groupResources.find((r) => r.groupMaxStacks !== undefined)?.groupMaxStacks;
          const sortedResources = groupMaxStacks !== undefined
            ? [...groupResources].sort(
                (a, b) => (a.displayGroupPriority ?? Number.MAX_SAFE_INTEGER) - (b.displayGroupPriority ?? Number.MAX_SAFE_INTEGER)
              )
            : groupResources;
          const stacksPerRow = groupMaxStacks !== undefined
            ? sortedResources.find((r) => r.stacksPerRow !== undefined)?.stacksPerRow
            : undefined;
          groups.push({
            key: res.displayGroup,
            label: res.shortName,
            resources: groupResources,
            sortedResources,
            groupMaxStacks,
            stacksPerRow,
          });
        }
      } else {
        groups.push({ key: res.id, label: res.shortName, resources: [res], sortedResources: [res] });
      }
    }
    return groups;
  }, [resources]);
  const [showBuffs, setShowBuffs] = useState(true);
  const [showDoTs, setShowDoTs] = useState(true);
  const [showRecasts, setShowRecasts] = useState(true);
  const [showUntargetableEditor, setShowUntargetableEditor] = useState(false);
  const [showMultiTargetEditor, setShowMultiTargetEditor] = useState(false);
  const [showPpsRange, setShowPpsRange] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 末尾追加時のみ自動スクロールするためのフラグ */
  const shouldAutoScrollRef = useRef(true);
  /** ドラッグオーバーのrAFスロットリング用 */
  const dragRafRef = useRef<number | null>(null);
  /** dragenter/dragleaveの子要素間移動を無視するためのカウンター */
  const dragEnterCountRef = useRef(0);

  // パレット用のスキルマップ（ドラッグ判定用）
  const paletteSkillMap = useMemo(
    () => new Map(skills.map((s) => [s.id, s])),
    [skills]
  );
  // 全スキルマップ（autoTransform対象を含む表示・計算用）
  const skillMap = allSkillMap;

  const buffDefMap = useMemo(
    () => new Map(buffs.map((b) => [b.id, b])),
    [buffs]
  );

  const getRecastTime = useCallback(
    (skill: Skill) => {
      if (stats && skill.type === "gcd") {
        return calcGcd(skill.recastTime, stats);
      }
      return skill.recastTime;
    },
    [stats]
  );

  /** エントリのアクティブバフを考慮したリキャスト計算 */
  /**
   * 既存エントリのリキャスト時間を resolve-timeline 側の計算結果から取得する。
   * GCD: gcdAvailableAt - startTime（自スキル付与の speed バフは除外済み = 実機準拠）
   * oGCD: スキル固有の recastTime（gcdAvailableAt は前 GCD 由来のため使えない）
   *
   * 注意: entry.activeBuffs から自前で speed を再計算するのは NG。
   * activeBuffs は実行"直後"のバフを含むため、当該スキル自身が付与した speed
   * バフが二重計算されて視覚的なリキャストバーと resolve-timeline の startTime
   * が乖離する（侍の士風→風花のように、自スキルが付与する速度バフを持つ場合）。
   */
  const getResolvedEntryRecast = useCallback(
    (entry: ResolvedTimelineEntry, skill: Skill) => {
      if (skill.type === "gcd") {
        return Math.round((entry.gcdAvailableAt - entry.startTime) * 1000) / 1000;
      }
      return getRecastTime(skill);
    },
    [getRecastTime]
  );

  const gcdEntries: (ResolvedTimelineEntry & { skill: Skill; displaySkill: Skill })[] = [];
  const ogcdEntries: (ResolvedTimelineEntry & { skill: Skill; displaySkill: Skill })[] = [];
  for (const entry of resolvedEntries) {
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;
    // 自動変化後のスキルを表示用に取得（変化なしの場合はskillと同じ）
    const displaySkill = skillMap.get(entry.resolvedSkillId) ?? skill;
    if (skill.type === "gcd") {
      gcdEntries.push({ ...entry, skill, displaySkill });
    } else {
      ogcdEntries.push({ ...entry, skill, displaySkill });
    }
  }

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

  // 個別リキャスト（クールダウン）のスパン: skillId → [{startTime, endTime, skillName, icon}]
  const cooldownSpans = useMemo(() => {
    const spans: Map<string, { startTime: number; endTime: number; skillName: string; icon: string }[]> = new Map();
    for (const entry of resolvedEntries) {
      const skill = skillMap.get(entry.resolvedSkillId) ?? skillMap.get(entry.skillId);
      if (!skill || skill.cooldown === undefined) continue;
      // エラーなしで実行されたスキルのみクールダウンを記録
      if (entry.recastError || entry.resourceErrors.length > 0 || entry.comboErrors.length > 0 || entry.untargetableError) continue;
      if (!spans.has(skill.id)) {
        spans.set(skill.id, []);
      }
      spans.get(skill.id)!.push({
        startTime: entry.startTime,
        endTime: Math.round((entry.startTime + skill.cooldown) * 1000) / 1000,
        skillName: skill.name,
        icon: skill.icon,
      });
    }
    return spans;
  }, [resolvedEntries, skillMap]);

  // リキャスト付きスキルが存在するか
  const hasRecastSkills = cooldownSpans.size > 0;

  const totalDuration = useMemo(() => {
    if (resolvedEntries.length === 0) return 0;
    let maxEnd = 0;
    for (const entry of resolvedEntries) {
      const skill = skillMap.get(entry.skillId);
      if (!skill) continue;
      const end = entry.startTime + getResolvedEntryRecast(entry, skill);
      if (end > maxEnd) maxEnd = end;
      // バフ終了時刻も考慮（永続バフ= endTime が Infinity はタイムライン幅に影響させない）
      for (const ab of entry.activeBuffs) {
        if (!Number.isFinite(ab.endTime)) continue;
        if (ab.endTime > maxEnd) maxEnd = ab.endTime;
      }
    }
    // DoT終了時刻も考慮
    for (const dot of activeDoTs) {
      if (dot.endTime > maxEnd) maxEnd = dot.endTime;
    }
    // ボス離脱ウィンドウの終了時刻も考慮
    for (const w of untargetableWindows) {
      if (w.endTime > maxEnd) maxEnd = w.endTime;
    }
    // 複数体ウィンドウの終了時刻も考慮
    for (const w of multiTargetWindows) {
      if (w.endTime > maxEnd) maxEnd = w.endTime;
    }
    // 個別リキャストの終了時刻も考慮
    for (const spans of cooldownSpans.values()) {
      for (const span of spans) {
        if (span.endTime > maxEnd) maxEnd = span.endTime;
      }
    }
    return maxEnd;
  }, [resolvedEntries, skillMap, getResolvedEntryRecast, activeDoTs, untargetableWindows, multiTargetWindows, cooldownSpans]);

  const timelineWidth = Math.max(totalDuration * PX_PER_SEC + 100, 600);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const maxTime = Math.ceil(totalDuration + 1);
    for (let t = 0; t <= maxTime; t += 0.5) {
      ticks.push(t);
    }
    return ticks;
  }, [totalDuration]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      shouldAutoScrollRef.current = true;
      return;
    }
    if (scrollRef.current && resolvedEntries.length > 0) {
      const last = resolvedEntries[resolvedEntries.length - 1];
      const skill = skillMap.get(last.skillId);
      const recast = skill ? getResolvedEntryRecast(last, skill) : 0;
      const endPx = (last.startTime + recast) * PX_PER_SEC;
      const container = scrollRef.current;
      if (endPx > container.scrollLeft + container.clientWidth - 100) {
        container.scrollLeft = endPx - container.clientWidth + 150;
      }
    }
  }, [resolvedEntries, skillMap, getResolvedEntryRecast]);

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
    [onRemoveEntry]
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
    [insertionResolvedEntries, detectDragType, detectDragSource, calcCombinedInsertIndex]
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
    [onAddEntry, onMoveEntry, insertionResolvedEntries, skillMap, calcCombinedInsertIndex, detectDragSource]
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

  // ドラッグオーバー時のstickyラベル背景色（ドロップゾーンの黄色みと視覚的に一致させる）
  const labelBg = dragOver ? "#1b1921" : "#0f0f23";

  // タイムライン上の全バフ期間を収集（重複排除）。消費・排他解除時は実際に消えた時刻へクランプする
  const buffTimespans = useMemo(
    () => computeBuffTimespans(resolvedEntries, buffs),
    [resolvedEntries, buffs],
  );

  // リソースエラーまたはコンボエラーがあるエントリのUIDセット
  const entriesWithErrors = useMemo(() => {
    const set = new Set<string>();
    for (const entry of resolvedEntries) {
      if (entry.resourceErrors.length > 0 || entry.comboErrors.length > 0 || entry.untargetableError || entry.recastError) {
        set.add(entry.uid);
      }
    }
    return set;
  }, [resolvedEntries]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>タイムライン</h2>
        <div style={styles.headerControls}>
          <button
            style={{
              ...styles.toggleButton,
              ...(untargetableWindows.length > 0 ? { borderColor: "rgba(255, 80, 80, 0.5)", color: "#ef5350" } : {}),
            }}
            onClick={() => setShowUntargetableEditor((v) => !v)}
            title="ボス離脱タイミング設定"
          >
            {showUntargetableEditor ? "離脱 ▼" : "離脱 ▶"}
            {untargetableWindows.length > 0 && ` (${untargetableWindows.length})`}
          </button>
          <button
            style={{
              ...styles.toggleButton,
              ...(multiTargetWindows.length > 0 ? { borderColor: "rgba(180, 100, 220, 0.5)", color: "#b864dc" } : {}),
            }}
            onClick={() => setShowMultiTargetEditor((v) => !v)}
            title="複数体ウィンドウ設定（敵の数を指定する時間帯）"
          >
            {showMultiTargetEditor ? "複数体 ▼" : "複数体 ▶"}
            {multiTargetWindows.length > 0 && ` (${multiTargetWindows.length})`}
          </button>
          {activeDoTs.length > 0 && (
            <button
              style={styles.toggleButton}
              onClick={() => setShowDoTs((v) => !v)}
              title={showDoTs ? "DoT表示を非表示" : "DoT表示を表示"}
            >
              {showDoTs ? "DoT ▼" : "DoT ▶"}
            </button>
          )}
          {buffs.length > 0 && (
            <button
              style={styles.toggleButton}
              onClick={() => setShowBuffs((v) => !v)}
              title={showBuffs ? "バフ表示を非表示" : "バフ表示を表示"}
            >
              {showBuffs ? "バフ ▼" : "バフ ▶"}
            </button>
          )}
          {hasRecastSkills && (
            <button
              style={styles.toggleButton}
              onClick={() => setShowRecasts((v) => !v)}
              title={showRecasts ? "リキャスト表示を非表示" : "リキャスト表示を表示"}
            >
              {showRecasts ? "リキャスト ▼" : "リキャスト ▶"}
            </button>
          )}
          {resources.length > 0 && (
            <button
              style={styles.toggleButton}
              onClick={() => setShowResources((v) => !v)}
              title={showResources ? "リソースゲージを非表示" : "リソースゲージを表示"}
            >
              {showResources ? "リソース ▼" : "リソース ▶"}
            </button>
          )}
          <button
            style={{
              ...styles.toggleButton,
              ...(ppsRange ? { borderColor: "rgba(255, 183, 77, 0.5)", color: "#ffb74d" } : {}),
            }}
            onClick={() => {
              const next = !showPpsRange;
              setShowPpsRange(next);
              if (next && !ppsRange) {
                onPpsRangeChange({ startTime: 0, endTime: Math.max(lastGcdEndTime, 10) });
              }
              if (!next) {
                onPpsRangeChange(null);
              }
            }}
            title="PPS範囲選択"
          >
            {showPpsRange ? "PPS範囲 ▼" : "PPS範囲 ▶"}
          </button>
          <div style={styles.potencyDisplay}>
            {totalExpectedPotency > 0 && (
              <>
                期待威力: <span style={styles.potencyValue}>{totalExpectedPotency}</span>
                {dotExpectedPotency > 0 && (
                  <span style={{ fontSize: "13px", color: "#a5d6a7" }}>
                    {" "}(DoT: {dotExpectedPotency})
                  </span>
                )}
              </>
            )}
            {overallPps !== null && (
              <span style={styles.ppsDisplay}>
                {" "}PPS: <span style={styles.ppsValue}>{overallPps.pps.toFixed(2)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {showPpsRange && (
        <PpsRangeEditor
          ppsRange={ppsRange}
          onPpsRangeChange={onPpsRangeChange}
          lastGcdEndTime={lastGcdEndTime}
          rangePps={rangePps}
        />
      )}

      {showUntargetableEditor && (
        <UntargetableWindowEditor
          untargetableWindows={untargetableWindows}
          onUntargetableWindowsChange={onUntargetableWindowsChange}
        />
      )}

      {showMultiTargetEditor && (
        <MultiTargetWindowEditor
          multiTargetWindows={multiTargetWindows}
          onMultiTargetWindowsChange={onMultiTargetWindowsChange}
        />
      )}

      <div
        style={{
          ...styles.dropZone,
          ...(dragOver ? styles.dropZoneActive : {}),
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {resolvedEntries.length === 0 ? (
          <div style={styles.placeholder}>
            スキルパレットからドラッグ＆ドロップしてスキルを追加
          </div>
        ) : (
          <div ref={scrollRef} className="timeline-scroll" style={styles.scrollContainer}>
            <div style={{ ...styles.timelineContent, width: timelineWidth }}>
              {/* 挿入インジケーター */}
              {indicatorX !== null && (
                <div
                  style={{
                    ...styles.insertIndicator,
                    left: LANE_LABEL_WIDTH + indicatorX,
                  }}
                />
              )}

              {/* GCD行 */}
              <div style={styles.lane}>
                <div style={{ ...styles.laneLabel, backgroundColor: labelBg }}>GCD</div>
                <div style={styles.laneContent}>
                  {gcdEntries.map((entry) => {
                    const hasError = entriesWithErrors.has(entry.uid);
                    const recast = getResolvedEntryRecast(entry, entry.skill);
                    const castTime = entry.castTime;
                    const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
                    const breakdown = stats && entry.resolvedPotency > 0 && !hasError
                      ? calcEntryPotencyBreakdown(entry, entry.displaySkill, stats)
                      : null;
                    const expectedPot = breakdown ? breakdown.total : null;
                    const targetBreakdown = formatTargetBreakdown(breakdown);
                    const isAutoTransformed = entry.resolvedSkillId !== entry.skillId;
                    // castTime > recast の場合は次 GCD が打てるのは castTime 後（resolve-timeline.ts と整合）。
                    // skillBlock の幅を max(castTime, recast) に拡張し、各バーを blockDuration 基準で割合計算する。
                    const blockDuration = Math.max(castTime, recast);
                    return (
                      <div
                        key={entry.uid}
                        style={{
                          ...styles.skillBlock,
                          left: entry.startTime * PX_PER_SEC,
                          width: blockDuration * PX_PER_SEC,
                        }}
                      >
                        <div
                          style={{
                            ...styles.recastBar,
                            width: (recast / blockDuration) * 100 + "%",
                          }}
                          title={`リキャスト: ${recast}s`}
                        />
                        {castTime > 0 && (
                          <div
                            style={styles.castTimeBar}
                            title={`詠唱時間: ${castTime}s`}
                          >
                            <div
                              style={{
                                ...styles.castTimeFill,
                                width: (castTime / blockDuration) * 100 + "%",
                              }}
                            />
                          </div>
                        )}
                        <div
                          style={styles.animLockBar}
                          title={`アニメーションロック: ${entry.skill.animationLock}s`}
                        >
                          <div
                            style={{
                              ...styles.animLockFill,
                              width:
                                (entry.skill.animationLock / blockDuration) * 100 + "%",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            ...styles.skillIcon,
                            ...(hasError ? styles.skillIconError : {}),
                            ...(entry.wsComboError ? styles.skillIconComboWarning : {}),
                            ...(selectedEntryUid === entry.uid ? styles.skillIconSelected : {}),
                            ...(draggingEntryUid === entry.uid ? styles.skillIconDragging : {}),
                          }}
                          title={`${entry.displaySkill.name}${isAutoTransformed ? ` (← ${entry.skill.name})` : ""} (威力: ${buffedPotency}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / 期待値: ${expectedPot}${targetBreakdown}` : ""}) [${entry.startTime.toFixed(2)}s${entry.manualStartTime !== undefined ? " 手動" : ""}]${castTime > 0 ? ` 詠唱: ${castTime}s` : " インスタント"}${entry.wsComboError ? " ⚠ コンボ不成立" : ""}${entry.resourceErrors.length > 0 ? " ⚠ リソース不足" : ""}${entry.comboErrors.length > 0 ? " ⚠ バフ条件未達成" : ""}${entry.untargetableError ? " ⚠ ボス離脱中" : ""}${entry.recastError ? " ⚠ リキャスト中" : ""}`}
                          data-skill-entry-uid={entry.uid}
                          onClick={() => onSelectEntry(entry.uid)}
                          draggable
                          onDragStart={(e) => handleEntryDragStart(e, entry, entry.skill)}
                          onDragEnd={handleEntryDragEnd}
                        >
                          <img
                            src={entry.displaySkill.icon}
                            alt={entry.displaySkill.name}
                            style={styles.iconImage}
                            draggable={false}
                          />
                          {entry.manualStartTime !== undefined && (
                            <ManualStartTimeBadge />
                          )}
                        </div>
                        <div style={{
                          ...styles.skillPotency,
                          ...(entry.wsComboError ? { color: "#ff9800" } : {}),
                        }}>
                          {hasError ? "-" : (expectedPot !== null ? expectedPot : buffedPotency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* oGCD行 */}
              <div style={styles.lane}>
                <div style={{ ...styles.laneLabel, backgroundColor: labelBg }}>oGCD</div>
                <div style={styles.laneContent}>
                  {ogcdEntries.map((entry) => {
                    const hasError = entriesWithErrors.has(entry.uid);
                    const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
                    const breakdown = stats && entry.resolvedPotency > 0 && !hasError
                      ? calcEntryPotencyBreakdown(entry, entry.displaySkill, stats)
                      : null;
                    const expectedPot = breakdown ? breakdown.total : null;
                    const targetBreakdown = formatTargetBreakdown(breakdown);
                    return (
                      <div
                        key={entry.uid}
                        style={{
                          ...styles.ogcdBlock,
                          left: entry.startTime * PX_PER_SEC,
                        }}
                      >
                        <div
                          style={{
                            ...styles.ogcdIcon,
                            ...(hasError ? styles.ogcdIconError : {}),
                            ...(selectedEntryUid === entry.uid ? styles.ogcdIconSelected : {}),
                            ...(draggingEntryUid === entry.uid ? styles.ogcdIconDragging : {}),
                          }}
                          title={`${entry.displaySkill.name} (威力: ${buffedPotency}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / 期待値: ${expectedPot}${targetBreakdown}` : ""}) [${entry.startTime.toFixed(2)}s${entry.manualStartTime !== undefined ? " 手動" : ""}]${entry.resourceErrors.length > 0 ? " ⚠ リソース不足" : ""}${entry.comboErrors.length > 0 ? " ⚠ バフ条件未達成" : ""}${entry.untargetableError ? " ⚠ ボス離脱中" : ""}${entry.recastError ? " ⚠ リキャスト中" : ""}`}
                          data-skill-entry-uid={entry.uid}
                          onClick={() => onSelectEntry(entry.uid)}
                          draggable
                          onDragStart={(e) => handleEntryDragStart(e, entry, entry.skill)}
                          onDragEnd={handleEntryDragEnd}
                        >
                          <img
                            src={entry.displaySkill.icon}
                            alt={entry.displaySkill.name}
                            style={styles.iconImage}
                            draggable={false}
                          />
                          {entry.manualStartTime !== undefined && (
                            <ManualStartTimeBadge />
                          )}
                        </div>
                        <div style={styles.skillPotency}>
                          {hasError ? "-" : (expectedPot !== null ? expectedPot : buffedPotency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* リソースゲージ行 */}
              {showResources && resourceGroups.map((group) => (
                <div key={group.key} style={styles.resourceLane}>
                  <div style={{ ...styles.resourceLaneLabel, backgroundColor: labelBg }} title={group.resources.map((r) => r.name).join(" / ")}>
                    {group.label}
                  </div>
                  <div style={styles.resourceLaneContent}>
                    {resolvedEntries.map((entry) => {
                      const hasError = group.resources.some((r) => entry.resourceErrors.includes(r.id));
                      return (
                        <div
                          key={entry.uid}
                          style={{
                            ...styles.resourceMarker,
                            left: entry.startTime * PX_PER_SEC,
                          }}
                          title={
                            group.groupMaxStacks !== undefined
                              ? group.resources.map((r) => `${r.name}: ${entry.resourceSnapshot[r.id] ?? 0}`).join(" / ") +
                                ` (合計 ${group.resources.reduce((s, r) => s + (entry.resourceSnapshot[r.id] ?? 0), 0)}/${group.groupMaxStacks})` +
                                (hasError ? " (不足)" : "")
                              : group.resources.map((r) => `${r.name}: ${entry.resourceSnapshot[r.id] ?? 0}/${r.maxStacks}`).join(", ") +
                                (hasError ? " (不足)" : "")
                          }
                        >
                          <div style={styles.resourceDots}>
                            {group.groupMaxStacks !== undefined ? (() => {
                              // 統合スロット描画: displayGroupPriority 昇順でスロットを埋め、残りは空ドット
                              const groupMax = group.groupMaxStacks;
                              const slotColors: string[] = [];
                              for (const res of group.sortedResources) {
                                const count = entry.resourceSnapshot[res.id] ?? 0;
                                for (let i = 0; i < count && slotColors.length < groupMax; i++) {
                                  slotColors.push(res.color);
                                }
                              }
                              while (slotColors.length < groupMax) {
                                slotColors.push("rgba(255,255,255,0.15)");
                              }
                              const stacksPerRow = group.stacksPerRow ?? groupMax;
                              const gridWidth = stacksPerRow * RESOURCE_DOT_SIZE + (stacksPerRow - 1) * RESOURCE_DOT_GAP;
                              return (
                                <div style={{ ...styles.resourceDotGrid, width: gridWidth }}>
                                  {slotColors.map((color, i) => (
                                    <div
                                      key={i}
                                      style={{ ...styles.resourceDot, backgroundColor: color }}
                                    />
                                  ))}
                                </div>
                              );
                            })() : group.resources.map((res) => {
                              const count = entry.resourceSnapshot[res.id] ?? 0;
                              if (res.maxStacks > 10) {
                                return (
                                  <div key={res.id} style={styles.resourceGauge}>
                                    <div
                                      style={{
                                        ...styles.resourceGaugeFill,
                                        width: `${(count / res.maxStacks) * 100}%`,
                                        backgroundColor: res.color,
                                      }}
                                    />
                                    <span style={styles.resourceGaugeLabel}>{count}</span>
                                  </div>
                                );
                              }
                              const stacksPerRow = res.stacksPerRow ?? res.maxStacks;
                              const gridWidth = stacksPerRow * RESOURCE_DOT_SIZE + (stacksPerRow - 1) * RESOURCE_DOT_GAP;
                              return (
                                <div
                                  key={res.id}
                                  style={{
                                    ...styles.resourceDotGrid,
                                    width: gridWidth,
                                  }}
                                >
                                  {Array.from({ length: res.maxStacks }, (_, i) => (
                                    <div
                                      key={`${res.id}-${i}`}
                                      style={{
                                        ...styles.resourceDot,
                                        backgroundColor:
                                          i < count
                                            ? res.color
                                            : "rgba(255,255,255,0.15)",
                                      }}
                                    />
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                          {hasError && (
                            <div style={styles.resourceErrorMark}>!</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* バフレーン */}
              {showBuffs && buffs.map((buffDef) => {
                const spans = buffTimespans.get(buffDef.id);
                if (!spans || spans.length === 0) return null;
                return (
                  <div key={buffDef.id} style={styles.buffLane}>
                    <div style={{ ...styles.buffLaneLabel, backgroundColor: labelBg }} title={buffDef.name}>
                      {buffDef.shortName}
                    </div>
                    <div style={styles.buffLaneContent}>
                      {spans.map((span, i) => {
                        // 永続バフ（endTime = Infinity）はタイムライン末尾でキャップ
                        const isPermanent = !Number.isFinite(span.endTime);
                        const effectiveEnd = isPermanent ? totalDuration : span.endTime;
                        const left = span.startTime * PX_PER_SEC;
                        const width = Math.max(0, (effectiveEnd - span.startTime) * PX_PER_SEC);
                        const stacksLabel = buffDef.maxStacks && span.stacks !== undefined
                          ? ` x${span.stacks}`
                          : "";
                        const endTimeLabel = isPermanent ? "∞" : `${span.endTime.toFixed(2)}s`;
                        const durationLabel = buffDef.maxStacks
                          ? `x${span.stacks ?? buffDef.maxStacks}`
                          : buffDef.duration === null
                            ? "∞"
                            : `${buffDef.duration}s`;
                        return (
                          <div
                            key={i}
                            style={{
                              ...styles.buffBar,
                              left,
                              width,
                              backgroundColor: `${buffDef.color}30`,
                              borderColor: buffDef.color,
                            }}
                            title={`${buffDef.name}${stacksLabel} (${span.startTime.toFixed(2)}s - ${endTimeLabel})`}
                          >
                            <img
                              src={buffDef.icon}
                              alt={buffDef.name}
                              style={styles.buffIcon}
                            />
                            <span style={{ ...styles.buffDuration, color: buffDef.color }}>
                              {durationLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* リキャストレーン */}
              {showRecasts && Array.from(cooldownSpans.entries()).map(([skillId, spans]) => {
                const skill = skillMap.get(skillId);
                const label = skill?.name ?? skillId;
                return (
                  <div key={`recast-${skillId}`} style={styles.recastLane}>
                    <div style={{ ...styles.recastLaneLabel, backgroundColor: labelBg }} title={`${label} リキャスト`}>
                      RC
                      {skill?.icon && (
                        <img
                          src={skill.icon}
                          alt={label}
                          style={styles.recastLabelIcon}
                        />
                      )}
                    </div>
                    <div style={styles.recastLaneContent}>
                      {spans.map((span, i) => {
                        const left = span.startTime * PX_PER_SEC;
                        const width = (span.endTime - span.startTime) * PX_PER_SEC;
                        return (
                          <div
                            key={i}
                            style={{
                              ...styles.cooldownBar,
                              left,
                              width,
                            }}
                            title={`${span.skillName} リキャスト (${span.startTime.toFixed(2)}s - ${span.endTime.toFixed(2)}s / ${skill?.cooldown}s)`}
                          >
                            <img
                              src={span.icon}
                              alt={span.skillName}
                              style={styles.recastIcon}
                            />
                            <span style={styles.recastDuration}>
                              {skill?.cooldown}s
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* DoTレーン */}
              {showDoTs && activeDoTs.length > 0 && (() => {
                // スキルIDごとにDoTをグループ化
                const dotBySkill = new Map<string, ActiveDoT[]>();
                for (const dot of activeDoTs) {
                  if (!dotBySkill.has(dot.skillId)) {
                    dotBySkill.set(dot.skillId, []);
                  }
                  dotBySkill.get(dot.skillId)!.push(dot);
                }

                return Array.from(dotBySkill.entries()).map(([skillId, dots]) => {
                  const skill = skillMap.get(skillId);
                  const label = skill?.name ?? skillId;
                  const ticksForSkill = dotTicks.filter((t) => t.skillId === skillId);

                  return (
                    <div key={`dot-${skillId}`} style={styles.dotLane}>
                      <div style={{ ...styles.dotLaneLabel, backgroundColor: labelBg }} title={`${label} DoT`}>
                        DoT
                      </div>
                      <div style={styles.dotLaneContent}>
                        {dots.map((dot, i) => {
                          const left = dot.startTime * PX_PER_SEC;
                          const width = (dot.endTime - dot.startTime) * PX_PER_SEC;
                          return (
                            <div
                              key={i}
                              style={{
                                ...styles.dotBar,
                                left,
                                width,
                              }}
                              title={`${label} DoT (${dot.potency}威力/tick${dot.buffMultiplier !== 1 ? ` x${dot.buffMultiplier.toFixed(2)}` : ""}) ${dot.startTime.toFixed(2)}s - ${dot.endTime.toFixed(2)}s`}
                            >
                              <img
                                src={dot.icon}
                                alt={label}
                                style={styles.dotIcon}
                              />
                              <span style={styles.dotDuration}>
                                {dot.potency}{dot.buffMultiplier !== 1 ? `x${dot.buffMultiplier.toFixed(1)}` : ""}
                              </span>
                            </div>
                          );
                        })}
                        {/* DoTティックマーカー */}
                        {ticksForSkill.map((tick, i) => (
                          <div
                            key={`tick-${i}`}
                            style={{
                              ...styles.dotTickMarker,
                              left: tick.time * PX_PER_SEC,
                            }}
                            title={`DoTティック: ${tick.potency}威力${tick.critRateBonus > 0 || tick.dhRateBonus > 0 ? ` (CRT+${Math.round(tick.critRateBonus * 100)}%${tick.dhRateBonus > 0 ? ` DH+${Math.round(tick.dhRateBonus * 100)}%` : ""})` : ""} @ ${tick.time.toFixed(2)}s${stats ? ` / 期待値: ${Math.floor(tick.potency * calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus))}` : ""}`}
                          >
                            <div style={styles.dotTickLine} />
                            <div style={styles.dotTickPotency}>
                              {stats ? Math.floor(tick.potency * calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus)) : tick.potency}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* ボス離脱ウィンドウ */}
              {untargetableWindows.map((w, i) => {
                const left = LANE_LABEL_WIDTH + w.startTime * PX_PER_SEC;
                const width = (w.endTime - w.startTime) * PX_PER_SEC;
                return (
                  <div
                    key={`untargetable-${i}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: RULER_HEIGHT,
                      left,
                      width,
                      backgroundColor: "rgba(255, 80, 80, 0.12)",
                      borderLeft: "2px solid rgba(255, 80, 80, 0.5)",
                      borderRight: "2px solid rgba(255, 80, 80, 0.5)",
                      zIndex: 5,
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      paddingTop: "2px",
                    }}
                    title={`ボス離脱 (${w.startTime}s - ${w.endTime}s)`}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "rgba(255, 80, 80, 0.8)",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}
                    >
                      離脱
                    </span>
                  </div>
                );
              })}

              {/* 複数体ウィンドウ */}
              {multiTargetWindows.map((w, i) => {
                const left = LANE_LABEL_WIDTH + w.startTime * PX_PER_SEC;
                const width = (w.endTime - w.startTime) * PX_PER_SEC;
                return (
                  <div
                    key={`multi-target-${i}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: RULER_HEIGHT,
                      left,
                      width,
                      backgroundColor: "rgba(180, 100, 220, 0.12)",
                      borderLeft: "2px solid rgba(180, 100, 220, 0.5)",
                      borderRight: "2px solid rgba(180, 100, 220, 0.5)",
                      zIndex: 4,
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      paddingTop: "2px",
                    }}
                    title={`複数体 ×${w.targetCount} (${w.startTime}s - ${w.endTime}s)`}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "rgba(180, 100, 220, 0.9)",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}
                    >
                      ×{w.targetCount}
                    </span>
                  </div>
                );
              })}

              {/* PPS範囲選択オーバーレイ */}
              {ppsRange && showPpsRange && (() => {
                const left = LANE_LABEL_WIDTH + ppsRange.startTime * PX_PER_SEC;
                const width = (ppsRange.endTime - ppsRange.startTime) * PX_PER_SEC;
                return (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: RULER_HEIGHT,
                      left,
                      width,
                      backgroundColor: "rgba(255, 183, 77, 0.08)",
                      borderLeft: "2px solid rgba(255, 183, 77, 0.6)",
                      borderRight: "2px solid rgba(255, 183, 77, 0.6)",
                      zIndex: 4,
                      pointerEvents: "none",
                    }}
                    title={`PPS範囲 (${ppsRange.startTime}s - ${ppsRange.endTime}s)`}
                  />
                );
              })()}

              {/* 時間軸ルーラー */}
              <div style={styles.ruler}>
                <div style={{ ...styles.rulerLabel, backgroundColor: labelBg }} />
                <div style={styles.rulerContent}>
                  {rulerTicks.map((t) => {
                    const isMajor = t % 1 === 0;
                    return (
                      <div
                        key={t}
                        style={{
                          ...styles.rulerTick,
                          left: t * PX_PER_SEC,
                          height: isMajor ? "12px" : "6px",
                        }}
                      >
                        <div style={styles.rulerTickLine} />
                        {isMajor && (
                          <div style={styles.rulerTickLabel}>{t}s</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.hint}>
        タイムライン上のスキルをドラッグで並び替え／画面下部のエリアにドロップで削除
      </div>

      {draggingEntryUid !== null && (
        <div
          style={{
            ...styles.deleteDropZone,
            ...(overDeleteZone ? styles.deleteDropZoneActive : {}),
          }}
          onDragEnter={handleDeleteZoneDragEnter}
          onDragOver={handleDeleteZoneDragOver}
          onDragLeave={handleDeleteZoneDragLeave}
          onDrop={handleDeleteZoneDrop}
        >
          <div style={styles.deleteDropZoneIcon} aria-hidden>×</div>
          <div style={styles.deleteDropZoneLabel}>ここにドロップして削除</div>
        </div>
      )}
    </div>
  );
}

