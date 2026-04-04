import { useState, useCallback, useMemo } from "react";
import { SkillPalette } from "./SkillPalette";
import { Timeline } from "./Timeline";
import { resolveTimeline, calcPps } from "../logic/resolve-timeline";
import { WHM_ATTACK_SKILLS } from "../data/whm-skills";
import { WHM_RESOURCES } from "../data/whm-resources";
import { WHM_BUFFS } from "../data/whm-buffs";
import { DRG_ATTACK_SKILLS } from "../data/drg-skills";
import { DRG_RESOURCES } from "../data/drg-resources";
import { DRG_BUFFS } from "../data/drg-buffs";
import { BRD_ATTACK_SKILLS } from "../data/brd-skills";
import { BRD_RESOURCES } from "../data/brd-resources";
import { BRD_BUFFS } from "../data/brd-buffs";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../logic/stat-calc";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel } from "../logic/skill-level";
import type { Skill, BuffDefinition, ResourceDefinition, TimelineEntry, CharacterStats, BossUntargetableWindow, PpsRange, PlayerLevel } from "../types/skill";

/** ジョブID */
export type JobId = "whm" | "drg" | "brd";

/** ジョブデータ定義 */
interface JobData {
  name: string;
  abbreviation: string;
  skills: Skill[];
  buffs: BuffDefinition[];
  resources: ResourceDefinition[];
}

/** ジョブデータレジストリ */
const JOB_DATA: Record<JobId, JobData> = {
  whm: { name: "白魔道士", abbreviation: "WHM", skills: WHM_ATTACK_SKILLS, buffs: WHM_BUFFS, resources: WHM_RESOURCES },
  drg: { name: "竜騎士", abbreviation: "DRG", skills: DRG_ATTACK_SKILLS, buffs: DRG_BUFFS, resources: DRG_RESOURCES },
  brd: { name: "詩人", abbreviation: "BRD", skills: BRD_ATTACK_SKILLS, buffs: BRD_BUFFS, resources: BRD_RESOURCES },
};

let nextUid = 1;

export function App() {
  const [selectedJob, setSelectedJob] = useState<JobId>("whm");
  const [level, setLevel] = useState<PlayerLevel>(100);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState<CharacterStats>(DEFAULT_STATS);
  const [untargetableWindows, setUntargetableWindows] = useState<BossUntargetableWindow[]>([]);
  const [ppsRange, setPpsRange] = useState<PpsRange | null>(null);

  const jobData = JOB_DATA[selectedJob];

  const handleJobChange = useCallback((jobId: JobId) => {
    setSelectedJob(jobId);
    // ジョブ変更時にタイムラインをリセット（異なるジョブのスキルは互換性がない）
    setEntries([]);
    setPpsRange(null);
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
    () => resolveTimeline(entries, allSkillMap, levelResources, stats, levelBuffs, untargetableWindows),
    [entries, allSkillMap, levelResources, stats, levelBuffs, untargetableWindows]
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
  }, []);

  const directPotency = useMemo(() => {
    return resolvedEntries.reduce((sum, entry) => {
      const hasError = entry.resourceErrors.length > 0 || entry.comboErrors.length > 0 || entry.untargetableError || entry.recastError;
      if (hasError) return sum;
      return sum + Math.floor(entry.resolvedPotency * entry.buffMultiplier);
    }, 0);
  }, [resolvedEntries]);

  const totalPotency = directPotency + timelineResult.dotTotalPotency;

  const expectedMultiplier = useMemo(
    () => calcExpectedMultiplier(stats),
    [stats]
  );

  // per-entryのクリティカル率ボーナスを考慮した合計期待威力
  const totalExpectedPotency = useMemo(() => {
    const directExpected = resolvedEntries.reduce((sum, entry) => {
      const hasError = entry.resourceErrors.length > 0 || entry.comboErrors.length > 0 || entry.untargetableError || entry.recastError;
      if (hasError) return sum;
      const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
      const entryMul = calcExpectedMultiplier(stats, entry.critRateBonus, entry.dhRateBonus);
      return sum + Math.floor(buffedPotency * entryMul);
    }, 0);
    // DoTはティックごとにスナップショット済みのcritRateBonus・dhRateBonusを適用
    const dotExpected = timelineResult.dotTicks.reduce((sum, tick) => {
      const dotMul = calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus);
      return sum + Math.floor(tick.potency * dotMul);
    }, 0);
    return directExpected + dotExpected;
  }, [stats, resolvedEntries, allSkillMap, timelineResult.dotTicks]);

  // 全体PPS: 0 〜 最後のGCDリキャスト完了まで（DoTは最終GCDまでで打ち切り）
  const overallPps = useMemo(() => {
    if (timelineResult.lastGcdEndTime <= 0) return null;
    return calcPps(
      resolvedEntries,
      allSkillMap,
      timelineResult.dotTicks,
      0,
      timelineResult.lastGcdEndTime,
      stats
    );
  }, [resolvedEntries, allSkillMap, timelineResult.dotTicks, timelineResult.lastGcdEndTime, stats]);

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
          totalPotency={totalPotency}
          resources={levelResources}
          buffs={levelBuffs}
          expectedMultiplier={expectedMultiplier}
          totalExpectedPotency={totalExpectedPotency}
          stats={stats}
          dotTicks={timelineResult.dotTicks}
          activeDoTs={timelineResult.activeDoTs}
          dotTotalPotency={timelineResult.dotTotalPotency}
          untargetableWindows={untargetableWindows}
          onUntargetableWindowsChange={setUntargetableWindows}
          overallPps={overallPps}
          rangePps={rangePps}
          ppsRange={ppsRange}
          onPpsRangeChange={setPpsRange}
          lastGcdEndTime={timelineResult.lastGcdEndTime}
        />
      </div>
      <footer style={styles.footer}>
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
  copyright: {
    fontSize: "11px",
    color: "#666",
  },
};
