import type { Skill, CharacterStats, DoTTick, ActiveDoT } from "../../types/skill";
import { calcExpectedMultiplier } from "../../logic/stat-calc";
import { styles } from "./styles";
import { PX_PER_SEC } from "./constants";

interface DotLanesProps {
  activeDoTs: ActiveDoT[];
  dotTicks: DoTTick[];
  skillMap: Map<string, Skill>;
  stats: CharacterStats;
  labelBg: string;
}

/** DoTレーン（スキルIDごとに1行、DoTバーとティックマーカーを描画） */
export function DotLanes({ activeDoTs, dotTicks, skillMap, stats, labelBg }: DotLanesProps) {
  // スキルIDごとにDoTをグループ化
  const dotBySkill = new Map<string, ActiveDoT[]>();
  for (const dot of activeDoTs) {
    if (!dotBySkill.has(dot.skillId)) {
      dotBySkill.set(dot.skillId, []);
    }
    dotBySkill.get(dot.skillId)!.push(dot);
  }

  return (
    <>
      {Array.from(dotBySkill.entries()).map(([skillId, dots]) => {
        const skill = skillMap.get(skillId);
        const label = skill?.name ?? skillId;
        const ticksForSkill = dotTicks.filter((t) => t.skillId === skillId);

        return (
          <div key={`dot-${skillId}`} style={styles.dotLane}>
            <div style={{ ...styles.dotLaneLabel, backgroundColor: labelBg }} title={`${label} DoT`}>
              DoT
            </div>
            <div style={styles.dotLaneContent}>
              {dots.map((dot, i) => {
                const left = dot.startTime * PX_PER_SEC;
                const width = (dot.endTime - dot.startTime) * PX_PER_SEC;
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.dotBar,
                      left,
                      width,
                    }}
                    title={`${label} DoT (${dot.potency}威力/tick${dot.buffMultiplier !== 1 ? ` x${dot.buffMultiplier.toFixed(2)}` : ""}) ${dot.startTime.toFixed(2)}s - ${dot.endTime.toFixed(2)}s`}
                  >
                    <img
                      src={dot.icon}
                      alt={label}
                      style={styles.dotIcon}
                    />
                    <span style={styles.dotDuration}>
                      {dot.potency}{dot.buffMultiplier !== 1 ? `x${dot.buffMultiplier.toFixed(1)}` : ""}
                    </span>
                  </div>
                );
              })}
              {/* DoTティックマーカー */}
              {ticksForSkill.map((tick, i) => (
                <div
                  key={`tick-${i}`}
                  style={{
                    ...styles.dotTickMarker,
                    left: tick.time * PX_PER_SEC,
                  }}
                  title={`DoTティック: ${tick.potency}威力${tick.critRateBonus > 0 || tick.dhRateBonus > 0 ? ` (CRT+${Math.round(tick.critRateBonus * 100)}%${tick.dhRateBonus > 0 ? ` DH+${Math.round(tick.dhRateBonus * 100)}%` : ""})` : ""} @ ${tick.time.toFixed(2)}s${stats ? ` / 期待値: ${Math.floor(tick.potency * calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus))}` : ""}`}
                >
                  <div style={styles.dotTickLine} />
                  <div style={styles.dotTickPotency}>
                    {stats ? Math.floor(tick.potency * calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus)) : tick.potency}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
