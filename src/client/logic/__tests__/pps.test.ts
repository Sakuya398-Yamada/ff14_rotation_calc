import { describe, it, expect } from "vitest";
import { resolveTimeline, calcPps } from "../resolve-timeline";
import { calcEntryExpectedPotency } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { Skill, TimelineEntry } from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
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

// DoT 付与 → GCD 2 発。DoT（30 秒）の最終ティックが GCD の終了より後に来るので、timelineEndTime = 最終ティック時刻
const dotSkill = makeSkill({ id: "dot", potency: 50, dotPotency: 60, dotDuration: 30 });
const gcd = makeSkill({ id: "gcd", potency: 300 });
const skillMap = new Map([
  [dotSkill.id, dotSkill],
  [gcd.id, gcd],
]);
const stats = DEFAULT_STATS;
const result = resolveTimeline([makeEntry("dot"), makeEntry("gcd"), makeEntry("gcd")], skillMap, [], stats);

// App.tsx の合計期待威力と同じ式
const totalExpected =
  result.entries.reduce((sum, e) => sum + calcEntryExpectedPotency(e, skillMap.get(e.resolvedSkillId), stats), 0) +
  result.dotTicks.reduce(
    (sum, t) => sum + Math.floor(t.potency * calcExpectedMultiplier(stats, t.critRateBonus, t.dhRateBonus)),
    0
  );

describe("calcPps", () => {
  it("前提: タイムラインは最終 DoT ティックの時刻で終わる", () => {
    const lastTick = Math.max(...result.dotTicks.map((t) => t.time));
    expect(result.timelineEndTime).toBe(lastTick);
  });

  it("includeEnd 指定時、全体 PPS の合計威力は合計期待威力と一致する（最終ティックを含む）（#400）", () => {
    const overall = calcPps(result.entries, skillMap, result.dotTicks, 0, result.timelineEndTime, stats, {
      includeEnd: true,
    });
    expect(overall.totalPotency).toBe(totalExpected);
    expect(overall.pps).toBeCloseTo(totalExpected / result.timelineEndTime);
  });

  it("隣り合う区間 [0, a) と [a, 終端] の合計は全体と一致し、境界のティックを二重に数えない", () => {
    // 境界をちょうどティック時刻に置く
    const boundary = result.dotTicks[2].time;
    const first = calcPps(result.entries, skillMap, result.dotTicks, 0, boundary, stats);
    const second = calcPps(result.entries, skillMap, result.dotTicks, boundary, result.timelineEndTime, stats, {
      includeEnd: true,
    });
    expect(first.totalPotency + second.totalPotency).toBe(totalExpected);
  });

  it("includeEnd を省略すると、終端ちょうどのティックは含めない（半開区間）", () => {
    const halfOpen = calcPps(result.entries, skillMap, result.dotTicks, 0, result.timelineEndTime, stats);
    const lastTick = result.dotTicks[result.dotTicks.length - 1];
    const lastTickPotency = Math.floor(
      lastTick.potency * calcExpectedMultiplier(stats, lastTick.critRateBonus, lastTick.dhRateBonus)
    );
    expect(halfOpen.totalPotency).toBe(totalExpected - lastTickPotency);
  });
});
