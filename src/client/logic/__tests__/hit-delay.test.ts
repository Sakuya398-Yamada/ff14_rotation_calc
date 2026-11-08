import { describe, it, expect } from "vitest";
import { resolveTimeline, calcPps } from "../resolve-timeline";
import { calcTimelineSummary } from "../timeline-summary";
import { calcEntryExpectedPotency } from "../expected-potency";
import { DEFAULT_STATS } from "../stat-calc";
import type { BuffDefinition, ResolvedTimelineEntry, Skill, TimelineEntry } from "../../types/skill";

// スキルの実行から着弾までの遅れ（#901）。遅れを設定したスキルは、着弾時刻（開始 + 詠唱時間 + 遅れ）で PPS 区間・集計に入る

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

let uidSeq = 0;
function makeEntry(skillId: string): TimelineEntry {
  uidSeq += 1;
  return { uid: `entry-${uidSeq}`, skillId };
}

const stats = DEFAULT_STATS;

const damageUp: BuffDefinition = {
  id: "damage-up",
  icon: "",
  duration: 20,
  effects: [{ type: "potency", value: 1.2 }],
  color: "#000",
};
const transformReady: BuffDefinition = {
  id: "transform-ready",
  icon: "",
  duration: 30,
  effects: [],
  color: "#000",
};
const buffs = [damageUp, transformReady];

const gcdA = makeSkill({ id: "gcd-a", potency: 100 });
const gcdB = makeSkill({ id: "gcd-b", potency: 200 });
const gcdC = makeSkill({ id: "gcd-c", potency: 300 });
const spell = makeSkill({ id: "spell", potency: 400, castTime: 2.0 });
const ogcd = makeSkill({ id: "ogcd", type: "ogcd", potency: 150, recastTime: 60 });
const buffOgcd = makeSkill({ id: "buff-ogcd", type: "ogcd", potency: 0, recastTime: 120, buffApplications: ["damage-up", "transform-ready"] });
const before = makeSkill({ id: "before", potency: 250, autoTransform: { buffId: "transform-ready", skillId: "after" } });
const after = makeSkill({ id: "after", potency: 500, hidden: true });
// 詠唱がリキャストより長い（黒魔のファイガなど）・詠唱とリキャストが同じ（ホーリジャなど）
const longCast = makeSkill({ id: "long-cast", potency: 600, castTime: 3.5 });
const evenCast = makeSkill({ id: "even-cast", potency: 700, castTime: 2.5 });
const dotGcd = makeSkill({ id: "dot-gcd", potency: 50, dotPotency: 60, dotDuration: 30 });

const skillMap = new Map(
  [gcdA, gcdB, gcdC, spell, ogcd, buffOgcd, before, after, longCast, evenCast, dotGcd].map((s) => [s.id, s])
);

function resolve(entries: TimelineEntry[], hitDelays?: Record<string, number>) {
  return resolveTimeline(entries, skillMap, [], stats, buffs, undefined, undefined, hitDelays);
}

function expectedPotency(entry: ResolvedTimelineEntry): number {
  return calcEntryExpectedPotency(entry, skillMap.get(entry.resolvedSkillId), stats);
}

