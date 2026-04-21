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

const triplecastBuff: BuffDefinition = {
  id: "triplecast-test",
  name: "三連魔",
  shortName: "三連魔",
  icon: "",
  duration: 15,
  maxStacks: 3,
  effects: [{ type: "instantCast", value: 0 }],
  color: "#ffee58",
};

const firestarterBuff: BuffDefinition = {
  id: "firestarter-test",
  name: "ファイアスターター",
  shortName: "FS",
  icon: "",
  duration: null,
  effects: [{ type: "instantCast", value: 0 }],
  color: "#ff7043",
};

describe("instantCast バフ（詠唱破棄）", () => {
  it("triplecast 3スタックは詠唱GCDを打つ度に1スタック消費し、3発目後に失効する", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["triplecast-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [
        makeEntry("grant"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
      ],
      skillMap,
      [],
      undefined,
      [triplecastBuff]
    );

    // 1〜3発目の詠唱スキルは castTime=0（Instant化）
    expect(result.entries[1].castTime).toBe(0);
    expect(result.entries[2].castTime).toBe(0);
    expect(result.entries[3].castTime).toBe(0);

    // 4発目は triplecast 失効済みのため castTime が元の値で計算される（速度バフなし = 2.8）
    expect(result.entries[4].castTime).toBeCloseTo(2.8, 3);

    // 最終エントリの activeBuffs は triplecast を含まない（3発で使い切った）
    expect(result.entries[4].activeBuffs.some((ab) => ab.buffId === "triplecast-test")).toBe(false);
  });

  it("firestarter（単発バフ）は1回の詠唱GCDで消費され、次の詠唱スキルは通常の詠唱時間に戻る", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["firestarter-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("cast-spell"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [firestarterBuff]
    );

    expect(result.entries[1].castTime).toBe(0);
    // 消費後は通常詠唱
    expect(result.entries[2].castTime).toBeCloseTo(2.8, 3);

    // 消費されたので2発目時点ではバフは存在しない
    expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "firestarter-test")).toBe(false);
  });

  it("非詠唱GCD（castTime 未設定）は instantCast バフを消費しない", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["firestarter-test"] });
    const instantSkill = makeSkill({ id: "instant-skill" }); // castTime なし
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([
      [grant.id, grant],
      [instantSkill.id, instantSkill],
      [castSpell.id, castSpell],
    ]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("instant-skill"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [firestarterBuff]
    );

    // 非詠唱GCD では消費されず、次の詠唱スキルで消費される
    expect(result.entries[1].castTime).toBe(0);
    expect(result.entries[2].castTime).toBe(0);
    // 3発目の詠唱スキルで firestarter が消費されている（snapshot は消費後なので含まれない）
    expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "firestarter-test")).toBe(false);
  });

  it("oGCD は instantCast バフを消費しない（詠唱GCDでのみ消費）", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["firestarter-test"] });
    const ability = makeSkill({ id: "ability", type: "ogcd", recastTime: 30 });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([
      [grant.id, grant],
      [ability.id, ability],
      [castSpell.id, castSpell],
    ]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("ability"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [firestarterBuff]
    );

    // oGCD 実行後も firestarter バフは残り、次の詠唱 GCD で Instant 化される
    expect(result.entries[2].castTime).toBe(0);
  });

  it("instantCast バフなしでは詠唱スキルが speed バフの影響を受ける（回帰チェック）", () => {
    const speedBuff: BuffDefinition = {
      id: "speed-buff",
      name: "スピード",
      shortName: "SP",
      icon: "",
      duration: 30,
      effects: [{ type: "speed", value: 0.85 }],
      color: "#888888",
    };
    const grant = makeSkill({ id: "grant", buffApplications: ["speed-buff"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [speedBuff]
    );

    // speed バフで詠唱が 2.8 * 0.85 = 2.38 になる
    expect(result.entries[1].castTime).toBeCloseTo(2.38, 3);
  });

  it("speed バフと instantCast バフが共存すると instantCast が優先される（castTime=0）", () => {
    const speedBuff: BuffDefinition = {
      id: "speed-buff",
      name: "スピード",
      shortName: "SP",
      icon: "",
      duration: 30,
      effects: [{ type: "speed", value: 0.85 }],
      color: "#888888",
    };
    const grant = makeSkill({ id: "grant", buffApplications: ["speed-buff", "triplecast-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [speedBuff, triplecastBuff]
    );

    expect(result.entries[1].castTime).toBe(0);
  });
});
