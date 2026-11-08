import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n";
import type { PpsRange } from "../types/skill";
import type { calcPps } from "../logic/resolve-timeline";

type PpsResult = ReturnType<typeof calcPps>;

interface SummaryBarProps {
  totalExpectedPotency: number;
  dotExpectedPotency: number;
  overallPps: PpsResult | null;
  rangePps: PpsResult | null;
  ppsRange: PpsRange | null;
  /** 全体 PPS の分母と同じ、最後の GCD のリキャスト完了時刻（詠唱がリキャストより長ければ詠唱完了） */
  duration: number;
  /** DoT が所要時間より後まで続くときの、最後の DoT ティックの時刻（所要時間の注記に出す） */
  lastDotTickTime: number | null;
}

const EMPTY = "—";

/** ヘッダー直下の集計行（合計期待威力・PPS・DoT・所要時間） */
export function SummaryBar({
  totalExpectedPotency,
  dotExpectedPotency,
  overallPps,
  rangePps,
  ppsRange,
  duration,
  lastDotTickTime,
}: SummaryBarProps) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const hasResult = totalExpectedPotency > 0;
  const items: { label: string; value: string; note?: string; accent?: boolean }[] = [
    {
      label: t("summaryBar.totalExpectedPotency"),
      value: hasResult ? totalExpectedPotency.toLocaleString(lang) : EMPTY,
    },
    { label: t("summaryBar.ppsOverall"), value: overallPps ? overallPps.pps.toFixed(2) : EMPTY, accent: true },
    {
      label: t("summaryBar.ppsRange"),
      value: rangePps ? rangePps.pps.toFixed(2) : EMPTY,
      note: ppsRange
        ? `${ppsRange.startTime.toFixed(1)}–${ppsRange.endTime.toFixed(1)}s`
        : t("summaryBar.ppsRangeUnset"),
    },
    {
      label: t("summaryBar.dotExpectedPotency"),
      value: hasResult ? dotExpectedPotency.toLocaleString(lang) : EMPTY,
    },
    {
      label: t("summaryBar.duration"),
      value: duration > 0 ? `${duration.toFixed(1)}s` : EMPTY,
      note:
        lastDotTickTime !== null
          ? t("summaryBar.durationLastDotTick", { time: lastDotTickTime.toFixed(1) })
          : undefined,
    },
  ];

  return (
    <section aria-label={t("summaryBar.regionLabel")} style={styles.bar}>
      {items.map((item) => (
        <div key={item.label} style={styles.cell}>
          <span style={styles.label}>
            {item.label}
            {item.note && <span className="num" style={styles.note}>{item.note}</span>}
          </span>
          <span className="num" style={item.accent ? { ...styles.value, color: "var(--color-accent)" } : styles.value}>
            {item.value}
          </span>
        </div>
      ))}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    borderBottom: "1px solid var(--color-line)",
    backgroundColor: "var(--color-surface)",
  },
  cell: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    padding: "var(--space-3) var(--space-5)",
    borderRight: "1px solid var(--color-line-soft)",
    minWidth: 0,
  },
  label: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "6px",
    fontSize: "11px",
    color: "var(--color-muted)",
  },
  note: {
    fontSize: "10px",
  },
  value: {
    fontSize: "22px",
    fontWeight: 500,
    color: "var(--color-text)",
  },
};
