import { describe, it, expect } from "vitest";
import { SGE_ATTACK_SKILLS } from "../../data/sge-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(SGE_ATTACK_SKILLS.map((s) => [s.id, s]));

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

/** 公式ジョブガイド（Patch 7.5 / 7.55）準拠の SGE 範囲スキル（Issue #813） */
const SGE_AOE_FALLOFF_SKILLS = [
  // フレグマ: 「対象とその周囲の敵に無属性範囲魔法攻撃。2体目以降の対象への威力は30％減少する」
  { id: "phlegma", falloffRate: 0.3 },
  // フレグマII・III、トキシコン・II、プシュケー: 「対象とその周囲の敵に無属性範囲魔法攻撃。2体目以降の対象への威力は50％減少する」
  { id: "phlegma2", falloffRate: 0.5 },
  { id: "phlegma3", falloffRate: 0.5 },
  { id: "toxikon", falloffRate: 0.5 },
  { id: "toxikon2", falloffRate: 0.5 },
  { id: "psyche", falloffRate: 0.5 },
  // プネウマ: 「対象に向かって前方直線範囲無属性魔法攻撃。2体目以降の対象への威力は40％減少する」
  { id: "pneuma", falloffRate: 0.4 },
] as const;

/** 減衰なし（全対象フル威力）の範囲スキル */
const SGE_AOE_NO_FALLOFF_IDS = [
  // ディスクラシア・ディスクラシアII: 「自身の周囲の敵に無属性範囲魔法攻撃」
  "dyskrasia",
  "dyskrasia2",
  // エウクラシア・ディスクラシア: 「自身の周囲の敵に無属性の継続ダメージを付与する」
  "eukrasian-dyskrasia",
] as const;

const SGE_AOE_IDS = new Set<string>([
  ...SGE_AOE_FALLOFF_SKILLS.map((s) => s.id),
  ...SGE_AOE_NO_FALLOFF_IDS,
]);

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

/** 内訳の確認は減衰率ごとに 1 スキル */
const SGE_FALLOFF_BREAKDOWN_CASES = [
  { id: "phlegma", falloffRate: 0.3 },
  { id: "pneuma", falloffRate: 0.4 },
  { id: "phlegma3", falloffRate: 0.5 },
] as const;

describe("SGE AoE データ（#813）", () => {
  it.each(SGE_AOE_FALLOFF_SKILLS)("$id は対象数無制限・減衰 $falloffRate の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it.each(SGE_AOE_NO_FALLOFF_IDS.map((id) => ({ id })))(
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
    for (const skill of SGE_ATTACK_SKILLS) {
      if (SGE_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it.each(SGE_FALLOFF_BREAKDOWN_CASES)("$id: 3体ヒットで2体目以降が減衰 $falloffRate", ({ id, falloffRate }) => {
    const { breakdown, single } = breakdownAt(id, 3);
    const reduced = Math.floor(single * (1 - falloffRate));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("ディスクラシアII: 3体ヒットで全対象フル威力", () => {
    const { breakdown, single } = breakdownAt("dyskrasia2", 3);
    expect(breakdown.targets).toEqual([single, single, single]);
  });
});
