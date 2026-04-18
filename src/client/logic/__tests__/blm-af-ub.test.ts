import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("BLM: AF/UB 排他と威力倍率", () => {
  it("ファイア使用で AF1 が付与され、ブリザド使用で UB1 が付与される（AF/UB は排他）", () => {
    const result = resolveTimeline(
      [entry("fire"), entry("blizzard")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    // ファイア直後は AF1 がアクティブ
    const afterFire = result.entries[0];
    expect(afterFire.activeBuffs.some((ab) => ab.buffId === "astral-fire-1")).toBe(true);
    // ブリザド後: AF1 は同一 exclusiveGroup により解除され、UB1 が付与されている
    const afterBlizzard = result.entries[1];
    expect(afterBlizzard.activeBuffs.some((ab) => ab.buffId === "astral-fire-1")).toBe(false);
    expect(afterBlizzard.activeBuffs.some((ab) => ab.buffId === "umbral-ice-1")).toBe(true);
  });

  it("AF3 中のファイジャは威力倍率（AF3 fire +80% × エノキアン +23% ≒ 2.214）が適用される", () => {
    // fire-3（ファイガ）で AF3 を付与 → fire-4（ファイジャ）
    const result = resolveTimeline(
      [entry("fire-3"), entry("fire-4")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const fighjaEntry = result.entries[1];
    // ファイジャは要求バフ AF3 を満たしており、威力倍率 ≒ 1.8 × 1.23 = 2.214
    expect(fighjaEntry.comboErrors).toEqual([]);
    expect(fighjaEntry.buffMultiplier).toBeCloseTo(1.8 * 1.23, 5);
  });

  it("AF3 中のブリザド系は威力倍率（AF3 blizzard -30% × エノキアン +23% ≒ 0.861）が適用される", () => {
    const result = resolveTimeline(
      // ブリザドを AF3 中に使う異例ケース（AF3付与直後にブリザド）
      [entry("fire-3"), entry("blizzard")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const blizzardEntry = result.entries[1];
    // ブリザドは AF3 の -30% と enochian +23% の両方が適用される
    expect(blizzardEntry.buffMultiplier).toBeCloseTo(0.7 * 1.23, 5);
  });

  it("UB3 中のブリザジャは威力倍率がエノキアン +23% のみ（blizzard は UB でブースト対象外）", () => {
    // blizzard-3（ブリザガ）で UB3 を付与 → blizzard-4（ブリザジャ）
    const result = resolveTimeline(
      [entry("blizzard-3"), entry("blizzard-4")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const blizzja = result.entries[1];
    expect(blizzja.comboErrors).toEqual([]);
    // UB3 中のブリザジャ: エノキアン倍率のみ
    expect(blizzja.buffMultiplier).toBeCloseTo(1.23, 5);
  });

  it("AF/UB 以外のスキル（ハイサンダー）にもエノキアン倍率は適用される", () => {
    // fire-3 で AF3 + thunderhead を付与 → high-thunder（サンダーヘッド要求を満たす）
    const result = resolveTimeline(
      [entry("fire-3"), entry("high-thunder")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const highThunder = result.entries[1];
    // ハイサンダーは fire/blizzard どちらでもない → appliesToSkillIds フィルタに引っかからず
    // エノキアン倍率 1.23 のみ適用される
    expect(highThunder.buffMultiplier).toBeCloseTo(1.23, 5);
  });
});

describe("BLM: サンダーヘッドとサンダー系 DoT", () => {
  it("ハイサンダーはサンダーヘッド付与が要求され、DoT を適用する", () => {
    // fire-3 で thunderhead + AF3 を付与 → high-thunder
    const result = resolveTimeline(
      [entry("fire-3"), entry("high-thunder")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const highThunder = result.entries[1];
    expect(highThunder.comboErrors).toEqual([]);
    // DoT が生成されている
    expect(result.dotTicks.length).toBeGreaterThan(0);
    expect(result.dotTicks[0].skillId).toBe("high-thunder");
  });

  it("サンダーヘッドなしでハイサンダーを使うと requiredBuff エラーになる", () => {
    const result = resolveTimeline(
      [entry("high-thunder")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    expect(result.entries[0].comboErrors).toContain("thunderhead");
  });
});

describe("BLM: ポリグロット自動蓄積", () => {
  it("AF/UB 中は 30 秒ごとにポリグロットが 1 蓄積される", () => {
    // fire-3 で AF3 を付与し、以降 GCD を多数配置して 30 秒経過させる
    const entries: TimelineEntry[] = [entry("fire-3")];
    // GCD 2.5s × 12 回 = 30 秒
    for (let i = 0; i < 12; i++) {
      entries.push(entry("fire-4"));
    }
    const result = resolveTimeline(
      entries,
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    const lastEntry = result.entries[result.entries.length - 1];
    // 30 秒前後経過した時点でポリグロットが少なくとも 1 蓄積されていること
    expect(lastEntry.resourceSnapshot["polyglot"]).toBeGreaterThanOrEqual(1);
  });
});

describe("BLM: マナフォント", () => {
  it("マナフォントは MP 全回復 + AF3 + アンブラルハート3 + ファイアスターター + サンダーヘッドを付与する", () => {
    // 先に fire-3 で MP を消費 → manafont で回復
    const result = resolveTimeline(
      [entry("fire-3"), entry("manafont")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const manafontEntry = result.entries[1];
    expect(manafontEntry.comboErrors).toEqual([]);
    expect(manafontEntry.resourceErrors).toEqual([]);
    expect(manafontEntry.resourceSnapshot["mp"]).toBe(10000);
    expect(manafontEntry.resourceSnapshot["umbral-heart"]).toBe(3);
    expect(manafontEntry.resourceSnapshot["paradox-gauge"]).toBe(1);
    expect(manafontEntry.activeBuffs.some((ab) => ab.buffId === "astral-fire-3")).toBe(true);
    expect(manafontEntry.activeBuffs.some((ab) => ab.buffId === "firestarter")).toBe(true);
    expect(manafontEntry.activeBuffs.some((ab) => ab.buffId === "thunderhead")).toBe(true);
  });
});

describe("BLM: フレアスターとアストラルソウル", () => {
  it("アストラルソウル 6 が無い状態でフレアスターを使うと resourceErrors が発生する", () => {
    const result = resolveTimeline(
      [entry("fire-3"), entry("flare-star")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    // astral-soul 0 で -6 しようとして不足エラー
    expect(result.entries[1].resourceErrors).toContain("astral-soul");
  });

  it("ファイジャ 6 発でアストラルソウル 6 蓄積後、フレアスターを使うと正常に実行される", () => {
    const entries: TimelineEntry[] = [entry("fire-3")];
    for (let i = 0; i < 6; i++) entries.push(entry("fire-4"));
    entries.push(entry("flare-star"));

    const result = resolveTimeline(
      entries,
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    const flareStarEntry = result.entries[result.entries.length - 1];
    expect(flareStarEntry.resourceErrors).toEqual([]);
    expect(flareStarEntry.resourceSnapshot["astral-soul"]).toBe(0);
  });
});