describe("着弾時刻（hitTime）", () => {
  it("詠唱が無く遅れも設定していないスキルには着弾時刻が無い（開始時刻で判定する）", () => {
    const result = resolve([makeEntry("gcd-a"), makeEntry("gcd-b")], { "gcd-a": 0.6 });
    expect(result.entries[0].hitTime).toBe(0.6);
    expect(result.entries[1].hitTime).toBeUndefined();
  });

  it("詠唱のあるスキルは、遅れを設定していなくても詠唱完了の時刻に着弾する", () => {
    const spellEntry = resolve([makeEntry("gcd-a"), makeEntry("spell")]).entries[1];
    expect(spellEntry.castTime).toBeGreaterThan(0);
    expect(spellEntry.hitTime).toBeCloseTo(spellEntry.startTime + spellEntry.castTime, 6);
  });

  it("詠唱の無いスキルは、開始 + 遅れで着弾する", () => {
    const result = resolve([makeEntry("gcd-a"), makeEntry("gcd-a")], { "gcd-a": 0.62 });
    expect(result.entries[1].startTime).toBe(2.5);
    expect(result.entries[1].hitTime).toBe(3.12);
  });

  it("詠唱のあるスキルは、詠唱完了から遅れを数える（遅れ 0 なら詠唱完了の時刻）", () => {
    const result = resolve([makeEntry("gcd-a"), makeEntry("spell")], { spell: 0.5 });
    const spellEntry = result.entries[1];
    expect(spellEntry.castTime).toBeGreaterThan(0);
    expect(spellEntry.hitTime).toBeCloseTo(spellEntry.startTime + spellEntry.castTime + 0.5, 6);

    const zero = resolve([makeEntry("gcd-a"), makeEntry("spell")], { spell: 0 }).entries[1];
    expect(zero.hitTime).toBeCloseTo(zero.startTime + zero.castTime, 6);
  });

  it("自動変化したスキルには、変化後（実行された）スキルの遅れが効く", () => {
    const entries = [makeEntry("buff-ogcd"), makeEntry("before")];

    const byAfter = resolve(entries, { after: 0.8 }).entries[1];
    expect(byAfter.resolvedSkillId).toBe("after");
    expect(byAfter.hitTime).toBeCloseTo(byAfter.startTime + 0.8, 6);

    // 置いたスキル（変化前）の ID に設定しても、変化後のスキルには効かない
    const byBefore = resolve(entries, { before: 0.8 }).entries[1];
    expect(byBefore.resolvedSkillId).toBe("after");
    expect(byBefore.hitTime).toBeUndefined();
  });

  it("遅れを設定しても、威力・バフ倍率・クリ/DH・開始時刻は変わらない", () => {
    const entries = [makeEntry("buff-ogcd"), makeEntry("gcd-a"), makeEntry("ogcd"), makeEntry("spell")];
    const plain = resolve(entries).entries;
    const delayed = resolve(entries, { "gcd-a": 1.5, ogcd: 0.7, spell: 0.9 }).entries;

    // 前提: バフが乗っている（倍率 1 に倒れたエラーでないこと）
    expect(plain[1].buffMultiplier).toBe(1.2);
    expect(plain[1].recastError).toBe(false);

    const withoutHitTime = (e: ResolvedTimelineEntry) => {
      const { hitTime: _hitTime, ...rest } = e;
      return rest;
    };
    // 詠唱のある spell は遅れが無くても着弾時刻を持つので、両方から除いて比べる
    expect(delayed.map(withoutHitTime)).toEqual(plain.map(withoutHitTime));
    expect(delayed.map(expectedPotency)).toEqual(plain.map(expectedPotency));
  });
});

describe("PPS 区間への算入（calcPps）", () => {
  // gcd-a(100) 0s → gcd-b(200) 2.5s → gcd-c(300) 5s。区間 [1, 5)
  const entries = [makeEntry("gcd-a"), makeEntry("gcd-b"), makeEntry("gcd-c")];

  it("遅れが無ければ、開始時刻で区間に入るかを判定する", () => {
    const result = resolve(entries);
    const pps = calcPps(result.entries, skillMap, result.dotTicks, 1, 5, stats);
    expect(pps.directPotency).toBe(expectedPotency(result.entries[1]));
  });

  it("遅れを設定したスキルは、着弾時刻で区間に入るかを判定する（区間の前から入る・区間の中から出る）", () => {
    // gcd-a は 1.5s に着弾して区間に入り、gcd-b は 5.1s に着弾して区間から出る
    const result = resolve(entries, { "gcd-a": 1.5, "gcd-b": 2.6 });
    expect(result.entries[0].hitTime).toBe(1.5);
    expect(result.entries[1].hitTime).toBe(5.1);

    const pps = calcPps(result.entries, skillMap, result.dotTicks, 1, 5, stats);
    expect(pps.directPotency).toBe(expectedPotency(result.entries[0]));
  });

  it("詠唱のあるスキルは、遅れを設定していなくても詠唱完了の時刻で区間に入るかを判定する", () => {
    const result = resolve([makeEntry("gcd-a"), makeEntry("spell")]);
    const spellEntry = result.entries[1];
    const hitTime = spellEntry.hitTime!;
    // 前提: 詠唱開始は 1s より後で、詠唱完了より前で区間が終わる
    expect(spellEntry.startTime).toBeGreaterThan(1);
    expect(hitTime).toBeGreaterThan(spellEntry.startTime);

    expect(calcPps(result.entries, skillMap, result.dotTicks, 1, hitTime, stats).directPotency).toBe(0);
    expect(calcPps(result.entries, skillMap, result.dotTicks, hitTime, hitTime + 1, stats).directPotency).toBe(
      expectedPotency(spellEntry)
    );
  });
});

