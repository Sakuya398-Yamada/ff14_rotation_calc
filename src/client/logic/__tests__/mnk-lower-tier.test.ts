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
  return { buffs, resources, skills, skillMap };
}

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

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
const LOWER_TIER_WS = ["bootshine", "true-strike", "snap-punch"];
const UPPER_TIER_WS = ["leaping-opo", "rising-raptor", "pouncing-coeurl"];

/**
 * Lv92 で象形拳により上位技へ変化する連撃・正拳突き・崩拳と、必殺技の下位技（#769）。
 * 象形拳（Lv92）: 連撃が猿舞連撃に、正拳突きが竜頷正拳撃に、崩拳が虎襲崩拳に、蒼気砲が真空波に変化する。
 * 爆裂脚マスタリー（Lv86）: 爆裂脚が鳳凰の舞に変化する。闘魂旋風脚マスタリー（Lv90）: 闘魂旋風脚が夢幻闘舞に変化する。
 */
describe("モンク: Lv92 未満の下位技のパレット", () => {
  it.each([70, 80, 90] as PlayerLevel[])("Lv%i では連撃・正拳突き・崩拳が並び、上位技は並ばない", (level) => {
    const ids = setup(level).skills.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(LOWER_TIER_WS));
    UPPER_TIER_WS.forEach((id) => expect(ids).not.toContain(id));
  });

  it("Lv100 では猿舞連撃・竜頷正拳撃・虎襲崩拳に置き換わる", () => {
    const ids = setup(100).skills.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(UPPER_TIER_WS));
    LOWER_TIER_WS.forEach((id) => expect(ids).not.toContain(id));
  });

  it.each(LEVELS)("Lv%i では功力版と必殺技の下位技はパレットに並ばない", (level) => {
    const ids = setup(level).skills.map((s) => s.id);
    ["bootshine-fury", "true-strike-fury", "snap-punch-fury", "tornado-kick", "elixir-field", "flint-strike"].forEach(
      (id) => expect(ids).not.toContain(id),
    );
  });
});

/**
 * 修得後の値は公式ジョブガイドの原文（連撃 220・正拳突き 300・崩拳 270（側面 330）、功力時 420・500・420（側面 480）、
 * 蒼気砲・爆裂脚 800、闘魂旋風脚 1,200）。アクション威力アップ（Lv84）の修得前の値は consolegameswiki の Notes とクラス版の説明文。
 * 崩拳は側面攻撃成功前提（側面ボーナス 60 込み）。
 */
describe("モンク: 下位技の威力（レベル調整済みスキルマップ）", () => {
  it.each([
    // [スキル, Lv70, Lv80, Lv90, Lv100]。Lv100 でも置き換え元としてスキルマップには残る
    ["bootshine", [180, 180, 220, 220]],
    ["bootshine-fury", [380, 380, 420, 420]],
    ["true-strike", [260, 260, 300, 300]],
    ["true-strike-fury", [460, 460, 500, 500]],
    ["snap-punch", [290, 290, 330, 330]],
    ["snap-punch-fury", [440, 440, 480, 480]],
    ["elixir-field", [800, 800, 800, 800]],
    ["flint-strike", [800, 800, 800, 800]],
    ["tornado-kick", [1200, 1200, 1200, 1200]],
  ] as const)("%s の威力", (skillId, potencies) => {
    LEVELS.forEach((level, i) => {
      expect(setup(level).skillMap.get(skillId)?.potency, `Lv${level}`).toBe(potencies[i]);
    });
  });

  it("連撃は功力の有無に関わらず壱の型でクリティカル確定", () => {
    const { skillMap } = setup(80);
    expect(skillMap.get("bootshine")?.guaranteedCrit).toBe(true);
    expect(skillMap.get("bootshine-fury")?.guaranteedCrit).toBe(true);
  });

  it.each(["elixir-field", "flint-strike", "tornado-kick"])("%s は範囲攻撃で 2 体目以降 35% 減", (skillId) => {
    const skill = setup(80).skillMap.get(skillId);
    expect(skill?.maxTargets).toBe(Infinity);
    expect(skill?.falloffRate).toBe(0.35);
  });
});

