import { useState, useCallback, useMemo, useEffect } from "react";
import { SkillPalette } from "./SkillPalette";
import { Timeline } from "./Timeline";
import { SkillDetailPanel } from "./SkillDetailPanel";
import { resolveTimeline, calcPps } from "../logic/resolve-timeline";
import { JOB_DATA } from "../data/job-registry";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../logic/stat-calc";
import { calcEntryExpectedPotency } from "../logic/expected-potency";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel } from "../logic/skill-level";
import { loadAppState, saveAppState, computeNextUid } from "../logic/timeline-storage";
import type { JobId } from "../data/job-registry";
import type { TimelineEntry, CharacterStats, BossUntargetableWindow, MultiTargetWindow, PpsRange, PlayerLevel } from "../types/skill";

// 既存の `import type { JobId } from "./App"` を壊さないための再エクスポート
export type { JobId } from "../data/job-registry";

let nextUid = 1;

/** 保存の debounce 間隔（ミリ秒）。連続操作中の書き込み頻度を抑える */
const SAVE_DEBOUNCE_MS = 500;

export function App() {
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
      stats
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
      stats
    );
  }, [resolvedEntries, allSkillMap, timelineResult.dotTicks, ppsRange, stats]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>FF14 Rotation Calculator</h1>
        <span style={styles.headerJob}>{jobData.name} ({jobData.abbreviation})</span>
      </header>
      <div style={styles.main}>
        <SkillPalette
          skills={skills}
          stats={stats}
          onStatsChange={setStats}
          level={level}
          onLevelChange={setLevel}
          selectedJob={selectedJob}
          onJobChange={handleJobChange}
        />
        <Timeline
          skills={skills}
          allSkillMap={allSkillMap}
          resolvedEntries={resolvedEntries}
          onAddEntry={handleAddEntry}
          onRemoveEntry={handleRemoveEntry}
          onMoveEntry={handleMoveEntry}
          resources={levelResources}
          buffs={levelBuffs}
          totalExpectedPotency={totalExpectedPotency}
          dotExpectedPotency={dotExpectedPotency}
          stats={stats}
          dotTicks={timelineResult.dotTicks}
          activeDoTs={timelineResult.activeDoTs}
          untargetableWindows={untargetableWindows}
          onUntargetableWindowsChange={setUntargetableWindows}
          multiTargetWindows={multiTargetWindows}
          onMultiTargetWindowsChange={setMultiTargetWindows}
          overallPps={overallPps}
          rangePps={rangePps}
          ppsRange={ppsRange}
          onPpsRangeChange={setPpsRange}
          lastGcdEndTime={timelineResult.lastGcdEndTime}
          selectedEntryUid={selectedEntryUid}
          onSelectEntry={setSelectedEntryUid}
        />
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
    backgroundColor: "#0f0f23",
    color: "#e0e0e0",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 20px",
    backgroundColor: "#16213e",
    borderBottom: "1px solid #333",
  },
  headerTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#ffd700",
  },
  headerJob: {
    fontSize: "14px",
    color: "#888",
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  footer: {
    padding: "8px 20px",
    backgroundColor: "#16213e",
    borderTop: "1px solid #333",
    textAlign: "center" as const,
  },
  contact: {
    display: "block",
    fontSize: "11px",
    color: "#888",
    marginBottom: "2px",
  },
  contactLink: {
    color: "#7aa2f7",
    textDecoration: "none",
  },
  copyright: {
    fontSize: "11px",
    color: "#666",
  },
};
