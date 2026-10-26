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

function setupLevel(level: PlayerLevel) {
  const buffs = getBuffsForLevel(BRD_BUFFS, level);
  const resources = getResourcesForLevel(BRD_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  return { buffs, resources, skills, skillMap };
}

function resolveAtLevel(skillIds: string[], level: PlayerLevel) {
  const { buffs, resources, skillMap } = setupLevel(level);
  const entries: TimelineEntry[] = skillIds.map((skillId, i) => ({ uid: `e${i}`, skillId }));
  return resolveTimeline(entries, skillMap, resources, undefined, buffs);
}

// 公式ジョブガイド PvE 欄: ワイドボレー（Lv25）は特性「ワイドボレーマスタリー」（Lv72）でシャドウバイトに変化する (#513)
describe("BRD: ワイドボレー (#513)", () => {
  it("Lv70 のパレットにはワイドボレーがあり、シャドウバイトは無い", () => {
    const ids = setupLevel(70).skills.map((s) => s.id);

    expect(ids).toContain("wide-volley");
    expect(ids).not.toContain("shadowbite");
  });

  it.each([80, 90, 100] as const)("Lv%s のパレットではシャドウバイトに置き換わる", (level) => {
    const ids = setupLevel(level).skills.map((s) => s.id);

    expect(ids).toContain("shadowbite");
    expect(ids).not.toContain("wide-volley");
  });

  it("Lv70 でクイックノック → ワイドボレーはホークアイ期待値の威力 116 になる", () => {
    const wideVolley = resolveAtLevel(["quick-nock", "wide-volley"], 70).entries[1];

    expect(wideVolley.resolvedSkillId).toBe("wide-volley");
    expect(wideVolley.recastError).toBeFalsy();
    expect(wideVolley.comboErrors).toEqual([]);
    expect(wideVolley.resourceErrors).toEqual([]);
    // floor(110 + (140 - 110) * 0.2)
    expect(wideVolley.resolvedPotency).toBe(116);
  });

  it("Lv70 で乱れ撃ち中のワイドボレーは威力 220 になる", () => {
    const wideVolley = resolveAtLevel(["barrage", "wide-volley"], 70).entries[1];

    expect(wideVolley.recastError).toBeFalsy();
    expect(wideVolley.comboErrors).toEqual([]);
    expect(wideVolley.resolvedPotency).toBe(220);
  });

  it("ホークアイも乱れ撃ちも無ければワイドボレーは使用できない", () => {
    const wideVolley = resolveAtLevel(["wide-volley"], 70).entries[0];

    expect(wideVolley.comboErrors).toContainEqual({ buffId: "barrage", kind: "missing" });
  });
});
