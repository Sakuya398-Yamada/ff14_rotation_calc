import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { BuffDefinition, CharacterStats, ResolvedTimelineEntry, Skill, TimelineEntry } from "../../types/skill";

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

function recastOf(entry: { startTime: number; gcdAvailableAt: number }): number {
  return Math.round((entry.gcdAvailableAt - entry.startTime) * 1000) / 1000;
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const speedBuff: BuffDefinition = {
  id: "speed-test",
  name: "speed",
  shortName: "speed",
  icon: "",
  duration: 30,
  effects: [{ type: "speed", value: 0.8 }],
  color: "#ffffff",
};

// GCD 2.40（calcGcd(2.5) = 2.40、calcGcd(1.5) = 1.44）になるスピード
const STATS: CharacterStats = { critical: 420, directHit: 420, determination: 440, speed: 1280 };

describe("fixedGcdRecast（スピードで縮めない GCD）", () => {
  it("speed バフ中でも fixedGcdRecast の GCD は recastTime のまま。付けていない GCD は縮む", () => {
    const grant = makeSkill({ id: "grant", type: "ogcd", recastTime: 0.65, cooldown: 60, buffApplications: ["speed-test"] });
    const fixed = makeSkill({ id: "fixed", recastTime: 1.5, fixedGcdRecast: true });
    const normal = makeSkill({ id: "normal" });
    const skillMap = new Map([grant, fixed, normal].map((s) => [s.id, s]));

    const [, fixedEntry, normalEntry] = resolveTimeline(
      [makeEntry("grant"), makeEntry("fixed"), makeEntry("normal")],
      skillMap,
      [],
      undefined,
      [speedBuff],
    ).entries;
    expectNoError(fixedEntry);
    expectNoError(normalEntry);
    expect(recastOf(fixedEntry)).toBe(1.5);
    expect(recastOf(normalEntry)).toBe(2);
  });

  it("ステータスのスピードでも fixedGcdRecast の GCD は縮まない。付けていない GCD は calcGcd で縮む", () => {
    const fixed = makeSkill({ id: "fixed", recastTime: 1.5, fixedGcdRecast: true });
    const normal = makeSkill({ id: "normal" });
    const skillMap = new Map([fixed, normal].map((s) => [s.id, s]));

    const [fixedEntry, normalEntry] = resolveTimeline(
      [makeEntry("fixed"), makeEntry("normal")],
      skillMap,
      [],
      STATS,
    ).entries;
    expectNoError(fixedEntry);
    expectNoError(normalEntry);
    expect(recastOf(fixedEntry)).toBe(1.5);
    expect(recastOf(normalEntry)).toBe(2.4);
  });

  it("autoTransform の変化先に付けたフラグは、変化先に変わったときに効く", () => {
    const grant = makeSkill({ id: "grant", type: "ogcd", recastTime: 0.65, cooldown: 60, buffApplications: ["speed-test"] });
    const source = makeSkill({ id: "source", autoTransform: { buffId: "speed-test", skillId: "target" } });
    const target = makeSkill({ id: "target", recastTime: 1.5, fixedGcdRecast: true });
    const skillMap = new Map([grant, source, target].map((s) => [s.id, s]));

    const [, transformed] = resolveTimeline(
      [makeEntry("grant"), makeEntry("source")],
      skillMap,
      [],
      STATS,
      [speedBuff],
    ).entries;
    expectNoError(transformed);
    expect(transformed.resolvedSkillId).toBe("target");
    expect(recastOf(transformed)).toBe(1.5);
  });
});
