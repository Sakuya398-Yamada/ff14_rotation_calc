import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Skill, CharacterStats } from "../types/skill";
import type { PaletteDragData } from "./timeline/dnd-types";
import { calcCritRate, calcCritMultiplier, calcDhRate, calcDetMultiplier, calcGcd } from "../logic/stat-calc";
import "./timeline.css";

interface CollapsibleSectionProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={styles.section}>
      {/* 開閉は h3 で受ける（ボタンのクリック・Enter/Space もここへバブリングする） */}
      <h3
        style={styles.collapsibleTitle}
        onClick={() => setOpen((prev) => !prev)}
      >
        <button type="button" aria-expanded={open} style={styles.collapsibleButton}>
          <span aria-hidden="true" style={styles.collapseIcon}>{open ? "▼" : "▶"}</span>
          {title}
        </button>
      </h3>
      {open && children}
    </div>
  );
}

/** dnd-kit のドラッグ元となるスキルカード（タッチ・マウス両対応） */
function PaletteSkillCard({ skill }: { skill: Skill }) {
  const data: PaletteDragData = { source: "palette", skillId: skill.id, skillType: skill.type };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `palette-${skill.id}`,
    data,
  });
  // GCD は角丸四角・実線枠、アビリティは円形アイコン・破線枠で形でも区別する
  const isOgcd = skill.type === "ogcd";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...styles.skillCard,
        borderStyle: isOgcd ? "dashed" : "solid",
        // none にするとカード上から始まるスワイプでパレットがスクロールできなくなる。
        // delay 式 TouchSensor では manipulation で十分（長押し成立後は dnd-kit が preventDefault する）
        touchAction: "manipulation",
        ...(isDragging ? { opacity: 0.5 } : {}),
      }}
      title={`${skill.name} (威力: ${skill.potency})`}
    >
      <img
        src={skill.icon}
        alt={skill.name}
        style={{ ...styles.skillIcon, borderRadius: isOgcd ? "50%" : "var(--radius-md)" }}
        draggable={false}
      />
      <div style={styles.skillInfo}>
        <div style={styles.skillName}>{skill.name}</div>
        <div className="num" style={styles.skillPotency}>威力 {skill.potency}</div>
      </div>
    </div>
  );
}

interface SkillPaletteProps {
  skills: Skill[];
  stats: CharacterStats;
  onStatsChange: (stats: CharacterStats) => void;
}

export function SkillPalette({
  skills,
  stats,
  onStatsChange,
}: SkillPaletteProps) {
  const gcdSkills = skills.filter((s) => s.type === "gcd" && !s.hidden);
  const ogcdSkills = skills.filter((s) => s.type === "ogcd" && !s.hidden);

  const handleStatChange = (key: keyof CharacterStats, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    onStatsChange({ ...stats, [key]: num });
  };

  const statFields: { key: keyof CharacterStats; label: string; abbr: string; min: number; detail: string }[] = [
    {
      key: "critical",
      label: "クリティカル",
      abbr: "CRT",
      min: 420,
      detail: `発生率 ${(calcCritRate(stats) * 100).toFixed(1)}% / 倍率 x${calcCritMultiplier(stats).toFixed(3)}`,
    },
    { key: "directHit", label: "ダイレクトヒット", abbr: "DH", min: 420, detail: `発生率 ${(calcDhRate(stats) * 100).toFixed(1)}%` },
    { key: "determination", label: "意思力", abbr: "DET", min: 440, detail: `倍率 x${calcDetMultiplier(stats).toFixed(3)}` },
    { key: "speed", label: "スピード", abbr: "SS", min: 420, detail: `GCD ${calcGcd(2.5, stats).toFixed(2)}s` },
  ];

  return (
    <div className="custom-scrollbar" style={styles.container}>
      <div style={styles.titleRow}>
        <h2 style={styles.title}>ジョブパレット</h2>
      </div>

      {/* ステータス入力セクション */}
      <CollapsibleSection title="ステータス">
        <div style={styles.statTable}>
          {statFields.map((field, i) => (
            <div key={field.key} style={i === statFields.length - 1 ? styles.statItemLast : styles.statItem}>
              <label style={styles.statRow}>
                <span style={styles.statLabel}>
                  {field.label}
                  <span style={styles.statAbbr}>{field.abbr}</span>
                </span>
                <input
                  type="number"
                  className="num"
                  value={stats[field.key]}
                  onChange={(e) => handleStatChange(field.key, e.target.value)}
                  style={styles.statInput}
                  min={field.min}
                />
              </label>
              <div className="num" style={styles.statDetail}>{field.detail}</div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="GCD">
        <div style={styles.skillGrid}>
          {gcdSkills.map((skill) => (
            <PaletteSkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="oGCD">
        <div style={styles.skillGrid}>
          {ogcdSkills.map((skill) => (
            <PaletteSkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

const fieldBase: React.CSSProperties = {
  fontSize: "13px",
  backgroundColor: "var(--color-raised)",
  border: "1px solid var(--color-field)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-text)",
  fontFamily: "inherit",
};

const statItemBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "var(--space-2) 10px",
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "280px",
    boxSizing: "border-box",
    backgroundColor: "var(--color-surface)",
    borderRight: "1px solid var(--color-line)",
    padding: "var(--space-5) var(--space-4)",
    overflowY: "auto",
    flexShrink: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    marginBottom: "var(--space-5)",
  },
  title: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--color-text)",
    flexShrink: 0,
  },
  section: {
    marginBottom: "var(--space-5)",
  },
  collapsibleTitle: {
    margin: "0 0 var(--space-2) 0",
    fontSize: "13px",
    fontWeight: 700,
  },
  collapsibleButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    minHeight: "28px",
    padding: 0,
    border: "none",
    background: "transparent",
    color: "var(--color-text)",
    font: "inherit",
    textAlign: "left" as const,
    cursor: "pointer",
    userSelect: "none" as const,
  },
  collapseIcon: {
    fontSize: "8px",
    width: "12px",
    display: "inline-block",
    color: "var(--color-muted)",
  },
  statTable: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--color-line)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--color-raised)",
  },
  statItem: {
    ...statItemBase,
    borderBottom: "1px solid var(--color-line-soft)",
  },
  statItemLast: statItemBase,
  statRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-2)",
  },
  statLabel: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    fontSize: "12px",
    color: "var(--color-text)",
    minWidth: 0,
  },
  statAbbr: {
    fontSize: "10px",
    color: "var(--color-muted)",
  },
  statInput: {
    ...fieldBase,
    width: "76px",
    boxSizing: "border-box",
    padding: "var(--space-1) 6px",
    textAlign: "right" as const,
  },
  statDetail: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
  skillGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  skillCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px var(--space-2)",
    backgroundColor: "var(--color-raised)",
    borderWidth: "1px",
    borderColor: "var(--color-field)",
    borderRadius: "var(--radius-md)",
    cursor: "grab",
    userSelect: "none" as const,
  },
  skillIcon: {
    width: "32px",
    height: "32px",
    flexShrink: 0,
    objectFit: "cover" as const,
  },
  skillInfo: {
    minWidth: 0,
    pointerEvents: "none" as const,
  },
  skillName: {
    fontSize: "13px",
    color: "var(--color-text)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  skillPotency: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
};
