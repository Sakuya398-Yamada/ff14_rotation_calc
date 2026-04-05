import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Skill, ResolvedTimelineEntry, ResourceDefinition, BuffDefinition, ActiveBuff, CharacterStats, DoTTick, ActiveDoT, BossUntargetableWindow, PpsRange } from "../types/skill";
import { calcGcd, calcExpectedMultiplier } from "../logic/stat-calc";
import "./timeline.css";

/** 1秒あたりのピクセル数 */
const PX_PER_SEC = 80;

/** スキルアイコンのサイズ（px） */
const ICON_SIZE = 40;

/** レーンの高さ（px） */
const LANE_HEIGHT = 72;

/** リソースレーンの高さ（px） */
const RESOURCE_LANE_HEIGHT = 36;

/** バフレーンの高さ（px） */
const BUFF_LANE_HEIGHT = 32;

/** DoTレーンの高さ（px） */
const DOT_LANE_HEIGHT = 36;

/** リキャストレーンの高さ（px） */
const RECAST_LANE_HEIGHT = 28;

/** 時間軸の高さ（px） */
const RULER_HEIGHT = 28;

/** レーンラベルの幅（px） */
const LANE_LABEL_WIDTH = 52;

/** リソースドットのサイズ（px） */
const RESOURCE_DOT_SIZE = 10;

interface TimelineProps {
  skills: Skill[];
  allSkillMap: Map<string, Skill>;
  resolvedEntries: ResolvedTimelineEntry[];
  onAddEntry: (skillId: string, insertBeforeUid?: string) => void;
  onRemoveEntry: (uid: string) => void;
  resources: ResourceDefinition[];
  buffs: BuffDefinition[];
  totalExpectedPotency: number;
  dotExpectedPotency: number;
  stats: CharacterStats;
  dotTicks: DoTTick[];
  activeDoTs: ActiveDoT[];
  untargetableWindows: BossUntargetableWindow[];
  onUntargetableWindowsChange: (windows: BossUntargetableWindow[]) => void;
  overallPps: { pps: number; totalPotency: number; directPotency: number; dotPotency: number } | null;
  rangePps: { pps: number; totalPotency: number; directPotency: number; dotPotency: number } | null;
  ppsRange: PpsRange | null;
  onPpsRangeChange: (range: PpsRange | null) => void;
  lastGcdEndTime: number;
}

/**
 * ドラッグ中のマウスX座標から挿入インデックスを計算する。
 * resolvedEntriesの各エントリの中央位置と比較し、挿入位置を決定する。
 */
function calcInsertIndex(
  mouseX: number,
  scrollLeft: number,
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>,
  recastFn: (skill: Skill, activeBuffs: ActiveBuff[]) => number
): number {
  // タイムラインコンテンツ上の実際のX座標（スクロール考慮、レーンラベル分を引く）
  const contentX = mouseX + scrollLeft - LANE_LABEL_WIDTH;
  const time = contentX / PX_PER_SEC;

  if (resolvedEntries.length === 0) return 0;

  // 各エントリの中央時刻と比較して挿入位置を決定
  for (let i = 0; i < resolvedEntries.length; i++) {
    const entry = resolvedEntries[i];
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;
    const centerTime = entry.startTime + recastFn(skill, entry.activeBuffs) / 2;
    if (time < centerTime) {
      return i;
    }
  }

  // 末尾に追加
  return resolvedEntries.length;
}

/** タイムラインの各エントリ処理後の状態 */
interface TimelineState {
  gcdAvailableAt: number;
  actionAvailableAt: number;
}

