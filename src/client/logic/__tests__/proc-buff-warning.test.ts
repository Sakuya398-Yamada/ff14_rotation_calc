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

describe("確率付与だけで付いたバフの自動消費の警告（unconfirmedProcBuffs）", () => {
  const procInstant: BuffDefinition = {
    id: "proc-instant",
    name: "確率で付く詠唱破棄",
    shortName: "proc",
    icon: "",
    duration: null,
    effects: [{ type: "instantCast", value: 0 }],
    color: "#ff7043",
  };
  const procGrant = makeSkill({
    id: "proc-grant",
    buffApplications: ["proc-instant"],
    buffApplicationProcRates: { "proc-instant": 0.4 },
  });
  const sureGrant = makeSkill({ id: "sure-grant", buffApplications: ["proc-instant"] });
  const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
  const skillMap = new Map([procGrant, sureGrant, castSpell].map((s) => [s.id, s]));

  function resolve(ids: string[]) {
    return resolveTimeline(ids.map(makeEntry), skillMap, [], undefined, [procInstant]).entries;
  }

  it("確率付与だけで付いたバフを消費すると、威力と詠唱破棄はそのままで警告が立つ", () => {
    const entries = resolve(["proc-grant", "cast-spell"]);
    expect(entries[1].unconfirmedProcBuffs).toEqual(["proc-instant"]);
    expect(entries[1].castTime).toBe(0);
    expect(entries[1].resolvedPotency).toBe(100);
    expect(entries[1].comboErrors).toEqual([]);
  });

  it.each([
    ["確定付与", ["sure-grant", "cast-spell"]],
    ["確率付与のあと確定付与で付け直す", ["proc-grant", "sure-grant", "cast-spell"]],
    ["確定付与のあと確率付与が重なる", ["sure-grant", "proc-grant", "cast-spell"]],
  ])("%s → 消費では警告が立たない", (_label, ids) => {
    const entries = resolve(ids);
    const consumer = entries[entries.length - 1];
    expect(consumer.castTime).toBe(0);
    expect(consumer.unconfirmedProcBuffs).toBeUndefined();
  });

  it("消費した後は確率付与の状態が残らない（buffApplications 以外の経路で付け直しても警告しない）", () => {
    const comboStarter = makeSkill({ id: "combo-starter" });
    const comboGrant = makeSkill({
      id: "combo-grant",
      comboFrom: ["combo-starter"],
      comboBuffApplications: ["proc-instant"],
    });
    const map = new Map([procGrant, castSpell, comboStarter, comboGrant].map((s) => [s.id, s]));
    const entries = resolveTimeline(
      ["proc-grant", "cast-spell", "combo-starter", "combo-grant", "cast-spell"].map(makeEntry),
      map,
      [],
      undefined,
      [procInstant]
    ).entries;
    expect(entries[1].unconfirmedProcBuffs).toEqual(["proc-instant"]);
    expect(entries[4].castTime).toBe(0);
    expect(entries[4].unconfirmedProcBuffs).toBeUndefined();
  });

  it("buffConsumptionAnyOf の期待値で消費するバフ（ホークアイ型）には警告を出さない", () => {
    const procBuff: BuffDefinition = {
      id: "proc-potency",
      name: "確率で付く威力上書き",
      shortName: "proc",
      icon: "",
      duration: 30,
      maxStacks: 1,
      effects: [],
      color: "#ffca28",
    };
    const grant = makeSkill({
      id: "potency-grant",
      buffApplications: ["proc-potency"],
      buffApplicationProcRates: { "proc-potency": 0.4 },
    });
    const consumer = makeSkill({
      id: "potency-consumer",
      potency: 100,
      buffConsumptionAnyOf: [{ buffId: "proc-potency", stacks: 1, fallbackPotency: 50 }],
    });
    const map = new Map([grant, consumer].map((s) => [s.id, s]));
    const entries = resolveTimeline(
      [makeEntry("potency-grant"), makeEntry("potency-consumer")],
      map,
      [],
      undefined,
      [procBuff]
    ).entries;
    expect(entries[1].comboErrors).toEqual([]);
    expect(entries[1].resolvedPotency).toBe(70);
    expect(entries[1].unconfirmedProcBuffs).toBeUndefined();
  });
});
