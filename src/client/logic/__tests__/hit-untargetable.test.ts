import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { calcEntryExpectedPotency } from "../expected-potency";
import { calcRangePps, calcTimelineSummary } from "../timeline-summary";
import { DEFAULT_STATS } from "../stat-calc";
import { hasBuffAfterHit } from "./helpers/buffs-after-hit";
import type {
  BossUntargetableWindow,
  BuffDefinition,
  ResolvedTimelineEntry,
  ResourceDefinition,
  Skill,
  TimelineEntry,
} from "../../types/skill";

// ボス離脱中に着弾したスキル（ゴースト。#950）。実行時は離脱の外で、着弾時刻（hitTime ?? startTime）が離脱中のとき、
// 威力を 0 にして警告（untargetableHit）にする。実行時の効果（リソース・コンボ・リキャスト・バフの消費）は起こし、
// 着弾時の効果（そのスキルが付けるバフ・シナジー・DoT の付与・打ち切り・延長）は起こさない

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    potency: 300,
    type: "gcd",
    target: "enemy",
    icon: "",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

function makeBuff(overrides: Partial<BuffDefinition> & { id: string }): BuffDefinition {
  return { icon: "", duration: 20, effects: [], color: "#000", ...overrides };
}

let uidSeq = 0;
function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  uidSeq += 1;
  return { uid: `entry-${uidSeq}`, skillId, ...(manualStartTime !== undefined ? { manualStartTime } : {}) };
}

const WINDOWS: BossUntargetableWindow[] = [{ startTime: 5, endTime: 10 }];

function expectNoHardError(e: ResolvedTimelineEntry) {
  expect(e.untargetableError).toBe(false);
  expect(e.recastError).toBe(false);
  expect(e.resourceErrors).toEqual([]);
  expect(e.comboErrors).toEqual([]);
}

