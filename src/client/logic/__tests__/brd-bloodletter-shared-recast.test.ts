import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel } from "../skill-level";
import type { PlayerLevel, TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

function skillMapForLevel(level: PlayerLevel) {
  const skills = getSkillsForLevel(
    BRD_ATTACK_SKILLS,
    level,
    new Set(BRD_BUFFS.map((b) => b.id)),
    new Set(BRD_RESOURCES.map((r) => r.id)),
  );
  return new Map(skills.map((s) => [s.id, s]));
}

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolveAt(level: PlayerLevel, skillIds: string[]) {
  return resolveTimeline(skillIds.map(entry), skillMapForLevel(level), BRD_RESOURCES, undefined, BRD_BUFFS);
}

describe("BRD: ブラッドレッター / レイン・オブ・デス / ハートブレイクショットの共有リキャスト (#409)", () => {
  it("スキル定義: 3 アビリティが同じ cooldownGroup で、cooldown が揃っている", () => {
    const ids = ["bloodletter", "rain-of-death", "heartbreak-shot"];
    const skills = ids.map((id) => BRD_ATTACK_SKILLS.find((s) => s.id === id)!);
    const groups = new Set(skills.map((s) => s.cooldownGroup));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeDefined();
    expect(new Set(skills.map((s) => s.cooldown))).toEqual(new Set([15]));
  });

  it.each([
    { level: 90 as PlayerLevel, ids: ["bloodletter", "rain-of-death"] },
    { level: 100 as PlayerLevel, ids: ["heartbreak-shot", "rain-of-death"] },
  ])("Lv$level: グループ内の最大チャージ数が 3 で揃っている", ({ level, ids }) => {
    const map = skillMapForLevel(level);
    for (const id of ids) {
      expect(map.get(id)?.maxCharges).toBe(3);
    }
  });

  it("Lv84 未満ではレイン・オブ・デスもブラッドレッターと同じく特性によるチャージ増加前の値になる", () => {
    const map = skillMapForLevel(80);
    expect(map.get("rain-of-death")).toBeDefined();
    expect(map.get("bloodletter")).toBeDefined();
    // maxCharges 未設定 = 1 チャージ
    expect(map.get("rain-of-death")!.maxCharges ?? 1).toBe(1);
    expect(map.get("bloodletter")!.maxCharges ?? 1).toBe(1);
  });

  it("Lv100: ハートブレイクショット 3 回でチャージを使い切ると、レイン・オブ・デスもリキャスト中になる", () => {
    const result = resolveAt(100, ["heartbreak-shot", "heartbreak-shot", "heartbreak-shot", "rain-of-death"]);
    expect(result.entries.slice(0, 3).every((e) => !e.recastError)).toBe(true);
    expect(result.entries[3].recastError).toBe(true);
  });

  it("Lv100: レイン・オブ・デスの使用でハートブレイクショットのチャージが減る", () => {
    const result = resolveAt(100, ["rain-of-death", "rain-of-death", "heartbreak-shot", "heartbreak-shot"]);
    expect(result.entries.slice(0, 3).every((e) => !e.recastError)).toBe(true);
    expect(result.entries[3].recastError).toBe(true);
  });

  it("Lv90: ブラッドレッターとレイン・オブ・デスがチャージを共有する", () => {
    const result = resolveAt(90, ["bloodletter", "rain-of-death", "bloodletter", "rain-of-death"]);
    expect(result.entries.slice(0, 3).every((e) => !e.recastError)).toBe(true);
    expect(result.entries[3].recastError).toBe(true);
  });
});
