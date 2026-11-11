import { describe, it, expect } from "vitest";
import { PLD_ATTACK_SKILLS } from "../../data/pld-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(PLD_ATTACK_SKILLS.map((s) => [s.id, s]));

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
    gcdRecast: 0,
    castTime: 0,
    targetCount: 1,
    ...overrides,
  };
}

const DEFAULT_MUL = calcExpectedMultiplier(DEFAULT_STATS, 0, 0);

/**
 * 公式ジョブガイド（Patch 7.5 / 7.55）準拠の PLD 範囲スキル
 * 「対象とその周囲の敵に範囲物理攻撃／無属性範囲魔法攻撃。2体目以降の対象への威力は60％減少する」（減衰は 7.2 で 50% → 60%）
 */
const PLD_AOE_FALLOFF_IDS = [
  "expiacion",
  "confiteor",
  "confiteor-requiescat",
  "blade-of-faith",
  "blade-of-faith-requiescat",
  "blade-of-truth",
  "blade-of-truth-requiescat",
  "blade-of-valor",
  "blade-of-valor-requiescat",
  "imperator",
  "blade-of-honor",
] as const;

/** 減衰なし（全対象フル威力）の範囲スキル: 「自身の周囲の敵に範囲物理攻撃／無属性範囲魔法攻撃」 */
const PLD_AOE_NO_FALLOFF_IDS = [
  "total-eclipse",
  "prominence",
  "holy-circle",
  "holy-circle-divine-might",
  "holy-circle-requiescat",
  "circle-of-scorn",
] as const;

const PLD_AOE_IDS = new Set<string>([...PLD_AOE_FALLOFF_IDS, ...PLD_AOE_NO_FALLOFF_IDS]);

function breakdownAt(id: string, targetCount: number) {
  const skill = skillMap.get(id)!;
  const entry = makeResolvedEntry({
    skillId: id,
    resolvedSkillId: id,
    resolvedPotency: skill.potency,
    targetCount,
  });
  return {
    breakdown: calcEntryPotencyBreakdown(entry, skill, DEFAULT_STATS),
    single: Math.floor(skill.potency * DEFAULT_MUL),
  };
}

describe("PLD AoE データ", () => {
  it.each(PLD_AOE_FALLOFF_IDS.map((id) => ({ id })))("$id は対象数無制限・減衰 0.6 の範囲スキル", ({ id }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(0.6);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it.each(PLD_AOE_NO_FALLOFF_IDS.map((id) => ({ id })))("$id は対象数無制限・減衰なしの範囲スキル", ({ id }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBeUndefined();
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it("範囲スキル以外の攻撃スキルは maxTargets 未設定のまま", () => {
    for (const skill of PLD_ATTACK_SKILLS) {
      if (PLD_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("エクスピアシオン: 3体ヒットで2体目以降が 60% 減衰", () => {
    const { breakdown, single } = breakdownAt("expiacion", 3);
    const reduced = Math.floor(single * (1 - 0.6));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("トータルエクリプス: 3体ヒットで全対象フル威力", () => {
    const { breakdown, single } = breakdownAt("total-eclipse", 3);
    expect(breakdown.targets).toEqual([single, single, single]);
  });
});
