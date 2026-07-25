import type { BuffDefinition, ActiveBuff } from "../../types/skill";
import { styles } from "./styles";
import { PX_PER_SEC } from "./constants";

interface BuffLanesProps {
  buffs: BuffDefinition[];
  buffTimespans: Map<string, ActiveBuff[]>;
  totalDuration: number;
  labelBg: string;
}

/** バフレーン（バフ定義ごとに1行、適用スパンをバー描画） */
export function BuffLanes({ buffs, buffTimespans, totalDuration, labelBg }: BuffLanesProps) {
  return (
    <>
      {buffs.map((buffDef) => {
        const spans = buffTimespans.get(buffDef.id);
        if (!spans || spans.length === 0) return null;
        return (
          <div key={buffDef.id} style={styles.buffLane}>
            <div style={{ ...styles.buffLaneLabel, backgroundColor: labelBg }} title={buffDef.name}>
              {buffDef.shortName}
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
                const durationLabel = buffDef.maxStacks
                  ? `x${span.stacks ?? buffDef.maxStacks}`
                  : buffDef.duration === null
                    ? "∞"
                    : `${buffDef.duration}s`;
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.buffBar,
                      left,
                      width,
                      backgroundColor: `${buffDef.color}30`,
                      borderColor: buffDef.color,
                    }}
                    title={`${buffDef.name}${stacksLabel} (${span.startTime.toFixed(2)}s - ${endTimeLabel})`}
                  >
                    <img
                      src={buffDef.icon}
                      alt={buffDef.name}
                      style={styles.buffIcon}
                    />
                    <span style={{ ...styles.buffDuration, color: buffDef.color }}>
                      {durationLabel}
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
