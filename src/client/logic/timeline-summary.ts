import type { CharacterStats, PpsRange, Skill, TimelineResult } from "../types/skill";
import { calcPps } from "./resolve-timeline";
import { calcEntryExpectedPotency } from "./expected-potency";
import { calcExpectedMultiplier } from "./stat-calc";

type PpsResult = ReturnType<typeof calcPps>;
type SummarySource = Pick<TimelineResult, "entries" | "dotTicks" | "lastGcdEndTime" | "timelineEndTime">;

/** PPS 区間の PPS。区間がタイムライン終端まで届くときは、終端ちょうどの最終ティックも含める（#400） */
export function calcRangePps(
  result: SummarySource,
  skillMap: Map<string, Skill>,
  range: PpsRange,
  stats: CharacterStats
): PpsResult {
  return calcPps(result.entries, skillMap, result.dotTicks, range.startTime, range.endTime, stats, {
    includeEnd: range.endTime >= result.timelineEndTime,
  });
}

export interface TimelineSummary {
  /** GCD が無く範囲が決まらないときは null */
  overallPps: PpsResult | null;
  totalExpectedPotency: number;
  dotExpectedPotency: number;
  /** 所要時間（最後の GCD のリキャスト完了） */
  duration: number;
  /** DoT が所要時間より後まで続くときの、最後の DoT ティックの時刻。続かなければ null */
  lastDotTickTime: number | null;
}

/**
 * 集計行の値。範囲は PPS 区間の「全体」ボタンと同じ 0 〜 最後の GCD のリキャスト完了で、
 * それより後の DoT ティックとエントリは数えない（#835）
 */
export function calcTimelineSummary(
  result: SummarySource,
  skillMap: Map<string, Skill>,
  stats: CharacterStats
): TimelineSummary {
  const { lastGcdEndTime, timelineEndTime } = result;
  const lastDotTickTime = timelineEndTime > lastGcdEndTime ? timelineEndTime : null;

  if (lastGcdEndTime <= 0) {
    // GCD が無いと範囲が 0 秒になり PPS が決まらない。合計は置いたエントリとティックをすべて数える
    const direct = result.entries.reduce(
      (sum, entry) => sum + calcEntryExpectedPotency(entry, skillMap.get(entry.resolvedSkillId), stats),
      0
    );
    const dot = result.dotTicks.reduce(
      (sum, tick) => sum + Math.floor(tick.potency * calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus)),
      0
    );
    return { overallPps: null, totalExpectedPotency: direct + dot, dotExpectedPotency: dot, duration: 0, lastDotTickTime };
  }

  const overallPps = calcRangePps(result, skillMap, { startTime: 0, endTime: lastGcdEndTime }, stats);
  return {
    overallPps,
    totalExpectedPotency: overallPps.totalPotency,
    dotExpectedPotency: overallPps.dotPotency,
    duration: lastGcdEndTime,
    lastDotTickTime,
  };
}
