import { describe, it, expect } from "vitest";
import { getBuffContributions } from "../buff-contribution";
import type { ActiveBuff, BuffDefinition } from "../../types/skill";

function makeBuff(overrides: Partial<BuffDefinition> & { id: string }): BuffDefinition {
  return {
    name: overrides.id,
    shortName: overrides.id,
    icon: "",
    duration: 30,
    effects: [],
    color: "#fff",
    ...overrides,
  };
}

function makeActiveBuff(buffId: string, stacks?: number): ActiveBuff {
  return { buffId, startTime: 0, endTime: 30, stacks };
}

describe("getBuffContributions", () => {
  it("potency / critRate / dhRate のいずれかに寄与するバフだけ返す", () => {
    const potencyOnly = makeBuff({ id: "potency-only", effects: [{ type: "potency", value: 1.1 }] });
    const speedOnly = makeBuff({ id: "speed-only", effects: [{ type: "speed", value: 0.85 }] });
    const noEffect = makeBuff({ id: "no-effect", effects: [] });
    const buffDefMap = new Map([
      [potencyOnly.id, potencyOnly],
      [speedOnly.id, speedOnly],
      [noEffect.id, noEffect],
    ]);
    const activeBuffs = [makeActiveBuff("potency-only"), makeActiveBuff("speed-only"), makeActiveBuff("no-effect")];

    const result = getBuffContributions(activeBuffs, buffDefMap, "any-skill");

    expect(result).toHaveLength(1);
    expect(result[0].buffId).toBe("potency-only");
    expect(result[0].potencyMultiplier).toBeCloseTo(1.1);
  });

  it("potency effect の appliesToSkillIds が targetSkillId を含まない場合は除外する", () => {
    const af3 = makeBuff({
      id: "af3",
      effects: [
        { type: "potency", value: 1.8, appliesToSkillIds: ["fire-skill"] },
      ],
    });
    const buffDefMap = new Map([[af3.id, af3]]);
    const activeBuffs = [makeActiveBuff("af3")];

    const onFire = getBuffContributions(activeBuffs, buffDefMap, "fire-skill");
    expect(onFire).toHaveLength(1);
    expect(onFire[0].potencyMultiplier).toBeCloseTo(1.8);

    const onBlizzard = getBuffContributions(activeBuffs, buffDefMap, "blizzard-skill");
    expect(onBlizzard).toHaveLength(0);
  });

  it("critRate と dhRate を加算合計として抽出する", () => {
    const battleLitany = makeBuff({
      id: "battle-litany",
      effects: [{ type: "critRate", value: 0.1 }],
    });
    const battleVoice = makeBuff({
      id: "battle-voice",
      effects: [{ type: "dhRate", value: 0.2 }],
    });
    const buffDefMap = new Map([
      [battleLitany.id, battleLitany],
      [battleVoice.id, battleVoice],
    ]);
    const result = getBuffContributions(
      [makeActiveBuff("battle-litany"), makeActiveBuff("battle-voice")],
      buffDefMap,
      "any-skill"
    );

    expect(result).toHaveLength(2);
    const crit = result.find((c) => c.buffId === "battle-litany")!;
    expect(crit.critRateBonus).toBeCloseTo(0.1);
    expect(crit.dhRateBonus).toBeUndefined();
    const dh = result.find((c) => c.buffId === "battle-voice")!;
    expect(dh.dhRateBonus).toBeCloseTo(0.2);
    expect(dh.critRateBonus).toBeUndefined();
  });

  it("guaranteedCrit / guaranteedDh は値が無くてもリストに残す", () => {
    const reassemble = makeBuff({
      id: "reassemble",
      effects: [{ type: "guaranteedCrit", value: 0 }, { type: "guaranteedDh", value: 0 }],
    });
    const buffDefMap = new Map([[reassemble.id, reassemble]]);
    const result = getBuffContributions([makeActiveBuff("reassemble")], buffDefMap, "any-skill");

    expect(result).toHaveLength(1);
    expect(result[0].guaranteedCrit).toBe(true);
    expect(result[0].guaranteedDh).toBe(true);
    expect(result[0].potencyMultiplier).toBeUndefined();
  });

  it("複数の potency effect は積として合成される", () => {
    const multiBuff = makeBuff({
      id: "multi",
      effects: [
        { type: "potency", value: 1.1 },
        { type: "potency", value: 1.2 },
      ],
    });
    const buffDefMap = new Map([[multiBuff.id, multiBuff]]);
    const result = getBuffContributions([makeActiveBuff("multi")], buffDefMap, "any-skill");

    expect(result).toHaveLength(1);
    expect(result[0].potencyMultiplier).toBeCloseTo(1.32);
  });

  it("buffDefMap に存在しない buffId は無視する", () => {
    const result = getBuffContributions([makeActiveBuff("unknown")], new Map(), "any-skill");
    expect(result).toHaveLength(0);
  });

  it("ActiveBuff の stacks をそのまま引き継ぐ", () => {
    const stackedBuff = makeBuff({
      id: "stacked",
      maxStacks: 3,
      effects: [{ type: "potency", value: 1.05 }],
    });
    const buffDefMap = new Map([[stackedBuff.id, stackedBuff]]);
    const result = getBuffContributions([makeActiveBuff("stacked", 2)], buffDefMap, "any-skill");
    expect(result[0].stacks).toBe(2);
  });
});
