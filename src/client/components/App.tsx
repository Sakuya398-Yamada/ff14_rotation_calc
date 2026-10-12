import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, pointerWithin } from "@dnd-kit/core";
import type { DragStartEvent } from "@dnd-kit/core";
import type { TimelineDragData } from "./timeline/dnd-types";
import { SkillPalette } from "./SkillPalette";
import { Timeline } from "./Timeline";
import { SkillDetailPanel } from "./SkillDetailPanel";
import { SettingsDialog } from "./SettingsDialog";
import { SummaryBar } from "./SummaryBar";
import { JobPicker } from "./JobPicker";
import { loadSettings, saveSettings, applySettings, prefersDarkScheme } from "../logic/app-settings";
import { resolveTimeline, calcPps } from "../logic/resolve-timeline";
import { JOB_DATA } from "../data/job-registry";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../logic/stat-calc";
import { calcEntryExpectedPotency } from "../logic/expected-potency";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel } from "../logic/skill-level";
import { loadAppState, saveAppState, computeNextUid } from "../logic/timeline-storage";
import type { JobId } from "../data/job-registry";
import type { Skill, TimelineEntry, CharacterStats, BossUntargetableWindow, MultiTargetWindow, PpsRange, PlayerLevel } from "../types/skill";

// 既存の `import type { JobId } from "./App"` を壊さないための再エクスポート
export type { JobId } from "../data/job-registry";

let nextUid = 1;

