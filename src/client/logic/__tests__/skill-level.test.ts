import { describe, it, expect } from "vitest";
import { getSkillsForLevel } from "../skill-level";
import type { Skill, PlayerLevel } from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
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

describe("getSkillsForLevel", () => {
  describe("autoTransform変換先スキルのフィルタリング", () => {
    it("autoTransformの変換先スキルがパレットから除外される", () => {
      const skills: Skill[] = [
        makeSkill({
          id: "true-thrust",
          autoTransform: { buffId: "dragons-eye", skillId: "raiden-thrust" },
        }),
        makeSkill({ id: "raiden-thrust", acquiredLevel: 76 }),
      ];

      const result = getSkillsForLevel(skills, 100 as PlayerLevel, new Set(), new Set());

      const ids = result.map((s) => s.id);
      expect(ids).toContain("true-thrust");
      expect(ids).not.toContain("raiden-thrust");
    });

    it("autoTransformの変換元スキルはパレットに残る", () => {
      const skills: Skill[] = [
        makeSkill({
          id: "doom-spike",
          autoTransform: { buffId: "dragons-eye", skillId: "draconian-fury" },
        }),
        makeSkill({ id: "draconian-fury", acquiredLevel: 82 }),
        makeSkill({ id: "other-skill" }),
      ];

      const result = getSkillsForLevel(skills, 100 as PlayerLevel, new Set(), new Set());

      const ids = result.map((s) => s.id);
      expect(ids).toContain("doom-spike");
      expect(ids).toContain("other-skill");
      expect(ids).not.toContain("draconian-fury");
    });

    it("変換先スキルが未習得の場合でもフィルタリングが正しく動作する", () => {
      const skills: Skill[] = [
        makeSkill({
          id: "true-thrust",
          autoTransform: { buffId: "dragons-eye", skillId: "raiden-thrust" },
        }),
        makeSkill({ id: "raiden-thrust", acquiredLevel: 76 }),
      ];

      // Lv70ではraiden-thrustは未習得なのでそもそもフィルタ対象外
      const result = getSkillsForLevel(skills, 70 as PlayerLevel, new Set(), new Set());

      const ids = result.map((s) => s.id);
      expect(ids).toContain("true-thrust");
      expect(ids).not.toContain("raiden-thrust");
    });

    it("replacesSkillIdフィルタリングに影響しない", () => {
      const skills: Skill[] = [
        makeSkill({ id: "full-thrust", acquiredLevel: 26 }),
        makeSkill({ id: "heavens-thrust", acquiredLevel: 86, replacesSkillId: "full-thrust" }),
      ];

      const result = getSkillsForLevel(skills, 100 as PlayerLevel, new Set(), new Set());

      const ids = result.map((s) => s.id);
      expect(ids).toContain("heavens-thrust");
      expect(ids).not.toContain("full-thrust");
    });
  });
});
