import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { PlayerLevel, TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";

function resolveAtLevel(skillIds: string[], level: PlayerLevel) {
  const buffs = getBuffsForLevel(BRD_BUFFS, level);
  const resources = getResourcesForLevel(BRD_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const entries: TimelineEntry[] = skillIds.map((skillId, i) => ({ uid: `e${i}`, skillId }));
  return resolveTimeline(entries, skillMap, resources, undefined, buffs);
}

function consumerAfter(skillIds: string[], level: PlayerLevel) {
  const consumer = resolveAtLevel(skillIds, level).entries[skillIds.length - 1];
  expect(consumer.recastError).toBeFalsy();
  expect(consumer.comboErrors).toEqual([]);
  return consumer;
}

// fallback は proc しなかったときにそのレベルで代わりに撃つ GCD の威力 (#600)
// 公式ジョブガイド PvE 欄: ヘヴィショット 160 → バーストショット（Lv76）220、クイックノック 110 → ラドンバイト（Lv82）140
describe("BRD: ホークアイ期待値の基準はそのレベルで代わりに撃つ GCD (#600)", () => {
  it("Lv70 でヘヴィショット → リフルジェントアローはヘヴィショット基準の 184 になる", () => {
    // floor(160 + (280 - 160) * 0.2)
    expect(consumerAfter(["heavy-shot", "refulgent-arrow"], 70).resolvedPotency).toBe(184);
  });

  it.each([80, 90, 100] as const)("Lv%s でバーストショット → リフルジェントアローはバーストショット基準の 241 になる", (level) => {
    // floor(220 + (280 - 220) * 0.35)
    expect(consumerAfter(["burst-shot", "refulgent-arrow"], level).resolvedPotency).toBe(241);
  });

  it("Lv80 でクイックノック → シャドウバイトはクイックノック基準の 128 になる", () => {
    // floor(110 + (200 - 110) * 0.2)
    expect(consumerAfter(["quick-nock", "shadowbite"], 80).resolvedPotency).toBe(128);
  });

  it.each([90, 100] as const)("Lv%s でラドンバイト → シャドウバイトはラドンバイト基準の 161 になる", (level) => {
    // floor(140 + (200 - 140) * 0.35)
    expect(consumerAfter(["ladonsbite", "shadowbite"], level).resolvedPotency).toBe(161);
  });

  it.each([
    ["refulgent-arrow", 70, 840],
    ["refulgent-arrow", 100, 840],
    ["shadowbite", 80, 300],
    ["shadowbite", 100, 300],
  ] as const)("乱れ撃ち中の %s は Lv%s でも威力 %s のまま", (skillId, level, potency) => {
    expect(consumerAfter(["barrage", skillId], level).resolvedPotency).toBe(potency);
  });
});
