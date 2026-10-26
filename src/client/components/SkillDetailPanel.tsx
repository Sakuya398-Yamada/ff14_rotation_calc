import { useEffect, useRef, useState } from "react";
import type { ResolvedTimelineEntry, Skill, BuffDefinition, CharacterStats, ResourceDefinition } from "../types/skill";
import { calcExpectedMultiplier } from "../logic/stat-calc";
import { calcEntryPotencyBreakdown } from "../logic/expected-potency";
import { getBuffContributions } from "../logic/buff-contribution";
import { describeBuffEffects, formatBuffRemaining, formatConsumedProc } from "../logic/buff-format";
import { formatResourceErrors } from "../logic/resource-error-format";

interface SkillDetailPanelProps {
  entry: ResolvedTimelineEntry;
  /** entry.resolvedSkillId に対応するスキル（autoTransform 後の実表示スキル） */
  resolvedSkill: Skill;
  buffDefMap: Map<string, BuffDefinition>;
  resourceDefMap: Map<string, ResourceDefinition>;
  stats: CharacterStats;
  onClose: () => void;
  /** 開始時刻のマニュアル設定/解除ハンドラ。undefined を渡すと自動計算に戻る */
  onManualStartTimeChange: (uid: string, manualStartTime: number | undefined) => void;
}

