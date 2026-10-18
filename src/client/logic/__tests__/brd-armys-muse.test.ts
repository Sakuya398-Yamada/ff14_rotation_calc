import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import type { ActiveBuff, PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

// 特性「軍神のパイオン効果アップ」（Lv78）の軍神の加護・軍神の契約 (#420)
function resolveAt(entries: TimelineEntry[], level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(BRD_BUFFS, level);
  const resources = getResourcesForLevel(BRD_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  return resolveTimeline(entries, skillMap, resources, undefined, buffs);
}

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function repeat(skillId: string, count: number): TimelineEntry[] {
  return Array.from({ length: count }, () => entry(skillId));
}

function findBuff(e: ResolvedTimelineEntry, prefix: string): ActiveBuff | undefined {
  return e.activeBuffs.find((ab) => ab.buffId.startsWith(prefix));
}

function gap(a: ResolvedTimelineEntry, b: ResolvedTimelineEntry): number {
  return Math.round((b.startTime - a.startTime) * 1000) / 1000;
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

// パイオン(0) → バーストショット(0.65) のあと、詩心は 4.4 / 8.15 / 11.9 / 15.65 秒に 1 つずつ付く
const SONG_TIME_BY_REPERTOIRE: [number, number, number][] = [
  [1, 5, 2.475],
  [2, 9, 2.45],
  [3, 12.5, 2.4],
  [4, 16.5, 2.2],
];
const OVERWRITING_SONGS = ["mages-ballad", "wanderers-minuet"] as const;
const ALL_SONGS = ["mages-ballad", "armys-paeon", "wanderers-minuet"];

describe("BRD: 軍神のパイオン中の歌で付く軍神の加護 (#420)", () => {
  it.each(OVERWRITING_SONGS)("パイオン中・詩心 4 で %s を使うと軍神の加護（詩心4）が 10 秒付く", (song) => {
    const result = resolveAt([entry("armys-paeon"), entry("burst-shot"), entry(song, 16.5)]);
    const songEntry = result.entries[2];
    expect(songEntry.activeBuffsAtUse.some((ab) => ab.buffId === "armys-paeon")).toBe(true);
    expect(findBuff(songEntry, "armys-muse")).toMatchObject({
      buffId: "armys-muse-4",
      startTime: 16.5,
      endTime: 26.5,
    });
  });

  it.each(SONG_TIME_BY_REPERTOIRE)(
    "詩心 %s（%s 秒に歌う）なら、軍神の加護中の GCD が %s 秒になる",
    (repertoire, songTime, expectedGap) => {
      const result = resolveAt([
        entry("armys-paeon"),
        entry("burst-shot"),
        entry("wanderers-minuet", songTime),
        ...repeat("burst-shot", 2),
      ]);
      const [, , song, a, b] = result.entries;
      expect(song.activeBuffsAtUse.some((ab) => ab.buffId === "armys-paeon")).toBe(true);
      expect(findBuff(song, "armys-muse")?.buffId).toBe(`armys-muse-${repertoire}`);
      expectNoError(a);
      expectNoError(b);
      expect(gap(a, b)).toBe(expectedGap);
    }
  );

  it("軍神の加護が 10 秒で切れると GCD は 2.5 秒に戻る", () => {
    const result = resolveAt([
      entry("armys-paeon"),
      entry("burst-shot"),
      entry("wanderers-minuet", 16.5),
      ...repeat("burst-shot", 8),
    ]);
    const bursts = result.entries.slice(3);
    const afterExpire = bursts.findIndex((e) => e.startTime >= 26.5);
    expect(afterExpire).toBeGreaterThan(0);
    expect(gap(bursts[afterExpire - 1], bursts[afterExpire])).toBe(2.2);
    expectNoError(bursts[afterExpire + 1]);
    expect(findBuff(bursts[afterExpire], "armys-muse")).toBeUndefined();
    expect(gap(bursts[afterExpire], bursts[afterExpire + 1])).toBe(2.5);
  });

  it("パイオン外の歌の上書きでは、詩心があっても軍神の加護は付かない", () => {
    const result = resolveAt([entry("mages-ballad"), ...repeat("burst-shot", 10), entry("wanderers-minuet")]);
    const before = result.entries[result.entries.length - 2];
    expect(before.resourceSnapshot["repertoire"]).toBeGreaterThan(0);
    expect(findBuff(result.entries[result.entries.length - 1], "armys-muse")).toBeUndefined();
  });

  it("パイオン中でも詩心 0 なら軍神の加護は付かない", () => {
    const result = resolveAt([entry("armys-paeon"), entry("wanderers-minuet")]);
    const song = result.entries[1];
    expect(song.activeBuffsAtUse.some((ab) => ab.buffId === "armys-paeon")).toBe(true);
    expect(song.resourceSnapshot["repertoire"]).toBe(0);
    expect(findBuff(song, "armys-muse")).toBeUndefined();
  });
});

describe("BRD: 軍神のパイオンの時間切れで付く軍神の契約 (#420)", () => {
  it("詩心が残ったままパイオンが時間切れになると、切れた時刻から軍神の契約（詩心4）が 30 秒付く", () => {
    const result = resolveAt([entry("armys-paeon"), ...repeat("burst-shot", 25)]);
    const first = result.entries.find((e) => e.startTime >= 45);
    expect(first).toBeDefined();
    expect(findBuff(first!, "armys-ethos")).toMatchObject({
      buffId: "armys-ethos-4",
      startTime: 45,
      endTime: 75,
    });
  });

  it.each(OVERWRITING_SONGS)("契約中に %s を使うと軍神の加護（詩心4）が付き、契約は消える", (song) => {
    const result = resolveAt([entry("armys-paeon"), ...repeat("burst-shot", 25), entry(song), ...repeat("burst-shot", 2)]);
    const songIdx = result.entries.findIndex((e) => e.skillId === song);
    const [songEntry, a, b] = result.entries.slice(songIdx, songIdx + 3);
    expect(songEntry.activeBuffsAtUse.some((ab) => ab.buffId === "armys-ethos-4")).toBe(true);
    expect(findBuff(songEntry, "armys-muse")?.buffId).toBe("armys-muse-4");
    expect(findBuff(songEntry, "armys-ethos")).toBeUndefined();
    expectNoError(a);
    expectNoError(b);
    expect(gap(a, b)).toBe(2.2);
  });

  it.each([
    [74, true],
    [80, false],
  ])("パイオンが 45 秒で切れたあと %s 秒に歌うと、軍神の加護が付く: %s", (songTime, expected) => {
    const result = resolveAt([entry("armys-paeon"), ...repeat("burst-shot", 10), entry("mages-ballad", songTime)]);
    expect(result.entries[result.entries.length - 2].resourceSnapshot["repertoire"]).toBe(4);
    const song = result.entries[result.entries.length - 1];
    expect(findBuff(song, "armys-muse") !== undefined).toBe(expected);
    expect(findBuff(song, "armys-ethos")).toBeUndefined();
  });

  it.each([1, 2, 3, 4])("軍神の契約（詩心%s）は 3 曲のどれでも同じ詩心数の軍神の加護を付ける", (n) => {
    const ethos = BRD_BUFFS.find((b) => b.id === `armys-ethos-${n}`);
    expect(ethos?.effects).toEqual([
      expect.objectContaining({
        type: "applyBuffOnSkill",
        appliedBuffId: `armys-muse-${n}`,
        appliesToSkillIds: ALL_SONGS,
      }),
    ]);
  });
});

describe("BRD: 軍神のパイオン効果アップの修得レベル (#420)", () => {
  it("Lv70 ではパイオン中に詩心があっても、歌の上書きで軍神の加護は付かない", () => {
    const result = resolveAt([entry("armys-paeon"), ...repeat("heavy-shot", 10), entry("wanderers-minuet")], 70);
    expect(result.entries[result.entries.length - 2].resourceSnapshot["repertoire"]).toBeGreaterThan(0);
    expect(findBuff(result.entries[result.entries.length - 1], "armys-muse")).toBeUndefined();
  });

  it("Lv70 ではパイオンが時間切れになっても軍神の契約は付かない", () => {
    const result = resolveAt([entry("armys-paeon"), ...repeat("heavy-shot", 25)], 70);
    expect(result.entries[result.entries.length - 1].startTime).toBeGreaterThan(45);
    expect(result.entries.some((e) => findBuff(e, "armys-ethos"))).toBe(false);
  });
});
