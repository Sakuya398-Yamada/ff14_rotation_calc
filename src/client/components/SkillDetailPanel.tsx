import { useEffect, useRef } from "react";
import type { ResolvedTimelineEntry, Skill, BuffDefinition, CharacterStats } from "../types/skill";
import { calcExpectedMultiplier } from "../logic/stat-calc";
import { getBuffContributions } from "../logic/buff-contribution";

interface SkillDetailPanelProps {
  entry: ResolvedTimelineEntry;
  /** entry.resolvedSkillId に対応するスキル（autoTransform 後の実表示スキル） */
  resolvedSkill: Skill;
  buffDefMap: Map<string, BuffDefinition>;
  stats: CharacterStats;
  onClose: () => void;
}

export function SkillDetailPanel({
  entry,
  resolvedSkill,
  buffDefMap,
  stats,
  onClose,
}: SkillDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      // Timeline のスキルアイコンをクリックした場合は、新しいエントリへの切替なので閉じない
      if (target.closest?.("[data-skill-entry-uid]")) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const hasError =
    entry.resourceErrors.length > 0 ||
    entry.comboErrors.length > 0 ||
    entry.untargetableError ||
    entry.recastError;

  // エラー時は entry.buffMultiplier / critRateBonus / dhRateBonus が 0/1 に倒されるため、
  // 個別バフ寄与も同様に空扱いにして集約値との整合を保つ
  const contributions = hasError ? [] : getBuffContributions(entry.activeBuffs, buffDefMap, entry.resolvedSkillId);
  const potencyContribs = contributions.filter((c) => c.potencyMultiplier !== undefined);
  const critContribs = contributions.filter((c) => c.critRateBonus !== undefined || c.guaranteedCrit);
  const dhContribs = contributions.filter((c) => c.dhRateBonus !== undefined || c.guaranteedDh);

  const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
  const expectedMul = calcExpectedMultiplier(stats, entry.critRateBonus, entry.dhRateBonus);
  const expectedValue = !hasError && entry.resolvedPotency > 0
    ? Math.floor(buffedPotency * expectedMul)
    : null;

  const errorMessages: string[] = [];
  if (entry.resourceErrors.length > 0) errorMessages.push(`リソース不足: ${entry.resourceErrors.join(", ")}`);
  if (entry.comboErrors.length > 0) errorMessages.push(`バフ条件未達成: ${entry.comboErrors.join(", ")}`);
  if (entry.untargetableError) errorMessages.push("ボス離脱中");
  if (entry.recastError) errorMessages.push("リキャスト中");

  return (
    <aside ref={panelRef} style={styles.panel} aria-label="スキル詳細パネル">
      <div style={styles.header}>
        <img src={resolvedSkill.icon} alt={resolvedSkill.name} style={styles.headerIcon} />
        <div style={styles.headerText}>
          <div style={styles.headerName}>{resolvedSkill.name}</div>
          <div style={styles.headerStartTime}>開始時刻: {entry.startTime.toFixed(2)}s</div>
        </div>
        <button type="button" onClick={onClose} style={styles.closeButton} aria-label="閉じる">×</button>
      </div>

      <div style={styles.body}>
        <Row label="基本威力" value={`${entry.resolvedPotency}`} />

        <Section label="バフ倍率" value={`×${entry.buffMultiplier.toFixed(2)}`}>
          {potencyContribs.length === 0 ? (
            <div style={styles.emptyContrib}>適用なし</div>
          ) : (
            potencyContribs.map((c) => (
              <ContribRow
                key={c.buffId}
                name={c.name}
                value={`×${c.potencyMultiplier!.toFixed(2)}`}
                color={c.color}
              />
            ))
          )}
        </Section>

        <Section label="CRT率ボーナス" value={formatPercent(entry.critRateBonus)}>
          {critContribs.length === 0 ? (
            <div style={styles.emptyContrib}>適用なし</div>
          ) : (
            critContribs.map((c) => (
              <ContribRow
                key={c.buffId}
                name={c.name}
                value={c.guaranteedCrit
                  ? "確定CRT"
                  : formatPercent(c.critRateBonus ?? 0)}
                color={c.color}
              />
            ))
          )}
        </Section>

        <Section label="DH率ボーナス" value={formatPercent(entry.dhRateBonus)}>
          {dhContribs.length === 0 ? (
            <div style={styles.emptyContrib}>適用なし</div>
          ) : (
            dhContribs.map((c) => (
              <ContribRow
                key={c.buffId}
                name={c.name}
                value={c.guaranteedDh
                  ? "確定DH"
                  : formatPercent(c.dhRateBonus ?? 0)}
                color={c.color}
              />
            ))
          )}
        </Section>

        <div style={styles.expectedBox}>
          <div style={styles.sectionLabel}>期待値</div>
          <div style={styles.expectedValue}>
            {expectedValue !== null ? expectedValue : "—"}
          </div>
          {expectedValue !== null && (
            <div style={styles.expectedFormula}>
              {entry.resolvedPotency} × {entry.buffMultiplier.toFixed(2)} × {expectedMul.toFixed(3)} = {expectedValue}
            </div>
          )}
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>コンボ:</span>
          <span style={entry.wsComboError ? styles.metaWarning : styles.metaOk}>
            {entry.wsComboError ? "不成立" : "成立"}
          </span>
        </div>

        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>エラー:</span>
          {errorMessages.length === 0 ? (
            <span style={styles.metaOk}>なし</span>
          ) : (
            <span style={styles.metaError}>{errorMessages.join(" / ")}</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function formatPercent(value: number): string {
  const pct = value * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

function Section({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionLabel}>■ {label}</span>
        <span style={styles.sectionValue}>{value}</span>
      </div>
      <div style={styles.contribList}>{children}</div>
    </div>
  );
}

function ContribRow({ name, value, color }: { name: string; value: string; color: string }) {
  return (
    <div style={styles.contribRow}>
      <span style={{ ...styles.contribBullet, backgroundColor: color }} />
      <span style={styles.contribName}>{name}</span>
      <span style={styles.contribValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: "320px",
    flexShrink: 0,
    backgroundColor: "#1a1a2e",
    borderLeft: "1px solid #333",
    color: "#e0e0e0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px",
    backgroundColor: "#16213e",
    borderBottom: "1px solid #333",
  },
  headerIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#ffd700",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  headerStartTime: {
    fontSize: "11px",
    color: "#888",
    marginTop: "2px",
  },
  closeButton: {
    background: "none",
    border: "1px solid #555",
    borderRadius: "4px",
    color: "#aaa",
    fontSize: "16px",
    width: "24px",
    height: "24px",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #222",
  },
  rowLabel: {
    fontSize: "12px",
    color: "#aaa",
  },
  rowValue: {
    fontSize: "14px",
    color: "#e0e0e0",
    fontWeight: "bold",
  },
  section: {
    marginTop: "12px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px",
  },
  sectionLabel: {
    color: "#aaa",
  },
  sectionValue: {
    color: "#ffd700",
    fontWeight: "bold",
    fontSize: "13px",
  },
  contribList: {
    marginTop: "4px",
    paddingLeft: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  contribRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
  },
  contribBullet: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  contribName: {
    flex: 1,
    color: "#ccc",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  contribValue: {
    color: "#e0e0e0",
  },
  emptyContrib: {
    fontSize: "11px",
    color: "#666",
    fontStyle: "italic" as const,
  },
  expectedBox: {
    marginTop: "16px",
    padding: "10px",
    backgroundColor: "#0f0f23",
    border: "1px solid #333",
    borderRadius: "6px",
  },
  expectedValue: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#ffd700",
    marginTop: "2px",
  },
  expectedFormula: {
    fontSize: "11px",
    color: "#888",
    marginTop: "4px",
    fontFamily: "monospace",
  },
  metaRow: {
    display: "flex",
    gap: "8px",
    marginTop: "10px",
    fontSize: "12px",
  },
  metaLabel: {
    color: "#aaa",
    flexShrink: 0,
  },
  metaOk: {
    color: "#88dd88",
  },
  metaWarning: {
    color: "#ff9800",
  },
  metaError: {
    color: "#ef5350",
  },
};
