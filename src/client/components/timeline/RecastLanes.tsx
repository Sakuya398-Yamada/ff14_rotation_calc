import type { Skill } from "../../types/skill";
import type { CooldownSpan } from "./types";
import { styles } from "./styles";
import { PX_PER_SEC } from "./constants";

interface RecastLanesProps {
  cooldownSpans: Map<string, CooldownSpan[]>;
  skillMap: Map<string, Skill>;
  labelBg: string;
}

/** 個別リキャスト（クールダウン）レーン（対象スキルごとに1行） */
export function RecastLanes({ cooldownSpans, skillMap, labelBg }: RecastLanesProps) {
  return (
    <>
      {Array.from(cooldownSpans.entries()).map(([skillId, spans]) => {
        const skill = skillMap.get(skillId);
        const label = skill?.name ?? skillId;
        return (
          <div key={`recast-${skillId}`} style={styles.recastLane}>
            <div style={{ ...styles.recastLaneLabel, backgroundColor: labelBg }} title={`${label} リキャスト`}>
              RC
              {skill?.icon && (
                <img
                  src={skill.icon}
                  alt={label}
                  style={styles.recastLabelIcon}
                />
              )}
            </div>
            <div style={styles.recastLaneContent}>
              {spans.map((span, i) => {
                const left = span.startTime * PX_PER_SEC;
                const width = (span.endTime - span.startTime) * PX_PER_SEC;
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.cooldownBar,
                      left,
                      width,
                    }}
                    title={`${span.skillName} リキャスト (${span.startTime.toFixed(2)}s - ${span.endTime.toFixed(2)}s / ${skill?.cooldown}s)`}
                  >
                    <img
                      src={span.icon}
                      alt={span.skillName}
                      style={styles.recastIcon}
                    />
                    <span style={styles.recastDuration}>
                      {skill?.cooldown}s
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
