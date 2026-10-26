import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { SCH_ATTACK_SKILLS } from "../../data/sch-skills";
import { SCH_BUFFS } from "../../data/sch-buffs";
import { SCH_RESOURCES } from "../../data/sch-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(SCH_BUFFS, level);
  const resources = getResourcesForLevel(SCH_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(SCH_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(SCH_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (ids: (string | TimelineEntry)[]) =>
    resolveTimeline(
      ids.map((id) => (typeof id === "string" ? entry(id) : id)),
      skillMap,
      resources,
      undefined,
      buffs,
    );
  return { skills, resolve };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const aetherflow = (e: ResolvedTimelineEntry) => e.resourceSnapshot["aetherflow"];

/**
 * 公式ジョブガイド（学者、Patch 7.5、7.55 表記、PvE 欄）と、特性習得前の値（パッチノート 7.x の変更履歴と consolegameswiki で照合）
 * - 炎法マスタリー（Lv54/64/72/82）: ルインラ 160/180/200/220、破陣法 165
 * - アクション威力アップ（Lv94）: 蠱毒法の継続ダメージ 85、極炎法 320（Lv94 未満は 70 / 295）
 */
describe("SCH: レベルごとの威力", () => {
  it.each<[PlayerLevel, string, number]>([
    [70, "broil2", 240], [80, "broil3", 255], [90, "broil4", 295], [100, "broil4", 320],
    [70, "sch-ruin2", 180], [80, "sch-ruin2", 200], [90, "sch-ruin2", 220], [100, "sch-ruin2", 220],
    [70, "art-of-war", 165], [80, "art-of-war", 165], [90, "art-of-war2", 180], [100, "art-of-war2", 180],
    [100, "energy-drain", 100],
  ])("Lv%i ではパレットに %s が並び、タイムライン上の威力は %i", (level, skillId, potency) => {
    const { skills, resolve } = setup(level);
    expect(skills.map((s) => s.id)).toContain(skillId);
    const [e] = resolve(skillId === "energy-drain" ? ["aetherflow", skillId] : [skillId]).entries.slice(-1);
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "sch-bio2", 40],
    [80, "biolysis", 70],
    [90, "biolysis", 70],
    [100, "biolysis", 85],
  ])("Lv%i の %s の DoT は 30 秒で 10 ティック、ティック威力 %i", (level, skillId, dotPotency) => {
    const { skills, resolve } = setup(level);
    expect(skills.map((s) => s.id)).toContain(skillId);
    const result = resolve([skillId]);
    expectNoError(result.entries[0]);
    const ticks = result.dotTicks.filter((t) => t.skillId === skillId);
    expect(ticks).toHaveLength(10);
    expect(ticks.every((t) => t.potency === dotPotency)).toBe(true);
  });
});

describe("SCH: 連環計のクリティカル率上昇", () => {
  it("連環計の後の攻撃にクリティカル率 +10% が乗る", () => {
    const [, broil] = setup().resolve(["chain-stratagem", "broil4"]).entries;
    expectNoError(broil);
    expect(broil.critRateBonus).toBeCloseTo(0.1);
  });

  it("連環計の後に付与した蠱毒法は、連環計が切れた後のティックもクリティカル率 +10% のまま（スナップショット）", () => {
    const result = setup().resolve(["chain-stratagem", "biolysis"]);
    expectNoError(result.entries[1]);
    const ticks = result.dotTicks.filter((t) => t.skillId === "biolysis");
    expect(ticks).toHaveLength(10);
    // 連環計（20 秒）が切れた後のティックが含まれていることを確かめてから全ティックを見る
    expect(ticks[ticks.length - 1].time).toBeGreaterThan(result.entries[0].startTime + 20);
    expect(ticks.every((t) => Math.abs(t.critRateBonus - 0.1) < 1e-9)).toBe(true);
  });

  it("連環計が無ければ蠱毒法のティックにクリティカル率のボーナスは無い", () => {
    const result = setup().resolve(["biolysis"]);
    expectNoError(result.entries[0]);
    const ticks = result.dotTicks.filter((t) => t.skillId === "biolysis");
    expect(ticks).toHaveLength(10);
    expect(ticks.every((t) => t.critRateBonus === 0)).toBe(true);
  });
});

describe("SCH: 埋伏の毒", () => {
  it("Lv100 では連環計の後に使え、威力 140 の DoT が 15 秒で 5 ティック入る", () => {
    const result = setup(100).resolve(["chain-stratagem", "baneful-impaction"]);
    expectNoError(result.entries[1]);
    const ticks = result.dotTicks.filter((t) => t.skillId === "baneful-impaction");
    expect(ticks).toHaveLength(5);
    expect(ticks.every((t) => t.potency === 140)).toBe(true);
  });

  it("連環計を使わずに置くと、埋伏の毒実行可が無いのでエラーになり DoT も入らない", () => {
    const result = setup(100).resolve(["baneful-impaction"]);
    expect(result.entries[0].comboErrors.length).toBeGreaterThan(0);
    expect(result.dotTicks.filter((t) => t.skillId === "baneful-impaction")).toHaveLength(0);
  });

  it("使うと埋伏の毒実行可を消費し、2 回目はエラーになる", () => {
    const result = setup(100).resolve(["chain-stratagem", "baneful-impaction", "broil4", "baneful-impaction"]);
    expectNoError(result.entries[1]);
    expect(result.entries[3].recastError).toBeFalsy();
    expect(result.entries[3].comboErrors.length).toBeGreaterThan(0);
  });

  it("Lv90 では埋伏の毒はパレットに無く、連環計も埋伏の毒実行可を付与しない", () => {
    const { skills, resolve } = setup(90);
    expect(skills.map((s) => s.id)).not.toContain("baneful-impaction");
    const [cs] = resolve(["chain-stratagem"]).entries;
    expectNoError(cs);
    expect(cs.activeBuffs.some((b) => b.buffId === "chain-stratagem")).toBe(true);
    expect(cs.activeBuffs.some((b) => b.buffId === "impact-imminent")).toBe(false);
  });
});

describe("SCH: エーテルフロー", () => {
  it("開始時は 0 なので、エナジードレインはリソース不足のエラーになる", () => {
    const [drain] = setup().resolve(["energy-drain"]).entries;
    expect(drain.resourceErrors).toEqual(["aetherflow"]);
    expect(aetherflow(drain)).toBe(0);
  });

  it("エーテルフローで 3 獲得し、エナジードレイン 3 回で 0 になり、4 回目はエラーになる", () => {
    // エナジードレインのリキャストは 1 秒なので、アニメーションロック（0.65 秒）で詰めて連打せず GCD を挟む
    const entries = setup().resolve([
      "aetherflow", "energy-drain", "broil4", "energy-drain", "broil4", "energy-drain", "broil4", "energy-drain",
    ]).entries;
    expect(aetherflow(entries[0])).toBe(3);
    for (const [i, rest] of [[1, 2], [3, 1], [5, 0]] as const) {
      expectNoError(entries[i]);
      expect(aetherflow(entries[i])).toBe(rest);
    }
    expect(entries[7].recastError).toBeFalsy();
    expect(entries[7].resourceErrors).toEqual(["aetherflow"]);
  });

  it("転化でも 3 獲得する", () => {
    const [dissipation] = setup().resolve(["dissipation"]).entries;
    expectNoError(dissipation);
    expect(aetherflow(dissipation)).toBe(3);
  });

  it("残り 2 で転化を使っても上限の 3 で止まる", () => {
    const entries = setup().resolve(["aetherflow", "energy-drain", "dissipation"]).entries;
    expect(aetherflow(entries[1])).toBe(2);
    expectNoError(entries[2]);
    expect(aetherflow(entries[2])).toBe(3);
  });

  it.each(["lustrate", "sacred-soil", "indomitability", "excogitation"])(
    "回復アビリティ %s はエーテルフローを 1 消費し、威力は 0",
    (skillId) => {
      const entries = setup().resolve(["aetherflow", skillId]).entries;
      expectNoError(entries[1]);
      expect(aetherflow(entries[1])).toBe(2);
      expect(entries[1].resolvedPotency).toBe(0);
    },
  );
});
