import { useState, useCallback, useMemo } from "react";
import { SkillPalette } from "./SkillPalette";
import { Timeline } from "./Timeline";
import { WHM_ATTACK_SKILLS } from "../data/whm-skills";
import type { TimelineEntry } from "../types/skill";

let nextUid = 1;

export function App() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  const skillMap = useMemo(
    () => new Map(WHM_ATTACK_SKILLS.map((s) => [s.id, s])),
    []
  );

  const handleAddEntry = useCallback((skillId: string) => {
    const uid = `entry-${nextUid++}`;
    setEntries((prev) => [...prev, { uid, skillId }]);
  }, []);

  const handleRemoveEntry = useCallback((uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
  }, []);

  const totalPotency = useMemo(() => {
    return entries.reduce((sum, entry) => {
      const skill = skillMap.get(entry.skillId);
      return sum + (skill?.potency ?? 0);
    }, 0);
  }, [entries, skillMap]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>FF14 Rotation Calculator</h1>
        <span style={styles.headerJob}>白魔道士 (WHM)</span>
      </header>
      <div style={styles.main}>
        <SkillPalette skills={WHM_ATTACK_SKILLS} />
        <Timeline
          skills={WHM_ATTACK_SKILLS}
          entries={entries}
          onAddEntry={handleAddEntry}
          onRemoveEntry={handleRemoveEntry}
          totalPotency={totalPotency}
        />
      </div>
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
};
