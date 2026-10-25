import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { calcGcd } from "../stat-calc";
import { MNK_ATTACK_SKILLS } from "../../data/mnk-skills";
import { MNK_BUFFS } from "../../data/mnk-buffs";
import { MNK_RESOURCES } from "../../data/mnk-resources";
import type {
  CharacterStats,
  PlayerLevel,
  ResolvedTimelineEntry,
  TimelineEntry,
} from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(MNK_BUFFS, level);
  const resources = getResourcesForLevel(MNK_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(MNK_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(MNK_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  return (entries: TimelineEntry[], stats?: CharacterStats) =>
    resolveTimeline(entries, skillMap, resources, stats, buffs);
}

const resolve = setup();

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const gap = (a: ResolvedTimelineEntry, b: ResolvedTimelineEntry) =>
  Math.round((b.startTime - a.startTime) * 1000) / 1000;
const pbStacks = (e: ResolvedTimelineEntry) =>
  e.activeBuffs.find((b) => b.buffId === "perfect-balance")?.stacks;

const MEDITATIONS = ["steeled-meditation", "forbidden-meditation"] as const;

/**
 * 公式ジョブガイド（モンク、Patch 7.5、7.55 表記、PvE 欄）との整合（#521）
 * - 鉄山闘気／陰陽闘気: 「発動条件：「闘気」5未満」「実行するとウェポンスキルと魔法にリキャストタイムが発生する」
 * - 桃園結義: 「ウェポンスキルおよび魔法による攻撃を命中させると、自身に「闘気」が付与される」（演武は攻撃しない）
 * - 踏鳴: 「発動条件：自身が戦闘状態かついずれのチャクラも付与されていない」（戦闘状態は扱わない）
 */
describe("MNK: 鉄山闘気／陰陽闘気の GCD リキャスト", () => {
  it.each(MEDITATIONS)("%s は WS のリキャスト明けに置かれ、次の WS は 2.0 秒後になる", (id) => {
    // 陰陽闘気斬で闘気を 0 にしてから置く
    const e = resolve([
      entry("the-forbidden-chakra"), entry("leaping-opo"), entry(id), entry("rising-raptor"),
    ]).entries;
    e.forEach(expectNoError);
    expect(gap(e[1], e[2])).toBe(2);
    expect(gap(e[2], e[3])).toBe(2);
    // GCD リキャストは発生させても、型（WS コンボ）は切らない
    expect(e[3].wsComboError).toBe(false);
  });

  it("Lv70 でも次の WS は 2.0 秒後になる", () => {
    const e = setup(70)([
      entry("the-forbidden-chakra"), entry("dragon-kick"), entry("forbidden-meditation"), entry("twin-snakes"),
    ]).entries;
    e.forEach(expectNoError);
    expect(gap(e[1], e[2])).toBe(2);
    expect(gap(e[2], e[3])).toBe(2);
  });

  it("スキルスピードが乗る", () => {
    const stats: CharacterStats = { critical: 420, directHit: 420, determination: 440, speed: 2000 };
    const e = resolve([
      entry("the-forbidden-chakra"), entry("forbidden-meditation"), entry("leaping-opo"), entry("rising-raptor"),
    ], stats).entries;
    expect(gap(e[1], e[2])).toBe(calcGcd(2.0, stats));
    expect(gap(e[1], e[2])).toBe(gap(e[2], e[3]));
  });

  it("陰陽闘気で終わるタイムラインの終了時刻に GCD リキャストが入る（#589）", () => {
    const r = resolve([entry("the-forbidden-chakra"), entry("forbidden-meditation")]);
    expect(r.entries[1].startTime).toBe(0.65);
    expect(r.lastGcdEndTime).toBe(2.65);
  });

  it("GCD のリキャスト中に手動で置くとリキャストエラーになり、闘気は増えない", () => {
    // 猿舞連撃（0.65 秒）のアニメーションロックは明けているが、GCD のリキャスト（2.65 秒まで）は明けていない時刻
    const e = resolve([
      entry("the-forbidden-chakra"), entry("leaping-opo"), entry("forbidden-meditation", 1.5),
    ]).entries;
    expect(e[2].recastError).toBe(true);
    expect(e[2].resourceSnapshot["chakra"]).toBe(0);
  });
});

describe("MNK: 鉄山闘気／陰陽闘気は闘気 5 未満で実行できる", () => {
  it.each(MEDITATIONS)("%s を初期値（闘気 5）で置くと resourceErrors になり、闘気は 5 のまま", (id) => {
    const e = resolve([entry(id)]).entries;
    expect(e[0].resourceErrors).toEqual(["chakra"]);
    expect(e[0].resourceSnapshot["chakra"]).toBe(5);
  });

  it("闘気 4 からは 5 にでき、5 になったらエラーになる", () => {
    const e = resolve([
      entry("the-forbidden-chakra"),
      ...Array.from({ length: 6 }, () => entry("forbidden-meditation")),
    ]).entries;
    expectNoError(e[5]);
    expect(e[5].resourceSnapshot["chakra"]).toBe(5);
    expect(e[6].resourceErrors).toEqual(["chakra"]);
    expect(e[6].resourceSnapshot["chakra"]).toBe(5);
  });

  it("エラーになった陰陽闘気でも GCD のリキャストは発生する（GCD・黙想のエラーと同じ扱い）", () => {
    const e = resolve([entry("forbidden-meditation"), entry("leaping-opo")]).entries;
    expect(e[0].resourceErrors).toEqual(["chakra"]);
    expect(gap(e[0], e[1])).toBe(2);
  });

  it("桃園結義の効果中（闘気の上限 10）でも、闘気 5 ではエラーになる", () => {
    const e = resolve([entry("brotherhood"), entry("forbidden-meditation")]).entries;
    expect(e[1].activeBuffsAtUse.some((b) => b.buffId === "brotherhood")).toBe(true);
    expect(e[1].resourceErrors).toEqual(["chakra"]);
  });
});

describe("MNK: 桃園結義の闘気は攻撃する WS で得る", () => {
  it("演武では闘気を得ず、続く WS では得る", () => {
    const e = resolve([
      entry("the-forbidden-chakra"), entry("brotherhood"), entry("form-shift"), entry("leaping-opo"),
    ]).entries;
    e.forEach(expectNoError);
    expect(e[2].resourceSnapshot["chakra"]).toBe(0);
    expect(e[3].resourceSnapshot["chakra"]).toBe(1);
  });
});

describe("MNK: 踏鳴はチャクラが無いときだけ実行できる", () => {
  it.each([
    ["leaping-opo", "opo-chakra"],
    ["rising-raptor", "raptor-chakra"],
    ["pouncing-coeurl", "coeurl-chakra"],
  ])("%s で %s が残っていると resourceErrors になり、踏鳴は付け直されない", (ws, chakraId) => {
    const e = resolve([entry("perfect-balance"), entry(ws), entry("perfect-balance")]).entries;
    expect(e[1].resourceSnapshot[chakraId]).toBe(1);
    expect(e[2].resourceErrors).toEqual([chakraId]);
    expect(pbStacks(e[2])).toBe(2);
  });

  it("エラーになった踏鳴はチャージを使わない", () => {
    // 2 チャージのうち 1 回目で 1 つ使う。エラーの 2 回目が使っていれば、3 回目は 40 秒経つ前なのでリキャストエラーになる
    const e = resolve([
      entry("perfect-balance"), entry("leaping-opo"), entry("perfect-balance"),
      entry("leaping-opo"), entry("leaping-opo"), entry("masterful-blitz"), entry("perfect-balance"),
    ]).entries;
    expect(e[2].resourceErrors).toEqual(["opo-chakra"]);
    expect(e[5].resolvedSkillId).toBe("elixir-burst");
    expect(e[6].startTime).toBeLessThan(40);
    expectNoError(e[6]);
  });

  it("必殺技でチャクラを使い切ったあとは実行できる", () => {
    const e = resolve([
      entry("perfect-balance"), entry("leaping-opo"), entry("leaping-opo"), entry("leaping-opo"),
      entry("masterful-blitz"), entry("perfect-balance"),
    ]).entries;
    expectNoError(e[5]);
    expect(pbStacks(e[5])).toBe(3);
  });
});
