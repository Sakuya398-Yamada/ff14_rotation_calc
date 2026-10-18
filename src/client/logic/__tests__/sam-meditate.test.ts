import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { calcGcd } from "../stat-calc";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
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
  const buffs = getBuffsForLevel(SAM_BUFFS, level);
  const resources = getResourcesForLevel(SAM_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(SAM_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(SAM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (entries: TimelineEntry[], stats?: CharacterStats) =>
    resolveTimeline(entries, skillMap, resources, stats, buffs);
  return { paletteIds: skills.map((s) => s.id), resolve };
}

const { resolve } = setup();

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const hasMeditate = (buffs: { buffId: string }[]) => buffs.some((b) => b.buffId === "meditate");
const gap = (a: ResolvedTimelineEntry, b: ResolvedTimelineEntry) =>
  Math.round((b.startTime - a.startTime) * 1000) / 1000;

/**
 * 黙想（#471）: 公式ジョブガイド（侍、Patch 7.5 表記、PvE 欄）と ConsoleGamesWiki（1 ティック 3 秒で剣気 +10）
 * ティックは実行の 3 秒後から 3 秒ごと。15 秒目も数えて完走で 5 回（剣気 +50・剣圧 +3）
 */
describe("侍: 黙想のデータ", () => {
  it.each([70, 80, 90, 100] as const)("Lv%i のパレットに並ぶ", (level) => {
    expect(setup(level).paletteIds).toContain("meditate");
  });

  it("アビリティで固有リキャスト 60 秒、Lv60 習得、15 秒のバフを付与する", () => {
    const skill = SAM_ATTACK_SKILLS.find((s) => s.id === "meditate");
    expect(skill).toMatchObject({
      type: "ogcd",
      cooldown: 60,
      acquiredLevel: 60,
      triggersGcdRecast: true,
      buffApplications: ["meditate"],
    });
    expect(skill!.icon).toBeTruthy();
    expect(SAM_BUFFS.find((b) => b.id === "meditate")?.duration).toBe(15);
  });
});

describe("侍: 黙想の GCD リキャスト", () => {
  it("GCD のリキャスト明けに置かれ、次の GCD は黙想からさらに 2.5 秒後になる", () => {
    const e = resolve([entry("gyofu"), entry("meditate"), entry("gyofu")]).entries;
    e.forEach(expectNoError);
    expect(e[1].startTime).toBe(2.5);
    expect(e[2].startTime).toBe(5);
  });

  it("スキルスピードが乗る", () => {
    const stats: CharacterStats = { critical: 420, directHit: 420, determination: 440, speed: 2000 };
    const e = resolve([entry("meditate"), entry("gyofu"), entry("gyofu")], stats).entries;
    expect(gap(e[0], e[1])).toBe(calcGcd(2.5, stats));
    expect(gap(e[0], e[1])).toBe(gap(e[1], e[2]));
  });

  it("風花が乗る", () => {
    const e = resolve([
      entry("gyofu"), entry("shifu"), entry("meditate"), entry("gyofu"), entry("gyofu"),
    ]).entries;
    e.forEach(expectNoError);
    expect(gap(e[2], e[3])).toBeCloseTo(2.5 * 0.87, 3);
    expect(gap(e[2], e[3])).toBe(gap(e[3], e[4]));
  });

  it("WS コンボを切らない", () => {
    const e = resolve([entry("gyofu"), entry("meditate"), entry("shifu")]).entries;
    e.forEach(expectNoError);
    expect(e[2].wsComboError).toBe(false);
    expect(e[2].activeBuffs.some((b) => b.buffId === "fuka")).toBe(true);
  });

  it("GCD のリキャスト中に手動で置くとリキャストエラーになり、黙想は付かない", () => {
    const e = resolve([entry("gyofu"), entry("meditate", 1)]).entries;
    expect(e[1].recastError).toBe(true);
    expect(hasMeditate(e[1].activeBuffs)).toBe(false);
  });

  it.each([
    [59.9, true],
    [60, false],
  ])("2 回目を %s 秒に置くと固有リキャストのエラーは %s", (time, expected) => {
    const e = resolve([entry("meditate"), entry("meditate", time)]).entries;
    expect(e[1].recastError).toBe(expected);
  });
});

describe("侍: 黙想の剣気・剣圧", () => {
  it("黙想の時点では増えず、自分の黙想バフは外さない", () => {
    const e = resolve([entry("meditate")]).entries;
    expectNoError(e[0]);
    expect(e[0].resourceSnapshot.kenki).toBe(0);
    expect(e[0].activeBuffs.find((b) => b.buffId === "meditate")?.endTime).toBe(15);
  });

  it("完走すると剣気 +50・剣圧 +3 になり、黙想は切れている", () => {
    const e = resolve([entry("meditate"), entry("true-north", 20)]).entries;
    expectNoError(e[1]);
    expect(e[1].resourceSnapshot.kenki).toBe(50);
    expect(e[1].resourceSnapshot.meditation).toBe(3);
    expect(hasMeditate(e[1].activeBuffsAtUse)).toBe(false);
  });

  it.each([0, 0.13])("黙想を %s 秒に置き、15 秒後ちょうどに次の行動を置くと 15 秒目も数える", (start) => {
    const e = resolve([entry("meditate", start), entry("true-north", start + 15)]).entries;
    expectNoError(e[1]);
    expect(e[1].resourceSnapshot.kenki).toBe(50);
  });

  it("14.9 秒で次の行動を置くと 4 回で止まり、以降は増えない", () => {
    const e = resolve([entry("meditate"), entry("true-north", 14.9), entry("true-north", 30)]).entries;
    e.forEach(expectNoError);
    expect(hasMeditate(e[1].activeBuffsAtUse)).toBe(true);
    expect(hasMeditate(e[1].activeBuffs)).toBe(false);
    expect(e[1].resourceSnapshot.kenki).toBe(40);
    expect(e[1].resourceSnapshot.meditation).toBe(3);
    expect(e[2].resourceSnapshot.kenki).toBe(40);
  });

  it("8.9 秒で次の行動を置くと剣気 +20・剣圧 +2", () => {
    const e = resolve([entry("meditate"), entry("true-north", 8.9)]).entries;
    expectNoError(e[1]);
    expect(e[1].resourceSnapshot.kenki).toBe(20);
    expect(e[1].resourceSnapshot.meditation).toBe(2);
  });

  it("ティックと同時刻の GCD は、そのティックを数えてから黙想を外す", () => {
    const e = resolve([entry("meditate"), entry("gyofu", 3), entry("true-north", 20)]).entries;
    e.forEach(expectNoError);
    // ティック 10 + 刃風 5
    expect(e[1].resourceSnapshot.kenki).toBe(15);
    expect(e[1].resourceSnapshot.meditation).toBe(1);
    expect(hasMeditate(e[1].activeBuffs)).toBe(false);
    expect(e[2].resourceSnapshot.kenki).toBe(15);
  });

  it("黙想の直後に自動配置した GCD（2.5 秒）で外すと、何も増えない", () => {
    const e = resolve([entry("meditate"), entry("gyofu"), entry("true-north", 20)]).entries;
    e.forEach(expectNoError);
    expect(e[1].startTime).toBe(2.5);
    expect(e[2].resourceSnapshot.kenki).toBe(5);
    expect(e[2].resourceSnapshot.meditation).toBe(0);
  });

  it.each([
    ["剣圧不足の照破", entry("shoha", 5), "resourceErrors"],
    ["GCD リキャスト中の刃風", entry("gyofu", 1), "recastError"],
  ] as const)("エラーのある行動（%s）では外れない", (_, errored, errorKey) => {
    const e = resolve([entry("meditate"), errored, entry("true-north", 20)]).entries;
    if (errorKey === "resourceErrors") expect(e[1].resourceErrors).toContain("meditation");
    else expect(e[1].recastError).toBe(true);
    expect(hasMeditate(e[1].activeBuffs)).toBe(true);
    expectNoError(e[2]);
    expect(e[2].resourceSnapshot.kenki).toBe(50);
    expect(e[2].resourceSnapshot.meditation).toBe(3);
  });

  it("Lv70 では剣圧が無く、剣気だけが増える", () => {
    const result = setup(70).resolve([entry("meditate"), entry("true-north", 20)]);
    expect(result.entries[1].resourceSnapshot.kenki).toBe(50);
    expect(result.entries[1].resourceSnapshot.meditation).toBeUndefined();
    expect(result.resourceTicks.map((t) => t.resourceId)).toEqual(Array(5).fill("kenki"));
  });
});

describe("侍: 黙想の段差表示（resourceTicks）", () => {
  it("黙想が最後のエントリでも、バフが切れるまでの付与を時刻順に返す", () => {
    const result = resolve([entry("meditate")]);
    expect(result.resourceTicks).toEqual([
      { time: 3, resourceId: "kenki", value: 10 },
      { time: 3, resourceId: "meditation", value: 1 },
      { time: 6, resourceId: "kenki", value: 20 },
      { time: 6, resourceId: "meditation", value: 2 },
      { time: 9, resourceId: "kenki", value: 30 },
      { time: 9, resourceId: "meditation", value: 3 },
      { time: 12, resourceId: "kenki", value: 40 },
      { time: 15, resourceId: "kenki", value: 50 },
    ]);
    expect(result.entries[0].resourceSnapshot.kenki).toBe(0);
  });

  it("エントリと同時刻の付与は除き、解除後の付与は返さない", () => {
    const result = resolve([entry("meditate"), entry("true-north", 6)]);
    expect(result.resourceTicks).toEqual([
      { time: 3, resourceId: "kenki", value: 10 },
      { time: 3, resourceId: "meditation", value: 1 },
    ]);
    expect(result.entries[1].resourceSnapshot.kenki).toBe(20);
  });

  it("段差表示を指定していない他ジョブの自動生成（詩人の詩心）は返さない", () => {
    const buffIds = new Set(BRD_BUFFS.map((b) => b.id));
    const resourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
    const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, 100, buffIds, resourceIds);
    const skillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, 100, buffIds, resourceIds);
    const result = resolveTimeline(
      [entry("wanderers-minuet"), entry("burst-shot", 10)],
      skillMap,
      BRD_RESOURCES,
      undefined,
      BRD_BUFFS
    );
    // 詩心は付与されている（自動生成自体は動いている）
    expect(result.entries[1].resourceSnapshot.repertoire).toBeGreaterThan(0);
    expect(result.resourceTicks).toEqual([]);
  });
});
