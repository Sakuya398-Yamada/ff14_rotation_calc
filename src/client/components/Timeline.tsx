import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Skill, ResolvedTimelineEntry, ResourceDefinition, BuffDefinition, CharacterStats, DoTTick, ActiveDoT, BossUntargetableWindow, MultiTargetWindow, PpsRange } from "../types/skill";
import { calcGcd } from "../logic/stat-calc";
import { computeBuffTimespans } from "../logic/buff-timespans";
import { resolveTimeline } from "../logic/resolve-timeline";
import { PX_PER_SEC, LANE_LABEL_WIDTH } from "./timeline/constants";
import { styles } from "./timeline/styles";
import { calcInsertIndex } from "./timeline/helpers";
import { PpsRangeEditor } from "./timeline/PpsRangeEditor";
import { UntargetableWindowEditor } from "./timeline/UntargetableWindowEditor";
import { MultiTargetWindowEditor } from "./timeline/MultiTargetWindowEditor";
import { SkillLanes } from "./timeline/SkillLanes";
import { ResourceLanes } from "./timeline/ResourceLanes";
import { BuffLanes } from "./timeline/BuffLanes";
import { RecastLanes } from "./timeline/RecastLanes";
import { DotLanes } from "./timeline/DotLanes";
import { TimelineOverlays } from "./timeline/TimelineOverlays";
import { TimelineRuler } from "./timeline/TimelineRuler";
import { DeleteZone } from "./timeline/DeleteZone";
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

              <SkillLanes
                gcdEntries={gcdEntries}
                ogcdEntries={ogcdEntries}
                entriesWithErrors={entriesWithErrors}
                getResolvedEntryRecast={getResolvedEntryRecast}
                stats={stats}
                selectedEntryUid={selectedEntryUid}
                draggingEntryUid={draggingEntryUid}
                labelBg={labelBg}
                onSelectEntry={onSelectEntry}
                onEntryDragStart={handleEntryDragStart}
                onEntryDragEnd={handleEntryDragEnd}
              />

              {/* リソースゲージ行 */}
              {showResources && (
                <ResourceLanes
                  resourceGroups={resourceGroups}
                  resolvedEntries={resolvedEntries}
                  labelBg={labelBg}
                />
              )}

              {/* バフレーン */}
              {showBuffs && (
                <BuffLanes
                  buffs={buffs}
                  buffTimespans={buffTimespans}
                  totalDuration={totalDuration}
                  labelBg={labelBg}
                />
              )}

              {/* リキャストレーン */}
              {showRecasts && (
                <RecastLanes
                  cooldownSpans={cooldownSpans}
                  skillMap={skillMap}
                  labelBg={labelBg}
                />
              )}

              {/* DoTレーン */}
              {showDoTs && activeDoTs.length > 0 && (
                <DotLanes
                  activeDoTs={activeDoTs}
                  dotTicks={dotTicks}
                  skillMap={skillMap}
                  stats={stats}
                  labelBg={labelBg}
                />
              )}

              <TimelineOverlays
                untargetableWindows={untargetableWindows}
                multiTargetWindows={multiTargetWindows}
                ppsRange={ppsRange}
                showPpsRange={showPpsRange}
              />

              <TimelineRuler rulerTicks={rulerTicks} labelBg={labelBg} />
            </div>
          </div>
        )}
      </div>

      <div style={styles.hint}>
        タイムライン上のスキルをドラッグで並び替え／画面下部のエリアにドロップで削除
      </div>

      {draggingEntryUid !== null && (
        <DeleteZone
          overDeleteZone={overDeleteZone}
          onDragEnter={handleDeleteZoneDragEnter}
          onDragOver={handleDeleteZoneDragOver}
          onDragLeave={handleDeleteZoneDragLeave}
          onDrop={handleDeleteZoneDrop}
        />
      )}
    </div>
  );
}

