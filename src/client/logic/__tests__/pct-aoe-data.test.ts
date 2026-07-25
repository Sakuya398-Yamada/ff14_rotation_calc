import { describe, it, expect } from "vitest";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(PCT_ATTACK_SKILLS.map((s) => [s.id, s]));

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

/** 公式ジョブガイド準拠の PCT 範囲スキル定義（Issue #272） */
const PCT_AOE_SKILLS = [
  // 2体目以降70%減
  { id: "hammer-stamp", falloffRate: 0.7 },
  { id: "hammer-brush", falloffRate: 0.7 },
  { id: "polishing-hammer", falloffRate: 0.7 },
  { id: "star-prism", falloffRate: 0.7 },
  { id: "pom-muse", falloffRate: 0.7 },
  { id: "winged-muse", falloffRate: 0.7 },
  { id: "clawed-muse", falloffRate: 0.7 },
  { id: "fanged-muse", falloffRate: 0.7 },
  { id: "mog-of-the-ages", falloffRate: 0.7 },
  { id: "retribution-of-the-madeen", falloffRate: 0.7 },
  // 2体目以降65%減
  { id: "holy-in-white", falloffRate: 0.65 },
  { id: "comet-in-black", falloffRate: 0.65 },
  // 2体目以降85%減
  { id: "rainbow-drip", falloffRate: 0.85 },
] as const;

const PCT_AOE_IDS = new Set<string>(PCT_AOE_SKILLS.map((s) => s.id));

describe("PCT AoE データ（#272）", () => {
  it.each(PCT_AOE_SKILLS)("$id は対象数無制限・減衰 $falloffRate の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it("範囲スキル以外の攻撃スキルは maxTargets 未設定のまま", () => {
    for (const skill of PCT_ATTACK_SKILLS) {
      if (PCT_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("ハンマースタンプ: 3体ヒットで2体目以降が70%減", () => {
    const hammerStamp = skillMap.get("hammer-stamp")!;
    const entry = makeResolvedEntry({
      skillId: "hammer-stamp",
      resolvedSkillId: "hammer-stamp",
      resolvedPotency: hammerStamp.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, hammerStamp, DEFAULT_STATS);
    const single = Math.floor(hammerStamp.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.7));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("ホワイトホーリー: 3体ヒットで2体目以降が65%減", () => {
    const holyInWhite = skillMap.get("holy-in-white")!;
    const entry = makeResolvedEntry({
      skillId: "holy-in-white",
      resolvedSkillId: "holy-in-white",
      resolvedPotency: holyInWhite.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, holyInWhite, DEFAULT_STATS);
    const single = Math.floor(holyInWhite.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.65));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("レインボードリップ: 3体ヒットで2体目以降が85%減", () => {
    const rainbowDrip = skillMap.get("rainbow-drip")!;
    const entry = makeResolvedEntry({
      skillId: "rainbow-drip",
      resolvedSkillId: "rainbow-drip",
      resolvedPotency: rainbowDrip.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, rainbowDrip, DEFAULT_STATS);
    const single = Math.floor(rainbowDrip.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.85));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("モーグリストリーム: 5体ヒットで合計威力が 1体分 + 4×30% 分", () => {
    const mogOfTheAges = skillMap.get("mog-of-the-ages")!;
    const entry = makeResolvedEntry({
      skillId: "mog-of-the-ages",
      resolvedSkillId: "mog-of-the-ages",
      resolvedPotency: mogOfTheAges.potency,
      targetCount: 5,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, mogOfTheAges, DEFAULT_STATS);
    const single = Math.floor(mogOfTheAges.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.7));
    expect(breakdown.targets).toHaveLength(5);
    expect(breakdown.total).toBe(single + reduced * 4);
  });
});
