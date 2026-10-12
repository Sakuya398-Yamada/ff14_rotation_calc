import { describe, it, expect } from "vitest";
import { describeBuffEffects, formatBuffRemaining } from "../buff-format";
import type { BuffDefinition } from "../../types/skill";

function makeBuff(effects: BuffDefinition["effects"]): BuffDefinition {
  return { id: "b", name: "b", shortName: "b", icon: "", duration: 10, effects, color: "#ffffff" };
}

describe("describeBuffEffects", () => {
  it("威力・CRT・DH・速度・確定・即時詠唱を短い文言にする", () => {
    expect(
      describeBuffEffects(
        makeBuff([
          { type: "potency", value: 1.1 },
          { type: "critRate", value: 0.1 },
          { type: "dhRate", value: 0.2 },
          { type: "speed", value: 0.8 },
          { type: "guaranteedCrit", value: 1 },
          { type: "guaranteedDh", value: 1 },
          { type: "instantCast", value: 0 },
        ])
      )
    ).toEqual(["威力×1.10", "CRT+10%", "DH+20%", "GCD×0.8", "確定CRT", "確定DH", "即時詠唱"]);
  });

  it("対象スキル限定の威力バフは「一部スキル」と添える", () => {
    expect(describeBuffEffects(makeBuff([{ type: "potency", value: 1.8, appliesToSkillIds: ["fire"] }]))).toEqual([
      "威力×1.80（一部スキル）",
    ]);
  });

  it("内部挙動の種別は出さず、同じ文言は1つにまとめる", () => {
    expect(
      describeBuffEffects(
        makeBuff([
          { type: "consumeOnGcd", value: 0 },
          { type: "bypassCombo", value: 0 },
          { type: "instantCast", value: 0 },
          { type: "instantCast", value: 0 },
        ])
      )
    ).toEqual(["即時詠唱"]);
  });
});

describe("formatBuffRemaining", () => {
  it("使用時点からの残り秒数を小数1桁で返す", () => {
    expect(formatBuffRemaining({ buffId: "b", startTime: 0, endTime: 20 }, 7.25)).toBe("12.8s");
  });

  it("永続バフ（endTime が Infinity）は ∞", () => {
    expect(formatBuffRemaining({ buffId: "b", startTime: 0, endTime: Infinity }, 5)).toBe("∞");
  });

  it("負にはならない", () => {
    expect(formatBuffRemaining({ buffId: "b", startTime: 0, endTime: 3 }, 5)).toBe("0.0s");
  });
});
