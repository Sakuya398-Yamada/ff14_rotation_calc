import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, BuffDefinition, TimelineEntry } from "../../types/skill";

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

describe("ResolvedTimelineEntry.activeBuffsAtUse", () => {
  const lifeSurgeLikeBuff: BuffDefinition = {
    id: "life-surge",
    name: "ライフサージ",
    shortName: "LS",
    icon: "",
    duration: 5,
    effects: [{ type: "guaranteedCrit", value: 1 }],
    color: "#4caf50",
    maxStacks: 1,
  };

  it("guaranteedCrit バフは GCD 使用時に消費されるが、activeBuffsAtUse には残る", () => {
    const surge = makeSkill({
      id: "life-surge",
      type: "ogcd",
      potency: 0,
      buffApplications: ["life-surge"],
    });
    const gcd = makeSkill({ id: "attack-gcd", potency: 200 });
    const skillMap = new Map([
      [surge.id, surge],
      [gcd.id, gcd],
    ]);

    const result = resolveTimeline(
      [makeEntry(surge.id), makeEntry(gcd.id)],
      skillMap,
      [],
      undefined,
      [lifeSurgeLikeBuff],
      []
    );

    const gcdEntry = result.entries[1];

    // guaranteedCrit が効いているので critRateBonus は 1（100%）
    expect(gcdEntry.critRateBonus).toBe(1);

    // activeBuffs（post-consumption）には残っていない
    expect(gcdEntry.activeBuffs.some((ab) => ab.buffId === "life-surge")).toBe(false);

    // activeBuffsAtUse（pre-consumption）には残っている
    expect(gcdEntry.activeBuffsAtUse.some((ab) => ab.buffId === "life-surge")).toBe(true);
  });

  it("通常のバフは activeBuffs と activeBuffsAtUse の両方に含まれる", () => {
    const potencyBuff: BuffDefinition = {
      id: "power",
      name: "パワー",
      shortName: "P",
      icon: "",
      duration: 20,
      effects: [{ type: "potency", value: 1.2 }],
      color: "#ff0000",
    };
    const buffSkill = makeSkill({
      id: "power-up",
      type: "ogcd",
      potency: 0,
      buffApplications: ["power"],
    });
    const gcd = makeSkill({ id: "atk", potency: 100 });
    const skillMap = new Map([
      [buffSkill.id, buffSkill],
      [gcd.id, gcd],
    ]);

    const result = resolveTimeline(
      [makeEntry(buffSkill.id), makeEntry(gcd.id)],
      skillMap,
      [],
      undefined,
      [potencyBuff],
      []
    );

    const gcdEntry = result.entries[1];
    expect(gcdEntry.activeBuffs.some((ab) => ab.buffId === "power")).toBe(true);
    expect(gcdEntry.activeBuffsAtUse.some((ab) => ab.buffId === "power")).toBe(true);
  });
});
