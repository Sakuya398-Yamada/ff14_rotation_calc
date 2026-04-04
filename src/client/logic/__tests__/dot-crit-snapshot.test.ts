import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, BuffDefinition } from "../../types/skill";

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

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("DoTのクリティカル率ボーナスのスナップショット", () => {
  const battleLitany: BuffDefinition = {
    id: "battle-litany",
    name: "バトルリタニー",
    shortName: "ﾘﾀﾆｰ",
    icon: "",
    duration: 20,
    effects: [{ type: "critRate", value: 0.1 }],
    color: "#2196f3",
  };

  it("バトルリタニー中にDoTを付与するとDoTティックにcritRateBonus=0.1がスナップショットされる", () => {
    const litanySkill = makeSkill({
      id: "battle-litany",
      type: "ogcd",
      potency: 0,
      target: "self",
      recastTime: 0.65,
      cooldown: 120,
      buffApplications: ["battle-litany"],
    });
    const dotSkill = makeSkill({
      id: "chaos-thrust",
      potency: 220,
      dotPotency: 40,
      dotDuration: 24,
      comboFrom: ["disembowel"],
    });
    const comboStart = makeSkill({ id: "true-thrust" });
    const combo2 = makeSkill({ id: "disembowel", comboFrom: ["true-thrust"] });

    const skillMap = new Map([
      [comboStart.id, comboStart],
      [combo2.id, combo2],
      [litanySkill.id, litanySkill],
      [dotSkill.id, dotSkill],
    ]);

    const result = resolveTimeline(
      [makeEntry("true-thrust"), makeEntry("disembowel"), makeEntry("battle-litany"), makeEntry("chaos-thrust")],
      skillMap,
      [],
      undefined,
      [battleLitany],
    );

    // DoTティックが生成されていること
    expect(result.dotTicks.length).toBeGreaterThan(0);
    // 全ティックにcritRateBonus=0.1がスナップショットされていること
    for (const tick of result.dotTicks) {
      expect(tick.critRateBonus).toBe(0.1);
    }
  });

  it("バトルリタニーなしのDoTティックはcritRateBonus=0", () => {
    const dotSkill = makeSkill({
      id: "chaos-thrust",
      potency: 220,
      dotPotency: 40,
      dotDuration: 24,
      comboFrom: ["disembowel"],
    });
    const comboStart = makeSkill({ id: "true-thrust" });
    const combo2 = makeSkill({ id: "disembowel", comboFrom: ["true-thrust"] });

    const skillMap = new Map([
      [comboStart.id, comboStart],
      [combo2.id, combo2],
      [dotSkill.id, dotSkill],
    ]);

    const result = resolveTimeline(
      [makeEntry("true-thrust"), makeEntry("disembowel"), makeEntry("chaos-thrust")],
      skillMap,
      [],
      undefined,
      [battleLitany],
    );

    expect(result.dotTicks.length).toBeGreaterThan(0);
    for (const tick of result.dotTicks) {
      expect(tick.critRateBonus).toBe(0);
    }
  });
});
