import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../skill-level";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { BuffDefinition, Skill, TimelineEntry } from "../../types/skill";

// スキルの DoT を着弾時刻（hitTime ?? startTime）から付ける（#949）。
// 付与・効果時間・ティックの数え始め・replacesDots の打ち切り・refreshesDots の延長は着弾時刻、
// スナップショット（倍率・クリ・DH）は実行時のまま

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

let uidSeq = 0;
function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  uidSeq += 1;
  return { uid: `entry-${uidSeq}`, skillId, ...(manualStartTime !== undefined ? { manualStartTime } : {}) };
}

type Result = ReturnType<typeof resolveTimeline>;

function tickTimes(result: Result, skillId: string): number[] {
  return result.dotTicks.filter((t) => t.skillId === skillId).map((t) => t.time);
}

function dotSpans(result: Result, skillId: string): [number, number][] {
  return result.activeDoTs.filter((d) => d.skillId === skillId).map((d) => [d.startTime, d.endTime]);
}

describe("遅れを設定したスキルの DoT（#949）", () => {
  const dot = makeSkill({ id: "dot", dotPotency: 10, dotDuration: 9 });
  const skillMap = new Map([[dot.id, dot]]);

  it("着弾時刻から付き、効果時間とティックも着弾時刻から数える（3 秒刻みの境界をまたぐ）", () => {
    // 2.5 秒に実行し、0.6 秒後の 3.1 秒に着弾。遅れが無ければ 2.5〜11.5 秒でティックは 3・6・9 秒
    const result = resolveTimeline([entry("dot", 2.5)], skillMap, [], undefined, [], undefined, undefined, { dot: 0.6 });
    expect(result.entries[0].hitTime).toBe(3.1);
    expect(dotSpans(result, "dot")).toEqual([[3.1, 12.1]]);
    expect(tickTimes(result, "dot")).toEqual([6, 9, 12]);
  });

  it("遅れを設定していなければ、実行した時刻から付く", () => {
    const result = resolveTimeline([entry("dot", 2.5)], skillMap, [], undefined, []);
    expect(dotSpans(result, "dot")).toEqual([[2.5, 11.5]]);
    expect(tickTimes(result, "dot")).toEqual([3, 6, 9]);
  });
});

describe("遅れが未設定の詠唱スキルの DoT（#949）", () => {
  it("詠唱完了の時刻から付く", () => {
    const castDot = makeSkill({ id: "cast-dot", castTime: 1.3, dotPotency: 10, dotDuration: 9 });
    const result = resolveTimeline([entry("cast-dot", 2)], new Map([[castDot.id, castDot]]), [], undefined, []);
    expect(result.entries[0].hitTime).toBe(3.3);
    expect(dotSpans(result, "cast-dot")).toEqual([[3.3, 12.3]]);
    expect(tickTimes(result, "cast-dot")).toEqual([6, 9, 12]);
  });

  it("侍の彼岸花の DoT は、詠唱完了の時刻から付く", () => {
    const buffIds = new Set(SAM_BUFFS.map((b) => b.id));
    const resourceIds = new Set(SAM_RESOURCES.map((r) => r.id));
    const samSkillMap = getAllSkillMapForLevel(
      SAM_ATTACK_SKILLS,
      getSkillsForLevel(SAM_ATTACK_SKILLS, 100, buffIds, resourceIds),
      100,
      buffIds,
      resourceIds,
    );
    const result = resolveTimeline([entry("hakaze"), entry("yukikaze"), entry("iaijutsu")], samSkillMap, SAM_RESOURCES, undefined, SAM_BUFFS);
    const higanbana = result.entries[2];
    expect(higanbana.resolvedSkillId).toBe("higanbana");
    expect(higanbana.startTime).toBe(5);
    expect(higanbana.hitTime).toBe(6.3);
    // 詠唱完了の 6.3 秒から 60 秒。実行した 5 秒から付けると、ティックは 6〜63 秒になる
    expect(dotSpans(result, "higanbana")).toEqual([[6.3, 66.3]]);
    const ticks = tickTimes(result, "higanbana");
    expect(ticks[0]).toBe(9);
    expect(ticks[ticks.length - 1]).toBe(66);
  });
});

