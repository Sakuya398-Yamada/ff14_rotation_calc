import { useState, useCallback } from "react";
import type { Skill, TimelineEntry } from "../types/skill";

interface TimelineProps {
  skills: Skill[];
  entries: TimelineEntry[];
  onAddEntry: (skillId: string) => void;
  onRemoveEntry: (uid: string) => void;
  totalPotency: number;
}

export function Timeline({
  skills,
  entries,
  onAddEntry,
  onRemoveEntry,
  totalPotency,
}: TimelineProps) {
  const [dragOver, setDragOver] = useState(false);

  const skillMap = new Map(skills.map((s) => [s.id, s]));

  const gcdEntries: (TimelineEntry & { skill: Skill })[] = [];
  const ogcdEntries: (TimelineEntry & { skill: Skill })[] = [];
  for (const entry of entries) {
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;
    if (skill.type === "gcd") {
      gcdEntries.push({ ...entry, skill });
    } else {
      ogcdEntries.push({ ...entry, skill });
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const skillId = e.dataTransfer.getData("application/skill-id");
      if (skillId) {
        onAddEntry(skillId);
      }
    },
    [onAddEntry]
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>タイムライン</h2>
        <div style={styles.potencyDisplay}>
          合計威力: <span style={styles.potencyValue}>{totalPotency}</span>
        </div>
      </div>

      <div
        style={{
          ...styles.dropZone,
          ...(dragOver ? styles.dropZoneActive : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {entries.length === 0 ? (
          <div style={styles.placeholder}>
            スキルパレットからドラッグ＆ドロップしてスキルを追加
          </div>
        ) : (
          <div style={styles.timelineContent}>
            {/* GCD行 */}
            <div style={styles.lane}>
              <div style={styles.laneLabel}>GCD</div>
              <div style={styles.laneSlots}>
                {gcdEntries.map((entry, index) => (
                  <div key={entry.uid} style={styles.slotWrapper}>
                    <div
                      style={{
                        ...styles.skillSlot,
                        backgroundColor: entry.skill.color,
                      }}
                      title={`${entry.skill.name} (威力: ${entry.skill.potency})`}
                      onClick={() => onRemoveEntry(entry.uid)}
                    >
                      <div style={styles.slotName}>{entry.skill.name}</div>
                      <div style={styles.slotPotency}>
                        {entry.skill.potency}
                      </div>
                    </div>
                    <div style={styles.slotIndex}>{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* oGCD行 */}
            <div style={styles.lane}>
              <div style={styles.laneLabel}>oGCD</div>
              <div style={styles.laneSlots}>
                {ogcdEntries.map((entry, index) => (
                  <div key={entry.uid} style={styles.slotWrapper}>
                    <div
                      style={{
                        ...styles.skillSlot,
                        ...styles.ogcdSlot,
                        backgroundColor: entry.skill.color,
                      }}
                      title={`${entry.skill.name} (威力: ${entry.skill.potency})`}
                      onClick={() => onRemoveEntry(entry.uid)}
                    >
                      <div style={styles.slotName}>{entry.skill.name}</div>
                      <div style={styles.slotPotency}>
                        {entry.skill.potency}
                      </div>
                    </div>
                    <div style={styles.slotIndex}>{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.hint}>
        クリックでスキルを削除
      </div>
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
    border: "2px dashed #444",
    borderRadius: "8px",
    padding: "16px",
    transition: "border-color 0.2s, background-color 0.2s",
    minHeight: "200px",
    overflow: "auto",
  },
  dropZoneActive: {
    borderColor: "#ffd700",
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
  timelineContent: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  lane: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },
  laneLabel: {
    width: "48px",
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: "bold",
    color: "#888",
    textTransform: "uppercase" as const,
    paddingTop: "10px",
    textAlign: "right" as const,
  },
  laneSlots: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    flex: 1,
  },
  slotWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  skillSlot: {
    width: "64px",
    height: "48px",
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "opacity 0.15s",
    border: "1px solid rgba(255,255,255,0.2)",
  },
  ogcdSlot: {
    borderRadius: "50%",
    width: "48px",
    height: "48px",
  },
  slotName: {
    fontSize: "10px",
    fontWeight: "bold",
    color: "#000",
    textAlign: "center" as const,
    lineHeight: "1.1",
    maxWidth: "58px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  slotPotency: {
    fontSize: "9px",
    color: "rgba(0,0,0,0.7)",
  },
  slotIndex: {
    fontSize: "9px",
    color: "#666",
  },
  hint: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#555",
    textAlign: "center" as const,
  },
};
