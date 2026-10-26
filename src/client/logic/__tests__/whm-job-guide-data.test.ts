import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getSkillsForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
} from "../skill-level";
import type { PlayerLevel, Skill } from "../../types/skill";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";
import { WHM_BUFFS } from "../../data/whm-buffs";
import { WHM_RESOURCES } from "../../data/whm-resources";

// 公式ジョブガイド（Patch 7.5、PvE 欄）との照合結果（Issue #411）

const skillMap = new Map(WHM_ATTACK_SKILLS.map((s) => [s.id, s]));

function skillsForLevel(level: PlayerLevel): Skill[] {
  const buffIds = new Set(getBuffsForLevel(WHM_BUFFS, level).map((b) => b.id));
  const resourceIds = new Set(getResourcesForLevel(WHM_RESOURCES, level).map((r) => r.id));
  return getSkillsForLevel(WHM_ATTACK_SKILLS, level, buffIds, resourceIds);
}

function resolveAtLevel(level: PlayerLevel, skillId: string) {
  const buffs = getBuffsForLevel(WHM_BUFFS, level);
  const resources = getResourcesForLevel(WHM_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(WHM_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(WHM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  return {
    skills,
    result: resolveTimeline([{ uid: skillId, skillId }], skillMap, resources, undefined, buffs),
  };
}

const WHM_DOT_SKILLS = [
  { id: "aero", dotPotency: 30, dotDuration: 30 },
  { id: "aero2", dotPotency: 50, dotDuration: 30 },
  { id: "dia", dotPotency: 65, dotDuration: 30 },
] as const;

describe("WHM: ジョブガイド準拠のスキルデータ", () => {
  it.each(WHM_DOT_SKILLS)("$id: DoT 威力 $dotPotency・効果時間 $dotDuration 秒", ({ id, dotPotency, dotDuration }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.dotPotency).toBe(dotPotency);
    expect(skill!.dotDuration).toBe(dotDuration);
  });

  it("迅速魔のリキャストは Lv94 のロール特性で 40 秒になる（Lv90 は 60 秒）", () => {
    expect(skillsForLevel(90).find((s) => s.id === "swiftcast")!.cooldown).toBe(60);
    expect(skillsForLevel(100).find((s) => s.id === "swiftcast")!.cooldown).toBe(40);
  });

  // 特性習得前の値はパッチ 6.4 で初撃・DoT とも 60 → 65、Lv94 の特性「アクション威力アップ」で 85（Issue #671）
  it.each<[PlayerLevel, number]>([
    [80, 65],
    [90, 65],
    [100, 85],
  ])("Lv%i のディアはタイムライン上で初撃・DoT ティックとも威力 %i", (level, potency) => {
    const { skills, result } = resolveAtLevel(level, "dia");
    expect(skills.map((s) => s.id)).toContain("dia");
    const [dia] = result.entries;
    expect(dia.recastError).toBeFalsy();
    expect(dia.untargetableError).toBeFalsy();
    expect(dia.comboErrors).toEqual([]);
    expect(dia.resourceErrors).toEqual([]);
    expect(dia.resolvedPotency).toBe(potency);
    const ticks = result.dotTicks.filter((t) => t.skillId === "dia");
    expect(ticks).toHaveLength(10);
    expect(ticks.every((t) => t.potency === potency)).toBe(true);
  });
});
