import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

const skillMap = new Map(BRD_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

describe("BRD: エンピリアルアローの詩心付与は歌の実行中のみ (#409)", () => {
  it("歌が無い状態では詩心もソウルボイスも付与されない", () => {
    const result = resolve([entry("empyreal-arrow")]);

    const e = result.entries[0];
    expect(e.recastError).toBeFalsy();
    expect(e.resolvedPotency).toBe(260);
    expect(e.resourceSnapshot["repertoire"]).toBe(0);
    expect(e.resourceSnapshot["soul-voice"]).toBe(0);
  });

  // 賢人のバラード中は詩心が溜まらない（#631）
  it.each([["mages-ballad", 0], ["armys-paeon", 1], ["wanderers-minuet", 1]] as const)(
    "%s の実行中は詩心 +%s・ソウルボイス +5",
    (songId, repertoireGain) => {
      // 歌の直後（自動付与の初回 tick より前）に撃ち、エンピリアルアロー分だけを観測する
      const result = resolve([entry(songId), entry("empyreal-arrow")]);

      const before = result.entries[0];
      const e = result.entries[1];
      expect(before.resourceSnapshot["repertoire"]).toBe(0);
      expect(before.resourceSnapshot["soul-voice"]).toBe(0);
      expect(e.resourceSnapshot["repertoire"]).toBe(repertoireGain);
      expect(e.resourceSnapshot["soul-voice"]).toBe(5);
    },
  );
});
