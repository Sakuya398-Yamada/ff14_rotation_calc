import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../skill-level";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

/**
 * BLM: サンダーヘッドとパラドックスの付与を AF/UB の付与・反転時に限定する（#416）
 * App と同じく getSkillsForLevel → getAllSkillMapForLevel でレベル調整したスキルを使う。
 */

let uidCounter = 0;
function makeEntry(skillId: string): TimelineEntry {
  uidCounter += 1;
  return { uid: `blm-416-${uidCounter}`, skillId };
}

function setup(level: PlayerLevel) {
  const buffs = getBuffsForLevel(BLM_BUFFS, level);
  const resources = getResourcesForLevel(BLM_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(BLM_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(BLM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  return (skillIds: string[]) =>
    resolveTimeline(skillIds.map(makeEntry), skillMap, resources, undefined, buffs).entries;
}

function hasBuff(entry: ResolvedTimelineEntry, buffId: string): boolean {
  return entry.activeBuffs.some((ab) => ab.buffId === buffId);
}

function expectNoError(entry: ResolvedTimelineEntry) {
  expect(entry.recastError).toBeFalsy();
  expect(entry.comboErrors).toEqual([]);
  expect(entry.resourceErrors).toEqual([]);
}

const resolve100 = setup(100);

describe("BLM: サンダーヘッドは AF/UB の付与・反転時だけ付与される", () => {
  // サンダーヘッドを撃って消費してから、対象スキルが付け直すかを見る
  it.each([
    { label: "AF3 中のファイア", setupIds: ["fire-3"], skillId: "fire", resolved: "fire-stay-af3" },
    { label: "AF1 中のファイア（AF2 へ上昇）", setupIds: ["fire"], skillId: "fire", resolved: "fire-up-af2" },
    { label: "AF3 中のファイガ", setupIds: ["fire-3"], skillId: "fire-3", resolved: "fire-3-in-af" },
    { label: "AF3 中のハイファイラ", setupIds: ["fire-3"], skillId: "high-fire-2", resolved: "high-fire-2-in-af" },
    { label: "UB1 中のブリザド（UB2 へ上昇）", setupIds: ["blizzard"], skillId: "blizzard", resolved: "blizzard-up-ub2" },
    { label: "UB3 中のブリザガ", setupIds: ["blizzard-3"], skillId: "blizzard-3", resolved: "blizzard-3-in-ub" },
    { label: "UB3 中のハイブリザラ", setupIds: ["blizzard-3"], skillId: "high-blizzard-2", resolved: "high-blizzard-2-in-ub" },
    { label: "UB3 中のフリーズ", setupIds: ["blizzard-3"], skillId: "freeze", resolved: "freeze" },
    // UB 中のファイア・AF 中のブリザドは属性を解除するだけ（#519）
    { label: "UB1 中のファイア（UB を解除）", setupIds: ["blizzard"], skillId: "fire", resolved: "fire-in-ub" },
    { label: "AF1 中のブリザド（AF を解除）", setupIds: ["fire"], skillId: "blizzard", resolved: "blizzard-in-af" },
  ])("$label はサンダーヘッドを付与しない", ({ setupIds, skillId, resolved }) => {
    const entries = resolve100([...setupIds, "high-thunder", skillId]);
    const target = entries[entries.length - 1];
    expectNoError(entries[entries.length - 2]);
    expectNoError(target);
    expect(target.resolvedSkillId).toBe(resolved);
    expect(hasBuff(target, "thunderhead")).toBe(false);
  });

  it.each([
    { label: "AF/UB 無しからのファイア", setupIds: [], skillId: "fire" },
    { label: "UB3 からのファイガ（UB→AF の反転）", setupIds: ["blizzard-3"], skillId: "fire-3" },
    { label: "AF3 からのブリザガ（AF→UB の反転）", setupIds: ["fire-3"], skillId: "blizzard-3" },
    { label: "AF3 からのハイブリザラ（AF→UB の反転）", setupIds: ["fire-3"], skillId: "high-blizzard-2" },
  ])("$label はサンダーヘッドを付与する", ({ setupIds, skillId }) => {
    const ids = setupIds.length > 0 ? [...setupIds, "high-thunder", skillId] : [skillId];
    const entries = resolve100(ids);
    const target = entries[entries.length - 1];
    expectNoError(target);
    expect(hasBuff(target, "thunderhead")).toBe(true);
  });
});

describe("BLM: パラドックスは反対属性への反転で付与される（Lv90 以上）", () => {
  it("AF3 からブリザガで UB へ反転するとパラドックスが付与され、UB 中にパラドックスを撃てる", () => {
    const entries = resolve100(["fire-3", "blizzard-3", "paradox"]);
    expect(entries[1].resolvedSkillId).toBe("blizzard-3-from-af3");
    expect(entries[1].resourceSnapshot["paradox-gauge"]).toBe(1);
    expectNoError(entries[2]);
    expect(entries[2].resolvedSkillId).toBe("paradox");
    expect(entries[2].resourceSnapshot["paradox-gauge"]).toBe(0);
  });

  it("AF3 からのトランスでもパラドックスが付与される（ブリザドは AF を解除するだけで付与しない。#519）", () => {
    const viaBlizzard = resolve100(["fire-3", "blizzard"]);
    expect(viaBlizzard[1].resolvedSkillId).toBe("blizzard-in-af");
    expect(viaBlizzard[1].resourceSnapshot["paradox-gauge"]).toBe(0);

    const viaTranspose = resolve100(["fire-3", "transpose"]);
    expect(viaTranspose[1].resolvedSkillId).toBe("transpose-to-ub1-from-af3");
    expect(viaTranspose[1].resourceSnapshot["paradox-gauge"]).toBe(1);
    expect(hasBuff(viaTranspose[1], "umbral-ice-1")).toBe(true);
  });

  it("AF1 からの反転ではパラドックスは付与されない", () => {
    const entries = resolve100(["fire", "blizzard-3", "paradox"]);
    expect(entries[1].resolvedSkillId).toBe("blizzard-3");
    expect(entries[1].resourceSnapshot["paradox-gauge"]).toBe(0);
    expect(entries[2].resourceErrors).toContain("paradox-gauge");
  });

  it("UB3 かつアンブラルハート 3 からファイガで AF へ反転するとパラドックスが付与され、AF 中のパラドックスでファイアスターターが付く", () => {
    const entries = resolve100(["blizzard-3", "blizzard-4", "fire-3", "paradox"]);
    expect(entries[1].resourceSnapshot["umbral-heart"]).toBe(3);
    expect(entries[2].resolvedSkillId).toBe("fire-3-from-ub3");
    expect(entries[2].resourceSnapshot["paradox-gauge"]).toBe(1);
    expect(hasBuff(entries[2], "thunderhead")).toBe(true);
    expectNoError(entries[3]);
    expect(entries[3].resolvedSkillId).toBe("paradox-af");
    expect(hasBuff(entries[3], "firestarter")).toBe(true);
  });

  it("UB3 でもアンブラルハートが 3 未満なら AF への反転でパラドックスは付与されない", () => {
    const entries = resolve100(["blizzard-3", "fire-3"]);
    expect(entries[1].resolvedSkillId).toBe("fire-3");
    expect(entries[1].resourceSnapshot["paradox-gauge"]).toBe(0);
  });

  it("Lv80 では AF3 から反転してもパラドックスゲージは存在しない", () => {
    const entries = setup(80)(["fire-3", "blizzard-3"]);
    expectNoError(entries[1]);
    expect(entries[1].resolvedSkillId).toBe("blizzard-3-from-af3");
    expect(entries[1].resourceSnapshot["paradox-gauge"]).toBeUndefined();
  });
});

describe("BLM: ファイアスターターは AF/UB の状態で切り替わるファイガにも効く", () => {
  it("AF3 中にファイアスターターで撃つファイガ（fire-3-in-af）は詠唱 0・MP 消費 0", () => {
    // マナフォントでパラドックスを得て、AF 中のパラドックスでファイアスターターを付与する
    const entries = resolve100(["fire-3", "manafont", "paradox", "fire-3"]);
    const paradox = entries[2];
    const fire3 = entries[3];
    expectNoError(paradox);
    expect(paradox.resolvedSkillId).toBe("paradox-af");
    expect(hasBuff(paradox, "firestarter")).toBe(true);
    expectNoError(fire3);
    expect(fire3.resolvedSkillId).toBe("fire-3-in-af");
    expect(fire3.castTime).toBe(0);
    expect(fire3.resourceSnapshot["mp"]).toBe(paradox.resourceSnapshot["mp"]);
    expect(hasBuff(fire3, "firestarter")).toBe(false);
  });
});
