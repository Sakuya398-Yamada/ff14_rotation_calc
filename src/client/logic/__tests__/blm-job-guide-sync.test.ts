import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getSkillsForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getAllSkillMapForLevel,
} from "../skill-level";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS, BLM_FIRE_FAMILY_IDS, BLM_BLIZZARD_FAMILY_IDS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

// 公式ジョブガイド（Patch 7.5、7.55 表記の PvE 欄）の属性解除・発動条件・ファイガ効果アップ（Issue #519）

const AF_UB_IDS = ["astral-fire-1", "astral-fire-2", "astral-fire-3", "umbral-ice-1", "umbral-ice-2", "umbral-ice-3"];
const THUNDER_DOT_IDS = ["thunder-3", "high-thunder", "thunder-4", "high-thunder-2"];

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel) {
  const buffs = getBuffsForLevel(BLM_BUFFS, level);
  const resources = getResourcesForLevel(BLM_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(BLM_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(BLM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (items: (string | TimelineEntry)[]) =>
    resolveTimeline(
      items.map((item) => (typeof item === "string" ? entry(item) : item)),
      skillMap,
      resources,
      undefined,
      buffs
    );
  return { skillMap, resolve };
}

function hasBuff(e: ResolvedTimelineEntry, buffId: string): boolean {
  return e.activeBuffs.some((ab) => ab.buffId === buffId);
}

const { skillMap, resolve } = setup(100);

describe("BLM: UB 中のファイア・AF 中のブリザドは属性を解除するだけ", () => {
  // 前置きの最後に high-thunder を撃ち、反転で付いたサンダーヘッドを消費しておく
  it.each([
    ["UB1", ["blizzard", "high-thunder"]],
    ["UB2", ["blizzard", "blizzard", "high-thunder"]],
    ["UB3", ["blizzard-3", "high-thunder"]],
    ["UB3・アンブラルハート 3", ["blizzard-3", "blizzard-4", "high-thunder"]],
  ])("%s 中のファイアは UB を解除し、AF・サンダーヘッド・パラドックスを付与しない", (_label, prefix) => {
    const entries = resolve([...prefix, "fire"]).entries;
    const before = entries[entries.length - 2];
    const fire = entries[entries.length - 1];
    expect(fire.comboErrors).toEqual([]);
    expect(fire.resolvedSkillId).toBe("fire-in-ub");
    expect(AF_UB_IDS.some((id) => hasBuff(fire, id))).toBe(false);
    expect(hasBuff(fire, "thunderhead")).toBe(false);
    expect(fire.resourceSnapshot["paradox-gauge"]).toBe(0);
    // UB 中のファイア系は MP 消費 0（変化先も UB の効果の対象に入っている）
    expect(fire.resourceSnapshot["mp"]).toBe(before.resourceSnapshot["mp"]);
  });

  it.each([
    ["AF1", ["fire", "high-thunder"]],
    ["AF2", ["fire", "fire", "high-thunder"]],
    ["AF3", ["fire-3", "high-thunder"]],
  ])("%s 中のブリザドは AF を解除し、UB・サンダーヘッド・パラドックスを付与しない", (_label, prefix) => {
    const entries = resolve([...prefix, "blizzard"]).entries;
    const before = entries[entries.length - 2];
    const blizzard = entries[entries.length - 1];
    expect(blizzard.comboErrors).toEqual([]);
    expect(blizzard.resolvedSkillId).toBe("blizzard-in-af");
    expect(AF_UB_IDS.some((id) => hasBuff(blizzard, id))).toBe(false);
    expect(hasBuff(blizzard, "thunderhead")).toBe(false);
    expect(blizzard.resourceSnapshot["paradox-gauge"]).toBe(0);
    // AF 中のブリザド系は MP 消費 0
    expect(blizzard.resourceSnapshot["mp"]).toBe(before.resourceSnapshot["mp"]);
  });
});

describe("BLM: ファイアのファイガ効果アップ（発動確率 40%）", () => {
  it("ファイアの変化先すべてが、ファイアスターターを確率 0.4 で付与する", () => {
    const fire = skillMap.get("fire");
    // パラドックス（ゲージがあるときの変化先、#613）は別のアクションで、AF 中に確定で付与するので除く
    const targetIds = new Set(
      [fire?.autoTransform ?? []].flat().map((t) => t.skillId).filter((id) => id !== "paradox")
    );
    const targets = [fire, ...[...targetIds].map((id) => skillMap.get(id))];
    expect(targets.map((s) => s?.id).sort()).toEqual(
      ["fire", "fire-in-ub", "fire-stay-af3", "fire-up-af2", "fire-up-af3"].sort()
    );
    for (const skill of targets) {
      expect(skill?.buffApplications).toContain("firestarter");
      expect(skill?.buffApplicationProcRates?.firestarter).toBe(0.4);
    }
  });

  it("ファイアで付いたファイアスターターをファイガが消費すると、インスタント・MP 0 のまま警告が立つ", () => {
    const entries = resolve(["fire", "fire-3"]).entries;
    expect(hasBuff(entries[0], "firestarter")).toBe(true);
    const fire3 = entries[1];
    expect(fire3.comboErrors).toEqual([]);
    expect(fire3.castTime).toBe(0);
    expect(fire3.resourceSnapshot["mp"]).toBe(entries[0].resourceSnapshot["mp"]);
    expect(fire3.unconfirmedProcBuffs).toEqual(["firestarter"]);
  });

  it.each([
    // ゲージがあるとファイアはパラドックスに変化する（#613）ので、ファイアはマナフォントでゲージを得る前に撃つ
    ["ファイアのあとパラドックスで確定付与し直す", ["fire-3", "fire", "manafont", "paradox", "fire-3"]],
    ["パラドックスで確定付与したあとファイアが重なる", ["fire-3", "manafont", "paradox", "fire", "fire-3"]],
  ])("%s と、ファイガで警告は立たない", (_label, ids) => {
    const entries = resolve(ids).entries;
    // ファイアとパラドックスがどちらも狙いどおり撃てている（パラドックスがゲージ不足になっていない）
    expect(entries.map((e) => e.resourceErrors)).toEqual(entries.map(() => []));
    expect(entries.map((e) => e.resolvedSkillId)).toContain("fire-stay-af3");
    expect(entries.map((e) => e.resolvedSkillId)).toContain("paradox-af");
    const fire3 = entries[entries.length - 1];
    expect(fire3.comboErrors).toEqual([]);
    expect(fire3.castTime).toBe(0);
    expect(fire3.unconfirmedProcBuffs).toBeUndefined();
  });

  // ファイアスターターは効果時間が無期限なので、消費した付与元を数え続けると P が上がり続ける (#615)
  it("付与時点の発動確率は、ファイガで消費したあと 0.4 から数え直す", () => {
    const entries = resolve(["fire", "fire-3", "fire", "fire"]).entries;
    const firestarterOf = (e: ResolvedTimelineEntry) => e.activeBuffs.find((ab) => ab.buffId === "firestarter");

    expect(entries.flatMap((e) => [...e.comboErrors, ...e.resourceErrors])).toEqual([]);
    expect(firestarterOf(entries[0])?.procRate).toBeCloseTo(0.4, 10);
    expect(firestarterOf(entries[1])).toBeUndefined();
    expect(firestarterOf(entries[2])?.procRate).toBeCloseTo(0.4, 10);
    expect(firestarterOf(entries[3])?.procRate).toBeCloseTo(1 - 0.6 ** 2, 10);
  });

  it("パラドックスで確定付与したあとファイアが重なっても、確定のままで発動確率は付かない", () => {
    const entries = resolve(["fire-3", "manafont", "paradox", "fire"]).entries;
    const fire = entries[3];

    expect(fire.comboErrors).toEqual([]);
    const firestarter = fire.activeBuffs.find((ab) => ab.buffId === "firestarter");
    expect(firestarter).toBeDefined();
    expect(firestarter).not.toHaveProperty("procRate");
  });
});

describe("BLM: マナフォントの発動条件（アストラルファイア効果中）", () => {
  it.each([
    ["AF/UB が無い", ["manafont"]],
    ["UB 中", ["blizzard-3", "manafont"]],
  ])("%s ときは発動条件エラーになる", (_label, ids) => {
    const entries = resolve(ids).entries;
    expect(entries[entries.length - 1].comboErrors.length).toBeGreaterThan(0);
  });

  it("AF 中なら使え、AF3 になる", () => {
    const entries = resolve(["fire", "manafont"]).entries;
    expect(entries[1].comboErrors).toEqual([]);
    expect(hasBuff(entries[1], "astral-fire-3")).toBe(true);
  });
});

describe("BLM: 黒魔紋の発動条件（黒魔紋 非効果中）", () => {
  it("黒魔紋の効果中に 2 チャージ目を使うと発動条件エラーになる", () => {
    const entries = resolve(["ley-lines", "ley-lines"]).entries;
    expect(entries[1].recastError).toBe(false);
    expect(entries[1].comboErrors).toEqual([{ buffId: "ley-lines", kind: "forbidden" }]);
  });

  it("効果が切れた後なら 2 チャージ目を使える", () => {
    const entries = resolve(["ley-lines", entry("ley-lines", 21)]).entries;
    expect(entries[1].recastError).toBe(false);
    expect(entries[1].comboErrors).toEqual([]);
    expect(hasBuff(entries[1], "ley-lines")).toBe(true);
  });
});

describe("BLM: サンダー系の DoT は同時に 1 種類だけ", () => {
  it("サンダー系 4 種すべてが、ほかのサンダー系の DoT を置き換える", () => {
    for (const id of THUNDER_DOT_IDS) {
      expect([...(skillMap.get(id)?.replacesDots ?? [])].sort()).toEqual([...THUNDER_DOT_IDS].sort());
    }
  });

  it("ハイサンダーの DoT が残っているときにハイサンダラを撃つと、ハイサンダーの DoT は打ち切られる（逆も同じ）", () => {
    const result = resolve(["fire-3", "high-thunder", "blizzard-3", "high-thunder-2", "fire-3", "high-thunder"]);
    const [, ht1, , ht2, , ht3] = result.entries;
    for (const e of [ht1, ht2, ht3]) expect(e.comboErrors).toEqual([]);

    const ticks = (skillId: string) => result.dotTicks.filter((t) => t.skillId === skillId).map((t) => t.time);
    const htTicks = ticks("high-thunder");
    const ht2Ticks = ticks("high-thunder-2");
    // ハイサンダラの効果中（打ち切られてから掛け直すまで）にハイサンダーのティックは無い
    expect(htTicks.some((t) => t > ht2.startTime && t <= ht3.startTime)).toBe(false);
    // ハイサンダーを掛け直した後にハイサンダラのティックは無い
    expect(ht2Ticks.length).toBeGreaterThan(0);
    expect(ht2Ticks.every((t) => t > ht2.startTime && t <= ht3.startTime)).toBe(true);
    // 同じ時刻に 2 種類のティックが立たない
    const allTimes = result.dotTicks.map((t) => t.time);
    expect(new Set(allTimes).size).toBe(allTimes.length);
  });
});

describe("BLM: 隠しスキルの AF/UB 効果の対象（系統横断）", () => {
  const ids = BLM_ATTACK_SKILLS.map((s) => s.id);

  it.each(ids.filter((id) => /^(fire|high-fire)/.test(id)))("%s は BLM_FIRE_FAMILY_IDS に入っている", (id) => {
    expect(BLM_FIRE_FAMILY_IDS).toContain(id);
  });

  it.each(ids.filter((id) => /^(blizzard|high-blizzard)/.test(id)))(
    "%s は BLM_BLIZZARD_FAMILY_IDS に入っている",
    (id) => {
      expect(BLM_BLIZZARD_FAMILY_IDS).toContain(id);
    }
  );
});
