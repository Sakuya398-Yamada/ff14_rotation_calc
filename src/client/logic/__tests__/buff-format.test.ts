import { describe, it, expect, beforeEach, afterEach } from "vitest";
import i18next from "i18next";
import {
  describeBuffEffects,
  formatBuffRemaining,
  formatConsumedProc,
  formatConsumedResourceProc,
  formatProcRate,
  formatProcRateShort,
  formatWastedProc,
  getProcOutcomeName,
} from "../buff-format";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../skill-level";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import { DNC_ATTACK_SKILLS } from "../../data/dnc-skills";
import { DNC_BUFFS } from "../../data/dnc-buffs";
import { DNC_RESOURCES } from "../../data/dnc-resources";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";
import type { BuffDefinition, PlayerLevel, ResourceDefinition, Skill } from "../../types/skill";

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

describe("formatConsumedResourceProc", () => {
  it("リソース名を引いて「<リソース名>がある確率 xx.x%」にする (#1005)", () => {
    expect(formatConsumedResourceProc({ resourceId: "dnc-feather", procRate: 0.75 }, "dnc")).toBe("幻扇がある確率 75.0%");
  });
});

function skillMapAt(level: PlayerLevel, skills: Skill[], buffs: BuffDefinition[], resources: ResourceDefinition[]) {
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  return getAllSkillMapForLevel(skills, getSkillsForLevel(skills, level, buffIds, resourceIds), level, buffIds, resourceIds);
}

// 付与元かはレベル調整後のスキルで決まる。バイト系のホークアイ付与は Lv76 の特性から (#426 / #838)
describe("getProcOutcomeName", () => {
  const brdSkillAt = (level: PlayerLevel, skillId: string) =>
    skillMapAt(level, BRD_ATTACK_SKILLS, BRD_BUFFS, BRD_RESOURCES).get(skillId)!;
  const dncSkillMap = skillMapAt(100, DNC_ATTACK_SKILLS, DNC_BUFFS, DNC_RESOURCES);

  it.each([
    [100, "iron-jaws", "ホークアイ"],
    [70, "iron-jaws", undefined],
    [70, "heavy-shot", "ホークアイ"],
    [100, "refulgent-arrow", undefined],
  ] as const)("Lv%i の %s は %s", (level, skillId, expected) => {
    expect(getProcOutcomeName(brdSkillAt(level, skillId), "brd", true)).toBe(expected);
  });

  it("確率 1 の付与は確定なので付与元に数えない", () => {
    const skill = { ...brdSkillAt(100, "burst-shot"), buffApplicationProcRates: { "hawks-eye": 1 } };
    expect(getProcOutcomeName(skill, "brd", true)).toBeUndefined();
  });

  // 確率付与のバフと、確率で得るリソースのどちらかを持つ踊り子のスキルは、全部指定できる (#1005)
  const dncProcSkillIds = [...dncSkillMap.values()]
    .filter((skill) =>
      Object.values(skill.buffApplicationProcRates ?? {}).some((rate) => rate < 1) ||
      [...(skill.resourceChanges ?? []), ...(skill.comboResourceChanges ?? [])].some((c) => c.amount > 0 && c.procRate !== undefined),
    )
    .map((skill) => skill.id);

  it("踊り子の確率付与・フェザーのスキルを、データから 10 個洗い出せる", () => {
    expect(dncProcSkillIds.sort()).toEqual([
      "bladeshower", "bloodshower", "cascade", "fan-dance", "fan-dance-ii",
      "fountain", "fountainfall", "reverse-cascade", "rising-windmill", "windmill",
    ]);
  });

  it.each([
    ["cascade", "対称投擲"],
    ["windmill", "対称投擲"],
    ["fountain", "非対称投擲"],
    ["bladeshower", "非対称投擲"],
    ["fan-dance", "扇の舞い【急】実行可"],
    ["fan-dance-ii", "扇の舞い【急】実行可"],
    ["reverse-cascade", "幻扇"],
    ["fountainfall", "幻扇"],
    ["rising-windmill", "幻扇"],
    ["bloodshower", "幻扇"],
  ])("踊り子の %s は %s", (skillId, expected) => {
    expect(getProcOutcomeName(dncSkillMap.get(skillId)!, "dnc", true)).toBe(expected);
  });

  // コンボで付くバフ（comboBuffApplications）は、コンボが成立したときだけ付く
  it.each(["fountain", "bladeshower"])("コンボが切れた %s は付与元に数えない", (skillId) => {
    expect(getProcOutcomeName(dncSkillMap.get(skillId)!, "dnc", false)).toBeUndefined();
  });

  it("コンボで確率で得るリソース（comboResourceChanges）は、コンボが成立したときだけ数える", () => {
    const skill: Skill = {
      ...dncSkillMap.get("fountain")!,
      comboBuffApplications: undefined,
      comboResourceChanges: [{ resourceId: "dnc-feather", amount: 1, procRate: 0.5 }],
    };
    expect(getProcOutcomeName(skill, "dnc", true)).toBe("幻扇");
    expect(getProcOutcomeName(skill, "dnc", false)).toBeUndefined();
  });

  it("コンボに関係ない付与元は、コンボが切れていても数える", () => {
    expect(getProcOutcomeName(dncSkillMap.get("cascade")!, "dnc", false)).toBe("対称投擲");
  });

  // 黒魔道士のファイアスターターは対象外のまま (#838)
  it("ファイアのファイアスターターは付与元に数えない", () => {
    const fire = skillMapAt(100, BLM_ATTACK_SKILLS, BLM_BUFFS, BLM_RESOURCES).get("fire")!;
    expect(fire.buffApplicationProcRates?.firestarter).toBeLessThan(1);
    expect(getProcOutcomeName(fire, "blm", true)).toBeUndefined();
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
    expect(formatConsumedResourceProc({ resourceId: "dnc-feather", procRate: 0.75 }, "dnc")).toBe(
      "chance of having Fourfold Feathers 75.0%",
    );
  });
});
