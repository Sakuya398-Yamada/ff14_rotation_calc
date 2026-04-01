import type { Skill } from "../types/skill";

interface SkillPaletteProps {
  skills: Skill[];
}

export function SkillPalette({ skills }: SkillPaletteProps) {
  const gcdSkills = skills.filter((s) => s.type === "gcd");
  const ogcdSkills = skills.filter((s) => s.type === "ogcd");

  const handleDragStart = (e: React.DragEvent, skill: Skill) => {
    e.dataTransfer.setData("application/skill-id", skill.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>スキルパレット</h2>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>GCD</h3>
        <div style={styles.skillGrid}>
          {gcdSkills.map((skill) => (
            <div
              key={skill.id}
              draggable
              onDragStart={(e) => handleDragStart(e, skill)}
              style={{ ...styles.skillCard, borderColor: skill.color }}
              title={`${skill.name} (威力: ${skill.potency})`}
            >
              <div
                style={{ ...styles.skillIcon, backgroundColor: skill.color }}
              >
                {skill.name.charAt(0)}
              </div>
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
              style={{ ...styles.skillCard, borderColor: skill.color }}
              title={`${skill.name} (威力: ${skill.potency})`}
            >
              <div
                style={{ ...styles.skillIcon, backgroundColor: skill.color }}
              >
                {skill.name.charAt(0)}
              </div>
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
    borderLeft: "3px solid",
    cursor: "grab",
    userSelect: "none" as const,
    transition: "background-color 0.15s",
  },
  skillIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#000",
    flexShrink: 0,
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
