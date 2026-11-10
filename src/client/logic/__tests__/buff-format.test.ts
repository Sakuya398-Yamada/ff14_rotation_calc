import { describe, it, expect, beforeEach, afterEach } from "vitest";
import i18next from "i18next";
import {
  describeBuffEffects,
  formatBuffRemaining,
  formatConsumedProc,
  formatProcRate,
  formatProcRateShort,
  formatWastedProc,
  isProcOutcomeSource,
} from "../buff-format";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../skill-level";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import type { BuffDefinition, PlayerLevel } from "../../types/skill";

function makeBuff(effects: BuffDefinition["effects"]): BuffDefinition {
  return { id: "b", icon: "", duration: 10, effects, color: "#ffffff" };
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

  it("威力に足すバフは「威力+N」にする（#958）", () => {
    expect(describeBuffEffects(makeBuff([{ type: "potencyAdd", value: 20, appliesToSkillIds: ["blazing-shot"] }]))).toEqual([
      "威力+20（一部スキル）",
    ]);
  });

  it("対象スキル限定の威力バフは「一部スキル」と添える", () => {
    expect(describeBuffEffects(makeBuff([{ type: "potency", value: 1.8, appliesToSkillIds: ["fire"] }]))).toEqual([
      "威力×1.80（一部スキル）",
    ]);
  });

  it("威力以外の効果も対象スキル限定なら「一部スキル」と添える", () => {
    expect(describeBuffEffects(makeBuff([{ type: "instantCast", value: 0, appliesToSkillIds: ["fire-3"] }]))).toEqual([
      "即時詠唱（一部スキル）",
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

describe("formatProcRate", () => {
  it.each([
    [0.35, "35.0%"],
    [0.2, "20.0%"],
    // 1 − 0.65² は 0.5774999999999999 になるが、57.7 にしない (#615)
    [1 - 0.65 ** 2, "57.8%"],
    [1 - 0.8 * 0.65, "48.0%"],
  ])("%s を小数第1位までの %s にする", (rate, expected) => {
    expect(formatProcRate(rate)).toBe(expected);
  });
});

describe("formatProcRateShort", () => {
  it.each([
    [0.35, "35%"],
    [0.4, "40%"],
    [1 - 0.65 ** 2, "58%"],
    // 0.575 * 100 は 57.49999999999999 になるが、57 にしない
    [0.575, "58%"],
  ])("%s を整数の %s にする", (rate, expected) => {
    expect(formatProcRateShort(rate)).toBe(expected);
  });
});

describe("formatConsumedProc", () => {
  it("バフ名を引いて「<バフ名>発動確率 xx.x%」にする", () => {
    expect(formatConsumedProc({ buffId: "hawks-eye", procRate: 0.35 }, "brd")).toBe("ホークアイ発動確率 35.0%");
  });

  it("辞書に無いバフは buffId を名前の代わりに使う", () => {
    expect(formatConsumedProc({ buffId: "b", procRate: 0.35 }, "brd")).toBe("b発動確率 35.0%");
  });

  // 出なかった分岐で撃つ GCD を添えて、フィラー枠であることを示す (#842)
  it("fallback のスキルがあれば、名前を引いて「（不発時は<スキル名>）」を添える", () => {
    expect(formatConsumedProc({ buffId: "hawks-eye", procRate: 0.5775, fallbackSkillId: "burst-shot" }, "brd")).toBe(
      "ホークアイ発動確率 57.8%（不発時はバーストショット）",
    );
  });
});

describe("formatWastedProc", () => {
  it("バフ名を引いて「<バフ名>上書き確率 xx.x%」にする", () => {
    // 0.35 × 0.35 = 0.12249999999999998 を 12.2 にしない
    expect(formatWastedProc({ buffId: "hawks-eye", rate: 0.35 * 0.35 }, "brd")).toBe("ホークアイ上書き確率 12.3%");
  });
});

// 付与元かはレベル調整後のスキルで決まる。バイト系のホークアイ付与は Lv76 の特性から (#426 / #838)
describe("isProcOutcomeSource", () => {
  function brdSkillAt(level: PlayerLevel, skillId: string) {
    const buffIds = new Set(BRD_BUFFS.map((b) => b.id));
    const resourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
    const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, level, buffIds, resourceIds);
    return getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, level, buffIds, resourceIds).get(skillId)!;
  }

  it.each([
    [100, "iron-jaws", true],
    [70, "iron-jaws", false],
    [70, "heavy-shot", true],
    [100, "refulgent-arrow", false],
  ] as const)("Lv%i の %s は %s", (level, skillId, expected) => {
    expect(isProcOutcomeSource(brdSkillAt(level, skillId))).toBe(expected);
  });

  it("確率 1 の付与は確定なので付与元に数えない", () => {
    const skill = { ...brdSkillAt(100, "burst-shot"), buffApplicationProcRates: { "hawks-eye": 1 } };
    expect(isProcOutcomeSource(skill)).toBe(false);
  });
});

describe("buff-format（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("効果の要約と、発動確率・上書き確率の文を英語で出す", () => {

    expect(
      describeBuffEffects(
        makeBuff([
          { type: "potency", value: 1.1 },
          { type: "guaranteedCrit", value: 1 },
          { type: "instantCast", value: 0, appliesToSkillIds: ["fire-3"] },
          { type: "potencyAdd", value: 20 },
        ])
      )
    ).toEqual(["Potency ×1.10", "Guaranteed critical hit", "Instant cast (some actions)", "Potency +20"]);
    expect(formatConsumedProc({ buffId: "hawks-eye", procRate: 0.35, fallbackSkillId: "burst-shot" }, "brd")).toBe(
      "Hawk's Eye proc chance 35.0% (Burst Shot if it doesn't proc)",
    );
    expect(formatWastedProc({ buffId: "hawks-eye", rate: 0.35 * 0.35 }, "brd")).toBe("Hawk's Eye overwrite chance 12.3%");
  });
});
