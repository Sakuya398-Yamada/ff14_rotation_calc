import { describe, it, expect } from "vitest";
import { SCH_ATTACK_SKILLS } from "../../data/sch-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(SCH_ATTACK_SKILLS.map((s) => [s.id, s]));

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
 * 公式ジョブガイド（Patch 7.5 / 7.55）準拠の SCH 範囲スキル（Issue #813）。
 * 学者の範囲攻撃に「2体目以降の対象への威力は X％減少する」の記載は無く、すべて減衰なし
 */
const SCH_AOE_NO_FALLOFF_IDS = [
  // 破陣法・裂陣法: 「自身の周囲の敵に無属性範囲魔法攻撃」
  "art-of-war",
  "art-of-war2",
  // 埋伏の毒: 「対象とその周囲の敵に無属性の継続ダメージを付与する」
  "baneful-impaction",
] as const;

const SCH_AOE_IDS = new Set<string>(SCH_AOE_NO_FALLOFF_IDS);

describe("SCH AoE データ（#813）", () => {
  it.each(SCH_AOE_NO_FALLOFF_IDS.map((id) => ({ id })))(
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
    for (const skill of SCH_ATTACK_SKILLS) {
      if (SCH_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("裂陣法: 3体ヒットで全対象フル威力", () => {
    const artOfWar2 = skillMap.get("art-of-war2")!;
    const entry = makeResolvedEntry({
      skillId: "art-of-war2",
      resolvedSkillId: "art-of-war2",
      resolvedPotency: artOfWar2.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, artOfWar2, DEFAULT_STATS);
    const single = Math.floor(artOfWar2.potency * DEFAULT_MUL);
    expect(breakdown.targets).toEqual([single, single, single]);
  });
});
