import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
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

function makeEntry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function tickTimes(result: ReturnType<typeof resolveTimeline>, skillId: string): number[] {
  return result.dotTicks.filter((t) => t.skillId === skillId).map((t) => t.time);
}

describe("DoT が切れていた期間のティック", () => {
  const shortDot = makeSkill({ id: "short-dot", dotPotency: 10, dotDuration: 9 });
  const skillMap = new Map([[shortDot.id, shortDot]]);

  it("切れてから掛け直すと、切れていた期間のティックは数えない", () => {
    const result = resolveTimeline([makeEntry("short-dot"), makeEntry("short-dot", 17.5)], skillMap, []);
    expect(tickTimes(result, "short-dot")).toEqual([3, 6, 9, 18, 21, 24]);
  });

  it("切れた後の掛け直しが 3 の倍数秒ちょうどなら、そのティックは数えない（新規付与と同じ）", () => {
    const result = resolveTimeline([makeEntry("short-dot"), makeEntry("short-dot", 15)], skillMap, []);
    expect(tickTimes(result, "short-dot")).toEqual([3, 6, 9, 18, 21, 24]);
  });

  it("効いている間の掛け直しは途切れずに延長される", () => {
    const result = resolveTimeline([makeEntry("short-dot"), makeEntry("short-dot", 6)], skillMap, []);
    expect(tickTimes(result, "short-dot")).toEqual([3, 6, 9, 12, 15]);
  });
});

describe("replacesDots（同時に1種類だけの DoT）", () => {
  const dotA = makeSkill({ id: "dot-a", dotPotency: 10, dotDuration: 30, replacesDots: ["dot-a", "dot-b"] });
  const dotB = makeSkill({ id: "dot-b", dotPotency: 20, dotDuration: 30, replacesDots: ["dot-a", "dot-b"] });
  const skillMap = new Map([[dotA.id, dotA], [dotB.id, dotB]]);

  it("別の DoT を付与すると、元の DoT はその時点で打ち切られる", () => {
    const result = resolveTimeline([makeEntry("dot-a"), makeEntry("dot-b", 10)], skillMap, []);
    expect(tickTimes(result, "dot-a")).toEqual([3, 6, 9]);
    expect(tickTimes(result, "dot-b")[0]).toBe(12);
    expect(result.activeDoTs.filter((d) => d.skillId === "dot-a").map((d) => d.endTime)).toEqual([10]);
  });

  it("打ち切った時刻ちょうどのティックは元の DoT が数え、二重に数えない", () => {
    const result = resolveTimeline([makeEntry("dot-a"), makeEntry("dot-b", 12)], skillMap, []);
    expect(tickTimes(result, "dot-a")).toEqual([3, 6, 9, 12]);
    expect(tickTimes(result, "dot-b")[0]).toBe(15);
  });

  it("打ち切られた DoT を掛け直しても、打ち切られていた期間のティックは数えない", () => {
    const result = resolveTimeline(
      [makeEntry("dot-a"), makeEntry("dot-b", 10), makeEntry("dot-a", 20)],
      skillMap,
      []
    );
    expect(tickTimes(result, "dot-a").slice(0, 4)).toEqual([3, 6, 9, 21]);
    expect(tickTimes(result, "dot-b")).toEqual([12, 15, 18]);
    const allTimes = result.dotTicks.map((t) => t.time);
    expect(new Set(allTimes).size).toBe(allTimes.length);
  });

  it("自分自身の ID は無視され、同じ DoT の掛け直しは通常の延長になる", () => {
    const result = resolveTimeline([makeEntry("dot-a"), makeEntry("dot-a", 10)], skillMap, []);
    const ticks = tickTimes(result, "dot-a");
    expect(ticks[0]).toBe(3);
    expect(ticks[ticks.length - 1]).toBe(39);
    expect(ticks).toHaveLength(13);
    // 掛け直し前の区間も打ち切らない（DoT レーンの表示は従来どおり重なったまま）
    expect(result.activeDoTs.filter((d) => d.skillId === "dot-a").map((d) => d.endTime)).toEqual([30, 40]);
  });
});
