import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getBuffContributions } from "../buff-contribution";
import type { BuffDefinition, ResolvedTimelineEntry, Skill, TimelineEntry } from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
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

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const stacksOf = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.find((b) => b.buffId === buffId)?.stacks;

// 戦士の原初の解放の形: 3 スタック。対象スキルにだけ確定 CRT/DH が効き、そのスキルでだけスタックを減らし、使い切ると別のバフを付ける
const limited: BuffDefinition = {
  id: "limited",
  icon: "",
  duration: 15,
  maxStacks: 3,
  effects: [
    { type: "guaranteedCrit", value: 1, appliesToSkillIds: ["target"] },
    { type: "guaranteedDh", value: 1, appliesToSkillIds: ["target"] },
    { type: "consumeOnGcd", value: 1, appliesToSkillIds: ["target"] },
    { type: "applyBuffOnDeplete", value: 1, appliedBuffId: "after" },
  ],
  color: "#fff",
};
// 戦士のバーサクの形: 3 スタック。全 GCD に確定 CRT/DH が効く（consumeOnGcd は持たない）
const both: BuffDefinition = {
  id: "both",
  icon: "",
  duration: 15,
  maxStacks: 3,
  effects: [
    { type: "guaranteedCrit", value: 1 },
    { type: "guaranteedDh", value: 1 },
  ],
  color: "#fff",
};
const after: BuffDefinition = { id: "after", icon: "", duration: 30, effects: [], color: "#fff" };
const buffs = [limited, both, after];

const skills = [
  makeSkill({ id: "grant-limited", type: "ogcd", recastTime: 0.65, cooldown: 60, buffApplications: ["limited"] }),
  makeSkill({ id: "grant-both", type: "ogcd", recastTime: 0.65, cooldown: 60, buffApplications: ["both"] }),
  makeSkill({ id: "target" }),
  makeSkill({ id: "other" }),
  // スキル自身が確定の GCD（戦士のインナーカオスの形）
  makeSkill({ id: "self-guaranteed", guaranteedCrit: true, guaranteedDh: true }),
];
const skillMap = new Map(skills.map((s) => [s.id, s]));
const buffDefMap = new Map(buffs.map((b) => [b.id, b]));
const resolve = (entries: TimelineEntry[]) => resolveTimeline(entries, skillMap, [], undefined, buffs).entries;

describe("確定クリティカル・ダイレクトヒットのバフを appliesToSkillIds で絞る", () => {
  it("対象外の GCD は確定にならず、スタックも減らない", () => {
    const e = resolve([entry("grant-limited"), entry("other")]);
    expectNoError(e[1]);
    expect(e[1].critRateBonus).toBe(0);
    expect(e[1].dhRateBonus).toBe(0);
    expect(stacksOf(e[1], "limited")).toBe(3);
    expect(getBuffContributions(e[1].activeBuffsAtUse, buffDefMap, "other")).toEqual([]);
  });

  it("対象の GCD は確定になり、CRT・DH・consumeOnGcd を併せ持っても 1 スタックだけ減る", () => {
    const e = resolve([entry("grant-limited"), entry("target")]);
    expectNoError(e[1]);
    expect(e[1].critRateBonus).toBe(1);
    expect(e[1].dhRateBonus).toBe(1);
    expect(stacksOf(e[1], "limited")).toBe(2);
    const [contribution] = getBuffContributions(e[1].activeBuffsAtUse, buffDefMap, "target");
    expect(contribution).toMatchObject({ buffId: "limited", guaranteedCrit: true, guaranteedDh: true });
  });

  it("スキル自身が確定の GCD は、対象外のバフのスタックを減らさない", () => {
    const e = resolve([entry("grant-limited"), entry("self-guaranteed")]);
    expectNoError(e[1]);
    expect(e[1].critRateBonus).toBe(1);
    expect(stacksOf(e[1], "limited")).toBe(3);
  });

  it("対象の GCD で 3 スタックを使い切ると、applyBuffOnDeplete のバフが付く", () => {
    const e = resolve([entry("grant-limited"), entry("target"), entry("target"), entry("target")]);
    e.forEach(expectNoError);
    expect(e[3].activeBuffs.some((b) => b.buffId === "limited")).toBe(false);
    expect(e[3].activeBuffs.some((b) => b.buffId === "after")).toBe(true);
  });

  it("appliesToSkillIds の無いバフは全 GCD に効き、CRT と DH を併せ持っても 1 スタックだけ減る", () => {
    const e = resolve([entry("grant-both"), entry("other"), entry("target")]);
    e.forEach(expectNoError);
    expect(e[1].critRateBonus).toBe(1);
    expect(e[1].dhRateBonus).toBe(1);
    expect(stacksOf(e[1], "both")).toBe(2);
    expect(stacksOf(e[2], "both")).toBe(1);
  });
});
