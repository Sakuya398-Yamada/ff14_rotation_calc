import { describe, it, expect } from "vitest";
import { resolveTimeline, calcPps } from "../resolve-timeline";
import { calcEntryExpectedPotency } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import { calcRangePps, calcTimelineSummary } from "../timeline-summary";
import type { DoTTick, Skill, TimelineEntry, TimelineResult } from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: "",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

const longDot = makeSkill({ id: "long-dot", potency: 50, dotPotency: 60, dotDuration: 30 });
// 0 秒に付与し、15 秒（GCD 6 発分のリキャスト完了と同じ時刻）のティックで切れる
const edgeDot = makeSkill({ id: "edge-dot", potency: 50, dotPotency: 60, dotDuration: 15 });
const gcd = makeSkill({ id: "gcd", potency: 300 });
const ogcdA = makeSkill({ id: "ogcd-a", type: "ogcd", potency: 200 });
const ogcdB = makeSkill({ id: "ogcd-b", type: "ogcd", potency: 150 });
const skillMap = new Map([longDot, edgeDot, gcd, ogcdA, ogcdB].map((s) => [s.id, s]));
const stats = DEFAULT_STATS;

const resolve = (ids: string[]) => resolveTimeline(ids.map(makeEntry), skillMap, [], stats);

const tickExpected = (t: DoTTick) => Math.floor(t.potency * calcExpectedMultiplier(stats, t.critRateBonus, t.dhRateBonus));

// #835 より前の集計行の式（0 〜 timelineEndTime で終端を含み、全エントリ・全ティックを数える）
function previousSummary(result: TimelineResult) {
  const direct = result.entries.reduce(
    (sum, e) => sum + calcEntryExpectedPotency(e, skillMap.get(e.resolvedSkillId), stats),
    0
  );
  const dot = result.dotTicks.reduce((sum, t) => sum + tickExpected(t), 0);
  return {
    overallPps:
      result.timelineEndTime > 0
        ? calcPps(result.entries, skillMap, result.dotTicks, 0, result.timelineEndTime, stats, { includeEnd: true })
        : null,
    totalExpectedPotency: direct + dot,
    dotExpectedPotency: dot,
    duration: result.timelineEndTime,
  };
}

describe("calcTimelineSummary: DoT が最後の GCD より後まで続くタイムライン（#835）", () => {
  const result = resolve(["long-dot", "gcd", "gcd"]);
  const summary = calcTimelineSummary(result, skillMap, stats);

  it("前提: 最後の DoT ティックが最後の GCD のリキャスト完了より後にある", () => {
    expect(result.lastGcdEndTime).toBeGreaterThan(0);
    expect(result.timelineEndTime).toBeGreaterThan(result.lastGcdEndTime);
  });

  it("PPS 全体は、「全体」ボタンで戻した PPS 区間（0 〜 最後の GCD のリキャスト完了）の PPS と一致する", () => {
    // PpsRangeEditor の「全体」ボタンが設定する区間
    const fullRange = { startTime: 0, endTime: result.lastGcdEndTime };
    expect(summary.overallPps).toEqual(calcRangePps(result, skillMap, fullRange, stats));
  });

  it("合計期待威力・DoT 期待威力は PPS 全体の合計威力・DoT 威力と一致し、最後の GCD 以降の DoT ティックを含まない", () => {
    const ticksInRange = result.dotTicks.filter((t) => t.time < result.lastGcdEndTime);
    const ticksAfter = result.dotTicks.filter((t) => t.time >= result.lastGcdEndTime);
    expect(ticksAfter.length).toBeGreaterThan(0);

    const direct = result.entries.reduce(
      (sum, e) => sum + calcEntryExpectedPotency(e, skillMap.get(e.resolvedSkillId), stats),
      0
    );
    const dotInRange = ticksInRange.reduce((sum, t) => sum + tickExpected(t), 0);

    expect(summary.dotExpectedPotency).toBe(dotInRange);
    expect(summary.totalExpectedPotency).toBe(direct + dotInRange);
    expect(summary.totalExpectedPotency).toBe(summary.overallPps?.totalPotency);
    expect(summary.dotExpectedPotency).toBe(summary.overallPps?.dotPotency);
    expect(summary.totalExpectedPotency).toBeLessThan(previousSummary(result).totalExpectedPotency);
  });

  it("PPS 全体 × 所要時間 は合計期待威力と一致する", () => {
    expect((summary.overallPps?.pps ?? 0) * summary.duration).toBeCloseTo(summary.totalExpectedPotency);
  });

  it("所要時間は最後の GCD のリキャスト完了で、最後の DoT ティックの時刻を別に返す", () => {
    expect(summary.duration).toBe(result.lastGcdEndTime);
    expect(summary.lastDotTickTime).toBe(result.dotTicks[result.dotTicks.length - 1].time);
  });
});

describe("calcTimelineSummary: DoT が最後の GCD より後まで続かないタイムライン（#835）", () => {
  const result = resolve(["edge-dot", "gcd", "gcd", "gcd", "gcd", "gcd"]);
  const summary = calcTimelineSummary(result, skillMap, stats);

  it("前提: 最後の DoT ティックがちょうど最後の GCD のリキャスト完了の時刻にあり、それより後にティックもエントリも無い", () => {
    expect(result.lastGcdEndTime).toBe(15);
    expect(result.dotTicks[result.dotTicks.length - 1].time).toBe(result.lastGcdEndTime);
    expect(result.timelineEndTime).toBe(result.lastGcdEndTime);
    expect(result.entries.every((e) => e.startTime < result.lastGcdEndTime)).toBe(true);
  });

  it("PPS 全体・合計期待威力・DoT 期待威力・所要時間が変更前と同じ値になり、最後の DoT ティックの時刻は返さない", () => {
    const { overallPps, totalExpectedPotency, dotExpectedPotency, duration } = summary;
    expect({ overallPps, totalExpectedPotency, dotExpectedPotency, duration }).toEqual(previousSummary(result));
    expect(summary.lastDotTickTime).toBeNull();
  });
});

describe("calcTimelineSummary: GCD が無いタイムライン（#835）", () => {
  const result = resolve(["ogcd-a", "ogcd-b"]);
  const summary = calcTimelineSummary(result, skillMap, stats);

  it("前提: GCD が無いので最後の GCD のリキャスト完了は 0", () => {
    expect(result.lastGcdEndTime).toBe(0);
    expect(result.entries.every((e) => !e.recastError)).toBe(true);
  });

  it("PPS 全体・所要時間は出さず、合計期待威力は変更前と同じくすべてのエントリを数える", () => {
    expect(summary.overallPps).toBeNull();
    expect(summary.duration).toBe(0);
    expect(summary.lastDotTickTime).toBeNull();
    expect(summary.totalExpectedPotency).toBeGreaterThan(0);
    expect(summary.totalExpectedPotency).toBe(previousSummary(result).totalExpectedPotency);
    expect(summary.dotExpectedPotency).toBe(previousSummary(result).dotExpectedPotency);
  });
});
