import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel } from "../skill-level";
import type { PlayerLevel, Skill, TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

// 公式ジョブガイド（Patch 7.5、PvE 欄）との照合結果（Issue #407）

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function skillsForLevel(level: PlayerLevel): Skill[] {
  const buffIds = new Set(getBuffsForLevel(BLM_BUFFS, level).map((b) => b.id));
  const resourceIds = new Set(getResourcesForLevel(BLM_RESOURCES, level).map((r) => r.id));
  return getSkillsForLevel(BLM_ATTACK_SKILLS, level, buffIds, resourceIds);
}

describe("BLM: ジョブガイド準拠のスキルデータ", () => {
  it.each<[string, keyof Skill, number]>([
    ["fire-2", "potency", 80],
    ["high-fire-2", "potency", 100],
    ["high-fire-2", "acquiredLevel", 82],
    ["blizzard-2", "potency", 80],
    ["high-blizzard-2", "potency", 100],
    ["high-blizzard-2", "acquiredLevel", 82],
    ["blizzard-4", "potency", 300],
    ["high-thunder", "potency", 150],
    ["high-thunder", "dotPotency", 60],
    ["high-thunder", "dotDuration", 30],
    ["thunder-3", "dotDuration", 27],
    ["high-thunder-2", "acquiredLevel", 92],
    ["high-thunder-2", "dotDuration", 24],
    ["thunder-4", "dotPotency", 35],
    ["thunder-4", "dotDuration", 21],
    ["ley-lines", "maxCharges", 2],
  ])("%s の %s は %d", (skillId, field, expected) => {
    expect(skillMap.get(skillId)![field]).toBe(expected);
  });

  it("ファイアスターター（ファイガ効果アップ）の習得レベルは 42", () => {
    expect(BLM_BUFFS.find((b) => b.id === "firestarter")!.acquiredLevel).toBe(42);
  });

  it("Lv80 ではファイラ・ブリザラ、Lv90 ではハイファイラ・ハイブリザラとサンダジャがパレットに出る", () => {
    const lv80 = skillsForLevel(80).map((s) => s.id);
    expect(lv80).toEqual(expect.arrayContaining(["fire-2", "blizzard-2"]));
    expect(lv80).not.toContain("high-fire-2");
    expect(lv80).not.toContain("high-blizzard-2");

    const lv90 = skillsForLevel(90).map((s) => s.id);
    expect(lv90).toEqual(expect.arrayContaining(["high-fire-2", "high-blizzard-2", "thunder-4"]));
    expect(lv90).not.toContain("high-thunder-2");

    expect(skillsForLevel(100).map((s) => s.id)).toContain("high-thunder-2");
  });

  it("迅速魔のリキャストは Lv94 のロール特性で 40 秒になる（Lv90 は 60 秒）", () => {
    expect(skillsForLevel(90).find((s) => s.id === "swiftcast")!.cooldown).toBe(60);
    expect(skillsForLevel(100).find((s) => s.id === "swiftcast")!.cooldown).toBe(40);
  });
});

describe("BLM: ジョブガイド準拠の計算結果", () => {
  it.each<[string, number, number]>([
    ["high-thunder", 10, 60],
    ["thunder-3", 9, 50],
    ["high-thunder-2", 8, 40],
    ["thunder-4", 7, 35],
  ])("%s の DoT は %d ティック、ティック威力は基本 %d にエノキアン倍率を掛けた値", (skillId, ticks, dotPotency) => {
    const result = resolveTimeline(
      [entry("fire-3"), entry(skillId)],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    const thunder = result.entries[1];
    expect(thunder.comboErrors).toEqual([]);
    const ticksOfSkill = result.dotTicks.filter((t) => t.skillId === skillId);
    expect(ticksOfSkill).toHaveLength(ticks);
    expect(ticksOfSkill[0].potency).toBe(Math.floor(dotPotency * thunder.buffMultiplier));
  });

  it("黒魔紋は 2 チャージあり、連続使用してもリキャストエラーにならない", () => {
    const result = resolveTimeline(
      [entry("ley-lines"), entry("ley-lines")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    expect(result.entries.map((e) => e.recastError)).toEqual([false, false]);
  });

  it("パラドックスは AF 中に撃つとファイアスターターを付与する", () => {
    // ファイガで AF3 → マナフォント（AF 中のみ。#519）でパラドックスゲージ 1
    const result = resolveTimeline(
      [entry("fire-3"), entry("manafont"), entry("paradox")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    const paradox = result.entries[2];
    expect(paradox.resourceErrors).toEqual([]);
    expect(paradox.activeBuffs.some((ab) => ab.buffId === "firestarter")).toBe(true);
  });

  it("パラドックスは UB 中に撃ってもファイアスターターを付与しない", () => {
    // ファイガで AF3 → マナフォントでパラドックスゲージ 1 → ブリザガで UB3 へ切替
    const result = resolveTimeline(
      [entry("fire-3"), entry("manafont"), entry("blizzard-3"), entry("paradox")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    const paradox = result.entries[3];
    expect(paradox.resourceErrors).toEqual([]);
    expect(paradox.activeBuffs.some((ab) => ab.buffId === "umbral-ice-3")).toBe(true);
    expect(paradox.activeBuffs.some((ab) => ab.buffId === "firestarter")).toBe(false);
  });
});
