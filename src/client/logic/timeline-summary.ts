import type { CharacterStats, PpsRange, Skill, TimelineResult } from "../types/skill";
import { calcPps } from "./resolve-timeline";
import { calcEntryDelayedHitsExpectedPotency, calcEntryExpectedPotency } from "./expected-potency";
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
    // 最後の GCD の詠唱完了は終端と同じ時刻なので、DoT が終端より後まで続いても、終端ちょうどの着弾は数える（#901）
    includeEndEntries: range.endTime >= result.lastGcdEndTime,
  });
}

export interface TimelineSummary {
  /** GCD が無く範囲が決まらないときは null */
  overallPps: PpsResult | null;
  totalExpectedPotency: number;
  dotExpectedPotency: number;
  /** 所要時間（最後の GCD のリキャスト完了。詠唱がリキャストより長ければ詠唱完了） */
  duration: number;
  /** DoT が所要時間より後まで続くときの、最後の DoT ティックの時刻。続かなければ null */
  lastDotTickTime: number | null;
}

/**
 * 集計行の値。範囲は PPS 区間の「全体」ボタンと同じ 0 〜 最後の GCD のリキャスト完了（詠唱がリキャストより長ければ
 * 詠唱完了。#901）で、それより後の DoT ティックと、それより後に着弾するエントリは数えない（#835）
 */
export function calcTimelineSummary(
  result: SummarySource,
  skillMap: Map<string, Skill>,
  stats: CharacterStats
): TimelineSummary {
  const { lastGcdEndTime, timelineEndTime } = result;

  if (lastGcdEndTime <= 0) {
    // GCD が無いと範囲が 0 秒になり PPS が決まらないので、#835 より前の集計のまま
    // （0 〜 最後の DoT ティック、すべてのエントリ（時間差の攻撃も。#957）とティックを数える。oGCD の DoT だけのタイムラインがある）
    const direct = result.entries.reduce((sum, entry) => {
      const skill = skillMap.get(entry.resolvedSkillId);
      return sum + calcEntryExpectedPotency(entry, skill, stats) + calcEntryDelayedHitsExpectedPotency(entry, skill, stats);
    }, 0);
    const dot = result.dotTicks.reduce(
      (sum, tick) => sum + Math.floor(tick.potency * calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus)),
      0
    );
    const overallPps =
      timelineEndTime > 0
        ? calcPps(result.entries, skillMap, result.dotTicks, 0, timelineEndTime, stats, { includeEnd: true })
        : null;
    return {
      overallPps,
      totalExpectedPotency: direct + dot,
      dotExpectedPotency: dot,
      duration: timelineEndTime,
      lastDotTickTime: null,
    };
  }

  const overallPps = calcRangePps(result, skillMap, { startTime: 0, endTime: lastGcdEndTime }, stats);
  return {
    overallPps,
    totalExpectedPotency: overallPps.totalPotency,
    dotExpectedPotency: overallPps.dotPotency,
    duration: lastGcdEndTime,
    lastDotTickTime: timelineEndTime > lastGcdEndTime ? timelineEndTime : null,
  };
}
