import { describe, it, expect } from "vitest";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";

const skillMap = new Map(WHM_ATTACK_SKILLS.map((s) => [s.id, s]));

/** 公式ジョブガイド（パッチ7.5）準拠の WHM DoT 定義（Issue #411） */
const WHM_DOT_SKILLS = [
  { id: "aero", dotPotency: 30, dotDuration: 30 },
  { id: "aero2", dotPotency: 50, dotDuration: 30 },
  { id: "dia", dotPotency: 60, dotDuration: 30 },
] as const;

describe("WHM: DoT スキルの効果時間 (#411)", () => {
  it.each(WHM_DOT_SKILLS)("$id: DoT 威力 $dotPotency・効果時間 $dotDuration 秒", ({ id, dotPotency, dotDuration }) => {
    const skill = skillMap.get(id);
    expect(skill).toBeDefined();
    expect(skill!.dotPotency).toBe(dotPotency);
    expect(skill!.dotDuration).toBe(dotDuration);
  });
});
