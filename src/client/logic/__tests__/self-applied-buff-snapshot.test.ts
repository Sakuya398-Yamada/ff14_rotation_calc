import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getBuffContributions } from "../buff-contribution";
import type { Skill, TimelineEntry, BuffDefinition } from "../../types/skill";

// Issue #263: スキル自身が付与する potency バフが、そのスキルの内訳 (SkillDetailPanel) に出現しないこと。
// 集約 buffMultiplier は Issue #78 で既に修正済み (バフ適用前の状態で計算)。
// 本テストは activeBuffsAtUse スナップショットも同じタイミングで取られ、内訳と集約が整合することを保証する。

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

const powerSurgeLike: BuffDefinition = {
  id: "power-surge",
  name: "竜槍",
  shortName: "竜槍",
  icon: "",
  duration: 30,
  effects: [{ type: "potency", value: 1.1 }],
  color: "#ff5722",
};

describe("自スキル付与の potency バフは activeBuffsAtUse に含まれない (#263)", () => {
  it("comboBuffApplications で付与する potency バフが、付与スキル自身の activeBuffsAtUse / 内訳に含まれない", () => {
    const trueThrust = makeSkill({ id: "true-thrust" });
    const spiralBlow = makeSkill({
      id: "spiral-blow",
      potency: 300,
      nonComboPotency: 140,
      comboFrom: ["true-thrust"],
      comboBuffApplications: ["power-surge"],
    });
    const skillMap = new Map([
      [trueThrust.id, trueThrust],
      [spiralBlow.id, spiralBlow],
    ]);

    const result = resolveTimeline(
      [makeEntry(trueThrust.id), makeEntry(spiralBlow.id)],
      skillMap,
      [],
      undefined,
      [powerSurgeLike],
      []
    );

    const spiralEntry = result.entries[1];

    // 1. 集約倍率: 自スキル付与のため power-surge は含まれず ×1.0
    expect(spiralEntry.buffMultiplier).toBe(1);

    // 2. activeBuffsAtUse (内訳の入力): power-surge を含まない
    expect(spiralEntry.activeBuffsAtUse.some((ab) => ab.buffId === "power-surge")).toBe(false);

    // 3. SkillDetailPanel の内訳: power-surge が現れない (集約 ×1.0 と整合)
    const buffDefMap = new Map([[powerSurgeLike.id, powerSurgeLike]]);
    const contributions = getBuffContributions(
      spiralEntry.activeBuffsAtUse,
      buffDefMap,
      spiralEntry.resolvedSkillId
    );
    expect(contributions.some((c) => c.buffId === "power-surge")).toBe(false);
  });

  it("buffApplications で付与する potency バフも、付与スキル自身の activeBuffsAtUse に含まれない", () => {
    const buffSelfApply = makeSkill({
      id: "self-buff-attack",
      potency: 200,
      buffApplications: ["power-surge"],
    });
    const skillMap = new Map([[buffSelfApply.id, buffSelfApply]]);

    const result = resolveTimeline(
      [makeEntry(buffSelfApply.id)],
      skillMap,
      [],
      undefined,
      [powerSurgeLike],
      []
    );

    const entry = result.entries[0];
    expect(entry.buffMultiplier).toBe(1);
    expect(entry.activeBuffsAtUse.some((ab) => ab.buffId === "power-surge")).toBe(false);
  });

  it("前のコンボで付与された竜槍は、次のスパイラルブロウの activeBuffsAtUse / 内訳に含まれる (回帰確認)", () => {
    const trueThrust = makeSkill({ id: "true-thrust" });
    const spiralBlow = makeSkill({
      id: "spiral-blow",
      potency: 300,
      nonComboPotency: 140,
      comboFrom: ["true-thrust"],
      comboBuffApplications: ["power-surge"],
    });
    const skillMap = new Map([
      [trueThrust.id, trueThrust],
      [spiralBlow.id, spiralBlow],
    ]);

    // true-thrust → spiral-blow (1周目: 竜槍付与) → true-thrust → spiral-blow (2周目: 前回の竜槍が乗る)
    const result = resolveTimeline(
      [
        makeEntry(trueThrust.id),
        makeEntry(spiralBlow.id),
        makeEntry(trueThrust.id),
        makeEntry(spiralBlow.id),
      ],
      skillMap,
      [],
      undefined,
      [powerSurgeLike],
      []
    );

    const firstSpiral = result.entries[1];
    const secondSpiral = result.entries[3];

    // 1周目: 自スキル付与のため power-surge なし
    expect(firstSpiral.buffMultiplier).toBe(1);
    expect(firstSpiral.activeBuffsAtUse.some((ab) => ab.buffId === "power-surge")).toBe(false);

    // 2周目: 前回の竜槍が残っており、+10% 適用される
    expect(secondSpiral.buffMultiplier).toBeCloseTo(1.1, 5);
    expect(secondSpiral.activeBuffsAtUse.some((ab) => ab.buffId === "power-surge")).toBe(true);
  });

  it("ディセムボウル (comboBuffApplications: [power-surge]) も同じ性質を持つ", () => {
    const trueThrust = makeSkill({ id: "true-thrust" });
    const disembowel = makeSkill({
      id: "disembowel",
      potency: 210,
      nonComboPotency: 100,
      comboFrom: ["true-thrust"],
      comboBuffApplications: ["power-surge"],
    });
    const skillMap = new Map([
      [trueThrust.id, trueThrust],
      [disembowel.id, disembowel],
    ]);

    const result = resolveTimeline(
      [makeEntry(trueThrust.id), makeEntry(disembowel.id)],
      skillMap,
      [],
      undefined,
      [powerSurgeLike],
      []
    );

    const disembowelEntry = result.entries[1];
    expect(disembowelEntry.buffMultiplier).toBe(1);
    expect(disembowelEntry.activeBuffsAtUse.some((ab) => ab.buffId === "power-surge")).toBe(false);
  });

  it("コンボ不成立で comboBuffApplications が走らないケースでは付与もされない", () => {
    const spiralBlow = makeSkill({
      id: "spiral-blow",
      potency: 300,
      nonComboPotency: 140,
      comboFrom: ["true-thrust"],
      comboBuffApplications: ["power-surge"],
    });
    const skillMap = new Map([[spiralBlow.id, spiralBlow]]);

    // true-thrust なしで spiral-blow を単独実行 → wsComboError で comboBuffApplications はスキップ
    const result = resolveTimeline(
      [makeEntry(spiralBlow.id)],
      skillMap,
      [],
      undefined,
      [powerSurgeLike],
      []
    );

    const entry = result.entries[0];
    expect(entry.wsComboError).toBe(true);
    // activeBuffs (post-everything) にも power-surge は付与されない
    expect(entry.activeBuffs.some((ab) => ab.buffId === "power-surge")).toBe(false);
    expect(entry.activeBuffsAtUse.some((ab) => ab.buffId === "power-surge")).toBe(false);
  });
});
