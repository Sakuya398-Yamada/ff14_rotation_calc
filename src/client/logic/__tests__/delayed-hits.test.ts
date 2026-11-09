import { describe, it, expect } from "vitest";
import { resolveTimeline, calcPps } from "../resolve-timeline";
import { calcTimelineSummary } from "../timeline-summary";
import { calcDelayedHitBreakdown, calcEntryExpectedPotency } from "../expected-potency";
import { DEFAULT_STATS } from "../stat-calc";
import type { BuffDefinition, MultiTargetWindow, ResolvedDelayedHit, Skill, TimelineEntry } from "../../types/skill";

// 時間差の攻撃（ペット・分身。#957）。各攻撃は着弾時刻で PPS 区間・集計に入り、威力のバフ・クリ/DH・敵の数も着弾時刻の状態で判定する

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
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

function makeOgcd(overrides: Partial<Skill> & { id: string }): Skill {
  return makeSkill({ type: "ogcd", potency: 0, recastTime: 0.65, ...overrides });
}

let uidSeq = 0;
function makeEntry(skillId: string, manualStartTime?: number): TimelineEntry {
  uidSeq += 1;
  return { uid: `entry-${uidSeq}`, skillId, ...(manualStartTime !== undefined ? { manualStartTime } : {}) };
}

const stats = DEFAULT_STATS;

function makeBuff(id: string, duration: number, effects: BuffDefinition["effects"]): BuffDefinition {
  return { id, icon: "", duration, effects, color: "#000" };
}
const buffs = [
  makeBuff("damage-up", 20, [{ type: "potency", value: 1.2 }]),
  makeBuff("short-up", 3, [{ type: "potency", value: 1.2 }]),
  makeBuff("crit-up", 20, [{ type: "critRate", value: 0.1 }]),
  makeBuff("surge", 5, [{ type: "guaranteedCrit", value: 1 }]),
];

const gcdA = makeSkill({ id: "gcd-a", potency: 100 });
const pet = makeOgcd({ id: "pet", delayedHits: [{ delay: 2, potency: 100 }, { delay: 5, potency: 200 }] });
const petAoe = makeOgcd({
  id: "pet-aoe",
  maxTargets: 3,
  falloffRate: 0.5,
  delayedHits: [{ delay: 2, potency: 100 }, { delay: 5, potency: 100 }],
});
const castPet = makeSkill({ id: "cast-pet", potency: 0, castTime: 2, delayedHits: [{ delay: 1, potency: 100 }] });
const petSameTime = makeOgcd({ id: "pet-same-time", delayedHits: [{ delay: 1.35, potency: 100 }] });
const cooldownPet = makeOgcd({ id: "cooldown-pet", cooldown: 60, delayedHits: [{ delay: 2, potency: 100 }] });
const plainOgcd = makeOgcd({ id: "plain-ogcd", potency: 150 });
const buffOgcd = makeOgcd({ id: "buff-ogcd", buffApplications: ["damage-up"] });
const shortBuffOgcd = makeOgcd({ id: "short-buff-ogcd", buffApplications: ["short-up"] });
const critOgcd = makeOgcd({ id: "crit-ogcd", buffApplications: ["crit-up"] });
const surgeOgcd = makeOgcd({ id: "surge-ogcd", buffApplications: ["surge"] });

const skillMap = new Map(
  [gcdA, pet, petAoe, castPet, petSameTime, cooldownPet, plainOgcd, buffOgcd, shortBuffOgcd, critOgcd, surgeOgcd].map((s) => [s.id, s])
);

function resolve(entries: TimelineEntry[], options: { hitDelays?: Record<string, number>; multiTargetWindows?: MultiTargetWindow[] } = {}) {
  return resolveTimeline(entries, skillMap, [], stats, buffs, undefined, options.multiTargetWindows, options.hitDelays);
}

function hitExpected(hit: ResolvedDelayedHit, skillId: string): number {
  return calcDelayedHitBreakdown(hit, skillMap.get(skillId), stats).total;
}

