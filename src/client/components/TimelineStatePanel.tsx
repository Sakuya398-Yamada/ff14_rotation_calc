import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RecastStateAt, Skill, TimelineStateAt } from "../types/skill";
import type { JobId } from "../data/job-registry";
import { resourceName, skillName } from "../logic/display-names";

interface TimelineStatePanelProps {
  jobId: JobId;
  /** resolveStateAt の結果 */
  state: TimelineStateAt;
  /** getRecastStatesAt の結果（リキャストのレーンと同じ並び） */
  recastStates: RecastStateAt[];
  skillMap: Map<string, Skill>;
  onClose: () => void;
}

/**
 * タイムラインをダブルクリックした時刻のリソースとリキャストの状態（#1001）。
 * タイムラインを編集しながら見るので、スキル詳細パネルと違って外のクリックや Escape では閉じない
 */
export function TimelineStatePanel({ jobId, state, recastStates, skillMap, onClose }: TimelineStatePanelProps) {
  const { t } = useTranslation();
  const [expandedSkillIds, setExpandedSkillIds] = useState<ReadonlySet<string>>(new Set());
  // 上限が 0 の時間帯（賢人のバラード中の詩心など）は、そのリソースを使わないので出さない（リソースレーンと同じ）
  const resources = state.resources.filter((r) => r.maxStacks > 0);

  const toggleExpanded = (skillId: string) => {
    setExpandedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  return (
    <aside style={styles.panel} aria-label={t("timelineStatePanel.label")}>
      <div style={styles.header}>
        <h2 className="num" style={styles.heading}>
          {t("timelineStatePanel.heading", { time: state.time.toFixed(2) })}
        </h2>
        <button type="button" onClick={onClose} style={styles.closeButton} aria-label={t("timelineStatePanel.close")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div style={styles.sections}>
        {resources.length > 0 && (
          <section style={styles.section} aria-label={t("timelineStatePanel.resources")}>
            <h3 style={styles.sectionHeading}>{t("timelineStatePanel.resources")}</h3>
            <ul style={styles.list}>
              {resources.map((r) => (
                <li key={r.resourceId} style={styles.row}>
                  <span style={styles.name}>{resourceName(t, jobId, r.resourceId)}</span>
                  <span className="num" style={styles.value}>{r.value} / {r.maxStacks}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recastStates.length > 0 && (
          <section style={styles.section} aria-label={t("timelineStatePanel.recasts")}>
            <h3 style={styles.sectionHeading}>{t("timelineStatePanel.recasts")}</h3>
            <ul style={styles.list}>
              {recastStates.map((recast) => {
                const name = skillName(t, jobId, recast.skillId);
                const icon = skillMap.get(recast.skillId)?.icon;
                const expanded = expandedSkillIds.has(recast.skillId);
                const remaining = recast.remaining.toFixed(2);
                return (
                  <li key={recast.skillId} style={styles.recastItem}>
                    <div style={styles.row}>
                      {icon && <img src={icon} alt="" style={styles.recastIcon} />}
                      <span style={styles.name}>{name}</span>
                      {recast.charges !== undefined && (
                        <span className="num" style={styles.muted}>
                          {t("timelineStatePanel.charges", { charges: recast.charges, max: recast.maxCharges })}
                        </span>
                      )}
                      <span className="num" style={recast.available ? styles.available : styles.value}>
                        {recast.available
                          ? recast.remaining > 0
                            ? `${t("timelineStatePanel.available")} / ${t("timelineStatePanel.nextCharge", { seconds: remaining })}`
                            : t("timelineStatePanel.available")
                          : t("timelineStatePanel.remaining", { seconds: remaining })}
                      </span>
                      {recast.actualEndTime !== undefined && (
                        <button
                          type="button"
                          style={{ ...styles.expandButton, ...(expanded ? styles.expandButtonExpanded : {}) }}
                          aria-expanded={expanded}
                          aria-label={t("timelineStatePanel.showActualEndTime", { name })}
                          onClick={() => toggleExpanded(recast.skillId)}
                        >
                          ＞
                        </button>
                      )}
                    </div>
                    {expanded && recast.actualEndTime !== undefined && (
                      <div className="num" style={styles.actualEndTime}>
                        {t("timelineStatePanel.actualEndTime", { time: recast.actualEndTime.toFixed(2) })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // 枠・余白はスキル詳細パネル（SkillDetailPanel）と揃える
  panel: {
    flexShrink: 0,
    maxHeight: "45vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    padding: "var(--space-3) var(--space-4)",
    borderTop: "1px solid var(--color-line)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  },
  heading: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 700,
  },
  closeButton: {
    marginLeft: "auto",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "var(--radius-md)",
    background: "transparent",
    color: "var(--color-muted)",
    cursor: "pointer",
  },
  sections: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
    gap: "var(--space-3)",
    alignItems: "start",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    minWidth: 0,
  },
  sectionHeading: {
    margin: 0,
    fontSize: "11px",
    fontWeight: 400,
    color: "var(--color-muted)",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  recastItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    fontSize: "13px",
  },
  name: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  value: {
    whiteSpace: "nowrap",
  },
  available: {
    whiteSpace: "nowrap",
    color: "var(--color-accent)",
  },
  muted: {
    whiteSpace: "nowrap",
    fontSize: "12px",
    color: "var(--color-muted)",
  },
  recastIcon: {
    width: "24px",
    height: "24px",
    borderRadius: "var(--radius-sm)",
    flexShrink: 0,
  },
  expandButton: {
    minWidth: "28px",
    minHeight: "28px",
    padding: 0,
    fontSize: "12px",
    background: "transparent",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  expandButtonExpanded: {
    transform: "rotate(90deg)",
  },
  actualEndTime: {
    paddingLeft: "30px",
    fontSize: "12px",
    color: "var(--color-muted)",
  },
};
