import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../skill-level";
import {
  getAutoGenerateProcSource,
  isAutoGenerateProcOccurred,
  isDefaultAutoGenerateProc,
} from "../auto-generate-proc";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

const LEVEL = 100;
const SONGS = ["mages-ballad", "armys-paeon", "wanderers-minuet"] as const;

function buildSkillMap() {
  const buffIds = new Set(BRD_BUFFS.map((b) => b.id));
  const resourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
  const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, LEVEL, buffIds, resourceIds);
  return getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, LEVEL, buffIds, resourceIds);
}

const skillMap = buildSkillMap();
const buffDefMap = new Map(BRD_BUFFS.map((b) => [b.id, b]));

let uidSeq = 0;
function entry(skillId: string, manualStartTime?: number, autoGenerateProcOccurred?: (boolean | null)[]): TimelineEntry {
  return { uid: `${skillId}-${uidSeq++}`, skillId, manualStartTime, autoGenerateProcOccurred };
}

function resolve(entries: TimelineEntry[], hitDelays?: Record<string, number>) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS, undefined, undefined, hitDelays);
}

/** 歌を 0 秒に置き、3, 6, …, 42 秒（判定の時刻ちょうど）にバーストショットを置いて、各判定の直後の値を取る */
function valuesAtTicks(song: string, spec?: (boolean | null)[], resourceId = "soul-voice") {
  const ticks = Array.from({ length: 14 }, (_, i) => 3 * (i + 1));
  const result = resolve([entry(song, 0, spec), ...ticks.map((t) => entry("burst-shot", t))]);
  const probes = result.entries.slice(1);
  for (const [i, p] of probes.entries()) {
    expect(p.startTime).toBe(ticks[i]);
    expect(p.recastError).toBe(false);
  }
  return probes.map((p) => p.resourceSnapshot[resourceId]);
}

/** 累計の値から、判定ごとに増えたかを出す */
function gains(values: number[]): boolean[] {
  return values.map((v, i) => v > (i === 0 ? 0 : values[i - 1]));
}

// 未指定の判定は 3・8・13 回目が不発（14 回中 11 回）
const DEFAULT_PATTERN = [true, true, false, true, true, true, true, false, true, true, true, true, false, true];