describe("時間差の攻撃の着弾時刻", () => {
  it("各攻撃は、使用時刻 + 遅れに着弾する", () => {
    const result = resolve([makeEntry("gcd-a"), makeEntry("pet")]);
    const petEntry = result.entries[1];
    expect(petEntry.startTime).toBe(0.65);
    expect(petEntry.delayedHits?.map((h) => [h.time, h.potency])).toEqual([[2.65, 100], [5.65, 200]]);
  });

  it("詠唱のあるスキルは、詠唱完了から遅れを数える", () => {
    const castEntry = resolve([makeEntry("cast-pet")]).entries[0];
    expect(castEntry.castTime).toBeGreaterThan(0);
    expect(castEntry.delayedHits?.[0].time).toBeCloseTo(castEntry.startTime + castEntry.castTime + 1, 6);
  });

  it("スキルに設定した着弾までの遅れ（hitDelays）は、時間差の攻撃には足さない", () => {
    const petEntry = resolve([makeEntry("pet")], { hitDelays: { pet: 1.5 } }).entries[0];
    expect(petEntry.hitTime).toBe(1.5);
    expect(petEntry.delayedHits?.map((h) => h.time)).toEqual([2, 5]);
  });

  it("ハードエラーのエントリは、時間差の攻撃を持たない", () => {
    // 2 回目はチャージ切れ（manualStartTime 無しなので、残る原因はチャージ切れだけ）
    const result = resolve([makeEntry("cooldown-pet"), makeEntry("cooldown-pet")]);
    expect(result.entries[0].delayedHits).toHaveLength(1);
    expect(result.entries[1].recastError).toBe(true);
    expect(result.entries[1].delayedHits).toBeUndefined();

    const pps = calcPps(result.entries, skillMap, result.dotTicks, 0, 10, stats);
    expect(pps.directPotency).toBe(hitExpected(result.entries[0].delayedHits![0], "cooldown-pet"));
  });
});

describe("既知の制限", () => {
  it("着弾時刻にボスが離脱中でも、時間差の攻撃は数える（ゴーストは扱わない）", () => {
    // 離脱は 1s〜3s。pet の攻撃は 2s（離脱中）と 5s
    const result = resolveTimeline([makeEntry("pet")], skillMap, [], stats, buffs, [{ startTime: 1, endTime: 3 }]);
    const petEntry = result.entries[0];
    expect(petEntry.untargetableError).toBe(false);
    const [first] = petEntry.delayedHits!;
    expect(first.time).toBe(2);
    expect(calcPps(result.entries, skillMap, result.dotTicks, 1, 3, stats).directPotency).toBe(hitExpected(first, "pet"));
    expect(hitExpected(first, "pet")).toBeGreaterThan(0);
  });
});

describe("PPS 区間・集計への算入", () => {
  // gcd-a(100) 0s → pet 0.65s（攻撃は 2.65s に 100、5.65s に 200）
  const entries = [makeEntry("gcd-a"), makeEntry("pet")];

  it("1 つのスキルの攻撃が区間の境界をまたぐと、各攻撃はそれぞれの着弾時刻の区間に入る", () => {
    const result = resolve(entries);
    const [gcdEntry, petEntry] = result.entries;
    const [first, second] = petEntry.delayedHits!;

    const before = calcPps(result.entries, skillMap, result.dotTicks, 0, 4, stats);
    expect(before.directPotency).toBe(calcEntryExpectedPotency(gcdEntry, gcdA, stats) + hitExpected(first, "pet"));

    const after = calcPps(result.entries, skillMap, result.dotTicks, 4, 8, stats);
    expect(after.directPotency).toBe(hitExpected(second, "pet"));
    expect(hitExpected(second, "pet")).toBeGreaterThan(0);
  });

  it("着弾が集計の終端（最後の GCD のリキャスト完了）より後になる攻撃は、全体の集計に入らない", () => {
    const result = resolve(entries);
    expect(result.lastGcdEndTime).toBe(2.5);
    const summary = calcTimelineSummary(result, skillMap, stats);
    expect(summary.duration).toBe(2.5);
    expect(summary.totalExpectedPotency).toBe(calcEntryExpectedPotency(result.entries[0], gcdA, stats));
  });

  it("着弾が集計の終端より前なら、全体の集計に入る", () => {
    // GCD を足して終端を 7.5s まで延ばす
    const result = resolve([...entries, makeEntry("gcd-a"), makeEntry("gcd-a")]);
    expect(result.lastGcdEndTime).toBe(7.5);
    const [first, second] = result.entries[1].delayedHits!;
    const gcdTotal = [0, 2, 3].reduce((sum, i) => sum + calcEntryExpectedPotency(result.entries[i], gcdA, stats), 0);
    const summary = calcTimelineSummary(result, skillMap, stats);
    expect(summary.totalExpectedPotency).toBe(gcdTotal + hitExpected(first, "pet") + hitExpected(second, "pet"));
  });

  it("GCD が無いタイムラインでは、時間差の攻撃もすべて合計期待威力に入る", () => {
    const result = resolve([makeEntry("pet")]);
    expect(result.lastGcdEndTime).toBe(0);
    const [first, second] = result.entries[0].delayedHits!;
    const summary = calcTimelineSummary(result, skillMap, stats);
    expect(summary.totalExpectedPotency).toBe(hitExpected(first, "pet") + hitExpected(second, "pet"));
    // 全体の PPS も、最後の着弾（5s）までを範囲にして同じ合計で出す
    expect(summary.duration).toBe(5);
    expect(summary.overallPps?.totalPotency).toBe(summary.totalExpectedPotency);
  });
});

