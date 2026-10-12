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

function heavyShots(count: number): TimelineEntry[] {
  return Array.from({ length: count }, () => entry("heavy-shot"));
}

describe("BRD: ピッチパーフェクトのメヌエット限定条件 (#108)", () => {
  it("スキル定義: requiredBuff がメヌエット、詩心 1 以上で全消費、詩心数に応じた段階威力 (#409)", () => {
    const pitch = skillMap.get("pitch-perfect");
    expect(pitch).toBeDefined();
    expect(pitch!.requiredBuff).toBe("wanderers-minuet");
    expect(pitch!.resourceChanges).toEqual([{ resourceId: "repertoire", amount: -1 }]);
    expect(pitch!.consumeAllOfResource).toBe("repertoire");
    expect(pitch!.potencyByResourceAmount).toEqual({
      resourceId: "repertoire",
      potencies: [100, 220, 360],
    });
  });

  it("歌なしでは使用できない（comboErrors）", () => {
    const result = resolve([entry("pitch-perfect")]);
    expect(result.entries[0].comboErrors).toContain("wanderers-minuet");
  });

  it.each(["mages-ballad", "armys-paeon"] as const)(
    "メヌエット以外の歌（%s）中も使用できない",
    (songId) => {
      const result = resolve([entry(songId), entry("pitch-perfect")]);
      expect(result.entries[1].comboErrors).toContain("wanderers-minuet");
    },
  );

  it("メヌエット中でも詩心 0 では使用できない（resourceErrors）", () => {
    const result = resolve([entry("wanderers-minuet"), entry("pitch-perfect")]);

    const pitch = result.entries[1];
    // 歌の条件は満たしている
    expect(pitch.comboErrors).toEqual([]);
    // 詩心はまだ蓄積していないためリソース不足
    expect(pitch.resourceErrors).toContain("repertoire");
  });

  it("メヌエット中に詩心 3（上限）まで蓄積すれば使用でき、威力 360 で詩心を全て消費する", () => {
    // 詩心は歌中 3.75 秒ごとに +1（上限 3）。GCD 8 回（約 18 秒）で確実に上限到達
    const result = resolve([
      entry("wanderers-minuet"),
      ...heavyShots(8),
      entry("pitch-perfect"),
    ]);

    const entries = result.entries;
    const pitch = entries[entries.length - 1];
    const beforePitch = entries[entries.length - 2];

    // 事前に上限 3 でクリップされていることを確認（上限キャップの検証を兼ねる）
    expect(beforePitch.resourceSnapshot["repertoire"]).toBe(3);

    expect(pitch.comboErrors).toEqual([]);
    expect(pitch.resourceErrors).toEqual([]);
    expect(pitch.resolvedPotency).toBe(360);
    expect(pitch.resourceSnapshot["repertoire"]).toBe(0);
  });

  it("詩心 1 で威力 100、詩心 2 で威力 220 になり、いずれも詩心を全て消費する (#409)", () => {
    // メヌエット直後のエンピリアルアローで詩心 1（自動付与の初回 tick より前）
    const one = resolve([
      entry("wanderers-minuet"),
      entry("empyreal-arrow"),
      entry("pitch-perfect"),
    ]);
    expect(one.entries[1].resourceSnapshot["repertoire"]).toBe(1);
    expect(one.entries[2].resourceErrors).toEqual([]);
    expect(one.entries[2].resolvedPotency).toBe(100);
    expect(one.entries[2].resourceSnapshot["repertoire"]).toBe(0);

    // エンピリアルアロー +1 と自動付与 1 tick で詩心 2
    const two = resolve([
      entry("wanderers-minuet"),
      entry("empyreal-arrow"),
      ...heavyShots(3),
      entry("pitch-perfect"),
    ]);
    const pitch = two.entries[two.entries.length - 1];
    expect(two.entries[two.entries.length - 2].resourceSnapshot["repertoire"]).toBe(2);
    expect(pitch.resourceErrors).toEqual([]);
    expect(pitch.resolvedPotency).toBe(220);
    expect(pitch.resourceSnapshot["repertoire"]).toBe(0);
  });
});
