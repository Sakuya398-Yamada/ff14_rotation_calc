import { useState, useCallback, useMemo, useEffect } from "react";
import { SkillPalette } from "./SkillPalette";
import { Timeline } from "./Timeline";
import { resolveTimeline } from "../logic/resolve-timeline";
import { resolveIconUrl } from "../utils/resolve-icon-url";
import type { Skill, TimelineEntry } from "../types/skill";

let nextUid = 1;

export function App() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => res.json())
      .then((data: Skill[]) => {
        const resolved = data.map((s) => ({
          ...s,
          icon: resolveIconUrl(s.icon),
        }));
        setSkills(resolved);
      })
      .finally(() => setLoading(false));
  }, []);

  const skillMap = useMemo(
    () => new Map(skills.map((s) => [s.id, s])),
    [skills]
  );

  const resolvedEntries = useMemo(
    () => resolveTimeline(entries, skillMap),
    [entries, skillMap]
  );

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

  const totalPotency = useMemo(() => {
    return entries.reduce((sum, entry) => {
      const skill = skillMap.get(entry.skillId);
      return sum + (skill?.potency ?? 0);
    }, 0);
  }, [entries, skillMap]);

  if (loading) {
    return (
      <div style={styles.app}>
        <div style={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>FF14 Rotation Calculator</h1>
        <span style={styles.headerJob}>白魔道士 (WHM)</span>
      </header>
      <div style={styles.main}>
        <SkillPalette skills={skills} />
        <Timeline
          skills={skills}
          resolvedEntries={resolvedEntries}
          onAddEntry={handleAddEntry}
          onRemoveEntry={handleRemoveEntry}
          totalPotency={totalPotency}
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
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    fontSize: "18px",
    color: "#888",
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