describe("着弾時刻の状態での判定", () => {
  it("使用後に置いたスキルのバフも、着弾時刻に効いていれば乗る", () => {
    const result = resolve([makeEntry("pet"), makeEntry("buff-ogcd"), makeEntry("crit-ogcd")]);
    const petEntry = result.entries[0];
    // 使ったときにはバフが無い
    expect(petEntry.buffMultiplier).toBe(1);
    expect(petEntry.critRateBonus).toBe(0);
    expect(petEntry.delayedHits?.map((h) => [h.buffMultiplier, h.critRateBonus])).toEqual([[1.2, 0.1], [1.2, 0.1]]);
  });

  it("使用時に効いていたバフも、着弾時刻までに切れていれば乗らない", () => {
    // short-up は 0s から 3s まで。攻撃は 2.65s と 5.65s
    const result = resolve([makeEntry("short-buff-ogcd"), makeEntry("pet")]);
    const petEntry = result.entries[1];
    expect(petEntry.recastError).toBe(false);
    expect(petEntry.buffMultiplier).toBe(1.2);
    expect(petEntry.delayedHits?.map((h) => [h.time, h.buffMultiplier])).toEqual([[2.65, 1.2], [5.65, 1]]);
  });

  it("敵の数は着弾時刻の複数体ウィンドウで決まり、対象数の上限と減衰は使ったスキルのものを使う", () => {
    const windows = [{ startTime: 4, endTime: 10, targetCount: 3 }];
    const petEntry = resolve([makeEntry("pet-aoe")], { multiTargetWindows: windows }).entries[0];
    expect(petEntry.targetCount).toBe(1);
    const [first, second] = petEntry.delayedHits!;
    expect([first.targetCount, second.targetCount]).toEqual([1, 3]);

    const firstBreakdown = calcDelayedHitBreakdown(first, petAoe, stats);
    const secondBreakdown = calcDelayedHitBreakdown(second, petAoe, stats);
    expect(firstBreakdown.targets).toHaveLength(1);
    const single = secondBreakdown.singleTargetPotency;
    expect(secondBreakdown.targets).toEqual([single, Math.floor(single * 0.5), Math.floor(single * 0.5)]);
  });

  it("確定クリティカルは時間差の攻撃に乗らず、消費もされない", () => {
    // surge（確定クリ）は 0s から 5s まで。攻撃は 2.65s、plain-ogcd は 3s
    const result = resolve([makeEntry("surge-ogcd"), makeEntry("pet"), makeEntry("plain-ogcd", 3)]);
    expect(result.entries[1].delayedHits?.[0].critRateBonus).toBe(0);
    expect(result.entries[2].activeBuffs.map((ab) => ab.buffId)).toContain("surge");
  });
});

describe("同じ時刻の境界（着弾を先に判定する）", () => {
  it("着弾時刻ちょうどに実行したスキルのバフは、その攻撃に乗らない", () => {
    // pet の攻撃は 2s と 5s。buff-ogcd を 2s に置く
    const petEntry = resolve([makeEntry("pet"), makeEntry("buff-ogcd", 2)]).entries[0];
    expect(petEntry.delayedHits?.map((h) => [h.time, h.buffMultiplier])).toEqual([[2, 1], [5, 1.2]]);
  });

  it("同じ時刻に着弾して付くバフは、待ち列に入れた順に関わらず、その攻撃に乗らない", () => {
    // 攻撃を先に予約: pet の攻撃は 2s。buff-ogcd（0.65s）の付与は遅れ 1.35s で 2s
    const hitFirst = resolve([makeEntry("pet"), makeEntry("buff-ogcd")], { hitDelays: { "buff-ogcd": 1.35 } }).entries[0];
    expect(hitFirst.delayedHits?.[0].time).toBe(2);
    expect(hitFirst.delayedHits?.[0].buffMultiplier).toBe(1);

    // バフの付与を先に予約: buff-ogcd（0s）の付与は遅れ 2s で 2s。pet-same-time（0.65s）の攻撃は 2s
    const buffFirst = resolve([makeEntry("buff-ogcd"), makeEntry("pet-same-time")], { hitDelays: { "buff-ogcd": 2 } }).entries[1];
    expect(buffFirst.delayedHits?.[0].time).toBe(2);
    expect(buffFirst.delayedHits?.[0].buffMultiplier).toBe(1);

    // 対照: 付与が攻撃より少しでも前なら乗る
    const buffEarlier = resolve([makeEntry("buff-ogcd"), makeEntry("pet-same-time")], { hitDelays: { "buff-ogcd": 1.99 } }).entries[1];
    expect(buffEarlier.delayedHits?.[0].buffMultiplier).toBe(1.2);
  });
});