describe("DoT のスナップショットは実行時のまま（#949）", () => {
  const burst: BuffDefinition = {
    id: "burst",
    icon: "",
    duration: 1.5,
    effects: [
      { type: "potency", value: 1.2 },
      { type: "critRate", value: 0.1 },
      { type: "dhRate", value: 0.2 },
    ],
    color: "#000",
  };
  const burstSkill = makeSkill({ id: "burst", type: "ogcd", potency: 0, target: "self", recastTime: 0.65, cooldown: 120, buffApplications: ["burst"] });
  const dot = makeSkill({ id: "dot", dotPotency: 10, dotDuration: 9 });
  const skillMap = new Map([[burstSkill.id, burstSkill], [dot.id, dot]]);

  it("実行時に効いていたバフは、着弾までに切れても DoT のティックに乗る", () => {
    // バフは 0〜1.5 秒。DoT は 1 秒に実行し、2 秒に着弾
    const result = resolveTimeline([entry("burst"), entry("dot", 1)], skillMap, [], undefined, [burst], undefined, undefined, { dot: 1 });
    expect(dotSpans(result, "dot")).toEqual([[2, 11]]);
    const ticks = result.dotTicks.filter((t) => t.skillId === "dot");
    expect(ticks.map((t) => t.time)).toEqual([3, 6, 9]);
    for (const t of ticks) {
      expect(t.potency).toBe(12);
      expect(t.critRateBonus).toBeCloseTo(0.1);
      expect(t.dhRateBonus).toBeCloseTo(0.2);
    }
  });

  it("実行の後・着弾の前に付いたバフは、DoT のティックに乗らない", () => {
    // DoT は 0 秒に実行し、2 秒に着弾。バフは 0.65 秒から
    const result = resolveTimeline([entry("dot"), entry("burst")], skillMap, [], undefined, [{ ...burst, duration: 20 }], undefined, undefined, { dot: 2 });
    expect(result.entries[1].startTime).toBe(0.65);
    const ticks = result.dotTicks.filter((t) => t.skillId === "dot");
    expect(ticks.map((t) => t.time)).toEqual([3, 6, 9]);
    for (const t of ticks) {
      expect(t.potency).toBe(10);
      expect(t.critRateBonus).toBe(0);
      expect(t.dhRateBonus).toBe(0);
    }
  });
});

describe("replacesDots の打ち切りは着弾時刻（#949）", () => {
  const dotA = makeSkill({ id: "dot-a", dotPotency: 10, dotDuration: 30, replacesDots: ["dot-a", "dot-b"] });
  const dotB = makeSkill({ id: "dot-b", dotPotency: 20, dotDuration: 30, replacesDots: ["dot-a", "dot-b"] });
  const skillMap = new Map([[dotA.id, dotA], [dotB.id, dotB]]);

  it("別の DoT が着弾した時刻に、元の DoT を打ち切る", () => {
    // dot-b は 10 秒に実行し、13 秒に着弾。遅れが無ければ dot-a は 10 秒で切れ、ティックは 3・6・9 秒
    const result = resolveTimeline([entry("dot-a"), entry("dot-b", 10)], skillMap, [], undefined, [], undefined, undefined, { "dot-b": 3 });
    expect(dotSpans(result, "dot-a")).toEqual([[0, 13]]);
    expect(tickTimes(result, "dot-a")).toEqual([3, 6, 9, 12]);
    expect(dotSpans(result, "dot-b")).toEqual([[13, 43]]);
    expect(tickTimes(result, "dot-b")[0]).toBe(15);
  });
});

describe("refreshesDots の延長は着弾時刻（#949）", () => {
  const dot = makeSkill({ id: "dot", dotPotency: 10, dotDuration: 9 });
  const refresher = makeSkill({ id: "refresher", refreshesDots: ["dot"] });
  const skillMap = new Map([[dot.id, dot], [refresher.id, refresher]]);

  it("着弾した時刻から、元の DoT の効果時間で延長する", () => {
    // 延長は 5 秒に実行し、6 秒に着弾。遅れが無ければ 5 + 9 = 14 秒まで
    const result = resolveTimeline([entry("dot"), entry("refresher", 5)], skillMap, [], undefined, [], undefined, undefined, { refresher: 1 });
    expect(dotSpans(result, "dot")).toEqual([[0, 9], [6, 15]]);
    expect(tickTimes(result, "dot")).toEqual([3, 6, 9, 12, 15]);
  });

  it("実行時に効いていても、着弾時に切れていれば延長しない", () => {
    // DoT は 9 秒に切れる。延長は 7 秒に実行し、10 秒に着弾
    const result = resolveTimeline([entry("dot"), entry("refresher", 7)], skillMap, [], undefined, [], undefined, undefined, { refresher: 3 });
    expect(dotSpans(result, "dot")).toEqual([[0, 9]]);
    expect(tickTimes(result, "dot")).toEqual([3, 6, 9]);
  });
});
