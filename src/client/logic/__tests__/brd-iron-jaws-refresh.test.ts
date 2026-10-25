import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";

function resolveLv100(entries: [skillId: string, startTime: number][]) {
  const buffs = getBuffsForLevel(BRD_BUFFS, 100);
  const resources = getResourcesForLevel(BRD_RESOURCES, 100);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, 100, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, 100, buffIds, resourceIds);
  const timeline: TimelineEntry[] = entries.map(([skillId, manualStartTime], i) => ({ uid: `e${i}`, skillId, manualStartTime }));
  return resolveTimeline(timeline, skillMap, resources, undefined, buffs);
}

function tickTimes(result: ReturnType<typeof resolveTimeline>, skillId: string): number[] {
  return result.dotTicks.filter((t) => t.skillId === skillId).map((t) => t.time);
}

function dotEndTimes(result: ReturnType<typeof resolveTimeline>, skillId: string): number[] {
  return result.activeDoTs.filter((d) => d.skillId === skillId).map((d) => d.endTime);
}

// 公式ジョブガイド（Patch 7.5）: 付与していない DoT には効果無し (#614)
describe("BRD: アイアンジョーのバイト DoT 付与しなおし (#614)", () => {
  // 45 秒はコースティックバイトが切れる時刻ちょうど
  it.each([45, 50])("切れたバイトに %s 秒でアイアンジョーを撃っても DoT は復活しない", (ironJawsAt) => {
    const result = resolveLv100([["caustic-bite", 0], ["iron-jaws", ironJawsAt]]);

    expect(result.entries[1].recastError).toBeFalsy();
    expect(tickTimes(result, "caustic-bite").at(-1)).toBe(45);
    expect(dotEndTimes(result, "caustic-bite")).toEqual([45]);
  });

  it("効いている間のバイトは、アイアンジョーで効果時間がリセットされる", () => {
    const result = resolveLv100([["caustic-bite", 0], ["iron-jaws", 30]]);

    expect(tickTimes(result, "caustic-bite").at(-1)).toBe(75);
    expect(dotEndTimes(result, "caustic-bite")).toEqual([45, 75]);
  });

  it("片方のバイトだけ切れているときは、効いている方だけリセットされる", () => {
    const result = resolveLv100([["caustic-bite", 0], ["stormbite", 30], ["iron-jaws", 50]]);

    expect(tickTimes(result, "caustic-bite").at(-1)).toBe(45);
    expect(dotEndTimes(result, "caustic-bite")).toEqual([45]);
    // 効果時間は 95 秒まで。ティックは 3 秒刻みなので最後は 93 秒
    expect(tickTimes(result, "stormbite").at(-1)).toBe(93);
    expect(dotEndTimes(result, "stormbite")).toEqual([75, 95]);
  });
});
