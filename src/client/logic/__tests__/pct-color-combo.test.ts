import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { computeBuffTimespans } from "../buff-timespans";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../skill-level";
import type { ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { PCT_BUFFS } from "../../data/pct-buffs";
import { PCT_RESOURCES } from "../../data/pct-resources";

/**
 * PCT: 色魔法コンボ（エーテルヒュー aetherhues-2 / aetherhues-3 で段をつなぐ）の挙動（#790）
 * 通常版と減算版はエーテルヒューを共有し、どちらもレッドファイアの autoTransform から変化する。
 */

const buffs = getBuffsForLevel(PCT_BUFFS, 100);
const resources = getResourcesForLevel(PCT_RESOURCES, 100);
const buffIds = new Set(buffs.map((b) => b.id));
const resourceIds = new Set(resources.map((r) => r.id));
const skills = getSkillsForLevel(PCT_ATTACK_SKILLS, 100, buffIds, resourceIds);
const skillMap = getAllSkillMapForLevel(PCT_ATTACK_SKILLS, skills, 100, buffIds, resourceIds);

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, resources, undefined, buffs).entries;
}

function resolveIds(skillIds: string[]) {
  return resolve(skillIds.map((id) => entry(id)));
}

/** 使用後に効いているエーテルヒュー */
function aetherhues(e: ResolvedTimelineEntry): string[] {
  return e.activeBuffs.map((ab) => ab.buffId).filter((id) => id.startsWith("aetherhues"));
}

/** ウォーターブルー 2 回でパレットゲージが 50 になり、サブトラクティブパレットを使える。エーテルヒューは残らない */
const FILL_PALETTE = Array.from({ length: 6 }, () => "fire-in-red");

describe("PCT: 色魔法コンボ（通常）", () => {
  it("レッドファイア → グリーンエアロ → ブルーウォータと進み、4 発目はレッドファイアに戻る", () => {
    const entries = resolveIds(["fire-in-red", "fire-in-red", "fire-in-red", "fire-in-red"]);

    expect(entries.map((e) => e.resolvedSkillId)).toEqual(["fire-in-red", "aero-in-green", "water-in-blue", "fire-in-red"]);
    expect(entries.map((e) => e.resolvedPotency)).toEqual([490, 530, 570, 490]);
    expect(entries.map((e) => e.comboErrors)).toEqual([[], [], [], []]);
    expect(entries.map(aetherhues)).toEqual([["aetherhues-2"], ["aetherhues-3"], [], ["aetherhues-2"]]);
  });

  it("ブルーウォータでパレットゲージ +25・ホワイトペイント +1", () => {
    const [, aero, water] = resolveIds(["fire-in-red", "fire-in-red", "fire-in-red"]);

    expect(aero.resourceSnapshot["palette-gauge"]).toBe(0);
    expect(aero.resourceSnapshot["white-paint"]).toBe(0);
    expect(water.resourceSnapshot["palette-gauge"]).toBe(25);
    expect(water.resourceSnapshot["white-paint"]).toBe(1);
  });

  it("エーテルヒューの区間は、次の段の使用時刻で終わる", () => {
    const entries = resolveIds(["fire-in-red", "fire-in-red", "fire-in-red"]);
    const spans = computeBuffTimespans(entries, buffs);

    expect(spans.get("aetherhues-2")?.map((s) => [s.startTime, s.endTime])).toEqual([
      [entries[0].startTime, entries[1].startTime],
    ]);
    expect(spans.get("aetherhues-3")?.map((s) => [s.startTime, s.endTime])).toEqual([
      [entries[1].startTime, entries[2].startTime],
    ]);
  });

  it.each([
    [30, "water-in-blue"],
    [40, "fire-in-red"],
  ])("グリーンエアロから %s 秒のレッドファイアは %s になる（エーテルヒューは 30 秒で切れる）", (time, expected) => {
    const entries = resolve([entry("fire-in-red"), entry("fire-in-red"), entry("fire-in-red", time)]);

    expect(entries[1].resolvedSkillId).toBe("aero-in-green");
    expect(entries[2].startTime).toBe(time);
    expect(entries[2].resolvedSkillId).toBe(expected);
    expect(entries[2].comboErrors).toEqual([]);
  });
});

