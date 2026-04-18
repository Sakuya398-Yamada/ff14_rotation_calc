import { useState } from "react";
import type { Skill, CharacterStats, PlayerLevel } from "../types/skill";
import type { JobId } from "./App";
import { calcCritRate, calcCritMultiplier, calcDhRate, calcDetMultiplier, calcGcd } from "../logic/stat-calc";
import "./timeline.css";

const SUPPORTED_LEVELS: PlayerLevel[] = [70, 80, 90, 100];

const JOBS: { id: JobId; name: string }[] = [
  { id: "whm", name: "白魔道士" },
  { id: "drg", name: "竜騎士" },
  { id: "brd", name: "詩人" },
  { id: "pct", name: "ピクトマンサー" },
  { id: "blm", name: "黒魔道士" },
];

interface CollapsibleSectionProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={styles.section}>
      <h3
        style={styles.collapsibleTitle}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span style={styles.collapseIcon}>{open ? "▼" : "▶"}</span>
        {title}
      </h3>
      {open && children}
    </div>
  );
}

interface SkillPaletteProps {
  skills: Skill[];
  stats: CharacterStats;
  onStatsChange: (stats: CharacterStats) => void;
  level: PlayerLevel;
  onLevelChange: (level: PlayerLevel) => void;
  selectedJob: JobId;
  onJobChange: (jobId: JobId) => void;
}

export function SkillPalette({
  skills,
  stats,
  onStatsChange,
  level,
  onLevelChange,
  selectedJob,
  onJobChange,
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

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onLevelChange(Number(e.target.value) as PlayerLevel);
  };

  return (
    <div className="custom-scrollbar" style={styles.container}>
      <div style={styles.titleRow}>
        <h2 style={styles.title}>ジョブパレット</h2>
        <select
          style={styles.jobSelect}
          value={selectedJob}
          onChange={(e) => onJobChange(e.target.value as JobId)}
        >
          {JOBS.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>
      </div>

      {/* レベル設定 */}
      <CollapsibleSection title={<>レベル<span style={{ textTransform: "none" }}>（α版）</span></>} defaultOpen={false}>
        <div style={styles.alphaNotice}>
          他レベルでのスキルの有無・威力は保証されていません
        </div>
        <div style={styles.levelRow}>
          <label style={styles.levelLabel}>Lv.</label>
          <select
            value={level}
            onChange={handleLevelChange}
            style={styles.levelSelect}
          >
            {SUPPORTED_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {lv}
              </option>
            ))}
          </select>
        </div>
        {level < 100 && (
          <div style={styles.levelWarning}>
            Lv{level}の威力値は正確でない可能性があります
          </div>
        )}
      </CollapsibleSection>

      {/* ステータス入力セクション */}
      <CollapsibleSection title="ステータス">
        <div style={styles.statInputs}>
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
      </CollapsibleSection>

      <CollapsibleSection title="GCD">
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
                draggable={false}
              />
              <div style={styles.skillInfo}>
                <div style={styles.skillName}>{skill.name}</div>
                <div style={styles.skillPotency}>威力 {skill.potency}</div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="oGCD">
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
                draggable={false}
              />
              <div style={styles.skillInfo}>
                <div style={styles.skillName}>{skill.name}</div>
                <div style={styles.skillPotency}>威力 {skill.potency}</div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
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
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    color: "#e0e0e0",
    flexShrink: 0,
  },
  jobSelect: {
    flex: 1,
    padding: "4px 6px",
    fontSize: "13px",
    backgroundColor: "#16213e",
    border: "1px solid #444",
    borderRadius: "4px",
    color: "#e0e0e0",
    outline: "none",
    cursor: "pointer",
    minWidth: 0,
  },
  section: {
    marginBottom: "20px",
  },
  collapsibleTitle: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    cursor: "pointer",
    userSelect: "none" as const,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  collapseIcon: {
    fontSize: "10px",
    width: "12px",
    display: "inline-block",
  },
  sectionTitle: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  },
  levelRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  levelLabel: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#e0e0e0",
    flexShrink: 0,
  },
  levelSelect: {
    flex: 1,
    padding: "6px 8px",
    fontSize: "14px",
    backgroundColor: "#16213e",
    border: "1px solid #444",
    borderRadius: "4px",
    color: "#e0e0e0",
    outline: "none",
    cursor: "pointer",
  },
  alphaNotice: {
    marginBottom: "8px",
    padding: "4px 8px",
    fontSize: "11px",
    color: "#90caf9",
    backgroundColor: "rgba(144, 202, 249, 0.1)",
    borderRadius: "4px",
    border: "1px solid rgba(144, 202, 249, 0.3)",
  },
  levelWarning: {
    marginTop: "6px",
    padding: "4px 8px",
    fontSize: "11px",
    color: "#ffa726",
    backgroundColor: "rgba(255, 167, 38, 0.1)",
    borderRadius: "4px",
    border: "1px solid rgba(255, 167, 38, 0.3)",
  },
  statInputs: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
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
    pointerEvents: "none" as const,
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
