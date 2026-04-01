import { useState, useCallback, useMemo } from "react";
import { SkillPalette } from "./SkillPalette";
import { Timeline } from "./Timeline";
import { resolveTimeline, calcPps } from "../logic/resolve-timeline";
import { WHM_ATTACK_SKILLS } from "../data/whm-skills";
import { WHM_RESOURCES } from "../data/whm-resources";
import { WHM_BUFFS } from "../data/whm-buffs";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../logic/stat-calc";
import type { TimelineEntry, CharacterStats, BossUntargetableWindow, PpsRange } from "../types/skill";

let nextUid = 1;

export function App() {
  const skills = WHM_ATTACK_SKILLS;
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState<CharacterStats>(DEFAULT_STATS);
  const [statsEnabled, setStatsEnabled] = useState(false);
  const [untargetableWindows, setUntargetableWindows] = useState<BossUntargetableWindow[]>([]);
  const [ppsRange, setPpsRange] = useState<PpsRange | null>(null);

  const skillMap = useMemo(
    () => new Map(skills.map((s) => [s.id, s])),
    [skills]
  );

  const timelineResult = useMemo(
    () => resolveTimeline(entries, skillMap, WHM_RESOURCES, statsEnabled ? stats : undefined, WHM_BUFFS, untargetableWindows),
    [entries, skillMap, stats, statsEnabled, untargetableWindows]
  );

  const resolvedEntries = timelineResult.entries;

  const handleAddEntry = useCallback((skillId: string, insertIndex?: number) => {
    const uid = `entry-${nextUid++}`;
    setEntries((prev) => {
      if (insertIndex !== undefined && insertIndex >= 0 && insertIndex < prev.length) {
        const next = [...prev];
        next.splice(insertIndex, 0, { uid, skillId });
        return next;
      }
      return [...prev, { uid, skillId }];
    });
  }, []);

  const handleRemoveEntry = useCallback((uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
  }, []);

  const directPotency = useMemo(() => {
    return entries.reduce((sum, entry) => {
      const skill = skillMap.get(entry.skillId);
      return sum + (skill?.potency ?? 0);
    }, 0);
  }, [entries, skillMap]);

  const totalPotency = directPotency + timelineResult.dotTotalPotency;

  const expectedMultiplier = useMemo(
    () => (statsEnabled ? calcExpectedMultiplier(stats) : null),
    [stats, statsEnabled]
  );

  // 全体PPS: 0 〜 最後のGCDリキャスト完了まで（DoTは最終GCDまでで打ち切り）
  const overallPps = useMemo(() => {
    if (timelineResult.lastGcdEndTime <= 0) return null;
    return calcPps(
      resolvedEntries,
      skillMap,
      timelineResult.dotTicks,
      0,
      timelineResult.lastGcdEndTime
    );
  }, [resolvedEntries, skillMap, timelineResult.dotTicks, timelineResult.lastGcdEndTime]);

  // 範囲選択PPS
  const rangePps = useMemo(() => {
    if (!ppsRange) return null;
    return calcPps(
      resolvedEntries,
      skillMap,
      timelineResult.dotTicks,
      ppsRange.startTime,
      ppsRange.endTime
    );
  }, [resolvedEntries, skillMap, timelineResult.dotTicks, ppsRange]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>FF14 Rotation Calculator</h1>
        <span style={styles.headerJob}>白魔道士 (WHM)</span>
      </header>
      <div style={styles.main}>
        <SkillPalette
          skills={skills}
          stats={stats}
          statsEnabled={statsEnabled}
          onStatsChange={setStats}
          onStatsEnabledChange={setStatsEnabled}
        />
        <Timeline
          skills={skills}
          resolvedEntries={resolvedEntries}
          onAddEntry={handleAddEntry}
          onRemoveEntry={handleRemoveEntry}
          totalPotency={totalPotency}
          resources={WHM_RESOURCES}
          buffs={WHM_BUFFS}
          expectedMultiplier={expectedMultiplier}
          statsEnabled={statsEnabled}
          stats={statsEnabled ? stats : undefined}
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
