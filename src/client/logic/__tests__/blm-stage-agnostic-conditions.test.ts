import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

type ResolvedEntry = ReturnType<typeof resolveTimeline>["entries"][number];

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(skillIds: string[]) {
  return resolveTimeline(skillIds.map(entry), skillMap, BLM_RESOURCES, undefined, BLM_BUFFS);
}

function hasBuff(e: ResolvedEntry, buffId: string): boolean {
  return e.activeBuffs.some((ab) => ab.buffId === buffId);
}

// エラーで倍率が 1 に倒れているだけのケースを弾く（testing-conventions 罠3）
function expectNoErrors(e: ResolvedEntry) {
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
  expect(e.recastError).toBeFalsy();
}

const ENOCHIAN = 1.27;

// AF1: blizzard → transpose（UB1 → AF1）。AF2: fire → fire（AF1 → AF2 へ段階進行）
const AF_STAGES = [
  { label: "AF1", setup: ["blizzard", "transpose"], buffId: "astral-fire-1", fireMul: 1.4 },
  { label: "AF2", setup: ["fire", "fire"], buffId: "astral-fire-2", fireMul: 1.6 },
];

// UB1: blizzard。UB2: blizzard → blizzard（UB1 → UB2 へ段階進行）
const UB_STAGES = [
  { label: "UB1", setup: ["blizzard"], buffId: "umbral-ice-1" },
  { label: "UB2", setup: ["blizzard", "blizzard"], buffId: "umbral-ice-2" },
];

describe("BLM: AF/UB 段階不問の発動条件（#417）", () => {
  describe("ファイジャ", () => {
    it.each(AF_STAGES)("$label 中でも使用でき、AF の段階を変えない", ({ setup, buffId, fireMul }) => {
      const result = resolve([...setup, "fire-4"]);
      expect(hasBuff(result.entries[setup.length - 1], buffId)).toBe(true);

      const fire4 = result.entries[setup.length];
      expectNoErrors(fire4);
      expect(fire4.buffMultiplier).toBeCloseTo(fireMul * ENOCHIAN, 5);
      expect(hasBuff(fire4, buffId)).toBe(true);
      expect(hasBuff(fire4, "astral-fire-3")).toBe(false);
    });
  });

  describe("デスペア", () => {
    it.each(AF_STAGES)("$label 中でも使用でき、MP を全消費して AF3 へ引き上げる", ({ setup, buffId }) => {
      const result = resolve([...setup, "despair"]);

      const despair = result.entries[setup.length];
      expectNoErrors(despair);
      expect(despair.resourceSnapshot["mp"]).toBe(0);
      expect(hasBuff(despair, "astral-fire-3")).toBe(true);
      expect(hasBuff(despair, buffId)).toBe(false);
    });
  });

  describe("ブリザジャ", () => {
    it.each(UB_STAGES)("$label 中でも使用でき、UB の段階を変えない", ({ setup, buffId }) => {
      const result = resolve([...setup, "blizzard-4"]);
      expect(hasBuff(result.entries[setup.length - 1], buffId)).toBe(true);

      const blizzard4 = result.entries[setup.length];
      expectNoErrors(blizzard4);
      // ブリザド系は UB でブースト対象外なのでエノキアン倍率のみ
      expect(blizzard4.buffMultiplier).toBeCloseTo(ENOCHIAN, 5);
      expect(hasBuff(blizzard4, buffId)).toBe(true);
      expect(hasBuff(blizzard4, "umbral-ice-3")).toBe(false);
    });
  });

  describe("フリーズ", () => {
    it.each(UB_STAGES)("$label 中でも使用でき、UB の段階を変えない", ({ setup, buffId }) => {
      const result = resolve([...setup, "freeze"]);
      expect(hasBuff(result.entries[setup.length - 1], buffId)).toBe(true);

      const freeze = result.entries[setup.length];
      expectNoErrors(freeze);
      expect(freeze.buffMultiplier).toBeCloseTo(ENOCHIAN, 5);
      expect(hasBuff(freeze, buffId)).toBe(true);
      expect(hasBuff(freeze, "umbral-ice-3")).toBe(false);
    });

    it.each([
      { label: "無極性", setup: [] as string[] },
      { label: "AF3 中", setup: ["fire-3"] },
    ])("$label では発動条件エラーになり威力を計上しない", ({ setup }) => {
      const result = resolve([...setup, "freeze"]);

      const freeze = result.entries[setup.length];
      expect(freeze.comboErrors.length).toBeGreaterThan(0);
      expect(freeze.buffMultiplier).toBe(1);
    });
  });
});

describe("BLM: アンプリファイアの発動条件（#454）", () => {
  // AF3: fire-3（無極性 → AF3）。UB3: blizzard-3（無極性 → UB3）
  const POLARITY_STAGES = [
    ...AF_STAGES,
    { label: "AF3", setup: ["fire-3"], buffId: "astral-fire-3" },
    ...UB_STAGES,
    { label: "UB3", setup: ["blizzard-3"], buffId: "umbral-ice-3" },
  ];

  it.each(POLARITY_STAGES)("$label 中は使用でき、ポリグロットが +1 される", ({ setup, buffId }) => {
    const result = resolve([...setup, "amplifier"]);
    const before = result.entries[setup.length - 1];
    expect(hasBuff(before, buffId)).toBe(true);

    const amplifier = result.entries[setup.length];
    expectNoErrors(amplifier);
    expect(amplifier.resourceSnapshot["polyglot"]).toBe(before.resourceSnapshot["polyglot"] + 1);
  });

  it("無極性では発動条件エラーになり、ポリグロットが増えない", () => {
    const result = resolve(["amplifier"]);

    const amplifier = result.entries[0];
    expect(amplifier.comboErrors.length).toBeGreaterThan(0);
    expect(amplifier.resourceSnapshot["polyglot"]).toBe(0);
  });
});
