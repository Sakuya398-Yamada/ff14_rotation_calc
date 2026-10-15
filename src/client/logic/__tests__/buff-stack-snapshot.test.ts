import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { computeBuffTimespans } from "../buff-timespans";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../skill-level";
import type { ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { PCT_BUFFS } from "../../data/pct-buffs";
import { PCT_RESOURCES } from "../../data/pct-resources";

/**
 * 各エントリの activeBuffs スナップショットが、後続エントリのスタック消費で書き換わらないこと（#429）
 */

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolvePct(skillIds: string[]) {
  const level = 100;
  const buffs = getBuffsForLevel(PCT_BUFFS, level);
  const resources = getResourcesForLevel(PCT_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(PCT_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(PCT_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const { entries } = resolveTimeline(skillIds.map(makeEntry), skillMap, resources, undefined, buffs);
  return { entries, buffs };
}

function stacksOf(entry: ResolvedTimelineEntry, buffId: string): number | undefined {
  return entry.activeBuffs.find((ab) => ab.buffId === buffId)?.stacks;
}

describe("activeBuffs スナップショットのスタック数（#429）", () => {
  // レッドファイア ×6 → サブトラクティブパレット → レッドファイア ×3（サブトラクティブ色魔法に変化して 1 スタックずつ消費）
  const sequence = [
    ...Array(6).fill("fire-in-red"),
    "subtractive-palette",
    "fire-in-red", "fire-in-red", "fire-in-red",
  ];

  it("各エントリの stacks はそのエントリ時点の値を保つ", () => {
    const { entries } = resolvePct(sequence);
    const palette = entries[6];
    const [first, second, third] = entries.slice(7);

    expect(palette.resolvedSkillId).toBe("subtractive-palette");
    expect(first.resolvedSkillId).toBe("blizzard-in-cyan");
    expect(stacksOf(palette, "subtractive-palette")).toBe(3);
    expect(stacksOf(first, "subtractive-palette")).toBe(2);
    expect(stacksOf(second, "subtractive-palette")).toBe(1);
    expect(stacksOf(third, "subtractive-palette")).toBeUndefined();
  });

  it("バフレーンのスパンは付与時点のスタック数を持つ", () => {
    const { entries, buffs } = resolvePct(sequence);
    const spans = computeBuffTimespans(entries, buffs).get("subtractive-palette");

    expect(spans).toHaveLength(1);
    expect(spans?.[0].stacks).toBe(3);
  });
});
