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

describe("バフ適用タイミングと威力計算", () => {
  const potencyBuff: BuffDefinition = {
    id: "power-buff",
    name: "パワーバフ",
    shortName: "パワー",
    icon: "",
    duration: 20,
    effects: [{ type: "potency", value: 1.1 }],
    color: "#ff0000",
  };

  it("スキル自身が付与するバフ（buffApplications）は自分の威力倍率に含まれない", () => {
    const buffSkill = makeSkill({
      id: "buff-attack",
      potency: 200,
      buffApplications: ["power-buff"],
    });
    const nextSkill = makeSkill({ id: "next-attack", potency: 100 });
    const skillMap = new Map([
      [buffSkill.id, buffSkill],
      [nextSkill.id, nextSkill],
    ]);

    const result = resolveTimeline(
      [makeEntry("buff-attack"), makeEntry("next-attack")],
      skillMap,
      [],
      undefined,
      [potencyBuff],
    );

    // バフ付与スキル自身: バフは適用されない → 倍率1.0
    expect(result.entries[0].buffMultiplier).toBe(1);
    // 次のスキル: バフが適用される → 倍率1.1
    expect(result.entries[1].buffMultiplier).toBeCloseTo(1.1);
  });

  it("スキル自身が付与するバフ（comboBuffApplications）は自分の威力倍率に含まれない", () => {
    const comboStart = makeSkill({ id: "combo-start", potency: 100 });
    const comboBuffSkill = makeSkill({
      id: "combo-buff-attack",
      potency: 200,
      comboFrom: ["combo-start"],
      comboBuffApplications: ["power-buff"],
    });
    const nextSkill = makeSkill({ id: "next-attack", potency: 100 });
    const skillMap = new Map([
      [comboStart.id, comboStart],
      [comboBuffSkill.id, comboBuffSkill],
      [nextSkill.id, nextSkill],
    ]);

    const result = resolveTimeline(
      [makeEntry("combo-start"), makeEntry("combo-buff-attack"), makeEntry("next-attack")],
      skillMap,
      [],
      undefined,
      [potencyBuff],
    );

    // コンボバフ付与スキル: バフは自分に適用されない → 倍率1.0
    expect(result.entries[1].buffMultiplier).toBe(1);
    // 次のスキル: バフが適用される → 倍率1.1
    expect(result.entries[2].buffMultiplier).toBeCloseTo(1.1);
  });

  it("既存のバフは引き続きスキルに適用される", () => {
    const buffSkill = makeSkill({
      id: "buff-only",
      type: "ogcd",
      potency: 0,
      recastTime: 0.65,
      buffApplications: ["power-buff"],
    });
    const attack1 = makeSkill({ id: "attack-1", potency: 100 });
    const attack2 = makeSkill({ id: "attack-2", potency: 100 });
    const skillMap = new Map([
      [buffSkill.id, buffSkill],
      [attack1.id, attack1],
      [attack2.id, attack2],
    ]);

    const result = resolveTimeline(
      [makeEntry("attack-1"), makeEntry("buff-only"), makeEntry("attack-2")],
      skillMap,
      [],
      undefined,
      [potencyBuff],
    );

    // バフ適用前: 倍率1.0
    expect(result.entries[0].buffMultiplier).toBe(1);
    // バフ適用後の攻撃: 倍率1.1
    expect(result.entries[2].buffMultiplier).toBeCloseTo(1.1);
  });
});