describe("BRD: 詩心・ソウルボイスは歌の効果中の 3 秒ごとの判定で付き、判定ごとに発生を指定できる (#900)", () => {
  it("既定の並びは、n 回目までの発生数が round(0.8 × n) になる並び（3・8・13 回目が不発）", () => {
    const pattern = Array.from({ length: 14 }, (_, i) => isDefaultAutoGenerateProc(i + 1, 0.8));
    expect(pattern).toEqual(DEFAULT_PATTERN);
    expect(pattern.filter(Boolean)).toHaveLength(11);
  });

  it("指定した判定は既定の並びより優先し、null と範囲外は既定の並びになる", () => {
    expect(isAutoGenerateProcOccurred([null, false, true], 1, 0.8)).toBe(true);
    expect(isAutoGenerateProcOccurred([null, false, true], 2, 0.8)).toBe(false);
    expect(isAutoGenerateProcOccurred([null, false, true], 3, 0.8)).toBe(true);
    expect(isAutoGenerateProcOccurred([null, false, true], 8, 0.8)).toBe(false);
    expect(isAutoGenerateProcOccurred(undefined, 4, 0.8)).toBe(true);
  });

  it.each(SONGS)("%s の判定は歌が付いてから 3〜42 秒の 14 回で、未指定なら既定の並びで付く（ソウルボイスで見る）", (song) => {
    expect(gains(valuesAtTicks(song))).toEqual(DEFAULT_PATTERN);
  });

  it.each(SONGS)("%s の効果 45 秒で、未指定の判定は 11 回付く（時間切れちょうどの 45 秒は判定しない）", (song) => {
    const after = resolve([entry(song, 0), entry("burst-shot", 50)]).entries[1];
    expect(after.activeBuffs.some((ab) => ab.buffId === song)).toBe(false);
    expect(after.resourceSnapshot["soul-voice"]).toBe(55);
  });

  it("「発生した」に指定した判定で詩心が付き、「しなかった」に指定した判定で付かない", () => {
    // 3 回目（既定は不発）を発生に、4 回目（既定は発生）を不発に、1 回目を不発に指定する
    const spec = [false, true, true, false];
    expect(valuesAtTicks("wanderers-minuet", spec, "repertoire").slice(0, 4)).toEqual([0, 1, 2, 2]);
    expect(valuesAtTicks("armys-paeon", spec, "repertoire").slice(0, 4)).toEqual([0, 1, 2, 2]);
    // 指定が無ければ 1・2・4 回目で付く
    expect(valuesAtTicks("wanderers-minuet", undefined, "repertoire").slice(0, 4)).toEqual([1, 2, 2, 3]);
  });

  it.each(SONGS)("ソウルボイスは、%s の発生した判定でだけ +5 される", (song) => {
    const allOccurred = Array.from({ length: 14 }, () => true);
    const noneOccurred = Array.from({ length: 14 }, () => false);
    expect(valuesAtTicks(song, allOccurred)[13]).toBe(70);
    expect(valuesAtTicks(song, noneOccurred)[13]).toBe(0);
    const mixed = [true, false, null, false, true];
    expect(gains(valuesAtTicks(song, mixed)).slice(0, 5)).toEqual([true, false, false, false, true]);
  });

  it("ピッチパーフェクトの威力は、指定した判定で付いた詩心の数で決まる", () => {
    // 9.5 秒（3 回目の判定の後）に撃つ。未指定なら 3 回目は不発で詩心 2
    const pitchAt = (spec?: (boolean | null)[]) =>
      resolve([entry("wanderers-minuet", 0, spec), entry("pitch-perfect", 9.5)]).entries[1];
    for (const [spec, potency] of [[undefined, 220], [[true, true, true], 360], [[false, false, true], 100]] as const) {
      const pitch = pitchAt(spec ? [...spec] : undefined);
      expect(pitch.resourceErrors).toEqual([]);
      expect(pitch.recastError).toBe(false);
      expect(pitch.resolvedPotency).toBe(potency);
    }
  });

  it("賢人のバラード中は、発生した判定でだけブラッドレッター系のリキャストが 7.5 秒短縮される", () => {
    // 歌 → ハートブレイクショット 3 回でチャージを使い切り、6 秒（2 回目の判定）に 4 回目を置く。
    // 最初のチャージの回復は 15.65 秒。2 回の短縮で 6 秒に戻り、1 回だけなら 8.15 秒まで戻らない
    const fourthAt = (t: number, spec?: (boolean | null)[]) =>
      resolve([
        entry("mages-ballad", 0, spec),
        entry("heartbreak-shot"),
        entry("heartbreak-shot"),
        entry("heartbreak-shot"),
        entry("heartbreak-shot", t),
      ]).entries[4];
    expect(fourthAt(6).recastError).toBe(false);
    expect(fourthAt(6, [true, false]).recastError).toBe(true);
    expect(fourthAt(6, [false, true]).recastError).toBe(true);
    expect(fourthAt(8.15, [false, true]).recastError).toBe(false);
  });

  it("歌に着弾までの遅れを設定すると、判定は歌が付く着弾時刻から数え、指定も同じ歌のものを引く (#948)", () => {
    // 1 秒の遅れで、歌は 1 秒に付く。判定は 4, 7, 10 秒
    const at = (t: number, spec?: (boolean | null)[]) =>
      resolve([entry("wanderers-minuet", 0, spec), entry("burst-shot", t)], { "wanderers-minuet": 1 }).entries[1]
        .resourceSnapshot["repertoire"];
    expect(at(3.9)).toBe(0);
    expect(at(4)).toBe(1);
    expect(at(4, [false])).toBe(0);
    expect(at(7, [false, true])).toBe(1);
  });

  it("歌を別の歌で上書きすると、上書きした歌の指定と判定の数え直しになる", () => {
    // パイオンを全部不発に指定し、10 秒にメヌエット（指定なし）で上書きする。メヌエットの判定は 13, 16 秒
    const none = Array.from({ length: 14 }, () => false);
    const result = resolve([
      entry("armys-paeon", 0, none),
      entry("burst-shot", 9),
      entry("wanderers-minuet", 10),
      entry("burst-shot", 13),
      entry("burst-shot", 16),
    ]).entries;
    expect(result[1].resourceSnapshot["repertoire"]).toBe(0);
    expect(result[3].resourceSnapshot["repertoire"]).toBe(1);
    expect(result[4].resourceSnapshot["repertoire"]).toBe(2);
  });

  it("歌の判定の回数と間隔は、歌の効果時間と自動生成の間隔から決まる（UI で並べる数。効果時間は残り秒数の表示に使う）", () => {
    for (const song of SONGS) {
      const source = getAutoGenerateProcSource(skillMap.get(song)!, BRD_RESOURCES, buffDefMap);
      expect(source).toEqual({ buffId: song, rate: 0.8, interval: 3, tickCount: 14, duration: 45 });
    }
    expect(getAutoGenerateProcSource(skillMap.get("burst-shot")!, BRD_RESOURCES, buffDefMap)).toBeUndefined();
    expect(getAutoGenerateProcSource(skillMap.get("battle-voice")!, BRD_RESOURCES, buffDefMap)).toBeUndefined();
  });

  it("解決結果のエントリに、元のエントリの指定を写す", () => {
    const spec = [true, null, false];
    const [song, shot] = resolve([entry("wanderers-minuet", 0, spec), entry("burst-shot")]).entries;
    expect(song.autoGenerateProcOccurred).toEqual(spec);
    expect(shot.autoGenerateProcOccurred).toBeUndefined();
  });
});
