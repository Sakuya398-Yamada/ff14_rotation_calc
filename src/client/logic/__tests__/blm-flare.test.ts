import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("BLM: フレア（#316）", () => {
  it("AF3 中のフレアは MP を全消費し、アストラルソウル +3 と AF3 を付与する", () => {
    const result = resolveTimeline(
      [entry("fire-3"), entry("flare")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const flare = result.entries[1];
    expect(flare.comboErrors).toEqual([]);
    expect(flare.resourceErrors).toEqual([]);
    // fire-3 で MP 10000 → 8000 に減った状態からの全消費
    expect(result.entries[0].resourceSnapshot["mp"]).toBe(8000);
    expect(flare.resourceSnapshot["mp"]).toBe(0);
    expect(flare.resourceSnapshot["astral-soul"]).toBe(3);
    // AF3 維持（ファイア系ブースト 1.8 × エノキアン 1.23）
    expect(flare.activeBuffs.some((ab) => ab.buffId === "astral-fire-3")).toBe(true);
    expect(flare.buffMultiplier).toBeCloseTo(1.8 * 1.23, 5);
  });

  it("トランス後の AF1 でも使用でき、AF3 へ引き上げる（requiredBuffAnyOf）", () => {
    const result = resolveTimeline(
      [entry("blizzard"), entry("transpose"), entry("flare")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    // transpose 後は AF1
    const afterTranspose = result.entries[1];
    expect(afterTranspose.activeBuffs.some((ab) => ab.buffId === "astral-fire-1")).toBe(true);

    const flare = result.entries[2];
    expect(flare.comboErrors).toEqual([]);
    // AF1 中の使用: ファイア系ブースト 1.4 × エノキアン 1.23
    expect(flare.buffMultiplier).toBeCloseTo(1.4 * 1.23, 5);
    // 使用後は最大スタック分の AF（AF3）へ引き上げ
    expect(flare.activeBuffs.some((ab) => ab.buffId === "astral-fire-3")).toBe(true);
    expect(flare.activeBuffs.some((ab) => ab.buffId === "astral-fire-1")).toBe(false);
  });

  it("AF 未付与ではエラーになり威力を計上しない", () => {
    const result = resolveTimeline(
      [entry("flare")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const flare = result.entries[0];
    expect(flare.comboErrors.length).toBeGreaterThan(0);
  });
});
