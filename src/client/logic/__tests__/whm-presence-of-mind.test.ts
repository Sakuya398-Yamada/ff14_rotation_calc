import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";
import { WHM_BUFFS } from "../../data/whm-buffs";
import { WHM_RESOURCES } from "../../data/whm-resources";

const skillMap = new Map(WHM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, WHM_RESOURCES, undefined, WHM_BUFFS);
}

function glares(count: number): TimelineEntry[] {
  return Array.from({ length: count }, () => entry("glare3"));
}

/** entry のリキャストを startTime と gcdAvailableAt から逆算する */
function recastOf(e: { startTime: number; gcdAvailableAt: number }): number {
  return Math.round((e.gcdAvailableAt - e.startTime) * 1000) / 1000;
}

describe("WHM: 神速魔（プレゼンス・オブ・マインド） (#322)", () => {
  it("バフ定義: 効果時間15秒・GCD/詠唱 20% 短縮（speed 0.8）", () => {
    const pom = WHM_BUFFS.find((b) => b.id === "presence-of-mind");
    expect(pom).toBeDefined();
    expect(pom!.duration).toBe(15);
    expect(pom!.effects).toEqual([{ type: "speed", value: 0.8 }]);
  });

  it("神速魔は presence-of-mind と sacred-sight を同時に付与する", () => {
    const result = resolve([entry("presence-of-mind"), entry("glare3")]);

    const buffs = result.entries[1].activeBuffs;
    expect(buffs.some((ab) => ab.buffId === "presence-of-mind")).toBe(true);
    expect(buffs.some((ab) => ab.buffId === "sacred-sight")).toBe(true);
  });

  it("バフ中はグレアガのリキャストと詠唱が 0.8 倍になり、効果終了後は元に戻る", () => {
    const result = resolve([entry("presence-of-mind"), ...glares(12)]);

    // バフ中の最初のグレアガ: 2.5 → 2.0 / 詠唱 1.5 → 1.2
    const first = result.entries[1];
    expect(recastOf(first)).toBeCloseTo(2.5 * 0.8, 3);
    expect(first.castTime).toBeCloseTo(1.5 * 0.8, 3);

    // 効果時間15秒を大きく過ぎた最後のグレアガは短縮なし
    const last = result.entries[result.entries.length - 1];
    expect(last.startTime).toBeGreaterThan(result.entries[0].startTime + 15);
    expect(last.activeBuffs.some((ab) => ab.buffId === "presence-of-mind")).toBe(false);
    expect(recastOf(last)).toBeCloseTo(2.5, 3);
    expect(last.castTime).toBeCloseTo(1.5, 3);
  });
});

describe("WHM: sacred-sight とグレアジャ (#322)", () => {
  it("バフ定義: 最大3スタック・効果時間30秒、グレアジャは1スタック消費する", () => {
    const sight = WHM_BUFFS.find((b) => b.id === "sacred-sight");
    expect(sight).toBeDefined();
    expect(sight!.maxStacks).toBe(3);
    expect(sight!.duration).toBe(30);

    const glare4 = WHM_ATTACK_SKILLS.find((s) => s.id === "glare4");
    expect(glare4!.buffConsumptions).toEqual([{ buffId: "sacred-sight", stacks: 1 }]);
  });

  it("sacred-sight なしではグレアジャが使用できない（comboErrors）", () => {
    const result = resolve([entry("glare4")]);

    expect(result.entries[0].comboErrors).toContain("sacred-sight");
  });

  it("神速魔後はグレアジャを3回使用でき、4回目はエラーになる", () => {
    const result = resolve([
      entry("presence-of-mind"),
      ...Array.from({ length: 4 }, () => entry("glare4")),
    ]);

    // 1〜3回目: エラーなし・威力640
    for (const e of result.entries.slice(1, 4)) {
      expect(e.comboErrors).toHaveLength(0);
      expect(e.resolvedPotency).toBe(640);
    }

    // activeBuffs は消費適用後の snapshot。1〜2回目時点ではスタックが残り、
    // 3回目で最後のスタックを消費してバフが除去される
    expect(result.entries[1].activeBuffs.some((ab) => ab.buffId === "sacred-sight")).toBe(true);
    expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "sacred-sight")).toBe(true);
    expect(result.entries[3].activeBuffs.some((ab) => ab.buffId === "sacred-sight")).toBe(false);

    // 4回目: 3スタック消費済みでバフが消えており、使用不可
    const fourth = result.entries[4];
    expect(fourth.comboErrors).toContain("sacred-sight");
    expect(fourth.activeBuffs.some((ab) => ab.buffId === "sacred-sight")).toBe(false);
  });
});
