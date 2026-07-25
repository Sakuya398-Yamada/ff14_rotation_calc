import { describe, it, expect } from "vitest";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(BRD_ATTACK_SKILLS.map((s) => [s.id, s]));

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

/** 公式ジョブガイド準拠の BRD 範囲スキル定義（Issue #271） */
const BRD_AOE_SKILLS = [
  // 減衰なし・対象数無制限
  { id: "quick-nock", falloffRate: undefined },
  { id: "ladonsbite", falloffRate: undefined },
  { id: "shadowbite", falloffRate: undefined },
  { id: "rain-of-death", falloffRate: undefined },
  { id: "apex-arrow", falloffRate: undefined },
  // 2体目以降50%減
  { id: "blast-arrow", falloffRate: 0.5 },
  { id: "resonant-arrow", falloffRate: 0.5 },
  { id: "radiant-encore", falloffRate: 0.5 },
  { id: "pitch-perfect", falloffRate: 0.5 },
] as const;

const BRD_AOE_IDS = new Set<string>(BRD_AOE_SKILLS.map((s) => s.id));

describe("BRD AoE データ（#271）", () => {
  it.each(BRD_AOE_SKILLS)("$id は対象数無制限の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it("範囲スキル以外の攻撃スキルは maxTargets 未設定のまま", () => {
    for (const skill of BRD_ATTACK_SKILLS) {
      if (BRD_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("レイン・オブ・デス: 5体ヒットで減衰なし5体分の合計威力", () => {
    const rainOfDeath = skillMap.get("rain-of-death")!;
    const entry = makeResolvedEntry({
      skillId: "rain-of-death",
      resolvedSkillId: "rain-of-death",
      resolvedPotency: rainOfDeath.potency,
      targetCount: 5,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, rainOfDeath, DEFAULT_STATS);
    const single = Math.floor(rainOfDeath.potency * DEFAULT_MUL);
    expect(breakdown.targets).toHaveLength(5);
    expect(breakdown.total).toBe(single * 5);
  });

  it("ブラストアロー: 3体ヒットで2体目以降が50%減", () => {
    const blastArrow = skillMap.get("blast-arrow")!;
    const entry = makeResolvedEntry({
      skillId: "blast-arrow",
      resolvedSkillId: "blast-arrow",
      resolvedPotency: blastArrow.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, blastArrow, DEFAULT_STATS);
    const single = Math.floor(blastArrow.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * 0.5);
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("ピッチパーフェクト: 3体ヒットで2体目以降が50%減", () => {
    const pitchPerfect = skillMap.get("pitch-perfect")!;
    const entry = makeResolvedEntry({
      skillId: "pitch-perfect",
      resolvedSkillId: "pitch-perfect",
      resolvedPotency: pitchPerfect.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, pitchPerfect, DEFAULT_STATS);
    const single = Math.floor(pitchPerfect.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * 0.5);
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });
});
