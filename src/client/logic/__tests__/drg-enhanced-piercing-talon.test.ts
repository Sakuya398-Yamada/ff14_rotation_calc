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

const enhancedPiercingTalon: BuffDefinition = {
  id: "enhanced-piercing-talon",
  name: "エンハンスドピアシングタロン",
  shortName: "PT強化",
  icon: "",
  duration: 15,
  effects: [],
  color: "#00bcd4",
  maxStacks: 1,
};

describe("イルーシブジャンプ → ピアシングタロン威力上昇", () => {
  it("バフ未付与時は通常威力（200）で実行される", () => {
    const piercingTalon = makeSkill({
      id: "piercing-talon",
      potency: 200,
      conditionalPotencyBuffs: [{ buffId: "enhanced-piercing-talon", potency: 350 }],
    });
    const skillMap = new Map([[piercingTalon.id, piercingTalon]]);

    const result = resolveTimeline(
      [makeEntry("piercing-talon")],
      skillMap,
      [],
      undefined,
      [enhancedPiercingTalon],
    );

    expect(result.entries[0].comboErrors).toHaveLength(0);
    expect(result.entries[0].resolvedPotency).toBe(200);
  });

  it("イルーシブジャンプ後のピアシングタロンは威力350になる", () => {
    const elusiveJump = makeSkill({
      id: "elusive-jump",
      potency: 0,
      type: "ogcd",
      target: "self",
      cooldown: 30,
      buffApplications: ["enhanced-piercing-talon"],
    });
    const piercingTalon = makeSkill({
      id: "piercing-talon",
      potency: 200,
      conditionalPotencyBuffs: [{ buffId: "enhanced-piercing-talon", potency: 350 }],
    });
    const skillMap = new Map([
      [elusiveJump.id, elusiveJump],
      [piercingTalon.id, piercingTalon],
    ]);

    const result = resolveTimeline(
      [makeEntry("elusive-jump"), makeEntry("piercing-talon")],
      skillMap,
      [],
      undefined,
      [enhancedPiercingTalon],
    );

    expect(result.entries[0].comboErrors).toHaveLength(0);
    expect(result.entries[1].comboErrors).toHaveLength(0);
    expect(result.entries[1].resolvedPotency).toBe(350);
  });

  it("バフ消費後のピアシングタロンは再び通常威力に戻る", () => {
    const elusiveJump = makeSkill({
      id: "elusive-jump",
      potency: 0,
      type: "ogcd",
      target: "self",
      cooldown: 30,
      buffApplications: ["enhanced-piercing-talon"],
    });
    const piercingTalon = makeSkill({
      id: "piercing-talon",
      potency: 200,
      conditionalPotencyBuffs: [{ buffId: "enhanced-piercing-talon", potency: 350 }],
    });
    const skillMap = new Map([
      [elusiveJump.id, elusiveJump],
      [piercingTalon.id, piercingTalon],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("elusive-jump"),
        makeEntry("piercing-talon"),
        makeEntry("piercing-talon"),
      ],
      skillMap,
      [],
      undefined,
      [enhancedPiercingTalon],
    );

    // 1発目は威力350（バフ消費）
    expect(result.entries[1].resolvedPotency).toBe(350);
    // 2発目は通常威力200（バフ無し）
    expect(result.entries[2].resolvedPotency).toBe(200);
  });

  it("バフ効果時間（15秒）経過後は威力が元に戻る", () => {
    const elusiveJump = makeSkill({
      id: "elusive-jump",
      potency: 0,
      type: "ogcd",
      target: "self",
      cooldown: 30,
      buffApplications: ["enhanced-piercing-talon"],
    });
    // 威力0・長いGCDで時間経過をシミュレート
    const filler = makeSkill({
      id: "filler",
      potency: 0,
      recastTime: 10,
    });
    const piercingTalon = makeSkill({
      id: "piercing-talon",
      potency: 200,
      conditionalPotencyBuffs: [{ buffId: "enhanced-piercing-talon", potency: 350 }],
    });
    const skillMap = new Map([
      [elusiveJump.id, elusiveJump],
      [filler.id, filler],
      [piercingTalon.id, piercingTalon],
    ]);

    // filler を2つ挟む → GCD20秒経過 → バフ切れ
    const result = resolveTimeline(
      [
        makeEntry("elusive-jump"),
        makeEntry("filler"),
        makeEntry("filler"),
        makeEntry("piercing-talon"),
      ],
      skillMap,
      [],
      undefined,
      [enhancedPiercingTalon],
    );

    expect(result.entries[3].resolvedPotency).toBe(200);
  });
});
