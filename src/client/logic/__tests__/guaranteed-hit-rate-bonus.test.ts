import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { calcEntryExpectedPotency } from "../expected-potency";
import { DEFAULT_STATS } from "../stat-calc";
import { getAllSkillMapForLevel, getBuffsForLevel, getResourcesForLevel, getSkillsForLevel } from "../skill-level";
import { DRG_ATTACK_SKILLS } from "../../data/drg-skills";
import { DRG_BUFFS } from "../../data/drg-buffs";
import { DRG_RESOURCES } from "../../data/drg-resources";
import { DNC_ATTACK_SKILLS } from "../../data/dnc-skills";
import { DNC_BUFFS } from "../../data/dnc-buffs";
import { DNC_RESOURCES } from "../../data/dnc-resources";
import { MCH_ATTACK_SKILLS } from "../../data/mch-skills";
import { MCH_BUFFS } from "../../data/mch-buffs";
import { MCH_RESOURCES } from "../../data/mch-resources";
import type { BuffDefinition, ResolvedTimelineEntry, ResourceDefinition, Skill } from "../../types/skill";

// 6.2 から、確定クリティカル・ダイレクトヒットのアクションでは、率の上昇がダメージの上昇に換算される（#1004）。
// 式は xivgear の autoCritBuffDmg / autoDhitBuffDmg / autoDhitBonusDmg

function setup(attackSkills: Skill[], allBuffs: BuffDefinition[], allResources: ResourceDefinition[]) {
  const buffs = getBuffsForLevel(allBuffs, 100);
  const resources = getResourcesForLevel(allResources, 100);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(attackSkills, 100, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(attackSkills, skills, 100, buffIds, resourceIds);
  const resolve = (ids: string[]) =>
    resolveTimeline(ids.map((skillId) => ({ uid: `${skillId}-${Math.random()}`, skillId })), skillMap, resources, undefined, buffs);
  return { skillMap, resolve };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

describe("確定クリティカルのスキルに、クリティカル率の上昇が乗る", () => {
  it("竜騎士: バトルリタニー → ライフサージ → トゥルースラストは、リタニーの +10% が クリ倍率 × (1 + (クリ倍率 − 1) × 0.1) で乗る", () => {
    const { skillMap, resolve } = setup(DRG_ATTACK_SKILLS, DRG_BUFFS, DRG_RESOURCES);
    const withLitany = resolve(["battle-litany", "life-surge", "true-thrust"]).entries;
    const withoutLitany = resolve(["life-surge", "true-thrust"]).entries;
    withLitany.forEach(expectNoError);
    withoutLitany.forEach(expectNoError);

    const gcd = withLitany[2];
    const base = withoutLitany[1];
    expect(gcd.guaranteedCrit).toBe(true);
    expect(gcd.critRateBonus).toBeCloseTo(0.1);
    expect(base.guaranteedCrit).toBe(true);

    const skill = skillMap.get("true-thrust");
    const potency = gcd.resolvedPotency;
    // 既定のステータスでクリ倍率 1.4: 1.4 × floor3(1 + 0.4 × 0.1) = 1.4 × 1.04
    expect(calcEntryExpectedPotency(gcd, skill, DEFAULT_STATS)).toBe(Math.floor(potency * 1.4 * 1.04));
    expect(calcEntryExpectedPotency(base, skill, DEFAULT_STATS)).toBe(Math.floor(potency * 1.4));
  });

  it("踊り子: 攻めのタンゴ中の流星の舞いは、クリ・DH の +20% がそれぞれ換算されて乗る", () => {
    const { skillMap, resolve } = setup(DNC_ATTACK_SKILLS, DNC_BUFFS, DNC_RESOURCES);
    const e = resolve(["devilment", "cascade", "starfall-dance"]).entries;
    e.forEach(expectNoError);

    const starfall = e[2];
    expect(starfall.guaranteedCrit).toBe(true);
    expect(starfall.guaranteedDh).toBe(true);
    expect(starfall.critRateBonus).toBeCloseTo(0.2);
    expect(starfall.dhRateBonus).toBeCloseTo(0.2);
    // 1.4 × floor3(1 + 0.4 × 0.2) × 1.25 × floor3(1 + 0.25 × 0.2) = 1.4 × 1.08 × 1.25 × 1.05。率の上昇が無ければ 600 × 1.75 = 1050
    expect(calcEntryExpectedPotency(starfall, skillMap.get("starfall-dance"), DEFAULT_STATS)).toBe(Math.floor(600 * 1.4 * 1.08 * 1.25 * 1.05));
    expect(calcEntryExpectedPotency(starfall, skillMap.get("starfall-dance"), DEFAULT_STATS)).toBeGreaterThan(1050);
  });
});

describe("確定ダイレクトヒットのスキルに、DH のステータスによる倍率が乗る", () => {
  it("DH を 2000 にすると、流星の舞いの意志力の倍率に floor(140 × 1580 / 2780) / 1000 = 0.079 が足される", () => {
    const { skillMap, resolve } = setup(DNC_ATTACK_SKILLS, DNC_BUFFS, DNC_RESOURCES);
    const starfall = resolve(["devilment", "cascade", "starfall-dance"]).entries[2];
    const skill = skillMap.get("starfall-dance");
    const highDh = { ...DEFAULT_STATS, directHit: 2000 };

    const rateMul = 1.4 * 1.08 * 1.25 * 1.05;
    expect(calcEntryExpectedPotency(starfall, skill, DEFAULT_STATS)).toBe(Math.floor(600 * rateMul));
    expect(calcEntryExpectedPotency(starfall, skill, highDh)).toBe(Math.floor(600 * rateMul * 1.079));
  });
});

describe("DoT には確定クリティカル・ダイレクトヒットが乗らない", () => {
  it("機工士: リアセンブル中のバイオブラストは本体が確定クリ・DH になり、DoT のティックは確定にならない", () => {
    const { resolve } = setup(MCH_ATTACK_SKILLS, MCH_BUFFS, MCH_RESOURCES);
    const result = resolve(["reassemble", "bioblaster"]);
    result.entries.forEach(expectNoError);

    const bioblaster = result.entries[1];
    expect(bioblaster.guaranteedCrit).toBe(true);
    expect(bioblaster.guaranteedDh).toBe(true);

    const ticks = result.dotTicks.filter((t) => t.skillId === "bioblaster");
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      expect(tick.critRateBonus).toBe(0);
      expect(tick.dhRateBonus).toBe(0);
    }
  });
});
