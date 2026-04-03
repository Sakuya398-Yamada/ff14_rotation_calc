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

const drakesbaneReadyBuff: BuffDefinition = {
  id: "drakesbane-ready",
  name: "雲蒸竜変レディ",
  shortName: "雲蒸ﾚﾃﾞｨ",
  icon: "",
  duration: 15,
  effects: [{ type: "consumeOnGcd", value: 1 }],
  color: "#795548",
  maxStacks: 1,
};

const dragonsEyeBuff: BuffDefinition = {
  id: "dragons-eye",
  name: "竜眼",
  shortName: "竜眼",
  icon: "",
  duration: 30,
  effects: [{ type: "consumeOnGcd", value: 1 }],
  color: "#e91e63",
  maxStacks: 1,
};

const allBuffs = [drakesbaneReadyBuff, dragonsEyeBuff];

describe("竜騎士4段目→5段目コンボ（autoTransform）", () => {
  const trueThrust = makeSkill({ id: "true-thrust" });
  const vorpalThrust = makeSkill({
    id: "vorpal-thrust",
    comboFrom: ["true-thrust"],
  });
  const fullThrust = makeSkill({
    id: "full-thrust",
    comboFrom: ["vorpal-thrust"],
  });
  const fangAndClaw = makeSkill({
    id: "fang-and-claw",
    comboFrom: ["full-thrust"],
    comboBuffApplications: ["drakesbane-ready"],
    autoTransform: { buffId: "drakesbane-ready", skillId: "drakesbane" },
  });
  const drakesbane = makeSkill({
    id: "drakesbane",
    potency: 400,
    comboFrom: ["fang-and-claw", "wheeling-thrust"],
    comboBuffApplications: ["dragons-eye"],
  });

  const disembowel = makeSkill({
    id: "disembowel",
    comboFrom: ["true-thrust"],
  });
  const chaosThrust = makeSkill({
    id: "chaos-thrust",
    comboFrom: ["disembowel"],
  });
  const wheelingThrust = makeSkill({
    id: "wheeling-thrust",
    comboFrom: ["chaos-thrust"],
    comboBuffApplications: ["drakesbane-ready"],
    autoTransform: { buffId: "drakesbane-ready", skillId: "drakesbane" },
  });

  const skillMap = new Map([
    [trueThrust.id, trueThrust],
    [vorpalThrust.id, vorpalThrust],
    [fullThrust.id, fullThrust],
    [fangAndClaw.id, fangAndClaw],
    [drakesbane.id, drakesbane],
    [disembowel.id, disembowel],
    [chaosThrust.id, chaosThrust],
    [wheelingThrust.id, wheelingThrust],
  ]);

  it("ルート1: 竜牙竜爪の次に竜牙竜爪を配置すると雲蒸竜変に自動変化する", () => {
    const entries = [
      makeEntry("true-thrust"),
      makeEntry("vorpal-thrust"),
      makeEntry("full-thrust"),
      makeEntry("fang-and-claw"),  // 4段目
      makeEntry("fang-and-claw"),  // 5段目 → autoTransformで雲蒸竜変に
    ];

    const result = resolveTimeline(entries, skillMap, [], undefined, allBuffs);

    // 4段目: 竜牙竜爪として実行
    expect(result.entries[3].resolvedSkillId).toBe("fang-and-claw");
    expect(result.entries[3].wsComboError).toBe(false);
    // 5段目: 雲蒸竜変に自動変化
    expect(result.entries[4].resolvedSkillId).toBe("drakesbane");
    expect(result.entries[4].wsComboError).toBe(false);
  });

  it("ルート2: 竜尾大車輪の次に竜尾大車輪を配置すると雲蒸竜変に自動変化する", () => {
    const entries = [
      makeEntry("true-thrust"),
      makeEntry("disembowel"),
      makeEntry("chaos-thrust"),
      makeEntry("wheeling-thrust"),  // 4段目
      makeEntry("wheeling-thrust"),  // 5段目 → autoTransformで雲蒸竜変に
    ];

    const result = resolveTimeline(entries, skillMap, [], undefined, allBuffs);

    expect(result.entries[3].resolvedSkillId).toBe("wheeling-thrust");
    expect(result.entries[3].wsComboError).toBe(false);
    expect(result.entries[4].resolvedSkillId).toBe("drakesbane");
    expect(result.entries[4].wsComboError).toBe(false);
  });

  it("ルート1: 竜牙竜爪の後に竜尾大車輪を配置すると雲蒸竜変に自動変化する", () => {
    const entries = [
      makeEntry("true-thrust"),
      makeEntry("vorpal-thrust"),
      makeEntry("full-thrust"),
      makeEntry("fang-and-claw"),      // 4段目 → drakesbane-ready付与
      makeEntry("wheeling-thrust"),    // 5段目 → autoTransformで雲蒸竜変に
    ];

    const result = resolveTimeline(entries, skillMap, [], undefined, allBuffs);

    expect(result.entries[3].resolvedSkillId).toBe("fang-and-claw");
    expect(result.entries[3].wsComboError).toBe(false);
    expect(result.entries[4].resolvedSkillId).toBe("drakesbane");
    expect(result.entries[4].wsComboError).toBe(false);
  });

  it("ルート2: 竜尾大車輪の後に竜牙竜爪を配置すると雲蒸竜変に自動変化する", () => {
    const entries = [
      makeEntry("true-thrust"),
      makeEntry("disembowel"),
      makeEntry("chaos-thrust"),
      makeEntry("wheeling-thrust"),    // 4段目 → drakesbane-ready付与
      makeEntry("fang-and-claw"),      // 5段目 → autoTransformで雲蒸竜変に
    ];

    const result = resolveTimeline(entries, skillMap, [], undefined, allBuffs);

    expect(result.entries[3].resolvedSkillId).toBe("wheeling-thrust");
    expect(result.entries[3].wsComboError).toBe(false);
    expect(result.entries[4].resolvedSkillId).toBe("drakesbane");
    expect(result.entries[4].wsComboError).toBe(false);
  });

  it("コンボ不成立時は雲蒸竜変レディが付与されずautoTransformしない", () => {
    // 竜牙竜爪を非コンボで使用
    const entries = [
      makeEntry("fang-and-claw"),  // 非コンボ（trueThrust等の前提なし）
      makeEntry("fang-and-claw"),  // autoTransformしない（バフ未付与）
    ];

    const result = resolveTimeline(entries, skillMap, [], undefined, allBuffs);

    // 1回目: 竜牙竜爪（非コンボ）
    expect(result.entries[0].resolvedSkillId).toBe("fang-and-claw");
    expect(result.entries[0].wsComboError).toBe(true);
    // 2回目: バフ未付与のためautoTransformせず竜牙竜爪のまま
    expect(result.entries[1].resolvedSkillId).toBe("fang-and-claw");
  });

  it("雲蒸竜変レディはconsumeOnGcdで次のGCD使用時に消費される", () => {
    const entries = [
      makeEntry("true-thrust"),
      makeEntry("vorpal-thrust"),
      makeEntry("full-thrust"),
      makeEntry("fang-and-claw"),   // 4段目 → drakesbane-ready付与
      makeEntry("fang-and-claw"),   // 5段目 → drakesbane（autoTransform）→ drakesbane-ready消費
      makeEntry("fang-and-claw"),   // 6回目 → drakesbane-ready消費済み → 竜牙竜爪のまま
    ];

    const result = resolveTimeline(entries, skillMap, [], undefined, allBuffs);

    expect(result.entries[4].resolvedSkillId).toBe("drakesbane");
    // 6回目: バフ消費済みのためautoTransformしない
    expect(result.entries[5].resolvedSkillId).toBe("fang-and-claw");
  });
});
