import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../skill-level";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { PCT_BUFFS } from "../../data/pct-buffs";
import { PCT_RESOURCES } from "../../data/pct-resources";

/**
 * PCT: 公式ジョブガイド（Patch 7.5 表記、PvE 欄）との照合結果を反映したデータの検証（#410）
 * App と同じく getSkillsForLevel → getAllSkillMapForLevel でレベル調整したスキルを使う。
 */

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function setup(level: PlayerLevel) {
  const buffs = getBuffsForLevel(PCT_BUFFS, level);
  const resources = getResourcesForLevel(PCT_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(PCT_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(PCT_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (skillIds: string[]) =>
    resolveTimeline(skillIds.map(makeEntry), skillMap, resources, undefined, buffs).entries;
  return { skillMap, resolve };
}

function hasBuff(entry: ResolvedTimelineEntry, buffId: string): boolean {
  return entry.activeBuffs.some((ab) => ab.buffId === buffId);
}

describe("PCT: 特性による威力（変化先スキルを含む）", () => {
  it.each([
    [70, "fire-in-red", 310], [80, "fire-in-red", 380], [90, "fire-in-red", 420], [100, "fire-in-red", 490],
    [70, "aero-in-green", 350], [80, "aero-in-green", 420], [90, "aero-in-green", 460], [100, "aero-in-green", 530],
    [70, "water-in-blue", 390], [80, "water-in-blue", 460], [90, "water-in-blue", 500], [100, "water-in-blue", 570],
    [70, "blizzard-in-cyan", 560], [80, "blizzard-in-cyan", 680], [90, "blizzard-in-cyan", 750], [100, "blizzard-in-cyan", 860],
    [70, "stone-in-yellow", 600], [80, "stone-in-yellow", 720], [90, "stone-in-yellow", 790], [100, "stone-in-yellow", 900],
    [70, "thunder-in-magenta", 640], [80, "thunder-in-magenta", 760], [90, "thunder-in-magenta", 830], [100, "thunder-in-magenta", 940],
    [70, "hammer-stamp", 420], [80, "hammer-stamp", 500], [90, "hammer-stamp", 540], [100, "hammer-stamp", 560],
    [80, "holy-in-white", 460], [90, "holy-in-white", 500], [100, "holy-in-white", 570],
    [70, "winged-muse", 700], [90, "winged-muse", 800],
  ] as [PlayerLevel, string, number][])("Lv%i の %s は威力 %i", (level, skillId, potency) => {
    expect(setup(level).skillMap.get(skillId)?.potency).toBe(potency);
  });

  it("変化先スキルも実際のタイムライン上で特性威力になる（Lv80 のグリーンエアロ）", () => {
    const [, aero] = setup(80).resolve(["fire-in-red", "fire-in-red"]);
    expect(aero.resolvedSkillId).toBe("aero-in-green");
    expect(aero.resolvedPotency).toBe(420);
  });
});

describe("PCT: リキャスト・ゲージ", () => {
  it.each(["blizzard-in-cyan", "stone-in-yellow", "thunder-in-magenta", "comet-in-black"])(
    "%s のリキャストは 3.3 秒",
    (skillId) => {
      expect(setup(100).skillMap.get(skillId)?.recastTime).toBe(3.3);
    },
  );

  it("タイムライン上でもサブトラクティブ色魔法・ブラックコメットは詠唱 2.3 秒・リキャスト 3.3 秒になる", () => {
    const entries = setup(100).resolve([
      ...Array.from({ length: 6 }, () => "fire-in-red"),
      "subtractive-palette", "fire-in-red", "fire-in-red", "fire-in-red", "holy-in-white", "holy-in-white",
    ]);
    const [cyan, yellow, magenta, comet, holy] = entries.slice(7);
    expect([cyan, yellow, magenta, comet].map((e) => e.resolvedSkillId)).toEqual([
      "blizzard-in-cyan", "stone-in-yellow", "thunder-in-magenta", "comet-in-black",
    ]);
    for (const [e, next] of [[cyan, yellow], [yellow, magenta], [magenta, comet], [comet, holy]]) {
      expect(e.castTime).toBe(e === comet ? 0 : 2.3);
      expect(Math.round((next.startTime - e.startTime) * 1000) / 1000).toBe(3.3);
    }
  });

  it("マゼンタサンダーはパレットゲージを上昇させない", () => {
    const magenta = setup(100).skillMap.get("thunder-in-magenta");
    expect(magenta?.resourceChanges?.some((rc) => rc.resourceId === "palette-gauge")).toBe(false);
  });

  it("パレットゲージは Lv60、ホワイトペイントは Lv80 で習得する", () => {
    const ids = (level: PlayerLevel) => getResourcesForLevel(PCT_RESOURCES, level).map((r) => r.id);
    expect(ids(70)).toContain("palette-gauge");
    expect(ids(70)).not.toContain("white-paint");
    expect(ids(80)).toContain("white-paint");
    expect(PCT_RESOURCES.find((r) => r.id === "palette-gauge")?.acquiredLevel).toBe(60);
  });
});

describe("PCT: ハンマーコンボ実行可", () => {
  it("イマジンハンマーで 3 スタック・30 秒が付与され、ハンマー系 3 段で消費される（Lv100）", () => {
    const [muse, stamp, brush, polish, extra] = setup(100).resolve([
      "steel-muse", "hammer-stamp", "hammer-stamp", "hammer-stamp", "hammer-stamp",
    ]);
    const ready = muse.activeBuffs.find((ab) => ab.buffId === "hammer-combo-ready");
    expect(ready?.endTime! - ready?.startTime!).toBe(30);

    expect([stamp, brush, polish].map((e) => e.resolvedSkillId)).toEqual([
      "hammer-stamp", "hammer-brush", "polishing-hammer",
    ]);
    for (const e of [stamp, brush, polish]) expect(e.comboErrors).toEqual([]);
    expect(hasBuff(brush, "hammer-combo-ready")).toBe(true);
    expect(hasBuff(polish, "hammer-combo-ready")).toBe(false);
    expect(extra.comboErrors).toContain("hammer-combo-ready");
  });

  it("Lv86 未満ではハンマースタンプを 3 回実行できる", () => {
    const entries = setup(80).resolve(["steel-muse", "hammer-stamp", "hammer-stamp", "hammer-stamp", "hammer-stamp"]);
    for (const e of entries.slice(1, 4)) {
      expect(e.resolvedSkillId).toBe("hammer-stamp");
      expect(e.comboErrors).toEqual([]);
    }
    expect(entries[4].comboErrors).toContain("hammer-combo-ready");
  });
});

describe("PCT: 迅速魔（Lv94 ロール特性）", () => {
  // 迅速魔 → GCD 17 回（約 42 秒）→ 迅速魔
  const sequence = ["swiftcast", ...Array.from({ length: 17 }, () => "fire-in-red"), "swiftcast"];

  it("Lv100 ではリキャスト 40 秒で再使用できる", () => {
    const entries = setup(100).resolve(sequence);
    const last = entries[entries.length - 1];
    expect(last.startTime).toBeGreaterThan(40);
    expect(last.startTime).toBeLessThan(60);
    expect(last.recastError).toBe(false);
  });

  it("Lv90 ではリキャスト 60 秒のまま", () => {
    const entries = setup(90).resolve(sequence);
    expect(entries[entries.length - 1].recastError).toBe(true);
  });
});

describe("PCT: チャージ数", () => {
  it.each([
    [80, "steel-muse", 1], [90, "steel-muse", 2],
    [90, "pom-muse", 2], [90, "winged-muse", 2],
    [100, "pom-muse", 3], [100, "winged-muse", 3], [100, "clawed-muse", 3], [100, "fanged-muse", 3],
  ] as [PlayerLevel, string, number][])("Lv%i の %s は最大 %i チャージ", (level, skillId, charges) => {
    expect(setup(level).skillMap.get(skillId)?.maxCharges).toBe(charges);
  });

  const animalSequence = ["pom-muse", "creature-motif", "pom-muse", "creature-motif", "pom-muse"];

  it("Lv96 未満はポンポン → ウィング → ポンポンと循環し、2 チャージを共有する", () => {
    const entries = setup(90).resolve(animalSequence);
    const muses = [entries[0], entries[2], entries[4]];
    expect(muses.map((e) => e.resolvedSkillId)).toEqual(["pom-muse", "winged-muse", "pom-muse"]);
    expect(muses[2].recastError).toBe(true);
  });

  it("Lv100 はクローまで進み、3 チャージ目も使える", () => {
    const entries = setup(100).resolve(animalSequence);
    const muses = [entries[0], entries[2], entries[4]];
    expect(muses.map((e) => e.resolvedSkillId)).toEqual(["pom-muse", "winged-muse", "clawed-muse"]);
    expect(muses[2].recastError).toBe(false);
  });
});

describe("PCT: インスタレーション", () => {
  it("ハンマー系では消費されず、色魔法 5 回で消費し切る", () => {
    const entries = setup(100).resolve([
      "scenic-muse", "steel-muse", "hammer-stamp", "hammer-stamp", "hammer-stamp",
      "fire-in-red", "fire-in-red", "fire-in-red", "fire-in-red", "fire-in-red",
    ]);
    const colors = entries.slice(5);
    for (const e of colors.slice(0, 4)) expect(hasBuff(e, "installation")).toBe(true);
    expect(hasBuff(colors[4], "installation")).toBe(false);
    expect(hasBuff(colors[4], "rainbow-drip-ready")).toBe(true);
  });

  it("Lv82 未満ではイマジンスカイでインスタレーションが付与されない", () => {
    const [muse] = setup(80).resolve(["scenic-muse"]);
    expect(hasBuff(muse, "subtractive-ready")).toBe(true);
    expect(hasBuff(muse, "installation")).toBe(false);
  });
});

describe("PCT: ペイント", () => {
  // 色魔法 3 段 × 2 周でパレットゲージ 50・WP 2
  const buildUp = Array.from({ length: 6 }, () => "fire-in-red");

  it("Lv90 未満のサブトラクティブパレットでは WP が減らず、色調反転も付かない", () => {
    const entries = setup(80).resolve([...buildUp, "subtractive-palette"]);
    const palette = entries[entries.length - 1];
    expect(palette.resourceErrors).toEqual([]);
    expect(palette.resourceSnapshot["white-paint"]).toBe(2);
    expect(hasBuff(palette, "color-inversion")).toBe(false);
  });

  it("ブラックペイントは 1 つまでで、色調反転中に得たペイントは BP が埋まっていれば WP になる", () => {
    const entries = setup(100).resolve([
      ...buildUp, "subtractive-palette", "fire-in-red", "fire-in-red", "fire-in-red", "holy-in-white", "holy-in-white",
    ]);
    const [magenta, comet, holy] = entries.slice(9);
    expect(magenta.resolvedSkillId).toBe("thunder-in-magenta");
    expect(magenta.resourceSnapshot["black-paint"]).toBe(1);
    expect(magenta.resourceSnapshot["white-paint"]).toBe(2);
    expect(comet.resolvedSkillId).toBe("comet-in-black");
    expect(comet.resourceSnapshot["black-paint"]).toBe(0);
    expect(holy.resolvedSkillId).toBe("holy-in-white");
    expect(holy.resourceErrors).toEqual([]);
    expect(holy.resourceSnapshot["white-paint"]).toBe(1);
  });

  it("BP が残ったままサブトラクティブパレットを再使用しても WP は減らない", () => {
    const entries = setup(100).resolve([
      ...buildUp, "subtractive-palette", "fire-in-red", "fire-in-red", "fire-in-red",
      // イマジンスカイの「サブトラクティブパレット実行可」でゲージを使わず再使用する
      "scenic-muse", "subtractive-palette",
    ]);
    const palette = entries[entries.length - 1];
    expect(palette.resourceErrors).toEqual([]);
    expect(palette.resourceSnapshot["white-paint"]).toBe(2);
    expect(palette.resourceSnapshot["black-paint"]).toBe(1);
  });
});
