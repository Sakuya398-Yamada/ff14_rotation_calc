import { describe, it, expect } from "vitest";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

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

/** 公式ジョブガイド準拠の SAM 範囲スキル定義（Issue #321） */
const SAM_AOE_FALLOFF_SKILLS = [
  // 2体目以降40%減
  { id: "ogi-namikiri", falloffRate: 0.4 },
  { id: "kaeshi-namikiri", falloffRate: 0.4 },
  { id: "zanshin", falloffRate: 0.4 },
  { id: "shoha", falloffRate: 0.4 },
] as const;

/** 減衰なし（全対象フル威力）の範囲スキル */
const SAM_AOE_NO_FALLOFF_IDS = [
  "fuga",
  "fuko",
  "mangetsu",
  "oka",
  "tenka-goken",
  "tendo-goken",
  "kaeshi-goken",
  "tendo-kaeshi-goken",
  "hissatsu-guren",
] as const;

const SAM_AOE_IDS = new Set<string>([
  ...SAM_AOE_FALLOFF_SKILLS.map((s) => s.id),
  ...SAM_AOE_NO_FALLOFF_IDS,
]);

describe("SAM AoE データ（#321）", () => {
  it.each(SAM_AOE_FALLOFF_SKILLS)("$id は対象数無制限・減衰 $falloffRate の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it.each(SAM_AOE_NO_FALLOFF_IDS.map((id) => ({ id })))(
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
    for (const skill of SAM_ATTACK_SKILLS) {
      if (SAM_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("奥義波切: 3体ヒットで2体目以降が40%減", () => {
    const ogiNamikiri = skillMap.get("ogi-namikiri")!;
    const entry = makeResolvedEntry({
      skillId: "ogi-namikiri",
      resolvedSkillId: "ogi-namikiri",
      resolvedPotency: ogiNamikiri.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, ogiNamikiri, DEFAULT_STATS);
    const single = Math.floor(ogiNamikiri.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.4));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("照破: 3体ヒットで2体目以降が40%減", () => {
    const shoha = skillMap.get("shoha")!;
    const entry = makeResolvedEntry({
      skillId: "shoha",
      resolvedSkillId: "shoha",
      resolvedPotency: shoha.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, shoha, DEFAULT_STATS);
    const single = Math.floor(shoha.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.4));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("天下五剣: 3体ヒットで全対象フル威力", () => {
    const tenkaGoken = skillMap.get("tenka-goken")!;
    const entry = makeResolvedEntry({
      skillId: "tenka-goken",
      resolvedSkillId: "tenka-goken",
      resolvedPotency: tenkaGoken.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, tenkaGoken, DEFAULT_STATS);
    const single = Math.floor(tenkaGoken.potency * DEFAULT_MUL);
    expect(breakdown.targets).toEqual([single, single, single]);
  });

  it("風光: 5体ヒットで合計威力が 1体分 × 5（減衰なし）", () => {
    const fuko = skillMap.get("fuko")!;
    const entry = makeResolvedEntry({
      skillId: "fuko",
      resolvedSkillId: "fuko",
      resolvedPotency: fuko.potency,
      targetCount: 5,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, fuko, DEFAULT_STATS);
    const single = Math.floor(fuko.potency * DEFAULT_MUL);
    expect(breakdown.targets).toHaveLength(5);
    expect(breakdown.total).toBe(single * 5);
  });
});
