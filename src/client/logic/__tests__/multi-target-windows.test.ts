import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  calcEntryExpectedPotency,
  calcEntryPotencyBreakdown,
} from "../expected-potency";
import { DEFAULT_STATS, calcExpectedMultiplier } from "../stat-calc";
import type {
  Skill,
  TimelineEntry,
  MultiTargetWindow,
  ResolvedTimelineEntry,
  CharacterStats,
} from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: "",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

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

// DEFAULT_STATS は critRate 最小 5% が効くため calcExpectedMultiplier ≈ 1.02。
// テスト期待値は同じ式で動的に計算して比較する（数値の魔法定数化を避け、式変更に追従するため）。
const STATS: CharacterStats = DEFAULT_STATS;
const DEFAULT_MUL = calcExpectedMultiplier(STATS, 0, 0);

/** 単体期待威力（バフ倍率込み）を再現する */
function singlePot(basePotency: number, buffMul = 1): number {
  return Math.floor(Math.floor(basePotency * buffMul) * DEFAULT_MUL);
}
/** 減衰後期待威力を再現する */
function reducedPot(basePotency: number, falloffRate: number, buffMul = 1): number {
  return Math.floor(singlePot(basePotency, buffMul) * (1 - falloffRate));
}

describe("MultiTargetWindow integration in resolveTimeline", () => {
  it("複数体ウィンドウ外のスキルは targetCount=1", () => {
    const skill = makeSkill({ id: "fire", potency: 100 });
    const skillMap = new Map([[skill.id, skill]]);
    const result = resolveTimeline(
      [makeEntry(skill.id)],
      skillMap,
      [],
      undefined,
      [],
      [],
      [{ startTime: 10, endTime: 20, targetCount: 3 }]
    );
    expect(result.entries[0].targetCount).toBe(1);
  });

  it("複数体ウィンドウ内のスキルは targetCount=指定値", () => {
    const skill = makeSkill({ id: "fire", potency: 100, maxTargets: 3, falloffRate: 0.5 });
    const skillMap = new Map([[skill.id, skill]]);
    const entries: TimelineEntry[] = [makeEntry(skill.id), makeEntry(skill.id), makeEntry(skill.id)];
    // 1本目は 0s（外）、2本目は 2.5s（外）、3本目は 5s（中）
    const windows: MultiTargetWindow[] = [{ startTime: 4, endTime: 20, targetCount: 3 }];
    const result = resolveTimeline(entries, skillMap, [], undefined, [], [], windows);
    expect(result.entries[0].targetCount).toBe(1);
    expect(result.entries[1].targetCount).toBe(1);
    expect(result.entries[2].targetCount).toBe(3);
  });

  it("半開区間: startTime と一致する瞬間は内側、endTime と一致する瞬間は外側", () => {
    const skill = makeSkill({ id: "fire", potency: 100 });
    const skillMap = new Map([[skill.id, skill]]);
    // 開始時刻が 0s, 2.5s, 5s の3スキル。ウィンドウ [2.5, 5) → 2.5s のみ中
    const entries: TimelineEntry[] = [makeEntry(skill.id), makeEntry(skill.id), makeEntry(skill.id)];
    const windows: MultiTargetWindow[] = [{ startTime: 2.5, endTime: 5, targetCount: 2 }];
    const result = resolveTimeline(entries, skillMap, [], undefined, [], [], windows);
    expect(result.entries[0].targetCount).toBe(1); // 0s: 外
    expect(result.entries[1].targetCount).toBe(2); // 2.5s: 内側（境界 = 内）
    expect(result.entries[2].targetCount).toBe(1); // 5s: 外側（境界 = 外）
  });

  it("味方対象（target='party'）のスキルは複数体ウィンドウ内でも targetCount=1", () => {
    const heal = makeSkill({ id: "heal", potency: 0, target: "party" });
    const skillMap = new Map([[heal.id, heal]]);
    const result = resolveTimeline(
      [makeEntry(heal.id)],
      skillMap,
      [],
      undefined,
      [],
      [],
      [{ startTime: 0, endTime: 10, targetCount: 5 }]
    );
    expect(result.entries[0].targetCount).toBe(1);
  });

  it("multiTargetWindows 未指定なら全エントリ targetCount=1", () => {
    const skill = makeSkill({ id: "fire", potency: 100 });
    const skillMap = new Map([[skill.id, skill]]);
    const result = resolveTimeline([makeEntry(skill.id)], skillMap, [], undefined, [], []);
    expect(result.entries[0].targetCount).toBe(1);
  });

  it("targetCount は最小 1 にクランプ（不正な targetCount=0 等が来ても安全）", () => {
    const skill = makeSkill({ id: "fire", potency: 100 });
    const skillMap = new Map([[skill.id, skill]]);
    const result = resolveTimeline(
      [makeEntry(skill.id)],
      skillMap,
      [],
      undefined,
      [],
      [],
      // targetCount: 0 は不正だが、内部で max(1, x) でクランプされる
      [{ startTime: 0, endTime: 10, targetCount: 0 }]
    );
    expect(result.entries[0].targetCount).toBe(1);
  });
});

