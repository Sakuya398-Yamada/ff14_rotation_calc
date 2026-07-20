import { describe, it, expect } from "vitest";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(WHM_ATTACK_SKILLS.map((s) => [s.id, s]));

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

/** 公式ジョブガイド準拠の WHM 範囲スキル定義（Issue #269） */
const WHM_AOE_SKILLS = [
  // 減衰なし・対象数無制限
  { id: "holy", falloffRate: undefined },
  { id: "holy3", falloffRate: undefined },
  { id: "assize", falloffRate: undefined },
  // 2体目以降減衰
  { id: "glare4", falloffRate: 0.4 },
  { id: "heart-of-misery", falloffRate: 0.5 },
] as const;

const WHM_AOE_IDS = new Set<string>(WHM_AOE_SKILLS.map((s) => s.id));

describe("WHM AoE データ（#269）", () => {
  it.each(WHM_AOE_SKILLS)("$id は対象数無制限の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it("範囲スキル以外の攻撃スキルは maxTargets 未設定のまま", () => {
    for (const skill of WHM_ATTACK_SKILLS) {
      if (WHM_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("ホーリー: 5体ヒットで減衰なし5体分の合計威力", () => {
    const holy = skillMap.get("holy")!;
    const entry = makeResolvedEntry({
      skillId: "holy",
      resolvedSkillId: "holy",
      resolvedPotency: holy.potency,
      targetCount: 5,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, holy, DEFAULT_STATS);
    const single = Math.floor(holy.potency * DEFAULT_MUL);
    expect(breakdown.targets).toHaveLength(5);
    expect(breakdown.total).toBe(single * 5);
  });

  it("グレアジャ: 3体ヒットで2体目以降が40%減", () => {
    const glare4 = skillMap.get("glare4")!;
    const entry = makeResolvedEntry({
      skillId: "glare4",
      resolvedSkillId: "glare4",
      resolvedPotency: glare4.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, glare4, DEFAULT_STATS);
    const single = Math.floor(glare4.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * 0.6);
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("ハート・オブ・ミゼリ: 2体ヒットで2体目が50%減", () => {
    const misery = skillMap.get("heart-of-misery")!;
    const entry = makeResolvedEntry({
      skillId: "heart-of-misery",
      resolvedSkillId: "heart-of-misery",
      resolvedPotency: misery.potency,
      targetCount: 2,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, misery, DEFAULT_STATS);
    const single = Math.floor(misery.potency * DEFAULT_MUL);
    expect(breakdown.targets).toEqual([single, Math.floor(single * 0.5)]);
  });
});