describe("遅れを設定した敵対象のスキルのゴースト（#950）", () => {
  const atk = makeSkill({ id: "atk" });
  const skillMap = new Map([[atk.id, atk]]);
  const resolve = (entries: TimelineEntry[], delay: number) =>
    resolveTimeline(entries, skillMap, [], undefined, [], WINDOWS, undefined, { atk: delay });

  it("実行時は離脱の外・着弾時は離脱中なら、期待威力が 0 になり警告になる", () => {
    // 4.5 秒に実行し、1 秒後の 5.5 秒（離脱中）に着弾
    const e = resolve([entry("atk", 4.5)], 1).entries[0];
    expect(e.hitTime).toBe(5.5);
    expectNoHardError(e);
    expect(e.untargetableHit).toBe(true);
    expect(calcEntryExpectedPotency(e, atk, DEFAULT_STATS)).toBe(0);
  });

  it("着弾が離脱の前なら、今どおり威力が入る", () => {
    const e = resolve([entry("atk", 3.5)], 1).entries[0];
    expect(e.hitTime).toBe(4.5);
    expect(e.untargetableHit).toBeUndefined();
    expect(calcEntryExpectedPotency(e, atk, DEFAULT_STATS)).toBeGreaterThan(0);
  });

  // 実行時の判定（isInUntargetableWindow）と同じ半開区間 [開始, 終了)
  it.each([
    { start: 4, delay: 1, hit: 5, ghost: true, label: "離脱の開始ちょうどは離脱中" },
    { start: 4.5, delay: 5.49, hit: 9.99, ghost: true, label: "離脱の終了の直前は離脱中" },
    { start: 4.5, delay: 5.5, hit: 10, ghost: false, label: "離脱の終了ちょうどは離脱の外" },
  ])("$label（着弾 $hit 秒）", ({ start, delay, hit, ghost }) => {
    const e = resolve([entry("atk", start)], delay).entries[0];
    expect(e.hitTime).toBe(hit);
    expectNoHardError(e);
    expect(e.untargetableHit === true).toBe(ghost);
    expect(calcEntryExpectedPotency(e, atk, DEFAULT_STATS) === 0).toBe(ghost);
  });

  it("実行時に離脱中なら今どおりハードエラーで、警告にはしない", () => {
    const e = resolve([entry("atk", 6)], 1).entries[0];
    expect(e.untargetableError).toBe(true);
    expect(e.untargetableHit).toBeUndefined();
  });

  it("自分対象のスキルは、着弾が離脱中でも今どおり（警告にせず、付けるバフも付く）", () => {
    const buffs = [makeBuff({ id: "self-buff" })];
    const selfSkill = makeSkill({ id: "self-skill", type: "ogcd", potency: 0, target: "self", buffApplications: ["self-buff"] });
    const result = resolveTimeline(
      [entry("self-skill", 4.5), entry("atk", 12)],
      new Map([[selfSkill.id, selfSkill], [atk.id, atk]]),
      [],
      undefined,
      buffs,
      WINDOWS,
      undefined,
      { "self-skill": 1 },
    );
    const [e, after] = result.entries;
    expect(e.hitTime).toBe(5.5);
    expect(e.untargetableHit).toBeUndefined();
    expect(hasBuffAfterHit(e, buffs, "self-buff")).toBe(true);
    expect(after.activeBuffsAtUse.map((ab) => ab.buffId)).toContain("self-buff");
  });

  it("PPS 区間・集計に 0 で入る", () => {
    const stats = DEFAULT_STATS;
    // 1 つ目は 0 秒に実行して 1 秒に着弾。2 つ目は着弾が離脱中（4.5 + 1 = 5.5）か、離脱の前（3 + 1 = 4）
    const ghost = resolve([entry("atk", 0), entry("atk", 4.5)], 1);
    const control = resolve([entry("atk", 0), entry("atk", 3)], 1);
    expect(ghost.entries[1].untargetableHit).toBe(true);
    expect(control.entries[1].untargetableHit).toBeUndefined();

    const one = calcEntryExpectedPotency(control.entries[0], atk, stats);
    expect(one).toBeGreaterThan(0);
    const range = { startTime: 0, endTime: 20 };
    expect(calcRangePps(control, skillMap, range, stats).directPotency).toBe(one * 2);
    expect(calcRangePps(ghost, skillMap, range, stats).directPotency).toBe(one);
    expect(calcTimelineSummary(control, skillMap, stats).totalExpectedPotency).toBe(one * 2);
    expect(calcTimelineSummary(ghost, skillMap, stats).totalExpectedPotency).toBe(one);
  });
});

describe("遅れが未設定の詠唱スキルのゴースト（#950）", () => {
  const cast = makeSkill({ id: "cast", castTime: 2 });
  const instant = makeSkill({ id: "instant" });
  const skillMap = new Map([[cast.id, cast], [instant.id, instant]]);
  const resolve = (entries: TimelineEntry[]) =>
    resolveTimeline(entries, skillMap, [], undefined, [], WINDOWS);

  it("詠唱完了が離脱中なら、期待威力が 0 になる", () => {
    const e = resolve([entry("cast", 4)]).entries[0];
    expect(e.hitTime).toBe(6);
    expectNoHardError(e);
    expect(e.untargetableHit).toBe(true);
    expect(calcEntryExpectedPotency(e, cast, DEFAULT_STATS)).toBe(0);
  });

  it("詠唱完了が離脱の前なら、今どおり威力が入る", () => {
    const e = resolve([entry("cast", 2.5)]).entries[0];
    expect(e.hitTime).toBe(4.5);
    expect(e.untargetableHit).toBeUndefined();
    expect(calcEntryExpectedPotency(e, cast, DEFAULT_STATS)).toBeGreaterThan(0);
  });

  it("詠唱も遅れも無いスキルは、今どおり開始時刻だけで判定する", () => {
    const e = resolve([entry("instant", 4.9)]).entries[0];
    expect(e.hitTime).toBeUndefined();
    expect(e.untargetableHit).toBeUndefined();
    expect(calcEntryExpectedPotency(e, instant, DEFAULT_STATS)).toBeGreaterThan(0);
  });
});

