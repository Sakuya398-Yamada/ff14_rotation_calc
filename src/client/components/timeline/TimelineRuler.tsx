import { styles } from "./styles";
import { PX_PER_SEC } from "./constants";

interface TimelineRulerProps {
  rulerTicks: number[];
  labelBg: string;
}

/** タイムライン下部の時間軸ルーラー */
export function TimelineRuler({ rulerTicks, labelBg }: TimelineRulerProps) {
  return (
    <div style={styles.ruler}>
      <div style={{ ...styles.rulerLabel, backgroundColor: labelBg }} />
      <div style={styles.rulerContent}>
        {rulerTicks.map((t) => {
          const isMajor = t % 1 === 0;
          return (
            <div
              key={t}
              style={{
                ...styles.rulerTick,
                left: t * PX_PER_SEC,
                height: isMajor ? "12px" : "6px",
              }}
            >
              <div style={styles.rulerTickLine} />
              {isMajor && (
                <div style={styles.rulerTickLabel}>{t}s</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
