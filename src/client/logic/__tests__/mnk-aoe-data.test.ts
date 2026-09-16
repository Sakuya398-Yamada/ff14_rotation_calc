import { describe, it, expect } from "vitest";
import { MNK_ATTACK_SKILLS } from "../../data/mnk-skills";
import { calcEntryPotencyBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type { ResolvedTimelineEntry } from "../../types/skill";

const skillMap = new Map(MNK_ATTACK_SKILLS.map((s) => [s.id, s]));

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

/** 公式ジョブガイド準拠の MNK 範囲スキル定義（Issue #339） */
const MNK_AOE_FALLOFF_SKILLS = [
  // 2体目以降35%減
  { id: "phantom-rush", falloffRate: 0.35 },
  { id: "elixir-burst", falloffRate: 0.35 },
  { id: "rising-phoenix", falloffRate: 0.35 },
  { id: "winds-reply", falloffRate: 0.35 },
  { id: "fires-reply", falloffRate: 0.35 },
] as const;

/** 減衰なし（全対象フル威力）の範囲スキル */
const MNK_AOE_NO_FALLOFF_IDS = [
  "arm-of-the-destroyer",
  "shadow-of-the-destroyer",
  "four-point-fury",
  "rockbreaker",
  "howling-fist",
  "enlightenment",
] as const;

const MNK_AOE_IDS = new Set<string>([
  ...MNK_AOE_FALLOFF_SKILLS.map((s) => s.id),
  ...MNK_AOE_NO_FALLOFF_IDS,
]);

describe("MNK AoE データ（#339）", () => {
  it.each(MNK_AOE_FALLOFF_SKILLS)("$id は対象数無制限・減衰 $falloffRate の範囲スキル", ({ id, falloffRate }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.maxTargets).toBe(Infinity);
    expect(skill!.falloffRate).toBe(falloffRate);
    expect(skill!.falloffStartTarget).toBeUndefined();
  });

  it.each(MNK_AOE_NO_FALLOFF_IDS.map((id) => ({ id })))(
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
    for (const skill of MNK_ATTACK_SKILLS) {
      if (MNK_AOE_IDS.has(skill.id)) continue;
      expect(skill.maxTargets, `${skill.id} は単体スキルのはず`).toBeUndefined();
      expect(skill.falloffRate, `${skill.id} は単体スキルのはず`).toBeUndefined();
    }
  });

  it("夢幻闘舞: 3体ヒットで2体目以降が35%減", () => {
    const phantomRush = skillMap.get("phantom-rush")!;
    const entry = makeResolvedEntry({
      skillId: "phantom-rush",
      resolvedSkillId: "phantom-rush",
      resolvedPotency: phantomRush.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, phantomRush, DEFAULT_STATS);
    const single = Math.floor(phantomRush.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.35));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("絶空拳: 3体ヒットで2体目以降が35%減", () => {
    const windsReply = skillMap.get("winds-reply")!;
    const entry = makeResolvedEntry({
      skillId: "winds-reply",
      resolvedSkillId: "winds-reply",
      resolvedPotency: windsReply.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, windsReply, DEFAULT_STATS);
    const single = Math.floor(windsReply.potency * DEFAULT_MUL);
    const reduced = Math.floor(single * (1 - 0.35));
    expect(breakdown.targets).toEqual([single, reduced, reduced]);
  });

  it("地烈斬: 3体ヒットで全対象フル威力", () => {
    const rockbreaker = skillMap.get("rockbreaker")!;
    const entry = makeResolvedEntry({
      skillId: "rockbreaker",
      resolvedSkillId: "rockbreaker",
      resolvedPotency: rockbreaker.potency,
      targetCount: 3,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, rockbreaker, DEFAULT_STATS);
    const single = Math.floor(rockbreaker.potency * DEFAULT_MUL);
    expect(breakdown.targets).toEqual([single, single, single]);
  });

  it("四面脚: 5体ヒットで合計威力が 1体分 × 5（減衰なし）", () => {
    const fourPointFury = skillMap.get("four-point-fury")!;
    const entry = makeResolvedEntry({
      skillId: "four-point-fury",
      resolvedSkillId: "four-point-fury",
      resolvedPotency: fourPointFury.potency,
      targetCount: 5,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, fourPointFury, DEFAULT_STATS);
    const single = Math.floor(fourPointFury.potency * DEFAULT_MUL);
    expect(breakdown.targets).toHaveLength(5);
    expect(breakdown.total).toBe(single * 5);
  });
});
