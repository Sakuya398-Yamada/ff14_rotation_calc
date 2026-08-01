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

/**
 * エンピリアルアロー（cd15s、ソウルボイス+5）を GCD 7 回挟みで n 回撃ち、
 * 歌なし（自動蓄積なし）でソウルボイスを 5n に確定させるシーケンス。
 */
function empyrealCycles(times: number): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (let i = 0; i < times; i++) {
    entries.push(entry("empyreal-arrow"));
    if (i < times - 1) {
      entries.push(...heavyShots(7));
    }
  }
  return entries;
}

function assertNoEmpyrealRecastError(result: ReturnType<typeof resolve>) {
  for (const e of result.entries) {
    if (e.skillId === "empyreal-arrow") {
      expect(e.recastError).toBeFalsy();
    }
  }
}

describe("BRD: エイペックスアローのソウルボイス残量による威力変動 (#111)", () => {
  it("スキル定義: 最低消費 20、potencyScaling 20→140 / 100→700、全量消費", () => {
    const apex = skillMap.get("apex-arrow");
    expect(apex).toBeDefined();
    expect(apex!.resourceChanges).toEqual([{ resourceId: "soul-voice", amount: -20 }]);
    expect(apex!.consumeAllOfResource).toBe("soul-voice");
    expect(apex!.potencyScaling).toEqual({
      resourceId: "soul-voice",
      minAmount: 20,
      minPotency: 140,
      maxAmount: 100,
      maxPotency: 700,
    });
    expect(apex!.buffApplicationIfResource).toEqual({
      resourceId: "soul-voice",
      minAmount: 80,
      buffIds: ["blast-arrow-ready"],
    });
  });

  it("ソウルボイス 0 では使用できない（resourceErrors）", () => {
    const result = resolve([entry("apex-arrow")]);

    const apex = result.entries[0];
    expect(apex.resourceErrors).toContain("soul-voice");
    // エラー時はリソースが変動しない
    expect(apex.resourceSnapshot["soul-voice"]).toBe(0);
  });

  it("ソウルボイス 15（20 未満）でも使用できない", () => {
    const result = resolve([...empyrealCycles(3), entry("apex-arrow")]);
    assertNoEmpyrealRecastError(result);

    const apex = result.entries[result.entries.length - 1];
    expect(apex.resourceErrors).toContain("soul-voice");
    expect(apex.resourceSnapshot["soul-voice"]).toBe(15);
  });

  it("ソウルボイス 20（最低値）で威力 140", () => {
    const result = resolve([...empyrealCycles(4), entry("apex-arrow")]);
    assertNoEmpyrealRecastError(result);

    const apex = result.entries[result.entries.length - 1];
    expect(apex.resourceErrors).toEqual([]);
    // floor(140 + (700 - 140) * (20 - 20) / 80) = 140
    expect(apex.resolvedPotency).toBe(140);
    // 全量消費で 0 になる
    expect(apex.resourceSnapshot["soul-voice"]).toBe(0);
    // 80 未満なのでブラストアローレディは付与されない
    expect(apex.activeBuffs.some((ab) => ab.buffId === "blast-arrow-ready")).toBe(false);
  });

  it("ソウルボイス 25 で威力 175（線形補間）、消費は 20 ではなく全量", () => {
    const result = resolve([...empyrealCycles(5), entry("apex-arrow")]);
    assertNoEmpyrealRecastError(result);

    const apex = result.entries[result.entries.length - 1];
    expect(apex.resourceErrors).toEqual([]);
    // floor(140 + (700 - 140) * (25 - 20) / 80) = 175
    expect(apex.resolvedPotency).toBe(175);
    expect(apex.resourceSnapshot["soul-voice"]).toBe(0);
  });

  it("ソウルボイス 100（最大）で威力 700、ブラストアローレディが付与される", () => {
    // 歌を繋いでソウルボイスを上限 100 まで蓄積してからエイペックスアロー
    const entries = [
      entry("mages-ballad"),
      ...heavyShots(16),
      entry("armys-paeon"),
      ...heavyShots(20),
      entry("apex-arrow"),
    ];
    const result = resolve(entries);

    const apex = result.entries[result.entries.length - 1];
    expect(apex.resourceErrors).toEqual([]);
    expect(apex.resolvedPotency).toBe(700);
    expect(apex.resourceSnapshot["soul-voice"]).toBe(0);
    // 消費前スナップショット 100 >= 80 なのでブラストアローレディが付与される
    expect(apex.activeBuffs.some((ab) => ab.buffId === "blast-arrow-ready")).toBe(true);
  });
});