export function SkillDetailPanel({
  entry,
  resolvedSkill,
  buffDefMap,
  resourceDefMap,
  stats,
  onClose,
  onManualStartTimeChange,
}: SkillDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // 入力中の文字列を別途保持（小数点や空文字を許容するため、数値直結ではなく文字列管理）。
  // entry.uid 切替、または manualStartTime が外部から変わった場合のみ draft を再同期する。
  // autoStartTime は前エントリの変動で連鎖的に変わり得るため、これを同期条件に含めると
  // タイプ中の draft が上書きされてしまう。
  const [startTimeDraft, setStartTimeDraft] = useState<string>(() =>
    (entry.manualStartTime ?? entry.autoStartTime).toFixed(2)
  );
  const lastSyncedRef = useRef<{ uid: string; manualStartTime: number | undefined }>({
    uid: entry.uid,
    manualStartTime: entry.manualStartTime,
  });
  useEffect(() => {
    const last = lastSyncedRef.current;
    if (last.uid !== entry.uid || last.manualStartTime !== entry.manualStartTime) {
      setStartTimeDraft((entry.manualStartTime ?? entry.autoStartTime).toFixed(2));
      lastSyncedRef.current = {
        uid: entry.uid,
        manualStartTime: entry.manualStartTime,
      };
    }
  }, [entry.uid, entry.manualStartTime, entry.autoStartTime]);

  const commitStartTime = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      // 空文字でコミットされたら自動計算に戻す
      onManualStartTimeChange(entry.uid, undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      // 不正値は draft を直前の有効値に戻す
      setStartTimeDraft((entry.manualStartTime ?? entry.autoStartTime).toFixed(2));
      return;
    }
    // 0.01 秒刻みに丸める
    const rounded = Math.round(parsed * 100) / 100;
    onManualStartTimeChange(entry.uid, rounded);
  };

  const handleResetStartTime = () => {
    onManualStartTimeChange(entry.uid, undefined);
  };

  const isManual = entry.manualStartTime !== undefined;

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
      if (e.key !== "Escape") return;
      // パネル内の入力欄にフォーカスがある場合、Escape は入力編集のキャンセル用途を優先する。
      // ここで onClose を呼ぶと「編集キャンセルと同時にパネル全体が閉じる」二重発火になる。
      const active = document.activeElement as HTMLElement | null;
      if (active && panelRef.current?.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
        return;
      }
      onClose();
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
  // 個別バフ寄与も同様に空扱いにして集約値との整合を保つ。
  // 入力には activeBuffsAtUse（消費前スナップショット）を使う。ライフサージ等の guaranteedCrit は
  // GCD 使用時に消費され activeBuffs には残らないため、消費前の状態でないと内訳を引けない。
  const contributions = hasError ? [] : getBuffContributions(entry.activeBuffsAtUse, buffDefMap, entry.resolvedSkillId);
  const potencyContribs = contributions.filter((c) => c.potencyMultiplier !== undefined);
  const critContribs = contributions.filter((c) => c.critRateBonus !== undefined || c.guaranteedCrit);
  const dhContribs = contributions.filter((c) => c.dhRateBonus !== undefined || c.guaranteedDh);

  const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
  const expectedMul = calcExpectedMultiplier(stats, entry.critRateBonus, entry.dhRateBonus);
  const singleTargetExpected = !hasError && entry.resolvedPotency > 0
    ? Math.floor(buffedPotency * expectedMul)
    : null;
  // 複数体ヒット内訳。単体時は targets.length <= 1
  const breakdown = !hasError && entry.resolvedPotency > 0
    ? calcEntryPotencyBreakdown(entry, resolvedSkill, stats)
    : null;
  const expectedValue = breakdown ? breakdown.total : singleTargetExpected;
  const isMultiTargetHit = breakdown !== null && breakdown.targets.length > 1;

  const errorMessages: string[] = [];
  errorMessages.push(...formatResourceErrors(entry.resourceErrors, resourceDefMap));
  if (entry.comboErrors.length > 0) errorMessages.push(`バフ条件未達成: ${entry.comboErrors.join(", ")}`);
  if (entry.untargetableError) errorMessages.push("ボス離脱中");
  if (entry.recastError) errorMessages.push("リキャスト中");


  // 使用時点で有効なバフを全件表示する（威力に関係しないバフも含む）。寄与の内訳と違いエラー時も表示する
  const appliedBuffs = entry.activeBuffsAtUse.flatMap((ab) => {
    const def = buffDefMap.get(ab.buffId);
    return def ? [{ activeBuff: ab, def }] : [];
  });

  return (
    <aside ref={panelRef} style={styles.panel} aria-label="スキル詳細パネル">
      <div style={styles.header}>
        <img src={resolvedSkill.icon} alt={resolvedSkill.name} style={styles.headerIcon} />
        <div style={styles.headerName}>{resolvedSkill.name}</div>
        <div style={styles.headerStartTimeRow}>
          <label style={styles.headerStartTimeLabel} htmlFor="manual-start-time-input">開始時刻</label>
          <input
            id="manual-start-time-input"
            type="number"
            step="0.01"
            min="0"
            className="num"
            value={startTimeDraft}
            onChange={(e) => setStartTimeDraft(e.target.value)}
            onBlur={(e) => commitStartTime(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitStartTime((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                // パネル全体の Escape ハンドラ（onClose）への伝播を止める。
                // 入力中の Escape は「編集キャンセル」だけを意図しており、パネル自体は閉じない。
                e.preventDefault();
                e.stopPropagation();
                setStartTimeDraft((entry.manualStartTime ?? entry.autoStartTime).toFixed(2));
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={isManual ? { ...styles.startTimeInput, ...styles.startTimeInputManual } : styles.startTimeInput}
            aria-label="開始時刻"
          />
          <span style={styles.startTimeUnit}>s</span>
          {isManual && (
            <button
              type="button"
              onClick={handleResetStartTime}
              style={styles.resetButton}
              aria-label="自動計算に戻す"
            >
              自動に戻す
            </button>
          )}
          {isManual && (
            <span className="num" style={styles.headerAutoHint}>
              （自動計算値: {entry.autoStartTime.toFixed(2)}s）
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} style={styles.closeButton} aria-label="閉じる">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div style={styles.metrics}>
        <div style={styles.cell}>
          <div style={styles.cellLabel}>基本威力</div>
          <div className="num" style={styles.cellValue}>{entry.resolvedPotency}</div>
          {entry.consumedProc && (
            <div className="num" style={styles.expectedFormula}>
              {formatConsumedProc(entry.consumedProc, buffDefMap)}
            </div>
          )}
        </div>

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

        <div style={styles.cell}>
          <div style={styles.cellLabel}>
            期待値{isMultiTargetHit && breakdown ? ` (×${breakdown.targets.length}体 合算)` : ""}
          </div>
          <div className="num" style={styles.expectedValue}>
            {expectedValue !== null ? expectedValue : "—"}
          </div>
          {singleTargetExpected !== null && !isMultiTargetHit && (
            <div className="num" style={styles.expectedFormula}>
              {entry.resolvedPotency} × {entry.buffMultiplier.toFixed(2)} × {expectedMul.toFixed(3)} = {singleTargetExpected}
            </div>
          )}
          {isMultiTargetHit && breakdown && (
            <div className="num" style={styles.expectedFormula}>
              1体: {breakdown.singleTargetPotency}
              {breakdown.targets.slice(1).map((t, i) => ` / ${i + 2}体目: ${t}`).join("")}
              {" = "}{breakdown.total}
            </div>
          )}
        </div>

        <div style={styles.cell}>
          <div style={styles.metaRow}>
            <span style={styles.cellLabel}>コンボ</span>
            <span style={entry.wsComboError ? styles.metaWarning : styles.metaOk}>
              {entry.wsComboError ? "不成立" : "成立"}
            </span>
          </div>
          {entry.unconfirmedProcBuffs && (
            <div style={styles.metaRow}>
              <span style={{ ...styles.cellLabel, flexShrink: 0 }}>警告</span>
              <span style={styles.metaWarning}>
                {entry.unconfirmedProcBuffs.map((id) => buffDefMap.get(id)?.name ?? id).join(", ")}（確率付与。発動しない場合あり）
              </span>
            </div>
          )}
          <div style={styles.metaRow}>
            <span style={styles.cellLabel}>エラー</span>
            {errorMessages.length === 0 ? (
              <span style={styles.metaOk}>なし</span>
            ) : (
              <span style={styles.metaError}>{errorMessages.join(" / ")}</span>
            )}
          </div>
        </div>
      </div>

      <div style={styles.appliedRow}>
        <span style={styles.cellLabel}>適用中のバフ</span>
        {appliedBuffs.length === 0 ? (
          <span style={styles.emptyContrib}>なし</span>
        ) : (
          <ul style={styles.appliedList} aria-label="適用中のバフ">
            {appliedBuffs.map(({ activeBuff, def }) => {
              const effects = describeBuffEffects(def);
              return (
                <li key={activeBuff.buffId} style={styles.appliedChip} title={def.name}>
                  <span style={{ ...styles.contribBullet, backgroundColor: def.color }} />
                  {def.icon && <img src={def.icon} alt="" style={styles.appliedIcon} />}
                  <span>{def.name}</span>
                  {effects.length > 0 && <span style={styles.appliedMeta}>{effects.join(" / ")}</span>}
                  {def.maxStacks !== undefined && activeBuff.stacks !== undefined && (
                    <span className="num" style={styles.appliedMeta}>×{activeBuff.stacks}</span>
                  )}
                  <span className="num" style={styles.appliedMeta}>残 {formatBuffRemaining(activeBuff, entry.startTime)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function formatPercent(value: number): string {
  const pct = value * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function Section({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div style={styles.cell}>
      <div style={styles.sectionHeader}>
        <span style={styles.cellLabel}>{label}</span>
        <span className="num" style={styles.sectionValue}>{value}</span>
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
      <span className="num" style={styles.contribValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    flexWrap: "wrap",
    alignItems: "center",
    gap: "var(--space-3)",
  },
  headerIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "var(--radius-md)",
    flexShrink: 0,
  },
  headerName: {
    fontSize: "15px",
    fontWeight: 700,
  },
  headerStartTimeRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    flex: "1 1 auto",
  },
  headerStartTimeLabel: {
    fontSize: "12px",
    color: "var(--color-muted)",
  },
  startTimeInput: {
    width: "80px",
    boxSizing: "border-box",
    minHeight: "32px",
    padding: "0 var(--space-2)",
    fontSize: "13px",
    textAlign: "right",
    backgroundColor: "var(--color-raised)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-field)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
  },
  startTimeInputManual: {
    borderColor: "var(--color-warning)",
    color: "var(--color-warning)",
  },
  startTimeUnit: {
    fontSize: "12px",
    color: "var(--color-muted)",
  },
  resetButton: {
    minHeight: "32px",
    padding: "0 10px",
    fontSize: "12px",
    background: "transparent",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  headerAutoHint: {
    fontSize: "11px",
    color: "var(--color-muted)",
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
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
    gap: "var(--space-2)",
  },
  cell: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    padding: "var(--space-2) 10px",
    border: "1px solid var(--color-line)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--color-raised)",
    minWidth: 0,
  },
  cellLabel: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
  cellValue: {
    fontSize: "18px",
    fontWeight: 500,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "var(--space-2)",
  },
  sectionValue: {
    fontSize: "15px",
    fontWeight: 500,
  },
  contribList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  contribRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
  },
  contribBullet: {
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
  },
  contribName: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  contribValue: {
    color: "var(--color-muted)",
  },
  emptyContrib: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
  expectedValue: {
    fontSize: "22px",
    fontWeight: 500,
    color: "var(--color-accent)",
  },
  expectedFormula: {
    fontSize: "11px",
    color: "var(--color-muted)",
    overflowWrap: "anywhere",
  },
  metaRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "var(--space-2)",
    fontSize: "12px",
  },
  metaOk: {
    color: "var(--color-dot)",
  },
  metaWarning: {
    color: "var(--color-warning)",
  },
  metaError: {
    color: "var(--color-error)",
  },
  appliedRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "var(--space-2)",
    paddingTop: "var(--space-3)",
    borderTop: "1px solid var(--color-line-soft)",
  },
  appliedList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  appliedChip: {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    padding: "0 10px 0 var(--space-2)",
    border: "1px solid var(--color-field)",
    borderRadius: "14px",
    backgroundColor: "var(--color-raised)",
    fontSize: "12px",
  },
  appliedIcon: {
    width: "18px",
    height: "18px",
    borderRadius: "3px",
  },
  appliedMeta: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
};
