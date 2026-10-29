import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getSkillsForLevel,
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
} from "../skill-level";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { PlayerLevel, TimelineEntry } from "../../types/skill";

function setup(level: PlayerLevel) {
  const buffs = getBuffsForLevel(SAM_BUFFS, level);
  const resources = getResourcesForLevel(SAM_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(SAM_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(SAM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  return { buffs, resources, skillMap };
}

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolveAtLevel(level: PlayerLevel, entries: TimelineEntry[]) {
  const { buffs, resources, skillMap } = setup(level);
  return resolveTimeline(entries, skillMap, resources, undefined, buffs);
}

/**
 * 特性「アクション威力アップII」（Lv84）・「アクション威力アップIII」（Lv94）・「明鏡止水効果アップ」（Lv76）の前後の値（#607）。
 * 月光・花車の威力は方向指定成功前提（背面・側面の値）。
 */
describe("侍: 特性によるレベル別の値（レベル調整済みスキルマップ）", () => {
  const LEVELS: PlayerLevel[] = [70, 80, 90, 100];

  it.each([
    // [スキル, Lv70, Lv80, Lv90, Lv100]
    ["jinpu", [280, 280, 280, 300]],
    ["shifu", [280, 280, 280, 300]],
    ["gekko", [360, 360, 370, 420]],
    ["kasha", [360, 360, 370, 420]],
    ["yukikaze", [280, 280, 290, 340]],
    ["midare-setsugekka", [620, 620, 620, 680]],
    ["kaeshi-setsugekka", [undefined, 620, 620, 680]],
    ["shoha", [undefined, 560, 560, 640]],
    ["ogi-namikiri", [undefined, undefined, 860, 1000]],
    ["kaeshi-namikiri", [undefined, undefined, 860, 1000]],
  ] as const)("%s のコンボ時（または通常の）威力", (skillId, potencies) => {
    LEVELS.forEach((level, i) => {
      expect(setup(level).skillMap.get(skillId)?.potency, `Lv${level}`).toBe(potencies[i]);
    });
  });

  it.each([
    ["jinpu", [120, 120, 120, 140]],
    ["shifu", [120, 120, 120, 140]],
    ["gekko", [150, 150, 160, 210]],
    ["kasha", [150, 150, 160, 210]],
    ["yukikaze", [100, 100, 110, 160]],
  ] as const)("%s の非コンボ時の威力", (skillId, potencies) => {
    LEVELS.forEach((level, i) => {
      expect(setup(level).skillMap.get(skillId)?.nonComboPotency, `Lv${level}`).toBe(potencies[i]);
    });
  });

  it("彼岸花の継続ダメージの威力は Lv94 未満で 45、Lv94 以降で 50", () => {
    expect(LEVELS.map((level) => setup(level).skillMap.get("higanbana")?.dotPotency)).toEqual([45, 45, 45, 50]);
  });

  it("燕飛効果アップ時の燕飛の威力は Lv94 未満で 260、Lv94 以降で 270", () => {
    expect(LEVELS.map((level) => setup(level).skillMap.get("enpi")?.conditionalPotencyBuffs)).toEqual([
      [{ buffId: "enhanced-enpi", potency: 260 }],
      [{ buffId: "enhanced-enpi", potency: 260 }],
      [{ buffId: "enhanced-enpi", potency: 260 }],
      [{ buffId: "enhanced-enpi", potency: 270 }],
    ]);
  });

  it("明鏡止水の最大チャージ数は Lv76 未満で 1、Lv76 以降で 2", () => {
    // maxCharges 未設定は 1 チャージ
    expect(LEVELS.map((level) => setup(level).skillMap.get("meikyo-shisui-skill")?.maxCharges ?? 1)).toEqual([1, 2, 2, 2]);
  });
});

describe("侍: 特性によるレベル別の値（タイムライン上）", () => {
  it.each([
    [80 as PlayerLevel, 360],
    [90 as PlayerLevel, 370],
    [100 as PlayerLevel, 420],
  ])("Lv%i の刃風 → 陣風 → 月光で、月光の威力は %i", (level, potency) => {
    const result = resolveAtLevel(level, [entry("hakaze"), entry("jinpu"), entry("gekko")]);
    const gekko = result.entries[2];
    expect(gekko.resolvedSkillId).toBe("gekko");
    expect(gekko.wsComboError).toBe(false);
    expect(gekko.resolvedPotency).toBe(potency);
  });

  it.each([
    [90 as PlayerLevel, 260],
    [100 as PlayerLevel, 270],
  ])("Lv%i の必殺剣・夜天のあとの燕飛の威力は %i", (level, potency) => {
    const result = resolveAtLevel(level, [entry("enpi"), entry("hissatsu-yaten"), entry("enpi")]);
    expect(result.entries[2].resourceErrors).toEqual([]);
    expect(result.entries[2].resolvedPotency).toBe(potency);
  });

  it("Lv70 では明鏡止水を続けて使うと 2 回目がリキャストエラー、Lv80 ではエラーにならない", () => {
    const entries = () => [entry("meikyo-shisui-skill"), entry("meikyo-shisui-skill")];
    expect(resolveAtLevel(70, entries()).entries[1].recastError).toBe(true);
    expect(resolveAtLevel(80, entries()).entries[1].recastError).toBe(false);
  });
});
