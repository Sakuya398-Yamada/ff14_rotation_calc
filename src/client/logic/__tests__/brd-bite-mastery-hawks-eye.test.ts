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

// 特性「バイトマスタリー II」（Lv76）でストームバイト・コースティックバイト・アイアンジョーがホークアイを付与する (#426)
const BITE_MASTERY_SKILLS = ["iron-jaws", "caustic-bite", "stormbite"] as const;

describe("BRD: バイトマスタリー II の修得レベルによるホークアイ付与 (#426)", () => {
  it.each(BITE_MASTERY_SKILLS)("Lv70 の %s ではホークアイが付与されない", (skillId) => {
    const entry = resolveAtLevel([skillId], 70).entries[0];

    expect(entry.recastError).toBeFalsy();
    expect(entry.comboErrors).toEqual([]);
    expect(entry.resourceErrors).toEqual([]);
    expect(entry.activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(false);
  });

  const levelsWithTrait = [80, 90, 100] as const;
  const cases = BITE_MASTERY_SKILLS.flatMap((skillId) => levelsWithTrait.map((level) => [skillId, level] as const));

  it.each(cases)("%s は Lv%s でホークアイを付与する", (skillId, level) => {
    const entry = resolveAtLevel([skillId], level).entries[0];

    expect(entry.activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(true);
  });

  // 特性で付与が加わっても付与確率 35% が効く (#427)
  it.each(BITE_MASTERY_SKILLS)("Lv80 の %s → リフルジェントアローは期待値威力 241 になる", (skillId) => {
    const refulgent = resolveAtLevel([skillId, "refulgent-arrow"], 80).entries[1];

    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    // floor(220 + (280 - 220) * 0.35)
    expect(refulgent.resolvedPotency).toBe(241);
  });
});
