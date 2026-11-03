import { useTranslation } from "react-i18next";
import type { BuffDefinition, ActiveBuff } from "../../types/skill";
import type { JobId } from "../../data/job-registry";
import { buffName, buffShortName } from "../../logic/display-names";
import { formatProcRate, formatProcRateShort } from "../../logic/buff-format";
import { styles } from "./styles";
import { PX_PER_SEC } from "./constants";

interface BuffLanesProps {
  jobId: JobId;
  buffs: BuffDefinition[];
  buffTimespans: Map<string, ActiveBuff[]>;
  totalDuration: number;
  labelBg: string;
}

/** バフレーン（バフ定義ごとに1行、適用スパンをバー描画） */
export function BuffLanes({ jobId, buffs, buffTimespans, totalDuration, labelBg }: BuffLanesProps) {
  const { t } = useTranslation();
  return (
    <>
      {buffs.map((buffDef) => {
        const spans = buffTimespans.get(buffDef.id);
        if (!spans || spans.length === 0) return null;
        const name = buffName(t, jobId, buffDef.id);
        return (
          <div key={buffDef.id} style={styles.buffLane}>
            <div style={{ ...styles.buffLaneLabel, backgroundColor: labelBg }} title={name}>
              {buffShortName(t, jobId, buffDef.id)}
            </div>
            <div style={styles.buffLaneContent}>
              {spans.map((span, i) => {
                // 永続バフ（endTime = Infinity）はタイムライン末尾でキャップ
                const isPermanent = !Number.isFinite(span.endTime);
                const effectiveEnd = isPermanent ? totalDuration : span.endTime;
                const left = span.startTime * PX_PER_SEC;
                const width = Math.max(0, (effectiveEnd - span.startTime) * PX_PER_SEC);
                const stacksLabel = buffDef.maxStacks && span.stacks !== undefined
                  ? ` x${span.stacks}`
                  : "";
                const endTimeLabel = isPermanent ? "∞" : `${span.endTime.toFixed(2)}s`;
                // 先の付与元が切れると実際の確率は下がるが、付与した時点の値だけを出す (#615)
                const procRateLabel = span.procRate !== undefined
                  ? ` ${t("buffLanes.procRate", { rate: formatProcRate(span.procRate) })}`
                  : "";
                const durationLabel = buffDef.maxStacks
                  ? `x${span.stacks ?? buffDef.maxStacks}`
                  : buffDef.duration === null
                    ? "∞"
                    : `${buffDef.duration}s`;
                const procRateShortLabel = span.procRate !== undefined
                  ? ` (${formatProcRateShort(span.procRate)})`
                  : "";
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.buffBar,
                      left,
                      width,
                      // バフ色はデータ側の固定色。地は背景と混ぜて薄め、残り時間の文字はテーマの本文色にする
                      // （明るいバフ色をそのまま文字にするとライトテーマで読めないため）
                      backgroundColor: `color-mix(in srgb, ${buffDef.color} 19%, transparent)`,
                      borderColor: buffDef.color,
                    }}
                    title={`${name}${stacksLabel} (${span.startTime.toFixed(2)}s - ${endTimeLabel})${procRateLabel}`}
                  >
                    <img
                      src={buffDef.icon}
                      alt={name}
                      style={styles.buffIcon}
                    />
                    <span className="num" style={styles.buffDuration}>
                      {durationLabel}{procRateShortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