describe("全体の集計（calcTimelineSummary）", () => {
  // gcd-a 0s（最後の GCD。リキャスト完了 2.5s）→ ogcd 0.65s
  const entries = [makeEntry("gcd-a"), makeEntry("ogcd")];

  it("前提: 遅れが無ければ、最後の GCD の後に挟んだ oGCD も集計に入る", () => {
    const result = resolve(entries);
    expect(result.lastGcdEndTime).toBe(2.5);
    const summary = calcTimelineSummary(result, skillMap, stats);
    expect(summary.totalExpectedPotency).toBe(expectedPotency(result.entries[0]) + expectedPotency(result.entries[1]));
  });

  it("着弾が集計の終端（最後の GCD のリキャスト完了）より後になるスキルは、全体の集計に入らない", () => {
    const result = resolve(entries, { ogcd: 2.0 });
    expect(result.entries[1].hitTime).toBe(2.65);
    // 終端と所要時間は変えない
    expect(result.lastGcdEndTime).toBe(2.5);
    const summary = calcTimelineSummary(result, skillMap, stats);
    expect(summary.duration).toBe(2.5);
    expect(summary.totalExpectedPotency).toBe(expectedPotency(result.entries[0]));
  });

  it("最後の GCD の詠唱完了がリキャスト完了より遅いと、終端（所要時間）を詠唱完了まで延ばし、その着弾も集計に入れる", () => {
    const result = resolve([makeEntry("gcd-a"), makeEntry("long-cast")]);
    const cast = result.entries[1];
    // 前提: 詠唱完了がリキャスト完了より遅い
    expect(cast.hitTime!).toBeGreaterThan(cast.gcdAvailableAt);

    expect(result.lastGcdEndTime).toBe(cast.hitTime);
    const summary = calcTimelineSummary(result, skillMap, stats);
    expect(summary.duration).toBe(cast.hitTime);
    expect(summary.totalExpectedPotency).toBe(expectedPotency(result.entries[0]) + expectedPotency(cast));
  });

  it("DoT が終端より後まで続いていても、終端ちょうどに着弾した最後の詠唱スキルは集計に入れる", () => {
    const result = resolve([makeEntry("dot-gcd"), makeEntry("even-cast")]);
    const cast = result.entries[1];
    // 前提: 詠唱完了とリキャスト完了が同じ時刻で、DoT のティックはその後も続く
    expect(cast.hitTime).toBe(cast.gcdAvailableAt);
    expect(result.lastGcdEndTime).toBe(cast.hitTime);
    expect(result.timelineEndTime).toBeGreaterThan(result.lastGcdEndTime);

    const summary = calcTimelineSummary(result, skillMap, stats);
    const dotUntilEnd = calcPps(result.entries, skillMap, result.dotTicks, 0, result.lastGcdEndTime, stats).dotPotency;
    expect(summary.totalExpectedPotency).toBe(expectedPotency(result.entries[0]) + expectedPotency(cast) + dotUntilEnd);
  });
});
