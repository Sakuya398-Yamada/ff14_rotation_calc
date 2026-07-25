import { describe, it, expect } from "vitest";
import { DRG_ATTACK_SKILLS } from "../../data/drg-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(DRG_ATTACK_SKILLS.map((s) => [s.id, s]));

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

/** 公式ジョブガイド準拠の DRG 範囲スキル定義（Issue #270） */
const DRG_AOE_SKILLS = [
  // 前方直線範囲・減衰なし・対象数無制限
  { id: "doom-spike", falloffRate: undefined },
  { id: "sonic-thrust", falloffRate: undefined },
  { id: "coerthan-torment", falloffRate: undefined },
  { id: "draconian-fury", falloffRate: undefined },
  { id: "wyrmwind-thrust", falloffRate: undefined },
  // 2体目以降50%減
  { id: "dragonfire-dive", falloffRate: 0.5 },
  { id: "rise-of-the-dragon", falloffRate: 0.5 },
  { id: "geirskogul", falloffRate: 0.5 },
  { id: "nastrond", falloffRate: 0.5 },
  // 2体目以降40%減（パッチ7.3で50%→40%）
  { id: "stardiver", falloffRate: 0.4 },
  { id: "starcross", falloffRate: 0.4 },
] as const;

const DRG_AOE_IDS = new Set<string>(DRG_AOE_SKILLS.map((s) => s.id));

describe("DRG AoE データ（#270）", () => {
  it.each(DRG_AOE_SKILLS)("$id は対象数無制限の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it("範囲スキル以外の攻撃スキルは maxTargets 未設定のまま", () => {
    for (const skill of DRG_ATTACK_SKILLS) {
      if (DRG_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("ドゥームスパイク: 5体ヒットで減衰なし5体分の合計威力", () => {
    const doomSpike = skillMap.get("doom-spike")!;
    const entry = makeResolvedEntry({
      skillId: "doom-spike",
      resolvedSkillId: "doom-spike",
      resolvedPotency: doomSpike.potency,
      targetCount: 5,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, doomSpike, DEFAULT_STATS);
    const single = Math.floor(doomSpike.potency * DEFAULT_MUL);
    expect(breakdown.targets).toHaveLength(5);
    expect(breakdown.total).toBe(single * 5);
  });

  it("ゲイルスコグル: 3体ヒットで2体目以降が50%減", () => {
    const geirskogul = skillMap.get("geirskogul")!;
    const entry = makeResolvedEntry({
      skillId: "geirskogul",
      resolvedSkillId: "geirskogul",
      resolvedPotency: geirskogul.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, geirskogul, DEFAULT_STATS);
    const single = Math.floor(geirskogul.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * 0.5);
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("スタークロッサー: 3体ヒットで2体目以降が40%減", () => {
    const starcross = skillMap.get("starcross")!;
    const entry = makeResolvedEntry({
      skillId: "starcross",
      resolvedSkillId: "starcross",
      resolvedPotency: starcross.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, starcross, DEFAULT_STATS);
    const single = Math.floor(starcross.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * 0.6);
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });
});
