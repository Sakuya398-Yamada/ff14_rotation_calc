import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

const skillMap = new Map(BRD_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

describe("BRD: ホークアイ proc 確率の期待値反映 (#118) と乱れ撃ち (#110)", () => {
  it("スキル定義: リフルジェントアローは barrage 優先 → hawks-eye (procRate 0.35)", () => {
    const refulgent = skillMap.get("refulgent-arrow");
    expect(refulgent).toBeDefined();
    expect(refulgent!.potency).toBe(280);
    expect(refulgent!.buffConsumptionAnyOf).toEqual([
      { buffId: "barrage", stacks: 1, potency: 840 },
      { buffId: "hawks-eye", stacks: 1, procRate: 0.35, fallbackPotency: 220 },
    ]);
  });

  it("バーストショットでホークアイが付与される", () => {
    const result = resolve([entry("burst-shot")]);
    expect(result.entries[0].activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(
      true,
    );
  });

  it("ホークアイ消費時のリフルジェントアローは期待値威力 241 になる", () => {
    const result = resolve([entry("burst-shot"), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    // floor(220 + (280 - 220) * 0.35) = 241
    expect(refulgent.resolvedPotency).toBe(241);
  });

  it("消費されたホークアイは後続エントリに残らない", () => {
    const result = resolve([
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    // 2発目のリフルジェントアローはホークアイ枯渇でエラーになる
    const second = result.entries[2];
    expect(second.activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(false);
    expect(second.comboErrors.length).toBeGreaterThan(0);
  });

  it("ホークアイなし・乱れ撃ちなしではリフルジェントアローは使用できない", () => {
    const result = resolve([entry("refulgent-arrow")]);

    // buffConsumptionAnyOf 不成立時は先頭候補（barrage）の buffId がエラーとして記録される
    expect(result.entries[0].comboErrors).toContain("barrage");
  });

  it("乱れ撃ち中はホークアイ不要で使用でき、威力 840 固定（proc 期待値は適用されない）", () => {
    const result = resolve([entry("barrage"), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(840);
  });

  it("乱れ撃ちとホークアイが両方有効なら乱れ撃ちを優先消費し、ホークアイは残る", () => {
    const result = resolve([
      entry("barrage"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    // 1発目: barrage 消費で 840
    expect(result.entries[2].resolvedPotency).toBe(840);
    // 2発目: 残っていたホークアイを消費して期待値 241
    const second = result.entries[3];
    expect(second.comboErrors).toEqual([]);
    expect(second.resolvedPotency).toBe(241);
  });

  it.each([
    // floor(fallback + (potency - fallback) * 0.35)
    ["straight-shot", 174], // floor(160 + (200 - 160) * 0.35)
    ["shadowbite", 161], // floor(140 + (200 - 140) * 0.35)
  ])("%s もホークアイ消費で proc 期待値威力 %i になる", (skillId, expected) => {
    const result = resolve([entry("heavy-shot"), entry(skillId)]);

    const e = result.entries[1];
    expect(e.comboErrors).toEqual([]);
    expect(e.resolvedPotency).toBe(expected);
  });
});
