import { useEffect, useRef, useState } from "react";
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
  /** 開始時刻のマニュアル設定/解除ハンドラ。undefined を渡すと自動計算に戻る */
  onManualStartTimeChange: (uid: string, manualStartTime: number | undefined) => void;
}

export function SkillDetailPanel({
  entry,
  resolvedSkill,
  buffDefMap,
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
          <div style={styles.headerStartTimeRow}>
            <label style={styles.headerStartTimeLabel} htmlFor="manual-start-time-input">開始時刻:</label>
            <input
              id="manual-start-time-input"
              type="number"
              step="0.01"
              min="0"
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
          </div>
          {isManual && (
            <div style={styles.headerAutoHint}>
              （自動計算値: {entry.autoStartTime.toFixed(2)}s）
            </div>
          )}
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
  headerStartTimeRow: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "4px",
    fontSize: "11px",
    color: "#aaa",
    flexWrap: "wrap" as const,
  },
  headerStartTimeLabel: {
    color: "#aaa",
  },
  startTimeInput: {
    width: "64px",
    padding: "2px 4px",
    fontSize: "12px",
    backgroundColor: "#0f0f23",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#444",
    borderRadius: "3px",
    color: "#e0e0e0",
    fontFamily: "monospace",
  },
  startTimeInputManual: {
    borderColor: "#ffa726",
    color: "#ffa726",
  },
  startTimeUnit: {
    color: "#888",
  },
  resetButton: {
    padding: "1px 6px",
    fontSize: "10px",
    backgroundColor: "transparent",
    border: "1px solid #555",
    borderRadius: "3px",
    color: "#aaa",
    cursor: "pointer",
    marginLeft: "2px",
  },
  headerAutoHint: {
    fontSize: "10px",
    color: "#666",
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