/** 保存の debounce 間隔（ミリ秒）。連続操作中の書き込み頻度を抑える */
const SAVE_DEBOUNCE_MS = 500;

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveSettings(settings);
    applySettings(settings, prefersDarkScheme());
    if (settings.theme !== "system" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSchemeChange = (e: MediaQueryListEvent) => applySettings(settings, e.matches);
    mediaQuery.addEventListener("change", handleSchemeChange);
    return () => mediaQuery.removeEventListener("change", handleSchemeChange);
  }, [settings]);

  // 初回マウント時に LocalStorage から復元（復元不能時は null → 各 state の初期値にフォールバック）
  const [restored] = useState(() => {
    const state = loadAppState();
    if (state) {
      // 復元した entries の uid と新規採番が衝突しないようカウンタを進める
      nextUid = Math.max(nextUid, computeNextUid(state.entries));
    }
    return state;
  });

  const [selectedJob, setSelectedJob] = useState<JobId>(restored?.selectedJob ?? "whm");
  const [level, setLevel] = useState<PlayerLevel>(restored?.level ?? 100);
  const [entries, setEntries] = useState<TimelineEntry[]>(restored?.entries ?? []);
  const [stats, setStats] = useState<CharacterStats>(restored?.stats ?? DEFAULT_STATS);
  const [untargetableWindows, setUntargetableWindows] = useState<BossUntargetableWindow[]>(restored?.untargetableWindows ?? []);
  const [multiTargetWindows, setMultiTargetWindows] = useState<MultiTargetWindow[]>(restored?.multiTargetWindows ?? []);
  const [ppsRange, setPpsRange] = useState<PpsRange | null>(null);
  const [selectedEntryUid, setSelectedEntryUid] = useState<string | null>(null);

  // 状態変更を debounce しつつ LocalStorage へ保存。
  // debounce 待ち中（直前 500ms 以内）のリロード・タブクローズでも取りこぼさないよう、
  // pagehide で即時フラッシュする
  useEffect(() => {
    const flush = () => {
      saveAppState({ selectedJob, level, entries, stats, untargetableWindows, multiTargetWindows });
    };
    const timer = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
    };
  }, [selectedJob, level, entries, stats, untargetableWindows, multiTargetWindows]);

  const jobData = JOB_DATA[selectedJob];

  const handleJobChange = useCallback((jobId: JobId) => {
    setSelectedJob(jobId);
    // ジョブ変更時にタイムラインをリセット（異なるジョブのスキルは互換性がない）
    setEntries([]);
    setPpsRange(null);
    setSelectedEntryUid(null);
  }, []);

  // レベルに応じたバフ・リソースをフィルタ
  const levelBuffs = useMemo(
    () => getBuffsForLevel(jobData.buffs, level),
    [jobData.buffs, level]
  );
  const levelResources = useMemo(
    () => getResourcesForLevel(jobData.resources, level),
    [jobData.resources, level]
  );

  // レベルに応じたスキルをフィルタ・威力調整
  const availableBuffIds = useMemo(
    () => new Set(levelBuffs.map((b) => b.id)),
    [levelBuffs]
  );
  const availableResourceIds = useMemo(
    () => new Set(levelResources.map((r) => r.id)),
    [levelResources]
  );
  const skills = useMemo(
    () => getSkillsForLevel(jobData.skills, level, availableBuffIds, availableResourceIds),
    [jobData.skills, level, availableBuffIds, availableResourceIds]
  );

  // パレット用のフィルタ済みスキルマップ
  const skillMap = useMemo(
    () => new Map(skills.map((s) => [s.id, s])),
    [skills]
  );

  // 全スキルマップ（autoTransform対象等を含む。タイムライン解決・表示用）
  const allSkillMap = useMemo(() => {
    const map = new Map(skills.map((s) => [s.id, s]));
    // パレットからフィルタされたスキル（autoTransform対象・replacesSkillId対象）も追加
    for (const s of jobData.skills) {
      if (s.acquiredLevel <= level && !map.has(s.id)) {
        map.set(s.id, s);
      }
    }
    return map;
  }, [skills, jobData.skills, level]);

  const timelineResult = useMemo(
    () => resolveTimeline(entries, allSkillMap, levelResources, stats, levelBuffs, untargetableWindows, multiTargetWindows),
    [entries, allSkillMap, levelResources, stats, levelBuffs, untargetableWindows, multiTargetWindows]
  );

  const resolvedEntries = timelineResult.entries;

  const handleAddEntry = useCallback((skillId: string, insertBeforeUid?: string) => {
    const uid = `entry-${nextUid++}`;
    setEntries((prev) => {
      if (insertBeforeUid) {
        const targetIndex = prev.findIndex((e) => e.uid === insertBeforeUid);
        if (targetIndex >= 0) {
          const next = [...prev];
          next.splice(targetIndex, 0, { uid, skillId });
          return next;
        }
      }
      return [...prev, { uid, skillId }];
    });
  }, []);

  const handleRemoveEntry = useCallback((uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
    setSelectedEntryUid((prev) => (prev === uid ? null : prev));
  }, []);

  const handleMoveEntry = useCallback((uid: string, insertBeforeUid?: string) => {
    if (insertBeforeUid === uid) return;
    setEntries((prev) => {
      const fromIdx = prev.findIndex((e) => e.uid === uid);
      if (fromIdx < 0) return prev;
      // D&D での並び替え時は、過去に設定した manualStartTime をリセットして自動計算に戻す
      // （Issue #175 仕様: 並び替えで位置が変わるならマニュアル時刻の意味が薄れる）
      const { manualStartTime: _drop, ...rest } = prev[fromIdx];
      void _drop;
      const entry: TimelineEntry = rest;
      const without = [...prev.slice(0, fromIdx), ...prev.slice(fromIdx + 1)];
      if (insertBeforeUid) {
        const toIdx = without.findIndex((e) => e.uid === insertBeforeUid);
        if (toIdx < 0) return prev;
        return [...without.slice(0, toIdx), entry, ...without.slice(toIdx)];
      }
      return [...without, entry];
    });
  }, []);

  // dnd-kit センサー設定（Issue #284: タッチ操作対応）
  // MouseSensor: distance 制約でクリック（エントリ選択）とドラッグを区別する
  // TouchSensor: 長押し（delay）でドラッグ開始し、通常のタップ・スクロールと区別する
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  /** ドラッグ中のスキル（DragOverlay 表示用。null = 非ドラッグ） */
  const [activeDragSkill, setActiveDragSkill] = useState<Skill | null>(null);

  const handleDndDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as TimelineDragData | undefined;
      if (!data) return;
      setActiveDragSkill(allSkillMap.get(data.skillId) ?? null);
    },
    [allSkillMap]
  );

  const handleDndDragFinish = useCallback(() => {
    setActiveDragSkill(null);
  }, []);

  const handleManualStartTimeChange = useCallback(
    (uid: string, manualStartTime: number | undefined) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.uid !== uid) return e;
          if (manualStartTime === undefined) {
            // undefined を渡されたら manualStartTime キー自体を削除（型上 optional のため省略形が正）
            const { manualStartTime: _drop, ...rest } = e;
            void _drop;
            return rest;
          }
          return { ...e, manualStartTime };
        })
      );
    },
    []
  );

  // per-entryのクリティカル率ボーナスを考慮した合計期待威力（複数体ヒット合算込み）
  const { totalExpectedPotency, dotExpectedPotency } = useMemo(() => {
    const directExpected = resolvedEntries.reduce((sum, entry) => {
      const skill = allSkillMap.get(entry.resolvedSkillId);
      return sum + calcEntryExpectedPotency(entry, skill, stats);
    }, 0);
    // DoTはティックごとにスナップショット済みのcritRateBonus・dhRateBonusを適用
    // （DoTは保守的に1体のみ付与の前提のため targetCount は反映しない）
    const dotExpected = timelineResult.dotTicks.reduce((sum, tick) => {
      const dotMul = calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus);
      return sum + Math.floor(tick.potency * dotMul);
    }, 0);
    return { totalExpectedPotency: directExpected + dotExpected, dotExpectedPotency: dotExpected };
  }, [stats, resolvedEntries, allSkillMap, timelineResult.dotTicks]);

  // 全体PPS: 0 〜 タイムライン全体終了まで（DoT最終ティック含む）
  const overallPps = useMemo(() => {
    if (timelineResult.timelineEndTime <= 0) return null;
    return calcPps(
      resolvedEntries,
      allSkillMap,
      timelineResult.dotTicks,
      0,
      timelineResult.timelineEndTime,
      stats,
      { includeEnd: true }
    );
  }, [resolvedEntries, allSkillMap, timelineResult.dotTicks, timelineResult.timelineEndTime, stats]);

  const buffDefMap = useMemo(
    () => new Map(levelBuffs.map((b) => [b.id, b])),
    [levelBuffs]
  );

  const selectedEntry = useMemo(() => {
    if (selectedEntryUid === null) return null;
    return resolvedEntries.find((e) => e.uid === selectedEntryUid) ?? null;
  }, [resolvedEntries, selectedEntryUid]);

  const selectedSkill = useMemo(() => {
    if (!selectedEntry) return null;
    return allSkillMap.get(selectedEntry.resolvedSkillId) ?? null;
  }, [selectedEntry, allSkillMap]);

  // 範囲選択PPS
  const rangePps = useMemo(() => {
    if (!ppsRange) return null;
    return calcPps(
      resolvedEntries,
      allSkillMap,
      timelineResult.dotTicks,
      ppsRange.startTime,
      ppsRange.endTime,
      stats,
      // 区間がタイムライン終端まで届くときは、終端ちょうどの最終ティックも含める（#400）
      { includeEnd: ppsRange.endTime >= timelineResult.timelineEndTime }
    );
  }, [resolvedEntries, allSkillMap, timelineResult.dotTicks, timelineResult.timelineEndTime, ppsRange, stats]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>FF14 Rotation Calculator</h1>
        <JobPicker
          selectedJob={selectedJob}
          level={level}
          onJobChange={handleJobChange}
          onLevelChange={setLevel}
        />
        <button
          ref={settingsButtonRef}
          type="button"
          aria-label="設定"
          title="設定"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
          style={styles.settingsButton}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </header>
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
        returnFocusRef={settingsButtonRef}
      />
      <SummaryBar
        totalExpectedPotency={totalExpectedPotency}
        dotExpectedPotency={dotExpectedPotency}
        overallPps={overallPps}
        rangePps={rangePps}
        ppsRange={ppsRange}
        duration={timelineResult.timelineEndTime}
      />
      <DndContext
        sensors={dndSensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDndDragStart}
        onDragEnd={handleDndDragFinish}
        onDragCancel={handleDndDragFinish}
      >
      <div style={styles.main}>
        <SkillPalette
          skills={skills}
          stats={stats}
          onStatsChange={setStats}
        />
        <div style={styles.workArea}>
          <div style={styles.timelineSlot}>
            <Timeline
              skills={skills}
              allSkillMap={allSkillMap}
              resolvedEntries={resolvedEntries}
              onAddEntry={handleAddEntry}
              onRemoveEntry={handleRemoveEntry}
              onMoveEntry={handleMoveEntry}
              resources={levelResources}
              buffs={levelBuffs}
              stats={stats}
              dotTicks={timelineResult.dotTicks}
              activeDoTs={timelineResult.activeDoTs}
              untargetableWindows={untargetableWindows}
              onUntargetableWindowsChange={setUntargetableWindows}
              multiTargetWindows={multiTargetWindows}
              onMultiTargetWindowsChange={setMultiTargetWindows}
              rangePps={rangePps}
              ppsRange={ppsRange}
              onPpsRangeChange={setPpsRange}
              lastGcdEndTime={timelineResult.lastGcdEndTime}
              selectedEntryUid={selectedEntryUid}
              onSelectEntry={setSelectedEntryUid}
            />
          </div>
          {selectedEntry && selectedSkill && (
            <SkillDetailPanel
              entry={selectedEntry}
              resolvedSkill={selectedSkill}
              buffDefMap={buffDefMap}
              stats={stats}
              onClose={() => setSelectedEntryUid(null)}
              onManualStartTimeChange={handleManualStartTimeChange}
            />
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragSkill && (
          <div style={styles.dragOverlayIcon}>
            <img
              src={activeDragSkill.icon}
              alt={activeDragSkill.name}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              draggable={false}
            />
          </div>
        )}
      </DragOverlay>
      </DndContext>
      <footer style={styles.footer}>
        <small style={styles.contact}>
          不具合・要望:{" "}
          <a
            style={styles.contactLink}
            href="https://github.com/Sakuya398-Yamada/ff14_rotation_calc"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>{" "}
          |{" "}
          <a
            style={styles.contactLink}
            href="https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Issue
          </a>{" "}
          | メール:{" "}
          <a style={styles.contactLink} href="mailto:forestry.for@gmail.com">
            forestry.for@gmail.com
          </a>
        </small>
        <small style={styles.copyright}>
          Copyright (C) SQUARE ENIX CO., LTD. All Rights Reserved.
        </small>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-4)",
    padding: "var(--space-3) var(--space-6)",
    backgroundColor: "var(--color-surface)",
    borderBottom: "1px solid var(--color-line)",
  },
  headerTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: "var(--color-text)",
  },
  settingsButton: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  workArea: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  // Timeline のルートは横方向の flex: 1 で伸びる作りのため、縦方向の伸縮はこの行ラッパーが受け持つ
  timelineSlot: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
  dragOverlayIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "4px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.6)",
    cursor: "grabbing",
  },
  footer: {
    padding: "var(--space-2) var(--space-6)",
    backgroundColor: "var(--color-surface)",
    borderTop: "1px solid var(--color-line)",
    textAlign: "center" as const,
  },
  contact: {
    display: "block",
    fontSize: "11px",
    color: "var(--color-muted)",
    marginBottom: "2px",
  },
  contactLink: {
    color: "var(--color-accent)",
    textDecoration: "none",
  },
  copyright: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
};
