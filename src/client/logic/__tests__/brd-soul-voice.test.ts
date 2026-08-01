import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

const skillMap = new Map(BRD_ATTACK_SKILLS.map((s) => [s.id, s]));

const SV_TICK_INTERVAL = 3.75;
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
  it("リソース定義: 最大100、歌バフ中のみ 3.75 秒ごとに +5", () => {
    const sv = BRD_RESOURCES.find((r) => r.id === "soul-voice");
    expect(sv).toBeDefined();
    expect(sv!.maxStacks).toBe(SV_MAX);
    expect(sv!.autoGenerateInterval).toBe(SV_TICK_INTERVAL);
    expect(sv!.autoGenerateAmount).toBe(SV_TICK_AMOUNT);
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

  it("歌（バラード）中は経過時間に応じて 3.75 秒ごとに +5 ずつ蓄積する", () => {
    const result = resolve([entry("mages-ballad"), ...heavyShots(16)]);

    // 自動生成タイマーは歌バフが有効になった直後のエントリ処理時に開始される
    const timerStart = result.entries[1].startTime;

    for (const e of result.entries.slice(1)) {
      const ticks = Math.floor((e.startTime - timerStart) / SV_TICK_INTERVAL);
      const expected = Math.min(SV_MAX, SV_TICK_AMOUNT * ticks);
      expect(e.resourceSnapshot["soul-voice"]).toBe(expected);
    }

    // 16 GCD（約 37.5 秒）経過で 10 tick = 50 まで蓄積しているはず
    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot["soul-voice"]).toBeGreaterThanOrEqual(45);
    expect(last.resourceSnapshot["soul-voice"]).toBeLessThan(SV_MAX);
  });

  it("エンピリアルアローでソウルボイス +5（歌なしでも蓄積する）", () => {
    const result = resolve([entry("empyreal-arrow")]);

    const e = result.entries[0];
    expect(e.recastError).toBeFalsy();
    expect(e.resourceSnapshot["soul-voice"]).toBe(5);
    expect(e.resourceSnapshot["repertoire"]).toBe(1);
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