describe("モンク: 下位技の型コンボと功力（タイムライン上）", () => {
  it("Lv80 では連撃 → 正拳突き → 崩拳 → 連撃が型で繋がり、功力が無ければ基本の威力", () => {
    const e = resolveAtLevel(80, [
      entry("form-shift"),
      entry("bootshine"),
      entry("true-strike"),
      entry("snap-punch"),
      entry("bootshine"),
    ]).entries;
    e.forEach(expectNoError);
    expect(e.slice(1).map((x) => x.wsComboError)).toEqual([false, false, false, false]);
    expect(e.slice(1).map((x) => x.resolvedSkillId)).toEqual(["bootshine", "true-strike", "snap-punch", "bootshine"]);
    expect(e.slice(1).map((x) => x.resolvedPotency)).toEqual([180, 260, 290, 180]);
  });

  it("Lv90 では功力があると連撃・正拳突き・崩拳が功力版になり、功力を 1 つ消費する", () => {
    // 零の型 → 双竜脚（壱の功力）→ 双掌打（弐の功力）→ 破砕拳（参の功力 2）→ 連撃 → 正拳突き → 崩拳
    const e = resolveAtLevel(90, [
      entry("form-shift"),
      entry("dragon-kick"),
      entry("twin-snakes"),
      entry("demolish"),
      entry("bootshine"),
      entry("true-strike"),
      entry("snap-punch"),
    ]).entries;
    e.forEach(expectNoError);
    expect(e.slice(4).map((x) => x.wsComboError)).toEqual([false, false, false]);
    expect(e.slice(4).map((x) => x.resolvedSkillId)).toEqual(["bootshine-fury", "true-strike-fury", "snap-punch-fury"]);
    expect(e.slice(4).map((x) => x.resolvedPotency)).toEqual([420, 500, 480]);
    expect(e[6].resourceSnapshot["opo-fury"]).toBe(0);
    expect(e[6].resourceSnapshot["raptor-fury"]).toBe(0);
    expect(e[6].resourceSnapshot["coeurl-fury"]).toBe(1);
  });

  it("Lv80 の踏鳴中は連撃・正拳突き・崩拳が型を問わず成立し、それぞれのチャクラを得る", () => {
    const e = resolveAtLevel(80, [
      entry("perfect-balance"),
      entry("snap-punch"),
      entry("true-strike"),
      entry("bootshine"),
    ]).entries;
    e.forEach(expectNoError);
    expect(e.slice(1).map((x) => x.wsComboError)).toEqual([false, false, false]);
    expect(e[3].resourceSnapshot["opo-chakra"]).toBe(1);
    expect(e[3].resourceSnapshot["raptor-chakra"]).toBe(1);
    expect(e[3].resourceSnapshot["coeurl-chakra"]).toBe(1);
  });
});

