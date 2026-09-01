import { describe, it, expect } from "vitest";
import { calcEntryExpectedPotency, calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry, Skill } from "../../types/skill";

function makeResolvedEntry(overrides: Partial<ResolvedTimelineEntry>): ResolvedTimelineEntry {
  return {
    uid: "u",
    skillId: "s",
    resolvedSkillId: "s",
    resolvedPotency: 100,
    startTime: 0,
    autoStartTime: 0,
    resourceSnapshot: {},
    resourceErrors: [],
    comboErrors: [],
    untargetableError: false,
    recastError: false,
    wsComboError: false,
    activeBuffs: [],
    activeBuffsAtUse: [],
    buffMultiplier: 1,
    critRateBonus: 0,
    dhRateBonus: 0,
    gcdAvailableAt: 0,
    actionAvailableAt: 0,
    castTime: 0,
    targetCount: 1,
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "s",
    name: "テストスキル",
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

const DEFAULT_MUL = calcExpectedMultiplier(DEFAULT_STATS, 0, 0);

describe("calcEntryPotencyBreakdown: 通常スキル", () => {
  it("バフなし単体スキル: floor(potency * 期待倍率) を 1 体分返す", () => {
    const entry = makeResolvedEntry({ resolvedPotency: 300 });
    const breakdown = calcEntryPotencyBreakdown(entry, makeSkill({ potency: 300 }), DEFAULT_STATS);
    const single = Math.floor(300 * DEFAULT_MUL);
    expect(breakdown.singleTargetPotency).toBe(single);
    expect(breakdown.targets).toEqual([single]);
    expect(breakdown.total).toBe(single);
  });

  it("buffMultiplier は威力に floor 適用してから期待倍率を掛ける", () => {
    // floor(300 * 1.1) = 330 → floor(330 * mul)
    const entry = makeResolvedEntry({ resolvedPotency: 300, buffMultiplier: 1.1 });
    const breakdown = calcEntryPotencyBreakdown(entry, makeSkill({ potency: 300 }), DEFAULT_STATS);
    expect(breakdown.total).toBe(Math.floor(Math.floor(300 * 1.1) * DEFAULT_MUL));
  });

  it("entry の critRateBonus / dhRateBonus が期待倍率に反映される", () => {
    const entry = makeResolvedEntry({ resolvedPotency: 300, critRateBonus: 0.1, dhRateBonus: 0.2 });
    const buffedMul = calcExpectedMultiplier(DEFAULT_STATS, 0.1, 0.2);
    const breakdown = calcEntryPotencyBreakdown(entry, makeSkill({ potency: 300 }), DEFAULT_STATS);
    expect(breakdown.total).toBe(Math.floor(300 * buffedMul));
    expect(breakdown.total).toBeGreaterThan(Math.floor(300 * DEFAULT_MUL));
  });

  it("skill 未解決（undefined）でも単体扱いで計算できる", () => {
    const entry = makeResolvedEntry({ resolvedPotency: 200, targetCount: 3 });
    const breakdown = calcEntryPotencyBreakdown(entry, undefined, DEFAULT_STATS);
    expect(breakdown.targets).toHaveLength(1);
  });
});

describe("calcEntryPotencyBreakdown: エラーエントリ", () => {
  it.each([
    { name: "resourceErrors", overrides: { resourceErrors: ["mp"] } },
    { name: "comboErrors", overrides: { comboErrors: ["combo"] } },
    { name: "untargetableError", overrides: { untargetableError: true } },
    { name: "recastError", overrides: { recastError: true } },
  ])("$name のエントリは 0 / 空配列を返す", ({ overrides }) => {
    const entry = makeResolvedEntry({ resolvedPotency: 300, ...overrides });
    const breakdown = calcEntryPotencyBreakdown(entry, makeSkill(), DEFAULT_STATS);
    expect(breakdown).toEqual({ total: 0, targets: [], singleTargetPotency: 0 });
  });

  it("wsComboError はエラー扱いにならず通常計算される", () => {
    const entry = makeResolvedEntry({ resolvedPotency: 140, wsComboError: true });
    const breakdown = calcEntryPotencyBreakdown(entry, makeSkill(), DEFAULT_STATS);
    expect(breakdown.total).toBe(Math.floor(140 * DEFAULT_MUL));
  });
});

describe("calcEntryPotencyBreakdown: DoT スキル", () => {
  it("dotPotency は含まれず、直撃分（resolvedPotency）のみで計算される", () => {
    // DoT ティック分は resolve-timeline 側で別途集計されるため、
    // このヘルパーは直撃威力のみを返すことを固定する
    const dotSkill = makeSkill({ potency: 150, dotPotency: 60, dotDuration: 30 });
    const entry = makeResolvedEntry({ resolvedPotency: 150 });
    const breakdown = calcEntryPotencyBreakdown(entry, dotSkill, DEFAULT_STATS);
    expect(breakdown.total).toBe(Math.floor(150 * DEFAULT_MUL));
  });
});

describe("calcEntryPotencyBreakdown: AoE falloff", () => {
  it("falloffStartTarget 未設定なら 2 体目から (1 - falloffRate) 倍に減衰する", () => {
    const aoe = makeSkill({ potency: 400, maxTargets: Infinity, falloffRate: 0.25 });
    const entry = makeResolvedEntry({ resolvedPotency: 400, targetCount: 3 });
    const breakdown = calcEntryPotencyBreakdown(entry, aoe, DEFAULT_STATS);
    const single = Math.floor(400 * DEFAULT_MUL);
    const reduced = Math.floor(single * 0.75);
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
    expect(breakdown.total).toBe(single + reduced * 2);
    expect(breakdown.singleTargetPotency).toBe(single);
  });

  it("falloffStartTarget 指定時はその体数から減衰が始まる", () => {
    const aoe = makeSkill({ potency: 400, maxTargets: 5, falloffRate: 0.5, falloffStartTarget: 3 });
    const entry = makeResolvedEntry({ resolvedPotency: 400, targetCount: 5 });
    const breakdown = calcEntryPotencyBreakdown(entry, aoe, DEFAULT_STATS);
    const single = Math.floor(400 * DEFAULT_MUL);
    const reduced = Math.floor(single * 0.5);
    expect(breakdown.targets).toEqual([single, single, reduced, reduced, reduced]);
  });

  it("targetCount が maxTargets を超えたら maxTargets 体で頭打ちになる", () => {
    const aoe = makeSkill({ potency: 400, maxTargets: 3, falloffRate: 0 });
    const entry = makeResolvedEntry({ resolvedPotency: 400, targetCount: 10 });
    const breakdown = calcEntryPotencyBreakdown(entry, aoe, DEFAULT_STATS);
    expect(breakdown.targets).toHaveLength(3);
  });

  it("falloffRate 未設定の範囲スキルは全対象フル威力", () => {
    const aoe = makeSkill({ potency: 400, maxTargets: Infinity });
    const entry = makeResolvedEntry({ resolvedPotency: 400, targetCount: 4 });
    const breakdown = calcEntryPotencyBreakdown(entry, aoe, DEFAULT_STATS);
    const single = Math.floor(400 * DEFAULT_MUL);
    expect(breakdown.targets).toEqual([single, single, single, single]);
  });

  it("範囲スキルでも targetCount=1 なら 1 体分のみ", () => {
    const aoe = makeSkill({ potency: 400, maxTargets: Infinity, falloffRate: 0.25 });
    const entry = makeResolvedEntry({ resolvedPotency: 400, targetCount: 1 });
    const breakdown = calcEntryPotencyBreakdown(entry, aoe, DEFAULT_STATS);
    expect(breakdown.targets).toHaveLength(1);
  });
});

describe("calcEntryExpectedPotency", () => {
  it("breakdown の total と一致する（通常・AoE・エラーの代表ケース）", () => {
    const aoe = makeSkill({ potency: 400, maxTargets: Infinity, falloffRate: 0.25 });
    const cases: Array<{ entry: ResolvedTimelineEntry; skill: Skill | undefined }> = [
      { entry: makeResolvedEntry({ resolvedPotency: 300 }), skill: makeSkill({ potency: 300 }) },
      { entry: makeResolvedEntry({ resolvedPotency: 400, targetCount: 3 }), skill: aoe },
      { entry: makeResolvedEntry({ resolvedPotency: 300, recastError: true }), skill: makeSkill() },
    ];
    for (const { entry, skill } of cases) {
      expect(calcEntryExpectedPotency(entry, skill, DEFAULT_STATS)).toBe(
        calcEntryPotencyBreakdown(entry, skill, DEFAULT_STATS).total
      );
    }
  });
});
