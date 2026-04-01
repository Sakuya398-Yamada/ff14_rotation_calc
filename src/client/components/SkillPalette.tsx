import type { Skill, CharacterStats } from "../types/skill";
import { calcCritRate, calcCritMultiplier, calcDhRate, calcDetMultiplier, calcGcd } from "../logic/stat-calc";
import "./timeline.css";

interface SkillPaletteProps {
  skills: Skill[];
  stats: CharacterStats;
  statsEnabled: boolean;
  onStatsChange: (stats: CharacterStats) => void;
  onStatsEnabledChange: (enabled: boolean) => void;
}

export function SkillPalette({
  skills,
  stats,
  statsEnabled,
  onStatsChange,
  onStatsEnabledChange,
}: SkillPaletteProps) {
  const gcdSkills = skills.filter((s) => s.type === "gcd");
  const ogcdSkills = skills.filter((s) => s.type === "ogcd");

  const handleDragStart = (e: React.DragEvent, skill: Skill) => {
    e.dataTransfer.setData("application/skill-id", skill.id);
    e.dataTransfer.setData(`application/skill-type-${skill.type}`, "1");
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleStatChange = (key: keyof CharacterStats, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    onStatsChange({ ...stats, [key]: num });
  };

  return (
    <div className="custom-scrollbar" style={styles.container}>
      <h2 style={styles.title}>スキルパレット</h2>

      {/* ステータス入力セクション */}
      <div style={styles.section}>
        <div style={styles.statHeader}>
          <h3 style={styles.sectionTitle}>ステータス</h3>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={statsEnabled}
              onChange={(e) => onStatsEnabledChange(e.target.checked)}
              style={styles.checkbox}
            />
            <span style={{
              ...styles.toggleText,
              color: statsEnabled ? "#4fc3f7" : "#666",
            }}>
              {statsEnabled ? "ON" : "OFF"}
            </span>
          </label>
        </div>
        <div style={{
          ...styles.statInputs,
          opacity: statsEnabled ? 1 : 0.4,
          pointerEvents: statsEnabled ? "auto" : "none",
        }}>
          <div style={styles.statRow}>
            <label style={styles.statLabel}>CRT</label>
            <input
              type="number"
              value={stats.critical}
              onChange={(e) => handleStatChange("critical", e.target.value)}
              style={styles.statInput}
              min={420}
            />
          </div>
          <div style={styles.statDetail}>
            発生率: {(calcCritRate(stats) * 100).toFixed(1)}% / 倍率: x{calcCritMultiplier(stats).toFixed(3)}
          </div>
          <div style={styles.statRow}>
            <label style={styles.statLabel}>DH</label>
            <input
              type="number"
              value={stats.directHit}
              onChange={(e) => handleStatChange("directHit", e.target.value)}
              style={styles.statInput}
              min={420}
            />
          </div>
          <div style={styles.statDetail}>
            発生率: {(calcDhRate(stats) * 100).toFixed(1)}%
          </div>
          <div style={styles.statRow}>
            <label style={styles.statLabel}>DET</label>
            <input
              type="number"
              value={stats.determination}
              onChange={(e) => handleStatChange("determination", e.target.value)}
              style={styles.statInput}
              min={440}
            />
          </div>
          <div style={styles.statDetail}>
            倍率: x{calcDetMultiplier(stats).toFixed(3)}
          </div>
          <div style={styles.statRow}>
            <label style={styles.statLabel}>SS</label>
            <input
              type="number"
              value={stats.speed}
              onChange={(e) => handleStatChange("speed", e.target.value)}
              style={styles.statInput}
              min={420}
            />
          </div>
          <div style={styles.statDetail}>
            GCD: {calcGcd(2.5, stats).toFixed(2)}s
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>GCD</h3>
        <div style={styles.skillGrid}>
          {gcdSkills.map((skill) => (
            <div
              key={skill.id}
              draggable
              onDragStart={(e) => handleDragStart(e, skill)}
              style={styles.skillCard}
              title={`${skill.name} (威力: ${skill.potency})`}
            >
              <img
                src={skill.icon}
                alt={skill.name}
                style={styles.skillIcon}
              />
              <div style={styles.skillInfo}>
                <div style={styles.skillName}>{skill.name}</div>
                <div style={styles.skillPotency}>威力 {skill.potency}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>oGCD</h3>
        <div style={styles.skillGrid}>
          {ogcdSkills.map((skill) => (
            <div
              key={skill.id}
              draggable
              onDragStart={(e) => handleDragStart(e, skill)}
              style={styles.skillCard}
              title={`${skill.name} (威力: ${skill.potency})`}
            >
              <img
                src={skill.icon}
                alt={skill.name}
                style={styles.skillIcon}
              />
              <div style={styles.skillInfo}>
                <div style={styles.skillName}>{skill.name}</div>
                <div style={styles.skillPotency}>威力 {skill.potency}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "280px",
    backgroundColor: "#1a1a2e",
    borderRight: "1px solid #333",
    padding: "16px",
    overflowY: "auto",
    flexShrink: 0,
  },
  title: {
    margin: "0 0 16px 0",
    fontSize: "18px",
    color: "#e0e0e0",
  },
  section: {
    marginBottom: "20px",
  },
  sectionTitle: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },
  statHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
  },
  checkbox: {
    cursor: "pointer",
  },
  toggleText: {
    fontSize: "12px",
    fontWeight: "bold",
  },
  statInputs: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    transition: "opacity 0.2s",
  },
  statRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  statLabel: {
    width: "32px",
    fontSize: "12px",
    fontWeight: "bold",
    color: "#aaa",
    flexShrink: 0,
  },
  statInput: {
    flex: 1,
    padding: "4px 8px",
    fontSize: "13px",
    backgroundColor: "#16213e",
    border: "1px solid #444",
    borderRadius: "4px",
    color: "#e0e0e0",
    outline: "none",
  },
  statDetail: {
    fontSize: "11px",
    color: "#4fc3f7",
    paddingLeft: "40px",
    marginTop: "-2px",
    marginBottom: "2px",
  },
  skillGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  skillCard: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    backgroundColor: "#16213e",
    borderRadius: "6px",
    cursor: "grab",
    userSelect: "none" as const,
    transition: "background-color 0.15s",
  },
  skillIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    flexShrink: 0,
    objectFit: "contain" as const,
  },
  skillInfo: {
    minWidth: 0,
  },
  skillName: {
    fontSize: "13px",
    color: "#e0e0e0",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  skillPotency: {
    fontSize: "11px",
    color: "#888",
  },
};