describe("モンク: 必殺技の変化先（タイムライン上）", () => {
  // 1 回目: 同種チャクラ 3 つ（陰の闘気）、2 回目: 3 種のチャクラ（陽の闘気）、3 回目: 陰陽の闘気 + チャクラ 3 つ
  const blitzTimeline = () => [
    entry("perfect-balance"),
    entry("dragon-kick"),
    entry("dragon-kick"),
    entry("dragon-kick"),
    entry("masterful-blitz"),
    entry("perfect-balance"),
    entry("dragon-kick"),
    entry("twin-snakes"),
    entry("demolish"),
    entry("masterful-blitz"),
    // 踏鳴のリキャスト（40 秒 × 2 チャージ）の回復を待つ。間隔は Lv70 の GCD（2.12 秒）より広く取る
    entry("perfect-balance", 90),
    entry("dragon-kick", 92.5),
    entry("dragon-kick", 95),
    entry("dragon-kick", 97.5),
    entry("masterful-blitz", 100),
  ];

  it.each([
    // [レベル, 同種 3, 3 種, 陰陽 + 3]
    [70, ["elixir-field", 800], ["flint-strike", 800], ["tornado-kick", 1200]],
    [80, ["elixir-field", 800], ["flint-strike", 800], ["tornado-kick", 1200]],
    [90, ["elixir-field", 800], ["rising-phoenix", 900], ["phantom-rush", 1400]],
    [100, ["elixir-burst", 900], ["rising-phoenix", 900], ["phantom-rush", 1500]],
  ] as const)("Lv%i の必殺技は 同種 3 で %j、3 種で %j、陰陽 + 3 で %j", (level, same, mixed, nadi) => {
    const e = resolveAtLevel(level as PlayerLevel, blitzTimeline()).entries;
    e.forEach(expectNoError);
    const [first, second, third] = [e[4], e[9], e[14]];

    expect([first.resolvedSkillId, first.resolvedPotency]).toEqual(same);
    expect(first.resourceSnapshot["opo-chakra"]).toBe(0);
    expect(first.resourceSnapshot["lunar-nadi"]).toBe(1);

    expect([second.resolvedSkillId, second.resolvedPotency]).toEqual(mixed);
    expect(second.resourceSnapshot["opo-chakra"]).toBe(0);
    expect(second.resourceSnapshot["raptor-chakra"]).toBe(0);
    expect(second.resourceSnapshot["coeurl-chakra"]).toBe(0);
    expect(second.resourceSnapshot["solar-nadi"]).toBe(1);

    // 闘魂旋風脚も夢幻闘舞と同じく陰陽の闘気を両方消費する
    expect([third.resolvedSkillId, third.resolvedPotency]).toEqual(nadi);
    expect(third.resourceSnapshot["opo-chakra"]).toBe(0);
    expect(third.resourceSnapshot["lunar-nadi"]).toBe(0);
    expect(third.resourceSnapshot["solar-nadi"]).toBe(0);
  });

  it.each([
    [70 as PlayerLevel, 2.12],
    [80 as PlayerLevel, 2],
  ])("Lv%i の蒼気砲・爆裂脚・闘魂旋風脚のあとの GCD は %s 秒で、零の型で次の WS が型を問わず成立する", (level, gcd) => {
    const withBlitz = (ws: string[]) => [
      entry("perfect-balance"),
      ...ws.map((id) => entry(id)),
      entry("masterful-blitz"),
      entry("true-strike"),
    ];
    const elixirField = resolveAtLevel(level, withBlitz(["dragon-kick", "dragon-kick", "dragon-kick"])).entries;
    const flintStrike = resolveAtLevel(level, withBlitz(["dragon-kick", "twin-snakes", "demolish"])).entries;
    const tornadoKick = resolveAtLevel(level, [...blitzTimeline(), entry("true-strike")]).entries;
    const cases = [
      ["elixir-field", elixirField[4], elixirField[5]],
      ["flint-strike", flintStrike[4], flintStrike[5]],
      ["tornado-kick", tornadoKick[14], tornadoKick[15]],
    ] as const;
    for (const [blitzId, blitz, next] of cases) {
      expectNoError(blitz);
      expectNoError(next);
      expect(blitz.resolvedSkillId).toBe(blitzId);
      expect(gap(blitz, next), blitzId).toBe(gcd);
      expect(next.wsComboError, blitzId).toBe(false);
    }
  });

  it("Lv90 の桃園結義中は蒼気砲でも闘気を得る（桃園結義効果アップ Lv88）", () => {
    const e = resolveAtLevel(90, [
      entry("the-forbidden-chakra"),
      entry("perfect-balance"),
      entry("dragon-kick"),
      entry("dragon-kick"),
      entry("brotherhood"),
      entry("dragon-kick"),
      entry("masterful-blitz"),
    ]).entries;
    e.forEach(expectNoError);
    expect(e[6].resolvedSkillId).toBe("elixir-field");
    expect(e[6].resourceSnapshot["chakra"]).toBe(e[5].resourceSnapshot["chakra"] + 1);
  });
});
