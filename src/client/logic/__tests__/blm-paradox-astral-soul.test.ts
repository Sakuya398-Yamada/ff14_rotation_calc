import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getSkillsForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getAllSkillMapForLevel,
} from "../skill-level";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

// 公式ジョブガイド（Patch 7.5、7.55 表記の PvE 欄）の、パラドックスへの変化とアストラルソウルの解除（Issue #613）

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function setup(level: PlayerLevel) {
  const buffs = getBuffsForLevel(BLM_BUFFS, level);
  const resources = getResourcesForLevel(BLM_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(BLM_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(BLM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (skillIds: string[]) =>
    resolveTimeline(skillIds.map(entry), skillMap, resources, undefined, buffs).entries;
  return { skills, resolve };
}

function hasBuff(e: ResolvedTimelineEntry, buffId: string): boolean {
  return e.activeBuffs.some((ab) => ab.buffId === buffId);
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

describe.each([90, 100] as PlayerLevel[])("BLM Lv%i: パラドックスゲージがあるとファイアとブリザドはパラドックスに変化する", (level) => {
  const { skills, resolve } = setup(level);

  it.each([
    { label: "AF3 中のファイア", ids: ["fire-3", "manafont", "fire"], resolved: "paradox-af", aspect: "astral-fire-3" },
    { label: "AF3 中のブリザド", ids: ["fire-3", "manafont", "blizzard"], resolved: "paradox-af", aspect: "astral-fire-3" },
    { label: "UB3 中のファイア", ids: ["fire-3", "blizzard-3", "fire"], resolved: "paradox", aspect: "umbral-ice-3" },
    { label: "UB3 中のブリザド", ids: ["fire-3", "blizzard-3", "blizzard"], resolved: "paradox", aspect: "umbral-ice-3" },
  ])("$label はパラドックスになり、AF/UB は解除されずゲージを使う", ({ ids, resolved, aspect }) => {
    const entries = resolve(ids);
    const before = entries[entries.length - 2];
    const target = entries[entries.length - 1];
    expect(before.resourceSnapshot["paradox-gauge"]).toBe(1);
    expectNoError(target);
    expect(target.resolvedSkillId).toBe(resolved);
    expect(hasBuff(target, aspect)).toBe(true);
    expect(target.resourceSnapshot["paradox-gauge"]).toBe(0);
    // ファイアスターターは AF 中のパラドックスだけが付与する
    expect(hasBuff(target, "firestarter")).toBe(resolved === "paradox-af");
  });

  it("ゲージを使ったあとの UB 中のファイアは、今までどおり UB を解除するだけ", () => {
    const entries = resolve(["fire-3", "blizzard-3", "fire", "fire"]);
    expect(entries[2].resolvedSkillId).toBe("paradox");
    const target = entries[3];
    expectNoError(target);
    expect(target.resolvedSkillId).toBe("fire-in-ub");
    expect(target.activeBuffs.some((ab) => ab.buffId.startsWith("umbral-ice-"))).toBe(false);
  });

  it.each([
    { label: "AF3 中のファイガ", ids: ["fire-3", "manafont", "fire-3"], resolved: "fire-3-in-af" },
    { label: "UB3 中のブリザガ", ids: ["fire-3", "blizzard-3", "blizzard-3"], resolved: "blizzard-3-in-ub" },
  ])("$label はゲージがあってもパラドックスに変化しない", ({ ids, resolved }) => {
    const entries = resolve(ids);
    const target = entries[entries.length - 1];
    expectNoError(target);
    expect(target.resolvedSkillId).toBe(resolved);
    expect(target.resourceSnapshot["paradox-gauge"]).toBe(1);
  });

  it("パラドックスはパレットに出ず、ファイアとブリザドは出る（ホットバーに登録できない）", () => {
    const ids = skills.map((s) => s.id);
    expect(ids).not.toContain("paradox");
    expect(ids).toContain("fire");
    expect(ids).toContain("blizzard");
  });
});

describe("BLM Lv80: パラドックスゲージが無いので変化しない", () => {
  const { resolve } = setup(80);

  it("反転後の UB 中のファイアは UB を解除するだけ", () => {
    const entries = resolve(["fire-3", "blizzard-3", "fire"]);
    const target = entries[2];
    expectNoError(target);
    expect(target.resolvedSkillId).toBe("fire-in-ub");
    expect(target.resourceSnapshot["paradox-gauge"]).toBeUndefined();
  });
});

describe("BLM Lv100: AF/UB が完全に解除されるとアストラルソウルが 0 になる", () => {
  const { resolve } = setup(100);

  it("AF 中のブリザドで AF が解除されると 0 になる", () => {
    const entries = resolve(["fire-3", "fire-4", "blizzard"]);
    expect(entries[1].resourceSnapshot["astral-soul"]).toBe(1);
    const target = entries[2];
    expectNoError(target);
    expect(target.resolvedSkillId).toBe("blizzard-in-af");
    expect(target.resourceSnapshot["astral-soul"]).toBe(0);
  });

  it("反転で UB に持ち越したあと、UB 中のファイアで UB が解除されると 0 になる", () => {
    const entries = resolve(["fire-3", "fire-4", "blizzard-3", "blizzard", "fire"]);
    // ゲージがある間のブリザドはパラドックスになり、アストラルソウルは残る
    expect(entries[3].resolvedSkillId).toBe("paradox");
    expect(entries[3].resourceSnapshot["astral-soul"]).toBe(1);
    const target = entries[4];
    expectNoError(target);
    expect(target.resolvedSkillId).toBe("fire-in-ub");
    expect(target.resourceSnapshot["astral-soul"]).toBe(0);
  });

  // AF⇔UB の反転ではリセットされない（#215 の実機確認）
  it.each([
    { label: "ブリザガ", reversal: "blizzard-3", resolved: "blizzard-3-from-af3" },
    { label: "トランス", reversal: "transpose", resolved: "transpose-to-ub1-from-af3" },
  ])("$label による AF→UB の反転では残る", ({ reversal, resolved }) => {
    const entries = resolve(["fire-3", "fire-4", reversal]);
    const target = entries[2];
    expectNoError(target);
    expect(target.resolvedSkillId).toBe(resolved);
    expect(target.resourceSnapshot["astral-soul"]).toBe(1);
  });
});

describe("BLM Lv90: アストラルソウルは未習得なので、完全解除でも書き込まれない", () => {
  const { resolve } = setup(90);

  it.each([
    { label: "AF 中のブリザド", ids: ["fire-3", "blizzard"], resolved: "blizzard-in-af" },
    { label: "UB 中のファイア", ids: ["blizzard", "fire"], resolved: "fire-in-ub" },
  ])("$label", ({ ids, resolved }) => {
    const target = resolve(ids)[1];
    expectNoError(target);
    expect(target.resolvedSkillId).toBe(resolved);
    expect(target.resourceSnapshot["astral-soul"]).toBeUndefined();
  });
});
