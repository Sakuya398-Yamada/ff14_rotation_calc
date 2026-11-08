import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

const skillMap = new Map(BRD_ATTACK_SKILLS.map((s) => [s.id, s]));

const SV_TICK_INTERVAL = 3;
const SV_PROC_RATE = 0.8;
const SV_TICK_AMOUNT = 5;
const SV_MAX = 100;

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

function heavyShots(count: number): TimelineEntry[] {
  return Array.from({ length: count }, () => entry("heavy-shot"));
}

describe("BRD: ソウルボイスゲージの蓄積 (#116)", () => {
  it("リソース定義: 最大100、歌バフ中のみ 3 秒ごとの 80% の判定で +5 (#900)", () => {
    const sv = BRD_RESOURCES.find((r) => r.id === "soul-voice");
    expect(sv).toBeDefined();
    expect(sv!.maxStacks).toBe(SV_MAX);
    expect(sv!.autoGenerateInterval).toBe(SV_TICK_INTERVAL);
    expect(sv!.autoGenerateAmount).toBe(SV_TICK_AMOUNT);
    expect(sv!.autoGenerateProcRate).toBe(SV_PROC_RATE);
    expect(sv!.autoGenerateWhileBuff).toEqual([
      "mages-ballad",
      "armys-paeon",
      "wanderers-minuet",
    ]);
  });

  it("歌なしでは時間が経過してもソウルボイスは蓄積しない", () => {
    const result = resolve(heavyShots(10));

    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot["soul-voice"]).toBe(0);
  });

  it("歌（バラード）中は、歌が付いてから 3 秒ごとの判定で +5 ずつ蓄積する（未指定の判定は既定の並び。#900）", () => {
    const result = resolve([entry("mages-ballad"), ...heavyShots(16)]);

    // 判定は歌が付いた時刻から数える。n 回目の判定までに付いた回数は、既定の並びで round(0.8 × n)
    const songStart = result.entries[0].startTime;

    for (const e of result.entries.slice(1)) {
      const ticks = Math.floor((e.startTime - songStart) / SV_TICK_INTERVAL);
      const expected = Math.min(SV_MAX, SV_TICK_AMOUNT * Math.round(SV_PROC_RATE * ticks));
      expect(e.resourceSnapshot["soul-voice"]).toBe(expected);
    }

    // 16 GCD（約 38 秒）経過で 12 回の判定のうち 10 回 = 50 まで蓄積しているはず
    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot["soul-voice"]).toBeGreaterThanOrEqual(45);
    expect(last.resourceSnapshot["soul-voice"]).toBeLessThan(SV_MAX);
  });

  it("エンピリアルアローは歌の実行中のみソウルボイス +5（歌なしでは蓄積しない。#409）", () => {
    const withoutSong = resolve([entry("empyreal-arrow")]);
    expect(withoutSong.entries[0].recastError).toBeFalsy();
    expect(withoutSong.entries[0].resourceSnapshot["soul-voice"]).toBe(0);
    expect(withoutSong.entries[0].resourceSnapshot["repertoire"]).toBe(0);

    // 歌の直後（自動蓄積の初回 tick より前）に撃ち、エンピリアルアロー分だけを観測する
    const withSong = resolve([entry("mages-ballad"), entry("empyreal-arrow")]);
    expect(withSong.entries[1].resourceSnapshot["soul-voice"]).toBe(5);
    // 賢人のバラード中は詩心が溜まらない（#631）
    expect(withSong.entries[1].resourceSnapshot["repertoire"]).toBe(0);
  });

  it("歌を繋いで長時間経過させると 100 で頭打ちになる（上限クリップ）", () => {
    // バラード 45 秒 → 効果が切れる前にパイオンへ繋ぎ、タイマー稼働時間を
    // 75 秒以上確保してソウルボイスを上限 100 まで蓄積させる
    const entries = [
      entry("mages-ballad"),
      ...heavyShots(16),
      entry("armys-paeon"),
      ...heavyShots(20),
    ];
    const result = resolve(entries);

    for (const e of result.entries) {
      expect(e.resourceSnapshot["soul-voice"]).toBeLessThanOrEqual(SV_MAX);
    }
    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot["soul-voice"]).toBe(SV_MAX);
  });
});
