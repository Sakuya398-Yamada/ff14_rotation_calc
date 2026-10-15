import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function setup(level: PlayerLevel) {
  const buffs = getBuffsForLevel(SAM_BUFFS, level);
  const resources = getResourcesForLevel(SAM_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(SAM_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(SAM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolveEntries = (entries: TimelineEntry[]) =>
    resolveTimeline(entries, skillMap, resources, undefined, buffs).entries;
  const resolve = (skillIds: string[]) => resolveEntries(skillIds.map(makeEntry));
  return { paletteIds: skills.map((s) => s.id), resolve, resolveEntries };
}

function expectNoError(entry: ResolvedTimelineEntry) {
  expect(entry.recastError).toBeFalsy();
  expect(entry.untargetableError).toBeFalsy();
  expect(entry.comboErrors).toEqual([]);
  expect(entry.resourceErrors).toEqual([]);
}

/**
 * 公式ジョブガイド（侍、Patch 7.5 表記、PvE 欄）にあって未実装だったアクションの追加（#424）
 */
describe("侍: 必殺剣・九天", () => {
  it.each([70, 80, 90, 100] as const)("Lv%i のパレットに並ぶ", (level) => {
    expect(setup(level).paletteIds).toContain("hissatsu-kyuten");
  });

  it("剣気 25 を消費して威力 100 で計算される", () => {
    // 意気衝天（剣気 +50）→ 九天（-25）
    const entries = setup(100).resolve(["ikishoten", "hissatsu-kyuten"]);
    expectNoError(entries[1]);
    expect(entries[1].resolvedPotency).toBe(100);
    expect(entries[1].resourceSnapshot.kenki).toBe(25);
  });

  it("剣気が 25 未満なら実行できない", () => {
    const entries = setup(100).resolve(["hissatsu-kyuten"]);
    expect(entries[0].resourceErrors.length).toBeGreaterThan(0);
  });

  it("必殺剣・震天とはリキャストを共有しない", () => {
    // 意気衝天（+50）→ 震天（-25）→ 九天（-25）。震天のリキャスト 1 秒の間に九天を撃てる
    const entries = setup(100).resolve(["ikishoten", "hissatsu-shinten", "hissatsu-kyuten"]);
    expectNoError(entries[2]);
    expect(entries[2].startTime - entries[1].startTime).toBeLessThan(1);
    expect(entries[2].resourceSnapshot.kenki).toBe(0);
  });
});

describe("侍: 心眼・天眼通", () => {
  it.each([70, 80] as const)("Lv%i のパレットには心眼が並び、天眼通は並ばない", (level) => {
    const { paletteIds } = setup(level);
    expect(paletteIds).toContain("third-eye");
    expect(paletteIds).not.toContain("tengentsu");
  });

  it.each([90, 100] as const)("Lv%i のパレットでは心眼が天眼通に置き換わる", (level) => {
    const { paletteIds } = setup(level);
    expect(paletteIds).toContain("tengentsu");
    expect(paletteIds).not.toContain("third-eye");
  });

  it.each([
    [80, "third-eye"],
    [100, "tengentsu"],
  ] as const)("Lv%i の %s は被弾に成功した前提で剣気を 10 上昇させる", (level, skillId) => {
    const entries = setup(level).resolve([skillId]);
    expectNoError(entries[0]);
    expect(entries[0].resolvedSkillId).toBe(skillId);
    expect(entries[0].resolvedPotency).toBe(0);
    expect(entries[0].resourceSnapshot.kenki).toBe(10);
  });

  it.each([
    [80, "third-eye"],
    [100, "tengentsu"],
  ] as const)("Lv%i の %s のリキャストは 15 秒", (level, skillId) => {
    const { resolve, resolveEntries } = setup(level);
    const back = resolve([skillId, skillId]);
    expect(back[1].recastError).toBe(true);

    // 14.9 秒後はまだリキャスト中、15 秒後なら撃てる（時刻ごとに別のタイムラインで解決する）
    const early = resolveEntries([makeEntry(skillId), { ...makeEntry(skillId), manualStartTime: 14.9 }]);
    expect(early[1].recastError).toBe(true);
    const spaced = resolveEntries([makeEntry(skillId), { ...makeEntry(skillId), manualStartTime: 15 }]);
    expectNoError(spaced[1]);
    expect(spaced[1].resourceSnapshot.kenki).toBe(20);
  });
});