describe("calcEntryExpectedPotency / calcEntryPotencyBreakdown", () => {
  it("単体スキル（maxTargets 未設定）は複数体ウィンドウ内でも1体分のみ", () => {
    const skill = makeSkill({ id: "fire", potency: 100 });
    const entry = makeResolvedEntry({ resolvedPotency: 100, targetCount: 3 });
    const breakdown = calcEntryPotencyBreakdown(entry, skill, STATS);
    expect(breakdown.targets).toEqual([singlePot(100)]);
    expect(breakdown.total).toBe(singlePot(100));
  });

  it("maxTargets=3, targetCount=2 → 2体分（減衰なし）", () => {
    const skill = makeSkill({ id: "aoe", potency: 100, maxTargets: 3 });
    const entry = makeResolvedEntry({ resolvedPotency: 100, targetCount: 2 });
    const breakdown = calcEntryPotencyBreakdown(entry, skill, STATS);
    expect(breakdown.targets).toEqual([singlePot(100), singlePot(100)]);
    expect(breakdown.total).toBe(singlePot(100) * 2);
  });

  it("maxTargets=3, targetCount=5 → 3体までしかヒットしない", () => {
    const skill = makeSkill({ id: "aoe", potency: 100, maxTargets: 3 });
    const entry = makeResolvedEntry({ resolvedPotency: 100, targetCount: 5 });
    const breakdown = calcEntryPotencyBreakdown(entry, skill, STATS);
    expect(breakdown.targets).toHaveLength(3);
    expect(breakdown.total).toBe(singlePot(100) * 3);
  });

  it("falloffRate=0.5, targetCount=3 → 2体目以降50%減衰", () => {
    const skill = makeSkill({
      id: "aoe",
      potency: 100,
      maxTargets: 8,
      falloffRate: 0.5,
    });
    const entry = makeResolvedEntry({ resolvedPotency: 100, targetCount: 3 });
    const breakdown = calcEntryPotencyBreakdown(entry, skill, STATS);
    const full = singlePot(100);
    const half = reducedPot(100, 0.5);
    expect(breakdown.targets).toEqual([full, half, half]);
    expect(breakdown.total).toBe(full + half + half);
  });

  it("falloffStartTarget=3 → 1,2体目フル、3体目以降減衰", () => {
    const skill = makeSkill({
      id: "aoe",
      potency: 100,
      maxTargets: 8,
      falloffRate: 0.25,
      falloffStartTarget: 3,
    });
    const entry = makeResolvedEntry({ resolvedPotency: 100, targetCount: 4 });
    const breakdown = calcEntryPotencyBreakdown(entry, skill, STATS);
    const full = singlePot(100);
    const reduced = reducedPot(100, 0.25);
    expect(breakdown.targets).toEqual([full, full, reduced, reduced]);
    expect(breakdown.total).toBe(full * 2 + reduced * 2);
  });

  it("hasError なエントリは 0 を返す", () => {
    const skill = makeSkill({ id: "aoe", potency: 100, maxTargets: 3 });
    const entry = makeResolvedEntry({
      resolvedPotency: 100,
      targetCount: 3,
      untargetableError: true,
    });
    expect(calcEntryExpectedPotency(entry, skill, STATS)).toBe(0);
    expect(calcEntryPotencyBreakdown(entry, skill, STATS).total).toBe(0);
  });

  it("バフ倍率込みの計算: buffMultiplier=1.2, falloffRate=0.5, targetCount=2", () => {
    const skill = makeSkill({ id: "aoe", potency: 100, maxTargets: 3, falloffRate: 0.5 });
    const entry = makeResolvedEntry({
      resolvedPotency: 100,
      buffMultiplier: 1.2,
      targetCount: 2,
    });
    const breakdown = calcEntryPotencyBreakdown(entry, skill, STATS);
    const full = singlePot(100, 1.2);
    const half = reducedPot(100, 0.5, 1.2);
    expect(breakdown.singleTargetPotency).toBe(full);
    expect(breakdown.targets).toEqual([full, half]);
    expect(breakdown.total).toBe(full + half);
  });

  it("skill=undefined（マップに無いスキル）は単体扱い", () => {
    const entry = makeResolvedEntry({ resolvedPotency: 100, targetCount: 3 });
    const breakdown = calcEntryPotencyBreakdown(entry, undefined, STATS);
    expect(breakdown.targets).toEqual([singlePot(100)]);
    expect(breakdown.total).toBe(singlePot(100));
  });

  it("calcEntryExpectedPotency と calcEntryPotencyBreakdown.total は一致", () => {
    const skill = makeSkill({
      id: "aoe",
      potency: 100,
      maxTargets: 5,
      falloffRate: 0.3,
      falloffStartTarget: 2,
    });
    const entry = makeResolvedEntry({ resolvedPotency: 250, targetCount: 4 });
    expect(calcEntryExpectedPotency(entry, skill, STATS)).toBe(
      calcEntryPotencyBreakdown(entry, skill, STATS).total
    );
  });
});

describe("DoT は複数体ウィンドウ内でも1体のみ付与（保守的）", () => {
  it("DoT スキルが複数体ウィンドウ内で使われても dotTotalPotency は1体分のみ", () => {
    const dotSkill = makeSkill({
      id: "dot",
      potency: 0,
      dotPotency: 50,
      dotDuration: 30,
    });
    const skillMap = new Map([[dotSkill.id, dotSkill]]);
    const windows: MultiTargetWindow[] = [{ startTime: 0, endTime: 60, targetCount: 3 }];
    const result = resolveTimeline(
      [makeEntry(dotSkill.id)],
      skillMap,
      [],
      undefined,
      [],
      [],
      windows
    );
    // 30秒間に 3秒ごとのティック = 10ティック × 50 威力 = 500
    // 複数体3体でも 1体のみ付与の保守的挙動なので、合計は依然 500
    expect(result.dotTotalPotency).toBe(500);
  });
});
