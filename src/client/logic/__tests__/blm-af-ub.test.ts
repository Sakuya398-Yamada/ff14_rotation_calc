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
    // fire-3 cast 3.5s + fire-4 (cast 2.0s, GCD 2.5s) × 13 = 36 秒（30秒を確実に超える）
    for (let i = 0; i < 13; i++) {
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
    // AF3 中のファイジャは MP 消費 2 倍 (-1600) になるため、UH なしでは 6 連射すると MP が
    // 不足する。事前に blizzard-3 → blizzard-4 で UB3 経由 UH 3 を確保し、最初の 3 発を
    // UH で打ち消して MP 切れを回避する（実機の標準ローテーションに近い形）。
    const entries: TimelineEntry[] = [
      entry("blizzard-3"),
      entry("blizzard-4"),
      entry("fire-3"),
    ];
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

describe("BLM: AF/UB バフ連動 MP 消費（#209）", () => {
  it("AF 外のファイアは MP を基本コスト 800 だけ消費する", () => {
    const result = resolveTimeline(
      [entry("fire")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    expect(result.entries[0].resourceErrors).toEqual([]);
    expect(result.entries[0].resourceSnapshot["mp"]).toBe(10000 - 800);
  });

  it("AF 中のファイア系は MP 消費が 2 倍になる（UH なし時）", () => {
    // fire-3 で AF3 付与 → fire-4: AF3 中なので MP -800 が -1600 になる
    const result = resolveTimeline(
      [entry("fire-3"), entry("fire-4")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    expect(result.entries[1].resourceErrors).toEqual([]);
    // fire-3 で MP -2000 (AF未付与のため等倍) → 8000
    // fire-4 で AF3 中、UH なしで MP -1600 → 6400
    expect(result.entries[0].resourceSnapshot["mp"]).toBe(10000 - 2000);
    expect(result.entries[1].resourceSnapshot["mp"]).toBe(10000 - 2000 - 1600);
  });

  it("AF 中でも UH があればファイア系の MP 消費は基本コストに戻り、UH を 1 消費する", () => {
    // blizzard-3 (UB3 付与) → blizzard-4 (UH 3 付与) → fire-3 (AF3 付与) → fire-4 (UH 消費)
    const result = resolveTimeline(
      [entry("blizzard-3"), entry("blizzard-4"), entry("fire-3"), entry("fire-4")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    const fire4Entry = result.entries[3];
    expect(fire4Entry.resourceErrors).toEqual([]);
    // fire-4 直前は UH=3, MP=10000-800-0-2000=7200
    // fire-4 で UH 1 消費して MP -800（倍化打ち消し）
    expect(fire4Entry.resourceSnapshot["mp"]).toBe(10000 - 800 - 0 - 2000 - 800);
    expect(fire4Entry.resourceSnapshot["umbral-heart"]).toBe(2);
  });

  it("UB 中のブリザド系の MP 消費は 0 になる", () => {
    // blizzard で UB1 付与 → blizzard-3 で UB3 付与（UB1 中なのでブリザガの MP -800 は 0 になる）
    const result = resolveTimeline(
      [entry("blizzard"), entry("blizzard-3")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    expect(result.entries[1].resourceErrors).toEqual([]);
    // blizzard: UB 未付与なので MP +400 回復、初期 10000 上限なので 10000 維持
    // blizzard-3: UB1 中なので MP -800 が 0 になる → 10000 維持
    expect(result.entries[0].resourceSnapshot["mp"]).toBe(10000);
    expect(result.entries[1].resourceSnapshot["mp"]).toBe(10000);
    expect(result.entries[1].activeBuffs.some((ab) => ab.buffId === "umbral-ice-3")).toBe(true);
  });

  it("UB 中でも UB を付与する側のスキル（fire-3）には MP 倍率は適用されない", () => {
    // blizzard で UB1 → fire-3 (UB 中だが FIRE 系なので UB の resourceCostMultiplier 対象外)
    const result = resolveTimeline(
      [entry("blizzard"), entry("fire-3")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    // fire-3 は通常通り MP -2000 消費（UB の倍率は BLIZZARD_SKILL_IDS のみに適用）
    expect(result.entries[1].resourceSnapshot["mp"]).toBe(10000 - 2000);
  });

  it("AF 中でも UH が足りなければ MP は 2 倍消費される（UH 残量 0 の場合は打ち消し不成立）", () => {
    // blizzard-4 で UH 3 を確保し、fire-3 → fire-4 × 4 で UH を使い切る
    const entries: TimelineEntry[] = [
      entry("blizzard-3"),
      entry("blizzard-4"),
      entry("fire-3"),
      entry("fire-4"),
      entry("fire-4"),
      entry("fire-4"),
      entry("fire-4"),
    ];
    const result = resolveTimeline(
      entries,
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );
    // 最後の fire-4: UH 0 なので MP -1600（打ち消されない）
    // 4 発目直前の MP = 10000 - 800(blizzard-3) - 0(blizzard-4) - 2000(fire-3) - 800×3(fire-4×3、UH打ち消し)
    //                 = 10000 - 800 - 2000 - 2400 = 4800
    // 4 発目で MP -1600 → 3200
    const lastFire4 = result.entries[result.entries.length - 1];
    expect(lastFire4.resourceErrors).toEqual([]);
    expect(lastFire4.resourceSnapshot["mp"]).toBe(3200);
    expect(lastFire4.resourceSnapshot["umbral-heart"]).toBe(0);
  });
});
