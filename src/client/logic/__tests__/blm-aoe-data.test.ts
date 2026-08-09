import { describe, it, expect } from "vitest";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

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

const DEFAULT_MUL = calcExpectedMultiplier(DEFAULT_STATS, 0, 0);

/** 公式ジョブガイド準拠の BLM 範囲スキル定義（Issue #273） */
const BLM_AOE_FALLOFF_SKILLS = [
  // 2体目以降30%減
  { id: "flare", falloffRate: 0.3 },
  // 2体目以降65%減
  { id: "flare-star", falloffRate: 0.65 },
  // 2体目以降25%減
  { id: "foul", falloffRate: 0.25 },
] as const;

/** 減衰なし（全対象フル威力）の範囲スキル */
const BLM_AOE_NO_FALLOFF_IDS = [
  "fire-2",
  "high-fire-2",
  "blizzard-2",
  "high-blizzard-2",
  "freeze",
  "high-thunder-2",
  "thunder-4",
] as const;

const BLM_AOE_IDS = new Set<string>([
  ...BLM_AOE_FALLOFF_SKILLS.map((s) => s.id),
  ...BLM_AOE_NO_FALLOFF_IDS,
]);

describe("BLM AoE データ（#273）", () => {
  it.each(BLM_AOE_FALLOFF_SKILLS)("$id は対象数無制限・減衰 $falloffRate の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it.each(BLM_AOE_NO_FALLOFF_IDS.map((id) => ({ id })))(
    "$id は対象数無制限・減衰なしの範囲スキル",
    ({ id }) => {
      const skill = skillMap.get(id);
      expect(skill).toBeDefined();
      expect(skill!.maxTargets).toBe(Infinity);
      expect(skill!.falloffRate).toBeUndefined();
      expect(skill!.falloffStartTarget).toBeUndefined();
    },
  );

  it("範囲スキル以外の攻撃スキルは maxTargets 未設定のまま", () => {
    for (const skill of BLM_ATTACK_SKILLS) {
      if (BLM_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("フレアスター: 3体ヒットで2体目以降が65%減", () => {
    const flareStar = skillMap.get("flare-star")!;
    const entry = makeResolvedEntry({
      skillId: "flare-star",
      resolvedSkillId: "flare-star",
      resolvedPotency: flareStar.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, flareStar, DEFAULT_STATS);
    const single = Math.floor(flareStar.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.65));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("ファウル: 3体ヒットで2体目以降が25%減", () => {
    const foul = skillMap.get("foul")!;
    const entry = makeResolvedEntry({
      skillId: "foul",
      resolvedSkillId: "foul",
      resolvedPotency: foul.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, foul, DEFAULT_STATS);
    const single = Math.floor(foul.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.25));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("フリーズ: 3体ヒットで全対象フル威力", () => {
    const freeze = skillMap.get("freeze")!;
    const entry = makeResolvedEntry({
      skillId: "freeze",
      resolvedSkillId: "freeze",
      resolvedPotency: freeze.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, freeze, DEFAULT_STATS);
    const single = Math.floor(freeze.potency * DEFAULT_MUL);
    expect(breakdown.targets).toEqual([single, single, single]);
  });

  it("ハイサンダラ: 5体ヒットで合計威力が 1体分 × 5（減衰なし）", () => {
    const highThunder2 = skillMap.get("high-thunder-2")!;
    const entry = makeResolvedEntry({
      skillId: "high-thunder-2",
      resolvedSkillId: "high-thunder-2",
      resolvedPotency: highThunder2.potency,
      targetCount: 5,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, highThunder2, DEFAULT_STATS);
    const single = Math.floor(highThunder2.potency * DEFAULT_MUL);
    expect(breakdown.targets).toHaveLength(5);
    expect(breakdown.total).toBe(single * 5);
  });
});
