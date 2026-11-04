import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
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

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const endOf = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.find((b) => b.buffId === buffId)?.endTime;

// 戦士の戦嵐の形: 30 秒、重ねがけで延長して上限 60 秒
const capped: BuffDefinition = { id: "capped", icon: "", duration: 30, maxDuration: 60, effects: [{ type: "potency", value: 1.1 }], color: "#fff" };
const plainBuff: BuffDefinition = { id: "plain-buff", icon: "", duration: 30, effects: [{ type: "potency", value: 1.1 }], color: "#fff" };
const buffs = [capped, plainBuff];

const skills = [
  makeSkill({ id: "apply", buffApplications: ["capped"] }),
  makeSkill({ id: "apply-plain", buffApplications: ["plain-buff"] }),
  makeSkill({ id: "starter" }),
  makeSkill({ id: "finisher", comboFrom: ["starter"], nonComboPotency: 50, comboBuffApplications: ["capped"] }),
  makeSkill({ id: "extend", type: "ogcd", recastTime: 0.65, cooldown: 60, buffExtensions: [{ buffId: "capped", seconds: 10 }] }),
  makeSkill({ id: "extend-plain", type: "ogcd", recastTime: 0.65, cooldown: 60, buffExtensions: [{ buffId: "plain-buff", seconds: 10 }] }),
];
const skillMap = new Map(skills.map((s) => [s.id, s]));
const resolve = (entries: TimelineEntry[]) => resolveTimeline(entries, skillMap, [], undefined, buffs).entries;

describe("BuffDefinition.maxDuration（重ねがけで延長し、上限で止める）", () => {
  it("効果中に付与し直すと残り時間に 30 秒を足し、付与時刻から 60 秒で止める", () => {
    const e = resolve([entry("apply"), entry("apply"), entry("apply")]);
    e.forEach(expectNoError);
    expect(endOf(e[0], "capped")).toBe(30);
    // 2.5 秒: 30 + 30 = 60（上限 62.5 に届かない）
    expect(endOf(e[1], "capped")).toBe(60);
    // 5 秒: 60 + 30 = 90 は上限（5 + 60 = 65）で止まる
    expect(endOf(e[2], "capped")).toBe(65);
  });

  it("コンボ成立時の付与（comboBuffApplications）も同じく延長する", () => {
    const e = resolve([entry("starter"), entry("finisher"), entry("starter"), entry("finisher")]);
    e.forEach(expectNoError);
    expect(endOf(e[1], "capped")).toBe(32.5);
    // 7.5 秒: 32.5 + 30 = 62.5（上限 67.5 に届かない）
    expect(endOf(e[3], "capped")).toBe(62.5);
  });

  it("切れたあとに付与すると、付与時刻から 30 秒になる", () => {
    const e = resolve([entry("apply"), entry("apply", 40)]);
    expectNoError(e[1]);
    expect(endOf(e[1], "capped")).toBe(70);
  });

  it("maxDuration の無いバフは、これまでどおり付与時刻から付け直す", () => {
    const e = resolve([entry("apply-plain"), entry("apply-plain")]);
    e.forEach(expectNoError);
    expect(endOf(e[1], "plain-buff")).toBe(32.5);
  });
});

describe("Skill.buffExtensions（効果中のバフだけを延長する）", () => {
  it("効果中なら 10 秒延長する", () => {
    const e = resolve([entry("apply"), entry("extend")]);
    e.forEach(expectNoError);
    expect(e[1].startTime).toBe(0.65);
    expect(endOf(e[1], "capped")).toBe(40);
  });

  it("延長も、使用時刻から maxDuration までで止める", () => {
    // 2.5 秒の付与で 60 秒まで。3.15 秒の延長は 70 秒ではなく 63.15 秒で止まる
    const e = resolve([entry("apply"), entry("apply"), entry("extend")]);
    e.forEach(expectNoError);
    expect(e[2].startTime).toBe(3.15);
    expect(endOf(e[2], "capped")).toBe(63.15);
  });

  it("maxDuration の無いバフは上限なく延長する", () => {
    const e = resolve([entry("apply-plain"), entry("extend-plain")]);
    e.forEach(expectNoError);
    expect(endOf(e[1], "plain-buff")).toBe(40);
  });

  it("効果中でなければ何も付かない", () => {
    const e = resolve([entry("extend")]);
    expectNoError(e[0]);
    expect(e[0].activeBuffs.some((b) => b.buffId === "capped")).toBe(false);
  });
});
