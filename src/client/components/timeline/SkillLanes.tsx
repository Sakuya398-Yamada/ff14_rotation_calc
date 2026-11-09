import { useDraggable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import type { Skill, ResolvedTimelineEntry, CharacterStats } from "../../types/skill";
import type { JobId } from "../../data/job-registry";
import { skillName } from "../../logic/display-names";
import type { DisplayEntry } from "./types";
import { calcEntryDelayedHitsExpectedPotency, calcEntryPotencyBreakdown } from "../../logic/expected-potency";
import {
  formatConsumedProc,
  formatProcOccurred,
  formatWastedProc,
  isProcOutcomeSource,
  PROC_OUTCOME_BUFF_ID,
} from "../../logic/buff-format";
import { formatResourceErrorWarnings } from "../../logic/resource-error-format";
import { formatComboErrorWarnings } from "../../logic/combo-error-format";
import { formatTargetBreakdown } from "./helpers";
import { ManualStartTimeBadge } from "./ManualStartTimeBadge";
import { ProcOutcomeBadge } from "./ProcOutcomeBadge";
import { styles } from "./styles";
import { PX_PER_SEC } from "./constants";
import type { TimelineEntryDragData } from "./dnd-types";

interface SkillLanesProps {
  gcdEntries: DisplayEntry[];
  ogcdEntries: DisplayEntry[];
  entriesWithErrors: Set<string>;
  getResolvedEntryRecast: (entry: ResolvedTimelineEntry, skill: Skill) => number;
  stats: CharacterStats;
  jobId: JobId;
  selectedEntryUid: string | null;
  draggingEntryUid: string | null;
  labelBg: string;
  onSelectEntry: (uid: string | null) => void;
}

/** 時間差の攻撃（#957）のバフ込みの威力の合計。持たないエントリは 0 */
function delayedHitsBuffedPotency(entry: ResolvedTimelineEntry): number {
  return (entry.delayedHits ?? []).reduce((sum, hit) => sum + Math.floor(hit.potency * hit.buffMultiplier), 0);
}

/** dnd-kit のドラッグ元となるタイムラインエントリのアイコン（タッチ・マウス両対応） */
function DraggableEntryIcon({
  uid,
  skillId,
  skillType,
  style,
  title,
  onClick,
  children,
}: {
  uid: string;
  skillId: string;
  skillType: "gcd" | "ogcd";
  style: React.CSSProperties;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const data: TimelineEntryDragData = { source: "timeline", uid, skillId, skillType };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `entry-${uid}`, data });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // none にするとアイコン上から始まるスワイプでタイムラインがスクロールできなくなる。
      // delay 式 TouchSensor では manipulation で十分（長押し成立後は dnd-kit が preventDefault する）
      style={{ ...style, touchAction: "manipulation" }}
      title={title}
      data-skill-entry-uid={uid}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** GCD行・oGCD行（スキルアイコン・詠唱/リキャストバー・威力ツールチップ・DnDソース） */
export function SkillLanes({
  gcdEntries,
  ogcdEntries,
  entriesWithErrors,
  getResolvedEntryRecast,
  stats,
  jobId,
  selectedEntryUid,
  draggingEntryUid,
  labelBg,
  onSelectEntry,
}: SkillLanesProps) {
  const { t } = useTranslation();
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
            // 時間差の攻撃（#957）は、各攻撃の威力と期待値を足して出す
            const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier) + delayedHitsBuffedPotency(entry);
            const breakdown = stats && entry.resolvedPotency > 0 && !hasError
              ? calcEntryPotencyBreakdown(entry, entry.displaySkill, stats)
              : null;
            const delayedExpected = stats && entry.delayedHits
              ? calcEntryDelayedHitsExpectedPotency(entry, entry.displaySkill, stats)
              : null;
            const expectedPot = breakdown || delayedExpected !== null ? (breakdown?.total ?? 0) + (delayedExpected ?? 0) : null;
            const targetBreakdown = formatTargetBreakdown(breakdown, t);
            const consumedProcLabel = entry.consumedProc
              ? ` / ${formatConsumedProc(entry.consumedProc, jobId)}`
              : "";
            // 上書きの表示はホークアイだけ（ほかのジョブの確率付与は対象外。#842）
            const wastedProcLabel = entry.wastedProc?.buffId === PROC_OUTCOME_BUFF_ID
              ? ` / ${formatWastedProc(entry.wastedProc, jobId)}`
              : "";
            // 付与元でなくなった指定（レベルを下げたバイト系など）は解決で無視されるので出さない
            const procOccurredLabel = entry.procOccurred !== undefined && isProcOutcomeSource(entry.displaySkill)
              ? formatProcOccurred(entry.procOccurred, jobId)
              : null;
            const isAutoTransformed = entry.resolvedSkillId !== entry.skillId;
            const name = skillName(t, jobId, entry.displaySkill.id);
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
                  title={t("skillLanes.recast", { time: recast })}
                />
                {castTime > 0 && (
                  <div
                    style={styles.castTimeBar}
                    title={t("skillLanes.castTime", { time: castTime })}
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
                  title={t("skillLanes.animationLock", { time: entry.skill.animationLock })}
                >
                  <div
                    style={{
                      ...styles.animLockFill,
                      width:
                        (entry.skill.animationLock / blockDuration) * 100 + "%",
                    }}
                  />
                </div>
                <DraggableEntryIcon
                  uid={entry.uid}
                  skillId={entry.skillId}
                  skillType="gcd"
                  style={{
                    ...styles.skillIcon,
                    ...(hasError ? styles.skillIconError : {}),
                    ...(entry.wsComboError || entry.unconfirmedProcBuffs || entry.untargetableHit ? styles.skillIconComboWarning : {}),
                    ...(selectedEntryUid === entry.uid ? styles.skillIconSelected : {}),
                    ...(draggingEntryUid === entry.uid ? styles.skillIconDragging : {}),
                  }}
                  title={`${name}${isAutoTransformed ? ` (← ${skillName(t, jobId, entry.skill.id)})` : ""} (${t("skillLanes.potency", { potency: buffedPotency })}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / ${t("skillLanes.expected", { value: expectedPot })}${targetBreakdown}` : ""}${consumedProcLabel}${wastedProcLabel}) [${entry.startTime.toFixed(2)}s${entry.manualStartTime !== undefined ? ` ${t("skillLanes.manual")}` : ""}]${castTime > 0 ? ` ${t("skillLanes.cast", { time: castTime })}` : ` ${t("skillLanes.instant")}`}${procOccurredLabel !== null ? ` ${procOccurredLabel}` : ""}${entry.wsComboError ? ` ⚠ ${t("skillLanes.comboBroken")}` : ""}${entry.unconfirmedProcBuffs ? ` ⚠ ${t("skillLanes.unconfirmedProc")}` : ""}${entry.untargetableHit ? ` ⚠ ${t("skillLanes.untargetableHit")}` : ""}${formatResourceErrorWarnings(entry.resourceErrors)}${formatComboErrorWarnings(entry.comboErrors)}${entry.untargetableError ? ` ⚠ ${t("skillLanes.untargetable")}` : ""}${entry.recastError ? ` ⚠ ${t("skillLanes.recastError")}` : ""}`}
                  onClick={() => onSelectEntry(entry.uid)}
                >
                  <img
                    src={entry.displaySkill.icon}
                    alt={name}
                    style={styles.iconImage}
                    draggable={false}
                  />
                  {entry.manualStartTime !== undefined && (
                    <ManualStartTimeBadge />
                  )}
                  {entry.procOccurred !== undefined && procOccurredLabel !== null && (
                    <ProcOutcomeBadge procOccurred={entry.procOccurred} title={procOccurredLabel} />
                  )}
                </DraggableEntryIcon>
                <div style={{
                  ...styles.skillPotency,
                  ...(entry.wsComboError || entry.unconfirmedProcBuffs || entry.untargetableHit ? { color: "var(--color-warning)" } : {}),
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
            // 時間差の攻撃（#957）は、各攻撃の威力と期待値を足して出す
            const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier) + delayedHitsBuffedPotency(entry);
            const breakdown = stats && entry.resolvedPotency > 0 && !hasError
              ? calcEntryPotencyBreakdown(entry, entry.displaySkill, stats)
              : null;
            const delayedExpected = stats && entry.delayedHits
              ? calcEntryDelayedHitsExpectedPotency(entry, entry.displaySkill, stats)
              : null;
            const expectedPot = breakdown || delayedExpected !== null ? (breakdown?.total ?? 0) + (delayedExpected ?? 0) : null;
            const targetBreakdown = formatTargetBreakdown(breakdown, t);
            const name = skillName(t, jobId, entry.displaySkill.id);
            return (
              <div
                key={entry.uid}
                style={{
                  ...styles.ogcdBlock,
                  left: entry.startTime * PX_PER_SEC,
                }}
              >
                <DraggableEntryIcon
                  uid={entry.uid}
                  skillId={entry.skillId}
                  skillType="ogcd"
                  style={{
                    ...styles.ogcdIcon,
                    ...(hasError ? styles.ogcdIconError : {}),
                    ...(entry.untargetableHit ? styles.ogcdIconWarning : {}),
                    ...(selectedEntryUid === entry.uid ? styles.ogcdIconSelected : {}),
                    ...(draggingEntryUid === entry.uid ? styles.ogcdIconDragging : {}),
                  }}
                  title={`${name} (${t("skillLanes.potency", { potency: buffedPotency })}${entry.buffMultiplier !== 1 ? ` [${entry.resolvedPotency}x${entry.buffMultiplier.toFixed(2)}]` : ""}${expectedPot !== null ? ` / ${t("skillLanes.expected", { value: expectedPot })}${targetBreakdown}` : ""}) [${entry.startTime.toFixed(2)}s${entry.manualStartTime !== undefined ? ` ${t("skillLanes.manual")}` : ""}]${entry.untargetableHit ? ` ⚠ ${t("skillLanes.untargetableHit")}` : ""}${formatResourceErrorWarnings(entry.resourceErrors)}${formatComboErrorWarnings(entry.comboErrors)}${entry.untargetableError ? ` ⚠ ${t("skillLanes.untargetable")}` : ""}${entry.recastError ? ` ⚠ ${t("skillLanes.recastError")}` : ""}`}
                  onClick={() => onSelectEntry(entry.uid)}
                >
                  <img
                    src={entry.displaySkill.icon}
                    alt={name}
                    style={styles.iconImage}
                    draggable={false}
                  />
                  {entry.manualStartTime !== undefined && (
                    <ManualStartTimeBadge />
                  )}
                </DraggableEntryIcon>
                <div style={{
                  ...styles.skillPotency,
                  ...(entry.untargetableHit ? { color: "var(--color-warning)" } : {}),
                }}>
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
