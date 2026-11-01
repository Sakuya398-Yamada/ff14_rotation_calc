import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getSkillsForLevel,
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
} from "../skill-level";
import { DEFAULT_STATS } from "../stat-calc";
import { MNK_ATTACK_SKILLS } from "../../data/mnk-skills";
import { MNK_BUFFS } from "../../data/mnk-buffs";
import { MNK_RESOURCES } from "../../data/mnk-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function setup(level: PlayerLevel) {
  const buffs = getBuffsForLevel(MNK_BUFFS, level);
  const resources = getResourcesForLevel(MNK_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(MNK_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(MNK_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  return { buffs, resources, skillMap };
}

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

// アプリ（App.tsx）と同じくステータスを渡す。GCD のリキャストは calcGcd で 10ms 単位に切り捨てられる
function resolveAtLevel(level: PlayerLevel, entries: TimelineEntry[]) {
  const { buffs, resources, skillMap } = setup(level);
  return resolveTimeline(entries, skillMap, resources, DEFAULT_STATS, buffs);
}

const gap = (a: ResolvedTimelineEntry, b: ResolvedTimelineEntry) =>
  Math.round((b.startTime - a.startTime) * 1000) / 1000;

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const LEVELS: PlayerLevel[] = [70, 80, 90, 100];

/**
 * 特性「疾風迅雷効果アップIII」（Lv76）・「抜重歩法効果アップ」（Lv84）・「アクション威力アップ」（Lv84）・
 * 「桃園結義効果アップ」（Lv88）・「アクション威力アップII」（Lv94）の前後の値（#517）。
 * 破砕拳の威力は背面攻撃成功前提（背面ボーナス 60 込み）。
 */
describe("モンク: 特性によるレベル別の値（レベル調整済みスキルマップ）", () => {
  it.each([
    // [スキル, Lv70, Lv80, Lv90, Lv100]
    ["twin-snakes", [340, 340, 380, 420]],
    ["demolish", [340, 340, 380, 420]],
    ["dragon-kick", [240, 240, 280, 320]],
    ["the-forbidden-chakra", [310, 310, 400, 400]],
    ["six-sided-star", [undefined, 710, 710, 780]],
    ["phantom-rush", [undefined, undefined, 1400, 1500]],
  ] as const)("%s の威力", (skillId, potencies) => {
    LEVELS.forEach((level, i) => {
      expect(setup(level).skillMap.get(skillId)?.potency, `Lv${level}`).toBe(potencies[i]);
    });
  });

  it("六合星導脚の闘気 10 のときの威力は Lv94 未満で 1,510、Lv94 以降で 1,580（闘気 1 つにつき +80）", () => {
    expect(LEVELS.map((level) => setup(level).skillMap.get("six-sided-star")?.potencyScaling)).toEqual([
      undefined,
      { resourceId: "chakra", minAmount: 0, minPotency: 710, maxAmount: 10, maxPotency: 1510 },
      { resourceId: "chakra", minAmount: 0, minPotency: 710, maxAmount: 10, maxPotency: 1510 },
      { resourceId: "chakra", minAmount: 0, minPotency: 780, maxAmount: 10, maxPotency: 1580 },
    ]);
  });

  it("抜重歩法の最大チャージ数は Lv84 未満で 2、Lv84 以降で 3", () => {
    expect(LEVELS.map((level) => setup(level).skillMap.get("thunderclap")?.maxCharges)).toEqual([2, 2, 3, 3]);
  });

  it("踏鳴の最大チャージ数は特性で変わらず、全レベルで 2", () => {
    expect(LEVELS.map((level) => setup(level).skillMap.get("perfect-balance")?.maxCharges)).toEqual([2, 2, 2, 2]);
  });

  // 疾風迅雷: Lv76 未満は 2.5 秒の 15% 短縮で 2.125 秒、疾風迅雷効果アップIII（Lv76）からは 20% 短縮で 2.0 秒。
  // 上書きの付け忘れが無いよう、スキルマップに入る GCD と GCD を拘束するアビリティを全件見る
  it.each(LEVELS)("Lv%i のスキルマップの GCD と、鉄山闘気・陰陽闘気が拘束する GCD の基礎リキャスト", (level) => {
    const expected = level < 76 ? 2.125 : 2.0;
    const checked: string[] = [];
    for (const skill of setup(level).skillMap.values()) {
      // 六合星導脚は固有のリキャスト（4 秒）。Lv80 で習得するので常に特性込み
      if (skill.type === "gcd" && skill.id !== "six-sided-star") {
        expect(skill.recastTime, skill.id).toBe(expected);
        checked.push(skill.id);
      }
      if (skill.triggersGcdRecast) {
        expect(skill.gcdRecastTime, skill.id).toBe(expected);
        checked.push(skill.id);
      }
    }
    expect(checked).toEqual(expect.arrayContaining(["dragon-kick", "celestial-revolution", "forbidden-meditation"]));
  });
});

describe("モンク: 特性によるレベル別の値（タイムライン上）", () => {
  it.each([
    [70 as PlayerLevel, 2.12],
    [80 as PlayerLevel, 2],
    [90 as PlayerLevel, 2],
    [100 as PlayerLevel, 2],
  ])("Lv%i では WS の間隔と、陰陽闘気が拘束する GCD が %s 秒", (level, gcd) => {
    const e = resolveAtLevel(level, [
      entry("the-forbidden-chakra"),
      entry("dragon-kick"),
      entry("forbidden-meditation"),
      entry("twin-snakes"),
      entry("demolish"),
    ]).entries;
    e.forEach(expectNoError);
    expect(gap(e[1], e[2])).toBe(gcd);
    expect(gap(e[2], e[3])).toBe(gcd);
    expect(gap(e[3], e[4])).toBe(gcd);
  });

  it("Lv70 で必殺技が天宙脚に変化したあとの GCD も 2.12 秒", () => {
    // 踏鳴中の双竜脚 ×2 で壱のチャクラ 2、双掌打で弐のチャクラ 1 → 2+1 で天宙脚
    const e = resolveAtLevel(70, [
      entry("perfect-balance"),
      entry("dragon-kick"),
      entry("dragon-kick"),
      entry("twin-snakes"),
      entry("masterful-blitz"),
      entry("form-shift"),
    ]).entries;
    e.forEach(expectNoError);
    expect(e[4].resolvedSkillId).toBe("celestial-revolution");
    expect(gap(e[4], e[5])).toBe(2.12);
  });

  // 桃園結義効果アップ（Lv88）より前は、自身の WS で闘気が付くのが確率なので付けない（確率の闘気獲得は対象外）
  it.each([
    [70 as PlayerLevel, 0],
    [80 as PlayerLevel, 0],
    [90 as PlayerLevel, 1],
    [100 as PlayerLevel, 1],
  ])("Lv%i の桃園結義中に WS を撃ったあとの闘気は %i", (level, chakra) => {
    const e = resolveAtLevel(level, [
      entry("the-forbidden-chakra"),
      entry("brotherhood"),
      entry("dragon-kick"),
    ]).entries;
    e.forEach(expectNoError);
    expect(e[0].resourceSnapshot["chakra"]).toBe(0);
    expect(e[2].resourceSnapshot["chakra"]).toBe(chakra);
    // 与ダメージ 5% は Lv88 未満でも乗る
    expect(e[2].buffMultiplier).toBeCloseTo(1.05);
  });

  it.each([
    [80 as PlayerLevel, 710, 1110],
    [90 as PlayerLevel, 710, 1110],
    [100 as PlayerLevel, 780, 1180],
  ])("Lv%i の六合星導脚の威力は、闘気 0 で %i、闘気 5 で %i", (level, withoutChakra, withFiveChakra) => {
    const zero = resolveAtLevel(level, [entry("the-forbidden-chakra"), entry("six-sided-star")]).entries;
    zero.forEach(expectNoError);
    expect(zero[1].resolvedPotency).toBe(withoutChakra);

    // 闘気の初期値は 5
    const five = resolveAtLevel(level, [entry("six-sided-star")]).entries;
    expectNoError(five[0]);
    expect(five[0].resolvedPotency).toBe(withFiveChakra);
  });

  it("Lv80 では抜重歩法を続けて 3 回使うと 3 回目がリキャストエラー、Lv90 ではエラーにならない", () => {
    // 手動の時刻を付けずに置き、エラーの原因をチャージ切れだけにする
    const entries = () => [entry("thunderclap"), entry("thunderclap"), entry("thunderclap")];
    const lv80 = resolveAtLevel(80, entries()).entries;
    expect(lv80[1].recastError).toBe(false);
    expect(lv80[2].recastError).toBe(true);
    const lv90 = resolveAtLevel(90, entries()).entries;
    expect(lv90[2].recastError).toBe(false);
  });
});