describe("ゴーストのエントリの効果（#950）", () => {
  // 対象のエントリを 4.5 秒（着弾 5.5 秒は離脱中）か 3 秒（着弾 4 秒は離脱の前）に置き、ゴーストかどうかだけを変えて比べる
  const GHOST_AT = 4.5;
  const CONTROL_AT = 3;
  const DELAY = 1;

  describe("実行時の効果は起きる", () => {
    const gauge: ResourceDefinition = { id: "gauge", maxStacks: 3, color: "#000" };
    const buffs = [makeBuff({ id: "charge", effects: [{ type: "consumeOnGcd", value: 0 }] })];
    const skills = [
      makeSkill({ id: "prime", type: "ogcd", potency: 0, target: "self", buffApplications: ["charge"] }),
      makeSkill({ id: "combo-1", resourceChanges: [{ resourceId: "gauge", amount: 1 }] }),
      makeSkill({ id: "combo-2", potency: 400, nonComboPotency: 100, comboFrom: ["combo-1"] }),
      makeSkill({ id: "cd", type: "ogcd", cooldown: 30 }),
    ];
    const skillMap = new Map(skills.map((s) => [s.id, s]));

    it("リソースの獲得・バフの消費・リキャスト・コンボが起きる", () => {
      // 離脱は 5〜8 秒。3.8 秒の cd は 2 秒後の 5.8 秒に、4.5 秒の combo-1 は 1 秒後の 5.5 秒に着弾する（どちらも離脱中）
      const [prime, cd, combo1, combo2] = resolveTimeline(
        [entry("prime", 0), entry("cd", 3.8), entry("combo-1", GHOST_AT), entry("combo-2", 8.5)],
        skillMap,
        [gauge],
        undefined,
        buffs,
        [{ startTime: 5, endTime: 8 }],
        undefined,
        { "combo-1": DELAY, cd: 2 },
      ).entries;
      expect(hasBuffAfterHit(prime, buffs, "charge")).toBe(true);
      expect(combo1.untargetableHit).toBe(true);
      expect(cd.untargetableHit).toBe(true);
      expectNoHardError(combo1);
      expectNoHardError(cd);
      // リソースの獲得とバフの消費
      expect(combo1.resourceSnapshot["gauge"]).toBe(1);
      expect(combo1.activeBuffs.map((ab) => ab.buffId)).not.toContain("charge");
      // リキャスト
      expect(cd.cooldownEndTime).toBe(33.8);
      // コンボ（8.5 秒の combo-2 は離脱の外で、コンボが成立して 400 になる）
      expect(combo2.untargetableHit).toBeUndefined();
      expect(combo2.wsComboError).toBe(false);
      expect(combo2.resolvedPotency).toBe(400);
    });

    // ブラッドソイル型: 付けるバフでリソースの上限を上げ、上がった上限で獲得を数える（#948 で上限だけは実行時から上げる）。
    // ゴーストではバフが付かないので、獲得は元の上限で止まる
    it.each([
      { at: GHOST_AT, ghost: true, gained: 3, afterSpend: 2 },
      { at: CONTROL_AT, ghost: false, gained: 6, afterSpend: 5 },
    ])("付けるバフで上がる上限（ゴースト: $ghost）", ({ at, ghost, gained, afterSpend }) => {
      const soil: ResourceDefinition = {
        id: "soil",
        maxStacks: 3,
        color: "#000",
        whileBuffModifiers: [{ buffId: "soil-cap", maxStacks: 6 }],
      };
      const capBuffs = [makeBuff({ id: "soil-cap", duration: 30 })];
      const capSkills = [
        makeSkill({ id: "fill", resourceChanges: [{ resourceId: "soil", amount: 3 }] }),
        makeSkill({ id: "festival", type: "ogcd", potency: 0, buffApplications: ["soil-cap"], resourceChanges: [{ resourceId: "soil", amount: 3 }] }),
        makeSkill({ id: "spend", resourceChanges: [{ resourceId: "soil", amount: -1 }] }),
      ];
      const [, festival, spend] = resolveTimeline(
        [entry("fill", at - 2.5), entry("festival", at), entry("spend", 12)],
        new Map(capSkills.map((s) => [s.id, s])),
        [soil],
        undefined,
        capBuffs,
        WINDOWS,
        undefined,
        { festival: DELAY },
      ).entries;
      expect(festival.untargetableHit === true).toBe(ghost);
      expectNoHardError(festival);
      expect(festival.resourceSnapshot["soil"]).toBe(gained);
      expectNoHardError(spend);
      expect(spend.resourceSnapshot["soil"]).toBe(afterSpend);
    });
  });

  describe("着弾時の効果は起きない", () => {
    const buffs = [makeBuff({ id: "self-buff", duration: 20 })];
    const skills = [
      makeSkill({ id: "buffer", buffApplications: ["self-buff"] }),
      makeSkill({ id: "dot", dotPotency: 50, dotDuration: 30 }),
      makeSkill({ id: "replacer", dotPotency: 50, dotDuration: 30, replacesDots: ["dot"] }),
      makeSkill({ id: "refresher", refreshesDots: ["dot"] }),
      makeSkill({ id: "after" }),
    ];
    const skillMap = new Map(skills.map((s) => [s.id, s]));
    const delays = { buffer: DELAY, replacer: DELAY, refresher: DELAY };
    const resolve = (entries: TimelineEntry[]) =>
      resolveTimeline(entries, skillMap, [], undefined, buffs, WINDOWS, undefined, delays);
    const dotSpans = (result: ReturnType<typeof resolve>, skillId: string) =>
      result.activeDoTs.filter((d) => d.skillId === skillId).map((d) => [d.startTime, d.endTime]);

    it.each([
      { at: GHOST_AT, ghost: true },
      { at: CONTROL_AT, ghost: false },
    ])("そのスキルが付けるバフ（ゴースト: $ghost）", ({ at, ghost }) => {
      const result = resolve([entry("buffer", at), entry("after", 12)]);
      const [buffer, after] = result.entries;
      expect(buffer.untargetableHit === true).toBe(ghost);
      expectNoHardError(buffer);
      expect(hasBuffAfterHit(buffer, buffs, "self-buff")).toBe(!ghost);
      expect(after.activeBuffsAtUse.map((ab) => ab.buffId).includes("self-buff")).toBe(!ghost);
    });

    it.each([
      { at: GHOST_AT, ghost: true },
      { at: CONTROL_AT, ghost: false },
    ])("DoT の付与（ゴースト: $ghost）", ({ at, ghost }) => {
      const result = resolve([entry("replacer", at)]);
      expect(result.entries[0].untargetableHit === true).toBe(ghost);
      expect(dotSpans(result, "replacer")).toEqual(ghost ? [] : [[at + DELAY, at + DELAY + 30]]);
      expect(result.dotTicks.some((t) => t.skillId === "replacer")).toBe(!ghost);
    });

    it.each([
      { at: GHOST_AT, ghost: true },
      { at: CONTROL_AT, ghost: false },
    ])("replacesDots の打ち切り（ゴースト: $ghost）", ({ at, ghost }) => {
      const result = resolve([entry("dot", 0), entry("replacer", at)]);
      expect(result.entries[1].untargetableHit === true).toBe(ghost);
      expect(dotSpans(result, "dot")).toEqual([[0, ghost ? 30 : at + DELAY]]);
    });

    it.each([
      { at: GHOST_AT, ghost: true },
      { at: CONTROL_AT, ghost: false },
    ])("refreshesDots の延長（ゴースト: $ghost）", ({ at, ghost }) => {
      const result = resolve([entry("dot", 0), entry("refresher", at)]);
      expect(result.entries[1].untargetableHit === true).toBe(ghost);
      // 延長は、着弾時刻からの区間を足す
      expect(dotSpans(result, "dot")).toEqual(ghost ? [[0, 30]] : [[0, 30], [at + DELAY, at + DELAY + 30]]);
    });
  });
});
