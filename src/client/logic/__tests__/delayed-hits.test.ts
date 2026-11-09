import { describe, it, expect } from "vitest";
import { resolveTimeline, calcPps } from "../resolve-timeline";
import { calcTimelineSummary } from "../timeline-summary";
import { calcDelayedHitBreakdown, calcEntryExpectedPotency } from "../expected-potency";
import { DEFAULT_STATS, calcDetMultiplier, calcExpectedMultiplier } from "../stat-calc";
import type { BuffDefinition, MultiTargetWindow, ResolvedDelayedHit, ResourceDefinition, Skill, TimelineEntry } from "../../types/skill";

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
// 攻撃ごとの範囲（#977）。使ったスキルは単体
const petHitAoe = makeOgcd({
  id: "pet-hit-aoe",
  delayedHits: [{ delay: 2, potency: 100, maxTargets: 2, falloffRate: 0.5 }, { delay: 3, potency: 100 }],
});
// 攻撃ごとの範囲（#977）。使ったスキルも範囲を持つ
const petAoeHitOverride = makeOgcd({
  id: "pet-aoe-hit-override",
  maxTargets: 3,
  falloffRate: 0.5,
  delayedHits: [
    { delay: 1, potency: 100, maxTargets: Infinity },
    { delay: 2, potency: 100, maxTargets: Infinity, falloffRate: 0.25, falloffStartTarget: 3 },
    { delay: 3, potency: 100, maxTargets: 1 },
    { delay: 4, potency: 100 },
  ],
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
  [gcdA, pet, petAoe, petHitAoe, petAoeHitOverride, castPet, petSameTime, cooldownPet, plainOgcd, buffOgcd, shortBuffOgcd, critOgcd, surgeOgcd].map((s) => [s.id, s])
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

  it("攻撃が範囲を持てば、使ったスキルが単体でも、その攻撃の対象数の上限と減衰で複数体に入る（#977）", () => {
    const windows = [{ startTime: 0, endTime: 10, targetCount: 3 }];
    const [entry] = resolve([makeEntry("pet-hit-aoe")], { multiTargetWindows: windows }).entries;
    const [aoeHit, plainHit] = entry.delayedHits!;
    expect([aoeHit.targetCount, plainHit.targetCount]).toEqual([3, 3]);

    const aoeBreakdown = calcDelayedHitBreakdown(aoeHit, petHitAoe, stats);
    const single = aoeBreakdown.singleTargetPotency;
    expect(aoeBreakdown.targets).toEqual([single, Math.floor(single * 0.5)]);
    // 範囲を持たない攻撃は、使ったスキル（単体）のとおり 1 体分
    expect(calcDelayedHitBreakdown(plainHit, petHitAoe, stats).targets).toEqual([single]);
  });

  it("攻撃の範囲は、使ったスキルの範囲より優先し、項目ごとには混ぜない（#977）", () => {
    const windows = [{ startTime: 0, endTime: 10, targetCount: 4 }];
    const [entry] = resolve([makeEntry("pet-aoe-hit-override")], { multiTargetWindows: windows }).entries;
    const breakdowns = entry.delayedHits!.map((hit) => calcDelayedHitBreakdown(hit, petAoeHitOverride, stats));
    const single = breakdowns[0].singleTargetPotency;
    const half = Math.floor(single * 0.5);
    const reduced = Math.floor(single * 0.75);
    expect(breakdowns.map((b) => b.targets)).toEqual([
      // 対象数の上限だけを持つ攻撃に、使ったスキルの減衰（50%）は掛けない
      [single, single, single, single],
      // 減衰の始まり（3 体目）も攻撃のもの
      [single, single, reduced, reduced],
      // 単体の攻撃は、使ったスキルが範囲を持っても 1 体分
      [single],
      // 範囲を持たない攻撃は、使ったスキルの範囲（3 体まで、2 体目以降 50% 減）
      [single, half, half],
    ]);
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

  it("着弾時刻ちょうどに切れるバフは、その攻撃に乗らない", () => {
    // short-up は 0s から 3s まで。pet-same-time を 1.65s に置くと攻撃は 3s
    const atEnd = resolve([makeEntry("short-buff-ogcd"), makeEntry("pet-same-time", 1.65)]).entries[1];
    expect(atEnd.recastError).toBe(false);
    expect(atEnd.delayedHits?.map((h) => [h.time, h.buffMultiplier])).toEqual([[3, 1]]);

    // 対照: 切れる少し前に着弾すれば乗る
    const beforeEnd = resolve([makeEntry("short-buff-ogcd"), makeEntry("pet-same-time", 1.64)]).entries[1];
    expect(beforeEnd.delayedHits?.map((h) => [h.time, h.buffMultiplier])).toEqual([[2.99, 1.2]]);
  });

  // 失効するバフが自動生成の条件バフ（歌など）かどうかで、失効を処理する経路が分かれる（expireBuffsUntil）ので、両方で確かめる
  describe.each([
    ["自動生成の条件バフでない", {}],
    ["自動生成の条件バフ", { autoGenerateInterval: 100, autoGenerateWhileBuff: ["trigger"] }],
  ])("失効をきっかけに付くバフ（onExpireApplyBuffByResource。#979）: 失効するバフが%s", (_, gate) => {
    // trigger は 0s から 2s まで。2s の失効で、charge の量（1）に応じて contract（×1.2）を 2s から付ける。
    // contract は guard（×1.1）と同じ排他グループなので、contract が付くと guard は外れる
    const expireResources: ResourceDefinition[] = [{ id: "charge", maxStacks: 1, initialStacks: 1, color: "#000", ...gate }];
    const expireBuffs: BuffDefinition[] = [
      { ...makeBuff("trigger", 2, []), onExpireApplyBuffByResource: { resourceId: "charge", buffIds: ["contract"] } },
      { ...makeBuff("contract", 20, [{ type: "potency", value: 1.2 }]), exclusiveGroup: "pact" },
      { ...makeBuff("guard", 20, [{ type: "potency", value: 1.1 }]), exclusiveGroup: "pact" },
    ];
    const expireSkills = [
      pet,
      petSameTime,
      makeOgcd({ id: "trigger-ogcd", buffApplications: ["trigger"] }),
      makeOgcd({ id: "guard-ogcd", buffApplications: ["guard"] }),
    ];
    const expireSkillMap = new Map(expireSkills.map((s) => [s.id, s]));
    const resolveExpire = (entries: TimelineEntry[]) =>
      resolveTimeline(entries, expireSkillMap, expireResources, stats, expireBuffs).entries;

    it("着弾時刻ちょうどに失効して付くバフは、その攻撃に乗らない", () => {
      // trigger-ogcd 0s → pet-same-time 0.65s（攻撃は 2s）
      const [triggerEntry, petEntry] = resolveExpire([makeEntry("trigger-ogcd"), makeEntry("pet-same-time")]);
      expect(triggerEntry.startTime).toBe(0);
      expect(petEntry.recastError).toBe(false);
      expect(petEntry.delayedHits?.map((h) => [h.time, h.buffMultiplier])).toEqual([[2, 1]]);
    });

    it("着弾時刻ちょうどに失効して付くバフが外す排他のバフは、着弾時刻にはまだ効いているので乗る", () => {
      // guard-ogcd 0s → trigger-ogcd 0.65s（trigger は 2.65s まで）→ pet-same-time 1.3s（攻撃は 2.65s）
      const [, , petEntry] = resolveExpire([makeEntry("guard-ogcd"), makeEntry("trigger-ogcd"), makeEntry("pet-same-time")]);
      expect(petEntry.recastError).toBe(false);
      expect(petEntry.delayedHits?.map((h) => [h.time, h.buffMultiplier])).toEqual([[2.65, 1.1]]);
    });

    it("着弾時刻より前に失効して付いたバフは、エントリを挟まずに着弾しても乗る", () => {
      // trigger-ogcd 0s → pet 0.65s（攻撃は 2.65s と 5.65s）。contract は 2s から
      const [, petEntry] = resolveExpire([makeEntry("trigger-ogcd"), makeEntry("pet")]);
      expect(petEntry.recastError).toBe(false);
      expect(petEntry.delayedHits?.map((h) => [h.time, h.buffMultiplier])).toEqual([[2.65, 1.2], [5.65, 1.2]]);
    });
  });

  it("着弾時刻に判定を挟んでも、自動生成の進め方は時間差の攻撃が無いときと変わらない", () => {
    // song（gauge の自動生成の条件バフ）は 0s から 5s まで、cap-up（gauge の上限 1 → 5）は 2.5s から 4.5s まで。
    // 3.65s に pet-same-time を置くと攻撃は song が切れる 5s で、cap-up はその前に切れる。対照は同じ時刻の plain-ogcd
    const gaugeResources: ResourceDefinition[] = [{
      id: "gauge",
      maxStacks: 1,
      color: "#000",
      autoGenerateInterval: 1,
      autoGenerateWhileBuff: ["song"],
      autoGenerateRestartOnBuffChange: true,
      whileBuffModifiers: [{ buffId: "cap-up", maxStacks: 5 }],
    }];
    const gaugeBuffs = [makeBuff("song", 5, []), makeBuff("cap-up", 2, [])];
    const gaugeSkillMap = new Map(
      [
        petSameTime,
        plainOgcd,
        makeOgcd({ id: "song-ogcd", buffApplications: ["song"] }),
        makeOgcd({ id: "cap-up-ogcd", buffApplications: ["cap-up"] }),
      ].map((s) => [s.id, s])
    );
    const resolveGauge = (thirdSkillId: string) =>
      resolveTimeline(
        [makeEntry("song-ogcd"), makeEntry("cap-up-ogcd", 2.5), makeEntry(thirdSkillId, 3.65), makeEntry("plain-ogcd", 6)],
        gaugeSkillMap,
        gaugeResources,
        stats,
        gaugeBuffs
      ).entries;

    const withHit = resolveGauge("pet-same-time");
    expect(withHit[2].delayedHits?.map((h) => h.time)).toEqual([5]);
    const withoutHit = resolveGauge("plain-ogcd");
    expect(withHit[3].resourceSnapshot["gauge"]).toBe(withoutHit[3].resourceSnapshot["gauge"]);
  });
});

describe("消費したリソース・当てた WS の回数で決まる威力（#958）", () => {
  const charge: ResourceDefinition = { id: "charge", maxStacks: 100, color: "#000" };
  const extBuffs = [...buffs, makeBuff("ws-up", 20, [{ type: "potency", value: 1.5, appliesToSkillIds: ["counter"] }])];
  const gain = makeSkill({ id: "gain", resourceChanges: [{ resourceId: "charge", amount: 30 }] });
  const scaledPet = makeOgcd({
    id: "scaled-pet",
    resourceChanges: [{ resourceId: "charge", amount: -50 }],
    consumeAllOfResource: "charge",
    delayedHits: [
      { delay: 2, potency: 200, potencyScaling: { resourceId: "charge", minAmount: 50, minPotency: 100, maxAmount: 100, maxPotency: 200 } },
    ],
  });
  const counter = makeOgcd({
    id: "counter",
    delayedHits: [{ delay: 10, potency: 300, potencyPerWeaponskill: { potency: 100, maxCount: 3 }, snapshotAtUse: true, noCritDh: true }],
  });
  const wsUpOgcd = makeOgcd({ id: "ws-up-ogcd", buffApplications: ["ws-up"] });
  const extSkillMap = new Map([...skillMap, ...[gain, scaledPet, counter, wsUpOgcd].map((s) => [s.id, s] as const)]);
  const resolveExt = (
    entries: TimelineEntry[],
    untargetableWindows?: { startTime: number; endTime: number }[],
    hitDelays?: Record<string, number>
  ) => resolveTimeline(entries, extSkillMap, [charge], stats, extBuffs, untargetableWindows, undefined, hitDelays);

  it.each([
    [2, 60, 120],
    [3, 90, 180],
    [4, 120, 200],
  ])("消費前のリソースで威力が決まる（gain %i 回 = %i で %i。上限で止まる）", (gains, amount, potency) => {
    const entries = resolveExt([...Array.from({ length: gains }, () => makeEntry("gain")), makeEntry("scaled-pet")]).entries;
    const petEntry = entries[gains];
    expect(entries[gains - 1].resourceSnapshot["charge"]).toBe(Math.min(amount, 100));
    expect(petEntry.resourceErrors).toEqual([]);
    expect(petEntry.resourceSnapshot["charge"]).toBe(0);
    expect(petEntry.delayedHits?.map((h) => h.potency)).toEqual([potency]);
  });

  it("使ってから着弾までに当てた GCD の回数 × 威力（上限の回数まで）が入る", () => {
    // counter は 0s。GCD は 0.65・3.15・5.65・8.15s（4 回。上限 3 回）
    const four = resolveExt([makeEntry("counter"), ...Array.from({ length: 4 }, () => makeEntry("gcd-a"))]).entries;
    expect(four.slice(1).map((e) => e.startTime)).toEqual([0.65, 3.15, 5.65, 8.15]);
    expect(four[0].delayedHits?.map((h) => [h.time, h.potency])).toEqual([[10, 300]]);
    // 2 回なら 200。GCD が無ければ 0
    const two = resolveExt([makeEntry("counter"), makeEntry("gcd-a"), makeEntry("gcd-a")]).entries;
    expect(two[0].delayedHits?.map((h) => h.potency)).toEqual([200]);
    expect(resolveExt([makeEntry("counter")]).entries[0].delayedHits?.map((h) => h.potency)).toEqual([0]);
  });

  it("使う前の GCD・着弾時刻ちょうど以降の GCD・エラーの GCD・ボス離脱中に着弾した GCD は数えない", () => {
    // 0s の GCD は counter（0.65s）より前。counter の着弾は 10.65s。10.65s ちょうどの GCD は数えない
    const boundary = resolveExt([
      makeEntry("gcd-a"),
      makeEntry("counter"),
      makeEntry("gcd-a", 3),
      makeEntry("gcd-a", 10.65),
    ]).entries;
    expect(boundary[1].startTime).toBe(0.65);
    expect(boundary[3].startTime).toBe(10.65);
    expect(boundary[3].recastError).toBe(false);
    expect(boundary[1].delayedHits?.map((h) => [h.time, h.potency])).toEqual([[10.65, 100]]);
    // 着弾時刻の直前（10.6s）の GCD は数える
    const before = resolveExt([makeEntry("gcd-a"), makeEntry("counter"), makeEntry("gcd-a", 3), makeEntry("gcd-a", 10.6)]).entries;
    expect(before[1].delayedHits?.map((h) => h.potency)).toEqual([200]);

    // 2 回目の GCD は GCD のリキャスト中（エラー）
    const withError = resolveExt([makeEntry("counter"), makeEntry("gcd-a"), makeEntry("gcd-a", 1.5)]).entries;
    expect(withError[2].recastError).toBe(true);
    expect(withError[0].delayedHits?.map((h) => h.potency)).toEqual([100]);

    // 4〜5s はボス離脱。GCD の着弾は 1s 遅れ（0.65s → 1.65s、3.15s → 4.15s）。2 回目はゴースト
    const ghost = resolveExt([makeEntry("counter"), makeEntry("gcd-a"), makeEntry("gcd-a")], [{ startTime: 4, endTime: 5 }], { "gcd-a": 1 }).entries;
    expect(ghost[2].untargetableError).toBe(false);
    expect(ghost[2].untargetableHit).toBe(true);
    expect(ghost[0].delayedHits?.map((h) => h.potency)).toEqual([100]);
    // 着弾の遅れがあれば、着弾時刻で数える。9s に使った GCD は counter の着弾（10s）より前に使ったが、着弾は 10s ちょうどなので数えない
    const late = resolveExt([makeEntry("counter"), makeEntry("gcd-a"), makeEntry("gcd-a", 9)], undefined, { "gcd-a": 1 }).entries;
    expect(late[2].recastError).toBe(false);
    expect(late[2].hitTime).toBe(10);
    expect(late[0].delayedHits?.map((h) => [h.time, h.potency])).toEqual([[10, 100]]);

    // counter より前に置いた GCD は、着弾が counter の使用より後でも数えない（0s に使い、1s に着弾。counter は 0.65s）
    const earlier = resolveExt([makeEntry("gcd-a"), makeEntry("counter"), makeEntry("gcd-a")], undefined, { "gcd-a": 1 }).entries;
    expect(earlier[0].hitTime).toBe(1);
    expect(earlier[1].startTime).toBe(0.65);
    expect(earlier[1].delayedHits?.map((h) => h.potency)).toEqual([100]);
  });

  it("snapshotAtUse の攻撃は、威力のバフを使ったときの状態で決め、noCritDh の攻撃はクリ/DH の期待値を持たない", () => {
    // 使った後に付けたバフは乗らない
    const after = resolveExt([makeEntry("counter"), makeEntry("ws-up-ogcd"), makeEntry("crit-ogcd"), makeEntry("gcd-a")]).entries;
    const [afterHit] = after[0].delayedHits!;
    expect(afterHit.buffMultiplier).toBe(1);
    expect(afterHit.critRateBonus).toBe(0);
    expect(afterHit.noCritDh).toBe(true);
    // 使う前に付けたバフは、着弾までに切れても乗る（short-up は 3 秒）
    const before = resolveExt([makeEntry("ws-up-ogcd"), makeEntry("short-buff-ogcd"), makeEntry("counter"), makeEntry("gcd-a")]).entries;
    const [beforeHit] = before[2].delayedHits!;
    expect(beforeHit.time).toBeGreaterThan(3);
    expect(beforeHit.buffMultiplier).toBeCloseTo(1.8, 10);

    // 期待値は DET の倍率だけ（クリ/DH の期待値を含めない）
    const buffed = Math.floor(100 * beforeHit.buffMultiplier);
    const total = calcDelayedHitBreakdown(beforeHit, counter, stats).total;
    expect(total).toBe(Math.floor(buffed * calcDetMultiplier(stats)));
    expect(total).toBeLessThan(Math.floor(buffed * calcExpectedMultiplier(stats)));
  });
});
