import type { Skill, ResolvedTimelineEntry, CharacterStats } from "../../types/skill";
import type { DisplayEntry } from "./types";
import { calcEntryPotencyBreakdown } from "../../logic/expected-potency";
import { formatTargetBreakdown } from "./helpers";
import { ManualStartTimeBadge } from "./ManualStartTimeBadge";
import { styles } from "./styles";
import { PX_PER_SEC } from "./constants";

interface SkillLanesProps {
  gcdEntries: DisplayEntry[];
  ogcdEntries: DisplayEntry[];
  entriesWithErrors: Set<string>;
  getResolvedEntryRecast: (entry: ResolvedTimelineEntry, skill: Skill) => number;
  stats: CharacterStats;
  selectedEntryUid: string | null;
  draggingEntryUid: string | null;
  labelBg: string;
  onSelectEntry: (uid: string | null) => void;
  onEntryDragStart: (e: React.DragEvent<HTMLDivElement>, entry: { uid: string; skillId: string }, skill: Skill) => void;
  onEntryDragEnd: () => void;
}

/** GCD行・oGCD行（スキルアイコン・詠唱/リキャストバー・威力ツールチップ・DnDソース） */
export function SkillLanes({
  gcdEntries,
  ogcdEntries,
  entriesWithErrors,
  getResolvedEntryRecast,
  stats,
  selectedEntryUid,
  draggingEntryUid,
  labelBg,
  onSelectEntry,
  onEntryDragStart,
  onEntryDragEnd,
}: SkillLanesProps) {
  return (
    <>
      {/* GCD行 */}
      <div style={styles.lane}>
        <div style={{ ...styles.laneLabel, backgroundColor: labelBg }}>GCD</div>
        <div style={styles.laneContent}>
          {gcdEntries.map((entry) => {
            const hasError = entriesWithErrors.has(entry.uid);
            const recast = getResolvedEntryRecast(entry, entry.skill);
            const castTime = entry.castTime;
            const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
            const breakdown = stats && entry.resolvedPotency > 0 && !hasError
              ? calcEntryPotencyBreakdown(entry, entry.displaySkill, stats)
              : null;
            const expectedPot = breakdown ? breakdown.total : null;
            const targetBreakdown = formatTargetBreakdown(breakdown);
            const isAutoTransformed = entry.resolvedSkillId !== entry.skillId;
            // castTime > recast の場合は次 GCD が打てるのは castTime 後（resolve-timeline.ts と整合）。
            // skillBlock の幅を max(castTime, recast) に拡張し、各バーを blockDuration 基準で割合計算する。
            const blockDuration = Math.max(castTime, recast);
            return (
              <div
                key={entry.uid}
                style={{
                  ...styles.skillBlock,
                  left: entry.startTime * PX_PER_SEC,
                  width: blockDuration * PX_PER_SEC,
                }}
              >
                <div
                  style={{
                    ...styles.recastBar,
                    width: (recast / blockDuration) * 100 + "%",
                  }}
                  title={`リキャスト: ${recast}s`}
                />
                {castTime > 0 && (
                  <div
                    style={styles.castTimeBar}
                    title={`詠唱時間: ${castTime}s`}
                  >
                    <div
                      style={{
                        ...styles.castTimeFill,
                        width: (castTime / blockDuration) * 100 + "%",
                      }}
                    />
                  </div>
                )}
                <div
                  style={styles.animLockBar}
                  title={`アニメーションロック: ${entry.skill.animationLock}s`}
                >
                  <div
                    style={{
                      ...styles.animLockFill,
                      width:
                        (entry.skill.animationLock / blockDuration) * 100 + "%",
                    }}
                  />
                </div>
                <div
                  style={{
                    ...styles.skillIcon,
                    ...(hasError ? styles.skillIconError : {}),
                    ...(entry.wsComboError ? styles.skillIconComboWarning : {}),
                    ...(selectedEntryUid === entry.uid ? styles.skillIconSelected : {}),
                    ...(draggingEntryUid === entry.uid ? styles.skillIconDragging : {}),
                  }}
                  title={`${entry.displaySkill.name}${isAutoTransformed ? ` (← ${entry.skill.name})` : ""} (威力: ${buffedPotency}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / 期待値: ${expectedPot}${targetBreakdown}` : ""}) [${entry.startTime.toFixed(2)}s${entry.manualStartTime !== undefined ? " 手動" : ""}]${castTime > 0 ? ` 詠唱: ${castTime}s` : " インスタント"}${entry.wsComboError ? " ⚠ コンボ不成立" : ""}${entry.resourceErrors.length > 0 ? " ⚠ リソース不足" : ""}${entry.comboErrors.length > 0 ? " ⚠ バフ条件未達成" : ""}${entry.untargetableError ? " ⚠ ボス離脱中" : ""}${entry.recastError ? " ⚠ リキャスト中" : ""}`}
                  data-skill-entry-uid={entry.uid}
                  onClick={() => onSelectEntry(entry.uid)}
                  draggable
                  onDragStart={(e) => onEntryDragStart(e, entry, entry.skill)}
                  onDragEnd={onEntryDragEnd}
                >
                  <img
                    src={entry.displaySkill.icon}
                    alt={entry.displaySkill.name}
                    style={styles.iconImage}
                    draggable={false}
                  />
                  {entry.manualStartTime !== undefined && (
                    <ManualStartTimeBadge />
                  )}
                </div>
                <div style={{
                  ...styles.skillPotency,
                  ...(entry.wsComboError ? { color: "#ff9800" } : {}),
                }}>
                  {hasError ? "-" : (expectedPot !== null ? expectedPot : buffedPotency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* oGCD行 */}
      <div style={styles.lane}>
        <div style={{ ...styles.laneLabel, backgroundColor: labelBg }}>oGCD</div>
        <div style={styles.laneContent}>
          {ogcdEntries.map((entry) => {
            const hasError = entriesWithErrors.has(entry.uid);
            const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
            const breakdown = stats && entry.resolvedPotency > 0 && !hasError
              ? calcEntryPotencyBreakdown(entry, entry.displaySkill, stats)
              : null;
            const expectedPot = breakdown ? breakdown.total : null;
            const targetBreakdown = formatTargetBreakdown(breakdown);
            return (
              <div
                key={entry.uid}
                style={{
                  ...styles.ogcdBlock,
                  left: entry.startTime * PX_PER_SEC,
                }}
              >
                <div
                  style={{
                    ...styles.ogcdIcon,
                    ...(hasError ? styles.ogcdIconError : {}),
                    ...(selectedEntryUid === entry.uid ? styles.ogcdIconSelected : {}),
                    ...(draggingEntryUid === entry.uid ? styles.ogcdIconDragging : {}),
                  }}
                  title={`${entry.displaySkill.name} (威力: ${buffedPotency}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / 期待値: ${expectedPot}${targetBreakdown}` : ""}) [${entry.startTime.toFixed(2)}s${entry.manualStartTime !== undefined ? " 手動" : ""}]${entry.resourceErrors.length > 0 ? " ⚠ リソース不足" : ""}${entry.comboErrors.length > 0 ? " ⚠ バフ条件未達成" : ""}${entry.untargetableError ? " ⚠ ボス離脱中" : ""}${entry.recastError ? " ⚠ リキャスト中" : ""}`}
                  data-skill-entry-uid={entry.uid}
                  onClick={() => onSelectEntry(entry.uid)}
                  draggable
                  onDragStart={(e) => onEntryDragStart(e, entry, entry.skill)}
                  onDragEnd={onEntryDragEnd}
                >
                  <img
                    src={entry.displaySkill.icon}
                    alt={entry.displaySkill.name}
                    style={styles.iconImage}
                    draggable={false}
                  />
                  {entry.manualStartTime !== undefined && (
                    <ManualStartTimeBadge />
                  )}
                </div>
                <div style={styles.skillPotency}>
                  {hasError ? "-" : (expectedPot !== null ? expectedPot : buffedPotency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