export function Timeline({
  skills,
  allSkillMap,
  resolvedEntries,
  onAddEntry,
  onRemoveEntry,
  resources,
  buffs,
  totalExpectedPotency,
  dotExpectedPotency,
  stats,
  dotTicks,
  activeDoTs,
  untargetableWindows,
  onUntargetableWindowsChange,
  overallPps,
  rangePps,
  ppsRange,
  onPpsRangeChange,
  lastGcdEndTime,
}: TimelineProps) {
  const [dragOver, setDragOver] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<"gcd" | "ogcd" | null>(null);
  const [showResources, setShowResources] = useState(true);

  // リソースをdisplayGroupでグループ化（同じグループは1行にまとめる）
  const resourceGroups = useMemo(() => {
    const groups: { key: string; label: string; resources: typeof resources }[] = [];
    const seen = new Set<string>();
    for (const res of resources) {
      if (res.displayGroup) {
        if (!seen.has(res.displayGroup)) {
          seen.add(res.displayGroup);
          groups.push({
            key: res.displayGroup,
            label: res.shortName,
            resources: resources.filter((r) => r.displayGroup === res.displayGroup),
          });
        }
      } else {
        groups.push({ key: res.id, label: res.shortName, resources: [res] });
      }
    }
    return groups;
  }, [resources]);
  const [showBuffs, setShowBuffs] = useState(true);
  const [showDoTs, setShowDoTs] = useState(true);
  const [showRecasts, setShowRecasts] = useState(true);
  const [showUntargetableEditor, setShowUntargetableEditor] = useState(false);
  const [showPpsRange, setShowPpsRange] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 末尾追加時のみ自動スクロールするためのフラグ */
  const shouldAutoScrollRef = useRef(true);
  /** ドラッグオーバーのrAFスロットリング用 */
  const dragRafRef = useRef<number | null>(null);
  /** dragenter/dragleaveの子要素間移動を無視するためのカウンター */
  const dragEnterCountRef = useRef(0);

  const handleRemoveEntry = useCallback(
    (uid: string) => {
      shouldAutoScrollRef.current = false;
      onRemoveEntry(uid);
    },
    [onRemoveEntry]
  );

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
  const getEntryRecastTime = useCallback(
    (skill: Skill, activeBuffs: ActiveBuff[]) => {
      let recast = getRecastTime(skill);
      if (skill.type === "gcd" && activeBuffs.length > 0) {
        for (const ab of activeBuffs) {
          const def = buffDefMap.get(ab.buffId);
          if (!def) continue;
          for (const effect of def.effects) {
            if (effect.type === "speed") {
              recast = Math.round(recast * effect.value * 1000) / 1000;
            }
          }
        }
      }
      return recast;
    },
    [getRecastTime, buffDefMap]
  );

  /** エントリのアクティブバフを考慮した詠唱時間計算 */
  const getEntryCastTime = useCallback(
    (skill: Skill, activeBuffs: ActiveBuff[]) => {
      if (!skill.castTime) return 0;
      let cast = skill.castTime;
      if (skill.type === "gcd" && activeBuffs.length > 0) {
        for (const ab of activeBuffs) {
          const def = buffDefMap.get(ab.buffId);
          if (!def) continue;
          for (const effect of def.effects) {
            if (effect.type === "speed") {
              cast = Math.round(cast * effect.value * 1000) / 1000;
            }
          }
        }
      }
      return cast;
    },
    [buffDefMap]
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
   * 各エントリ処理後のタイムライン状態（gcdAvailableAt, actionAvailableAt）を事前計算。
   * 挿入インジケーターの正確な位置算出に使用する。
   * states[i] = entry[i]処理後の状態。挿入位置idxの開始時刻算出にはstates[idx-1]を参照。
   */
  const timelineStateAtIndex = useMemo(() => {
    const states: TimelineState[] = [];
    let gcdAvailableAt = 0;
    let actionAvailableAt = 0;

    for (const entry of resolvedEntries) {
      const skill = skillMap.get(entry.skillId);
      if (!skill) {
        states.push({ gcdAvailableAt, actionAvailableAt });
        continue;
      }

      if (skill.type === "gcd") {
        const recast = getEntryRecastTime(skill, entry.activeBuffs);
        const castTime = getEntryCastTime(skill, entry.activeBuffs);
        gcdAvailableAt = entry.startTime + recast;
        actionAvailableAt = entry.startTime + Math.max(castTime, skill.animationLock);
      } else {
        actionAvailableAt = entry.startTime + skill.animationLock;
      }

      states.push({ gcdAvailableAt, actionAvailableAt });
    }

    return states;
  }, [resolvedEntries, skillMap, getEntryRecastTime, getEntryCastTime]);

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
      const end = entry.startTime + getEntryRecastTime(skill, entry.activeBuffs);
      if (end > maxEnd) maxEnd = end;
      // バフ終了時刻も考慮
      for (const ab of entry.activeBuffs) {
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
    // 個別リキャストの終了時刻も考慮
    for (const spans of cooldownSpans.values()) {
      for (const span of spans) {
        if (span.endTime > maxEnd) maxEnd = span.endTime;
      }
    }
    return maxEnd;
  }, [resolvedEntries, skillMap, getEntryRecastTime, activeDoTs, untargetableWindows, cooldownSpans]);

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
      const recast = skill ? getEntryRecastTime(skill, last.activeBuffs) : 0;
      const endPx = (last.startTime + recast) * PX_PER_SEC;
      const container = scrollRef.current;
      if (endPx > container.scrollLeft + container.clientWidth - 100) {
        container.scrollLeft = endPx - container.clientWidth + 150;
      }
    }
  }, [resolvedEntries, skillMap, getEntryRecastTime]);

  /** ドラッグ中のスキルタイプを検出 */
  const detectDragType = useCallback((e: React.DragEvent): "gcd" | "ogcd" => {
    return e.dataTransfer.types.includes("application/skill-type-gcd") ? "gcd" : "ogcd";
  }, []);

  /** GCDエントリのみをフィルタ */
  const gcdResolvedEntries = useMemo(
    () => resolvedEntries.filter((entry) => {
      const skill = skillMap.get(entry.skillId);
      return skill && skill.type === "gcd";
    }),
    [resolvedEntries, skillMap]
  );

  /** GCDフィルタ済みインデックスを全エントリ上のインデックスに変換 */
  const mapGcdIndexToCombined = useCallback(
    (gcdIdx: number): number => {
      if (gcdIdx >= gcdResolvedEntries.length) {
        // 末尾に追加: 最後のGCD以降のoGCDも含めた全エントリの末尾
        return resolvedEntries.length;
      }
      // gcdIdx番目のGCDエントリの前に挿入
      const targetEntry = gcdResolvedEntries[gcdIdx];
      return resolvedEntries.findIndex((e) => e.uid === targetEntry.uid);
    },
    [resolvedEntries, gcdResolvedEntries]
  );

  /**
   * oGCD挿入用の幅関数: アニメーションロックを基準にする。
   * GCDのリキャスト幅（2.5s）ではなく、アニメーションロック（0.65s）を使うことで、
   * GCDリキャスト中のウィービング位置を正しく判定する。
   */
  const getAnimLockWidth = useCallback(
    (skill: Skill, _activeBuffs: ActiveBuff[]): number => skill.animationLock,
    []
  );

  /**
   * ドラッグ中のマウス位置から挿入インデックス（resolvedEntries上）を計算する。
   * GCD: GCDエントリのみで計算し、combined変換（GCDリキャスト境界間に配置）
   * oGCD: 全エントリで計算、アニメーションロック基準の中央で判定（ウィービング対応）
   */
  const calcCombinedInsertIndex = useCallback(
    (mouseX: number, scrollLeft: number, type: "gcd" | "ogcd"): number => {
      if (type === "gcd") {
        const gcdIdx = calcInsertIndex(mouseX, scrollLeft, gcdResolvedEntries, skillMap, getEntryRecastTime);
        return mapGcdIndexToCombined(gcdIdx);
      }
      return calcInsertIndex(mouseX, scrollLeft, resolvedEntries, skillMap, getAnimLockWidth);
    },
    [resolvedEntries, gcdResolvedEntries, skillMap, getEntryRecastTime, getAnimLockWidth, mapGcdIndexToCombined]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragEnterCountRef.current++;
    setDragOver(true);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";

      // rAFでスロットリング: 前フレームの更新がまだ処理中なら新しいリクエストをスキップ
      if (dragRafRef.current !== null) return;

      const type = detectDragType(e);
      const mouseX = scrollRef.current ? e.clientX - scrollRef.current.getBoundingClientRect().left : 0;
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;

      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        setDragType(type);

        if (scrollRef.current && resolvedEntries.length > 0) {
          const idx = calcCombinedInsertIndex(mouseX, scrollLeft, type);
          setInsertIndex(idx);
        } else {
          setInsertIndex(null);
        }
      });
    },
    [resolvedEntries, detectDragType, calcCombinedInsertIndex]
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

      const skillId = e.dataTransfer.getData("application/skill-id");
      if (!skillId) {
        setInsertIndex(null);
        setDragType(null);
        return;
      }

      if (scrollRef.current && resolvedEntries.length > 0) {
        const rect = scrollRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const skill = skillMap.get(skillId);
        const type: "gcd" | "ogcd" = skill?.type === "gcd" ? "gcd" : "ogcd";
        const idx = calcCombinedInsertIndex(mouseX, scrollRef.current.scrollLeft, type);
        const isInsertMiddle = idx < resolvedEntries.length;
        if (isInsertMiddle) {
          shouldAutoScrollRef.current = false;
        }
        onAddEntry(skillId, isInsertMiddle ? resolvedEntries[idx].uid : undefined);
      } else {
        onAddEntry(skillId);
      }
      setInsertIndex(null);
      setDragType(null);
    },
    [onAddEntry, resolvedEntries, skillMap, calcCombinedInsertIndex]
  );

  /**
   * 挿入インジケーターのX座標。
   * A方式: 挿入後にスキルが実際に配置される位置（最速実行可能時刻）を表示する。
   * 事前計算済みのtimelineStateAtIndexを使い、resolveTimelineと同じロジックで開始時刻を算出。
   */
  const indicatorX = useMemo(() => {
    if (insertIndex === null || dragType === null) return null;

    let startTime: number;
    if (insertIndex <= 0) {
      // 先頭に挿入: 時刻0から開始
      startTime = 0;
    } else {
      const prevState = timelineStateAtIndex[insertIndex - 1];
      if (!prevState) {
        startTime = 0;
      } else if (dragType === "gcd") {
        // GCD: max(GCDリキャスト明け, 直前アクション硬直明け)
        startTime = Math.max(prevState.gcdAvailableAt, prevState.actionAvailableAt);
      } else {
        // oGCD: 直前アクション硬直明け
        startTime = prevState.actionAvailableAt;
      }
    }

    return startTime * PX_PER_SEC;
  }, [insertIndex, dragType, timelineStateAtIndex]);

  // ドラッグオーバー時のstickyラベル背景色（ドロップゾーンの黄色みと視覚的に一致させる）
  const labelBg = dragOver ? "#1b1921" : "#0f0f23";

  // タイムライン上の全バフ期間を収集（重複排除）
  // スタック付きバフの場合、スタックが0になった時点でバフ終了とみなす
  const buffTimespans = useMemo(() => {
    const spans: Map<string, ActiveBuff[]> = new Map();
    const stackableBuffIds = new Set(buffs.filter((b) => b.maxStacks).map((b) => b.id));
    const exclusiveGroupBuffIds = new Set(buffs.filter((b) => b.exclusiveGroup).map((b) => b.id));
    // 早期終了の可能性があるバフ（スタック消費 or 排他グループによる解除）
    const earlyTerminationBuffIds = new Set([...stackableBuffIds, ...exclusiveGroupBuffIds]);

    for (const entry of resolvedEntries) {
      for (const ab of entry.activeBuffs) {
        if (!spans.has(ab.buffId)) {
          spans.set(ab.buffId, []);
        }
        const list = spans.get(ab.buffId)!;

        if (stackableBuffIds.has(ab.buffId)) {
          // スタック付きバフ: 同じ開始時刻のものは更新しない（初回のみ追加）
          if (!list.some((s) => s.startTime === ab.startTime)) {
            list.push({ ...ab });
          }
        } else {
          // 通常バフ: 同じ開始・終了時刻のものは重複追加しない
          if (!list.some((s) => s.startTime === ab.startTime && s.endTime === ab.endTime)) {
            list.push(ab);
          }
        }
      }
    }

    // スタック消費 or 排他グループ解除によるバフの実際の終了時刻を算出
    for (const [buffId, spanList] of spans) {
      if (!earlyTerminationBuffIds.has(buffId)) continue;
      for (const span of spanList) {
        let lastSeenTime = span.startTime;
        for (const entry of resolvedEntries) {
          const match = entry.activeBuffs.find(
            (ab) => ab.buffId === buffId && ab.startTime === span.startTime
          );
          if (match) {
            lastSeenTime = entry.startTime;
          }
        }
        // スタック消費で終了した場合、最後に確認されたエントリの時刻を終了時刻とする
        if (lastSeenTime < span.endTime) {
          // 次のエントリでバフが消えたか確認
          const allTimes = resolvedEntries.map((e) => e.startTime).sort((a, b) => a - b);
          const nextTimeIdx = allTimes.findIndex((t) => t > lastSeenTime);
          if (nextTimeIdx >= 0) {
            const nextEntry = resolvedEntries.find((e) => e.startTime === allTimes[nextTimeIdx]);
            const stillActive = nextEntry?.activeBuffs.some(
              (ab) => ab.buffId === buffId && ab.startTime === span.startTime
            );
            if (!stillActive) {
              span.endTime = allTimes[nextTimeIdx];
            }
          }
        }
      }
    }

    return spans;
  }, [resolvedEntries, buffs]);

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
        <div style={styles.ppsRangeEditor}>
          <div style={styles.ppsRangeHeader}>
            <span style={styles.ppsRangeTitle}>PPS範囲選択</span>
          </div>
          <div style={styles.ppsRangeRow}>
            <label style={styles.ppsRangeLabel}>
              開始:
              <input
                type="number"
                step="0.5"
                min="0"
                value={ppsRange?.startTime ?? 0}
                style={styles.ppsRangeInput}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val) || val < 0) return;
                  onPpsRangeChange({
                    startTime: val,
                    endTime: ppsRange?.endTime ?? lastGcdEndTime,
                  });
                }}
              />
              s
            </label>
            <label style={styles.ppsRangeLabel}>
              終了:
              <input
                type="number"
                step="0.5"
                min="0"
                value={ppsRange?.endTime ?? lastGcdEndTime}
                style={styles.ppsRangeInput}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val) || val < 0) return;
                  onPpsRangeChange({
                    startTime: ppsRange?.startTime ?? 0,
                    endTime: val,
                  });
                }}
              />
              s
            </label>
            <button
              style={styles.ppsRangeResetButton}
              onClick={() => onPpsRangeChange({ startTime: 0, endTime: lastGcdEndTime })}
              title="全体範囲にリセット"
            >
              全体
            </button>
          </div>
          {rangePps !== null && (
            <div style={styles.ppsRangeResult}>
              <span>
                範囲PPS: <span style={styles.ppsValue}>{rangePps.pps.toFixed(2)}</span>
              </span>
              <span style={styles.ppsRangeDetail}>
                (威力: {rangePps.totalPotency} = 直接{rangePps.directPotency} + DoT{rangePps.dotPotency})
              </span>
            </div>
          )}
        </div>
      )}

      {showUntargetableEditor && (
        <div style={styles.untargetableEditor}>
          <div style={styles.untargetableHeader}>
            <span style={styles.untargetableTitle}>ボス離脱タイミング</span>
            <button
              style={styles.untargetableAddButton}
              onClick={() => {
                const lastEnd = untargetableWindows.length > 0
                  ? Math.max(...untargetableWindows.map((w) => w.endTime))
                  : 0;
                onUntargetableWindowsChange([
                  ...untargetableWindows,
                  { startTime: lastEnd + 5, endTime: lastEnd + 10 },
                ]);
              }}
            >
              + 追加
            </button>
          </div>
          {untargetableWindows.length === 0 && (
            <div style={styles.untargetableEmpty}>離脱タイミングが未設定です</div>
          )}
          {untargetableWindows.map((w, i) => (
            <div key={i} style={styles.untargetableRow}>
              <label style={styles.untargetableLabel}>
                開始:
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={w.startTime}
                  style={styles.untargetableInput}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val < 0) return;
                    const next = [...untargetableWindows];
                    next[i] = { ...next[i], startTime: val };
                    onUntargetableWindowsChange(next);
                  }}
                />
                s
              </label>
              <label style={styles.untargetableLabel}>
                終了:
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={w.endTime}
                  style={styles.untargetableInput}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val < 0) return;
                    const next = [...untargetableWindows];
                    next[i] = { ...next[i], endTime: val };
                    onUntargetableWindowsChange(next);
                  }}
                />
                s
              </label>
              <button
                style={styles.untargetableDeleteButton}
                onClick={() => {
                  onUntargetableWindowsChange(untargetableWindows.filter((_, idx) => idx !== i));
                }}
                title="削除"
              >
                x
              </button>
            </div>
          ))}
        </div>
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
                    const recast = getEntryRecastTime(entry.skill, entry.activeBuffs);
                    const castTime = getEntryCastTime(entry.skill, entry.activeBuffs);
                    const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
                    const entryExpMul = stats ? calcExpectedMultiplier(stats, entry.critRateBonus, entry.dhRateBonus) : null;
                    const expectedPot = hasError ? null : (
                      entryExpMul !== null && entry.resolvedPotency > 0
                        ? Math.floor(buffedPotency * entryExpMul)
                        : null
                    );
                    const isAutoTransformed = entry.resolvedSkillId !== entry.skillId;
                    return (
                      <div
                        key={entry.uid}
                        style={{
                          ...styles.skillBlock,
                          left: entry.startTime * PX_PER_SEC,
                          width: recast * PX_PER_SEC,
                        }}
                      >
                        <div
                          style={styles.recastBar}
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
                                width: (castTime / recast) * 100 + "%",
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
                                (entry.skill.animationLock / recast) * 100 + "%",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            ...styles.skillIcon,
                            ...(hasError ? styles.skillIconError : {}),
                            ...(entry.wsComboError ? styles.skillIconComboWarning : {}),
                          }}
                          title={`${entry.displaySkill.name}${isAutoTransformed ? ` (← ${entry.skill.name})` : ""} (威力: ${buffedPotency}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / 期待値: ${expectedPot}` : ""}) [${entry.startTime.toFixed(2)}s]${castTime > 0 ? ` 詠唱: ${castTime}s` : " インスタント"}${entry.wsComboError ? " ⚠ コンボ不成立" : ""}${entry.resourceErrors.length > 0 ? " ⚠ リソース不足" : ""}${entry.comboErrors.length > 0 ? " ⚠ バフ条件未達成" : ""}${entry.untargetableError ? " ⚠ ボス離脱中" : ""}${entry.recastError ? " ⚠ リキャスト中" : ""}`}
                          onClick={() => handleRemoveEntry(entry.uid)}
                        >
                          <img
                            src={entry.displaySkill.icon}
                            alt={entry.displaySkill.name}
                            style={styles.iconImage}
                          />
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
                    const entryExpMul = stats ? calcExpectedMultiplier(stats, entry.critRateBonus, entry.dhRateBonus) : null;
                    const expectedPot = hasError ? null : (
                      entryExpMul !== null && entry.resolvedPotency > 0
                        ? Math.floor(buffedPotency * entryExpMul)
                        : null
                    );
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
                          }}
                          title={`${entry.displaySkill.name} (威力: ${buffedPotency}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / 期待値: ${expectedPot}` : ""}) [${entry.startTime.toFixed(2)}s]${entry.resourceErrors.length > 0 ? " ⚠ リソース不足" : ""}${entry.comboErrors.length > 0 ? " ⚠ バフ条件未達成" : ""}${entry.untargetableError ? " ⚠ ボス離脱中" : ""}${entry.recastError ? " ⚠ リキャスト中" : ""}`}
                          onClick={() => handleRemoveEntry(entry.uid)}
                        >
                          <img
                            src={entry.displaySkill.icon}
                            alt={entry.displaySkill.name}
                            style={styles.iconImage}
                          />
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
                          title={group.resources.map((r) => `${r.name}: ${entry.resourceSnapshot[r.id] ?? 0}/${r.maxStacks}`).join(", ") + (hasError ? " (不足)" : "")}
                        >
                          <div style={styles.resourceDots}>
                            {group.resources.flatMap((res) => {
                              const count = entry.resourceSnapshot[res.id] ?? 0;
                              if (res.maxStacks > 10) {
                                return [(
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
                                )];
                              }
                              return Array.from({ length: res.maxStacks }, (_, i) => (
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
                              ));
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
                        const left = span.startTime * PX_PER_SEC;
                        const width = (span.endTime - span.startTime) * PX_PER_SEC;
                        const stacksLabel = buffDef.maxStacks && span.stacks !== undefined
                          ? ` x${span.stacks}`
                          : "";
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
                            title={`${buffDef.name}${stacksLabel} (${span.startTime.toFixed(2)}s - ${span.endTime.toFixed(2)}s)`}
                          >
                            <img
                              src={buffDef.icon}
                              alt={buffDef.name}
                              style={styles.buffIcon}
                            />
                            <span style={{ ...styles.buffDuration, color: buffDef.color }}>
                              {buffDef.maxStacks ? `x${span.stacks ?? buffDef.maxStacks}` : `${buffDef.duration}s`}
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

      <div style={styles.hint}>クリックでスキルを削除</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    color: "#e0e0e0",
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  toggleButton: {
    background: "none",
    border: "1px solid #555",
    borderRadius: "4px",
    color: "#aaa",
    fontSize: "12px",
    padding: "4px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  potencyDisplay: {
    fontSize: "16px",
    color: "#aaa",
  },
  potencyValue: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#ffd700",
  },
  dropZone: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRadius: "8px",
    transition: "background-color 0.2s",
    minHeight: "200px",
    overflow: "hidden",
  },
  dropZoneActive: {
    backgroundColor: "rgba(255, 215, 0, 0.05)",
  },
  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: "160px",
    color: "#666",
    fontSize: "14px",
  },
  scrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    padding: "12px 0",
  },
  timelineContent: {
    position: "relative",
    minWidth: "100%",
    paddingLeft: 0,
  },
  insertIndicator: {
    position: "absolute",
    top: 0,
    bottom: RULER_HEIGHT,
    width: "2px",
    backgroundColor: "#ffd700",
    zIndex: 10,
    pointerEvents: "none",
    boxShadow: "0 0 6px rgba(255, 215, 0, 0.6)",
  },
  lane: {
    display: "flex",
    height: LANE_HEIGHT,
    position: "relative",
    marginBottom: "4px",
  },
  laneLabel: {
    width: LANE_LABEL_WIDTH,
    boxSizing: "border-box" as const,
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: "bold",
    color: "#888",
    textTransform: "uppercase" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
    position: "sticky" as const,
    left: 0,
    zIndex: 6,
    backgroundColor: "#0f0f23",
  },
  laneContent: {
    position: "relative",
    flex: 1,
    borderBottom: "1px solid #2a2a4a",
  },
  skillBlock: {
    position: "absolute",
    top: "4px",
    height: LANE_HEIGHT - 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  recastBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    backgroundColor: "rgba(100, 149, 237, 0.3)",
    borderRadius: "2px",
  },
  castTimeBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    borderRadius: "2px",
    overflow: "hidden",
  },
  castTimeFill: {
    height: "100%",
    backgroundColor: "rgba(255, 183, 77, 0.6)",
    borderRadius: "2px",
  },
  animLockBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    borderRadius: "2px",
    overflow: "hidden",
  },
  animLockFill: {
    height: "100%",
    backgroundColor: "rgba(255, 100, 100, 0.6)",
    borderRadius: "2px",
  },
  skillIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: "6px",
    overflow: "hidden",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.2)",
    marginTop: "8px",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  skillIconError: {
    border: "2px solid #ef5350",
    boxShadow: "0 0 8px rgba(239, 83, 80, 0.6)",
  },
  skillIconComboWarning: {
    border: "2px solid #ff9800",
    boxShadow: "0 0 8px rgba(255, 152, 0, 0.6)",
  },
  ogcdBlock: {
    position: "absolute",
    top: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  ogcdIcon: {
    width: ICON_SIZE - 4,
    height: ICON_SIZE - 4,
    borderRadius: "50%",
    overflow: "hidden",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.2)",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  ogcdIconError: {
    border: "2px solid #ef5350",
    boxShadow: "0 0 8px rgba(239, 83, 80, 0.6)",
  },
  iconImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
  },
  skillPotency: {
    fontSize: "9px",
    color: "#888",
    marginTop: "2px",
    textAlign: "center" as const,
  },
  // リソースゲージレーン
  resourceLane: {
    display: "flex",
    height: RESOURCE_LANE_HEIGHT,
    position: "relative",
    marginBottom: "2px",
  },
  resourceLaneLabel: {
    width: LANE_LABEL_WIDTH,
    boxSizing: "border-box" as const,
    flexShrink: 0,
    fontSize: "11px",
    color: "#777",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    position: "sticky" as const,
    left: 0,
    zIndex: 6,
    backgroundColor: "#0f0f23",
  },
  resourceLaneContent: {
    position: "relative",
    flex: 1,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  resourceMarker: {
    position: "absolute",
    top: "4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  resourceDots: {
    display: "flex",
    gap: "3px",
  },
  resourceGauge: {
    position: "relative",
    width: 40,
    height: RESOURCE_DOT_SIZE,
    borderRadius: RESOURCE_DOT_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  resourceGaugeFill: {
    height: "100%",
    borderRadius: RESOURCE_DOT_SIZE / 2,
    transition: "width 0.2s",
  },
  resourceGaugeLabel: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "8px",
    fontWeight: "bold",
    color: "#fff",
    textShadow: "0 0 2px rgba(0,0,0,0.8)",
  },
  resourceDot: {
    width: RESOURCE_DOT_SIZE,
    height: RESOURCE_DOT_SIZE,
    borderRadius: "50%",
    transition: "background-color 0.2s",
  },
  resourceErrorMark: {
    fontSize: "9px",
    fontWeight: "bold",
    color: "#ef5350",
    lineHeight: 1,
  },
  // バフレーン
  buffLane: {
    display: "flex",
    height: BUFF_LANE_HEIGHT,
    position: "relative",
    marginBottom: "2px",
  },
  buffLaneLabel: {
    width: LANE_LABEL_WIDTH,
    boxSizing: "border-box" as const,
    flexShrink: 0,
    fontSize: "11px",
    color: "#777",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
    whiteSpace: "pre-line" as const,
    textAlign: "right" as const,
    lineHeight: 1.2,
    overflow: "hidden",
    position: "sticky" as const,
    left: 0,
    zIndex: 6,
    backgroundColor: "#0f0f23",
  },
  buffLaneContent: {
    position: "relative",
    flex: 1,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  buffBar: {
    position: "absolute",
    top: "4px",
    height: BUFF_LANE_HEIGHT - 8,
    borderRadius: "4px",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    paddingLeft: "2px",
    paddingRight: "6px",
    overflow: "hidden",
  },
  buffIcon: {
    width: "20px",
    height: "20px",
    borderRadius: "3px",
    flexShrink: 0,
    objectFit: "contain" as const,
  },
  buffDuration: {
    fontSize: "10px",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  ruler: {
    display: "flex",
    height: RULER_HEIGHT,
    position: "relative",
    borderTop: "1px solid #444",
    marginTop: "4px",
  },
  rulerLabel: {
    width: LANE_LABEL_WIDTH,
    flexShrink: 0,
    position: "sticky" as const,
    left: 0,
    zIndex: 6,
    backgroundColor: "#0f0f23",
  },
  rulerContent: {
    position: "relative",
    flex: 1,
  },
  rulerTick: {
    position: "absolute",
    top: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  rulerTickLine: {
    width: "1px",
    height: "100%",
    backgroundColor: "#555",
  },
  rulerTickLabel: {
    fontSize: "10px",
    color: "#777",
    marginTop: "2px",
    whiteSpace: "nowrap" as const,
  },
  // DoTレーン
  dotLane: {
    display: "flex",
    height: DOT_LANE_HEIGHT,
    position: "relative",
    marginBottom: "2px",
  },
  dotLaneLabel: {
    width: LANE_LABEL_WIDTH,
    boxSizing: "border-box" as const,
    flexShrink: 0,
    fontSize: "11px",
    color: "#777",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    position: "sticky" as const,
    left: 0,
    zIndex: 6,
    backgroundColor: "#0f0f23",
  },
  dotLaneContent: {
    position: "relative",
    flex: 1,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  dotBar: {
    position: "absolute",
    top: "4px",
    height: DOT_LANE_HEIGHT - 12,
    borderRadius: "4px",
    border: "1px solid #a5d6a7",
    backgroundColor: "rgba(165, 214, 167, 0.15)",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    paddingLeft: "2px",
    paddingRight: "6px",
    overflow: "hidden",
  },
  dotIcon: {
    width: "18px",
    height: "18px",
    borderRadius: "3px",
    flexShrink: 0,
    objectFit: "contain" as const,
  },
  dotDuration: {
    fontSize: "10px",
    color: "#a5d6a7",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  dotTickMarker: {
    position: "absolute",
    top: "2px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    transform: "translateX(-50%)",
  },
  dotTickLine: {
    width: "1px",
    height: DOT_LANE_HEIGHT - 14,
    backgroundColor: "rgba(165, 214, 167, 0.5)",
  },
  dotTickPotency: {
    fontSize: "8px",
    color: "#a5d6a7",
    whiteSpace: "nowrap" as const,
  },
  // リキャストレーン
  recastLane: {
    display: "flex",
    height: RECAST_LANE_HEIGHT,
    position: "relative",
    marginBottom: "2px",
  },
  recastLaneLabel: {
    width: LANE_LABEL_WIDTH,
    boxSizing: "border-box" as const,
    flexShrink: 0,
    fontSize: "11px",
    color: "#777",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    position: "sticky" as const,
    left: 0,
    zIndex: 6,
    backgroundColor: "#0f0f23",
    gap: "3px",
  },
  recastLabelIcon: {
    width: "16px",
    height: "16px",
    borderRadius: "3px",
    flexShrink: 0,
    objectFit: "contain" as const,
  },
  recastLaneContent: {
    position: "relative",
    flex: 1,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  cooldownBar: {
    position: "absolute",
    top: "3px",
    height: RECAST_LANE_HEIGHT - 6,
    borderRadius: "4px",
    border: "1px solid #90caf9",
    backgroundColor: "rgba(144, 202, 249, 0.12)",
    display: "flex",
    alignItems: "center",
    gap: "3px",
    paddingLeft: "2px",
    paddingRight: "6px",
    overflow: "hidden",
  },
  recastIcon: {
    width: "16px",
    height: "16px",
    borderRadius: "3px",
    flexShrink: 0,
    objectFit: "contain" as const,
  },
  recastDuration: {
    fontSize: "10px",
    color: "#90caf9",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  hint: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#555",
    textAlign: "center" as const,
  },
  // ボス離脱エディタ
  untargetableEditor: {
    backgroundColor: "rgba(255, 80, 80, 0.05)",
    border: "1px solid rgba(255, 80, 80, 0.2)",
    borderRadius: "6px",
    padding: "8px 12px",
    marginBottom: "8px",
  },
  untargetableHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  untargetableTitle: {
    fontSize: "13px",
    fontWeight: "bold",
    color: "#ef5350",
  },
  untargetableAddButton: {
    background: "none",
    border: "1px solid rgba(255, 80, 80, 0.4)",
    borderRadius: "4px",
    color: "#ef5350",
    fontSize: "12px",
    padding: "2px 10px",
    cursor: "pointer",
  },
  untargetableEmpty: {
    fontSize: "12px",
    color: "#777",
  },
  untargetableRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "4px",
  },
  untargetableLabel: {
    fontSize: "12px",
    color: "#aaa",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  untargetableInput: {
    width: "60px",
    backgroundColor: "#1a1a3e",
    border: "1px solid #444",
    borderRadius: "4px",
    color: "#e0e0e0",
    padding: "2px 6px",
    fontSize: "12px",
    textAlign: "right" as const,
  },
  untargetableDeleteButton: {
    background: "none",
    border: "1px solid rgba(255, 80, 80, 0.3)",
    borderRadius: "4px",
    color: "#ef5350",
    fontSize: "12px",
    padding: "2px 8px",
    cursor: "pointer",
    lineHeight: 1,
  },
  // PPS表示
  ppsDisplay: {
    fontSize: "14px",
    color: "#ffb74d",
    marginLeft: "8px",
  },
  ppsValue: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#ffb74d",
  },
  // PPS範囲選択エディタ
  ppsRangeEditor: {
    backgroundColor: "rgba(255, 183, 77, 0.05)",
    border: "1px solid rgba(255, 183, 77, 0.2)",
    borderRadius: "6px",
    padding: "8px 12px",
    marginBottom: "8px",
  },
  ppsRangeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  ppsRangeTitle: {
    fontSize: "13px",
    fontWeight: "bold",
    color: "#ffb74d",
  },
  ppsRangeRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "4px",
  },
  ppsRangeLabel: {
    fontSize: "12px",
    color: "#aaa",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  ppsRangeInput: {
    width: "60px",
    backgroundColor: "#1a1a3e",
    border: "1px solid #444",
    borderRadius: "4px",
    color: "#e0e0e0",
    padding: "2px 6px",
    fontSize: "12px",
    textAlign: "right" as const,
  },
  ppsRangeResetButton: {
    background: "none",
    border: "1px solid rgba(255, 183, 77, 0.4)",
    borderRadius: "4px",
    color: "#ffb74d",
    fontSize: "12px",
    padding: "2px 10px",
    cursor: "pointer",
  },
  ppsRangeResult: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#e0e0e0",
    marginTop: "4px",
  },
  ppsRangeDetail: {
    fontSize: "12px",
    color: "#888",
  },
};