describe("PCT: 色魔法コンボ（減算）", () => {
  it("サブトラクティブパレット中はシアンブリザド → イエローストーン → マゼンタサンダーと進む", () => {
    const entries = resolveIds([...FILL_PALETTE, "subtractive-palette", "fire-in-red", "fire-in-red", "fire-in-red"]);
    const combo = entries.slice(7);

    expect(combo.map((e) => e.resolvedSkillId)).toEqual(["blizzard-in-cyan", "stone-in-yellow", "thunder-in-magenta"]);
    expect(combo.map((e) => e.resolvedPotency)).toEqual([860, 900, 940]);
    expect(combo.map((e) => e.comboErrors)).toEqual([[], [], []]);
    expect(combo.map(aetherhues)).toEqual([["aetherhues-2"], ["aetherhues-3"], []]);
  });

  it("エーテルヒューは通常版と共有する（レッドファイアのあとのサブトラクティブはイエローストーンから）", () => {
    const entries = resolveIds([
      ...FILL_PALETTE,
      "fire-in-red",
      "subtractive-palette",
      "fire-in-red",
      "fire-in-red",
      "fire-in-red",
    ]);
    const [fire, palette, yellow, magenta, cyan] = entries.slice(6);

    expect(fire.resolvedSkillId).toBe("fire-in-red");
    expect(aetherhues(fire)).toEqual(["aetherhues-2"]);
    expect(palette.comboErrors).toEqual([]);
    expect([yellow, magenta, cyan].map((e) => e.resolvedSkillId)).toEqual([
      "stone-in-yellow",
      "thunder-in-magenta",
      "blizzard-in-cyan",
    ]);
    expect([yellow, magenta, cyan].map((e) => e.comboErrors)).toEqual([[], [], []]);
    expect([yellow, magenta, cyan].map(aetherhues)).toEqual([["aetherhues-3"], [], ["aetherhues-2"]]);
  });
});

describe("PCT: エーテルヒューが無いときの色魔法", () => {
  it.each([
    ["aero-in-green", "aetherhues-2"],
    ["water-in-blue", "aetherhues-3"],
  ])("%s をバフ（%s）無しで置くと、そのバフの missing が 1 件だけ出て、エーテルヒューもリソースも変わらない", (skillId, buffId) => {
    const [e] = resolveIds([skillId]);

    expect(e.resolvedSkillId).toBe(skillId);
    expect(e.comboErrors).toEqual([{ buffId, kind: "missing" }]);
    expect(aetherhues(e)).toEqual([]);
    expect(e.resourceSnapshot["palette-gauge"]).toBe(0);
    expect(e.resourceSnapshot["white-paint"]).toBe(0);
  });

  it.each([
    ["stone-in-yellow", "aetherhues-2"],
    ["thunder-in-magenta", "aetherhues-3"],
  ])(
    "サブトラクティブパレット中に %s をバフ（%s）無しで置くと、そのバフの missing が 1 件だけ出て、パレットを消費しない",
    (skillId, buffId) => {
      const entries = resolveIds([...FILL_PALETTE, "subtractive-palette", skillId]);
      const [palette, e] = entries.slice(6);

      expect(aetherhues(palette)).toEqual([]);
      expect(e.resolvedSkillId).toBe(skillId);
      expect(e.comboErrors).toEqual([{ buffId, kind: "missing" }]);
      expect(aetherhues(e)).toEqual([]);
      expect(e.activeBuffs.find((ab) => ab.buffId === "subtractive-palette")?.stacks).toBe(3);
    },
  );

  // 並び順は判定の順で決まるので見ない。パレットは変化先を隠しているので、この状態はレッドファイアからは届かない
  it.each([
    ["stone-in-yellow", "aetherhues-2"],
    ["thunder-in-magenta", "aetherhues-3"],
  ])("%s をサブトラクティブパレットも %s も無しで置くと、それぞれの missing が 1 件ずつ出る", (skillId, buffId) => {
    const [e] = resolveIds([skillId]);
    const byId = [...e.comboErrors].sort((a, b) => a.buffId.localeCompare(b.buffId));

    expect(byId).toEqual([
      { buffId, kind: "missing" },
      { buffId: "subtractive-palette", kind: "missing" },
    ]);
  });
});
