import { describe, it, expect } from "vitest";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel } from "../skill-level";
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

const WHM_DOT_SKILLS = [
  { id: "aero", dotPotency: 30, dotDuration: 30 },
  { id: "aero2", dotPotency: 50, dotDuration: 30 },
  { id: "dia", dotPotency: 60, dotDuration: 30 },
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
});
