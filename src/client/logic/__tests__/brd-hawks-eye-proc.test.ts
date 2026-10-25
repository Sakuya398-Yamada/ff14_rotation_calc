import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../skill-level";

// fallbackPotency は Lv76 / Lv82 の上書きで決まるので、App と同じくレベル調整したスキルで解決する (#600)
const buffIds = new Set(BRD_BUFFS.map((b) => b.id));
const resourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
const skillMap = getAllSkillMapForLevel(
  BRD_ATTACK_SKILLS,
  getSkillsForLevel(BRD_ATTACK_SKILLS, 100, buffIds, resourceIds),
  100,
  buffIds,
  resourceIds,
);

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

function grantsHawksEye(skill: Skill): boolean {
  return (
    (skill.buffApplications?.includes("hawks-eye") ?? false) ||
    (skill.traitPotencyOverrides?.some((o) => o.buffApplications?.includes("hawks-eye")) ?? false)
  );
}

describe("BRD: ホークアイ proc 確率の期待値反映 (#118 / #427) と乱れ撃ち (#110)", () => {
  it("スキル定義: リフルジェントアローは barrage 優先 → hawks-eye（付与元の蓄積から期待値）", () => {
    const refulgent = skillMap.get("refulgent-arrow");
    expect(refulgent).toBeDefined();
    expect(refulgent!.potency).toBe(280);
    expect(refulgent!.buffConsumptionAnyOf).toEqual([
      { buffId: "barrage", stacks: 1, potency: 840 },
      { buffId: "hawks-eye", stacks: 1, fallbackPotency: 220 },
    ]);
  });

  // 公式ジョブガイド PvE 欄: ヘヴィショット・クイックノックは 20%、それ以外は 35% (#427)
  it("スキル定義: ホークアイの付与元はすべて付与確率を持つ", () => {
    const rates = Object.fromEntries(
      BRD_ATTACK_SKILLS.filter(grantsHawksEye).map((s) => [s.id, s.buffApplicationProcRates?.["hawks-eye"]]),
    );
    expect(rates).toEqual({
      "heavy-shot": 0.2,
      "quick-nock": 0.2,
      "burst-shot": 0.35,
      ladonsbite: 0.35,
      "iron-jaws": 0.35,
      "caustic-bite": 0.35,
      stormbite: 0.35,
    });
  });

  it("スキル定義: ホークアイの消費側はすべて fallbackPotency を持つ", () => {
    const consumers = [...skillMap.values()].flatMap((s) =>
      (s.buffConsumptionAnyOf ?? [])
        .filter((o) => o.buffId === "hawks-eye")
        .map((o) => [s.id, o.fallbackPotency] as const),
    );
    expect(Object.fromEntries(consumers)).toEqual({
      "straight-shot": 160,
      "refulgent-arrow": 220,
      "wide-volley": 110,
      shadowbite: 140,
    });
  });

  it("バーストショットでホークアイが付与される", () => {
    const result = resolve([entry("burst-shot")]);
    expect(result.entries[0].activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(
      true,
    );
  });

  // ホークアイ付与特性（バイトマスタリー II, Lv76）はコースティックバイト/ストームバイトが対象で、
  // Lv64 で置き換わるベノムバイト/ウィンドバイトとは共存しない (#418)
  it.each(["venomous-bite", "windbite"])("%s ではホークアイが付与されない", (skillId) => {
    const result = resolve([entry(skillId), entry("straight-shot")]);

    expect(result.entries[0].activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(
      false,
    );
    expect(result.entries[1].comboErrors.length).toBeGreaterThan(0);
  });

  it("ホークアイ消費時のリフルジェントアローは期待値威力 241 になる", () => {
    const result = resolve([entry("burst-shot"), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    // floor(220 + (280 - 220) * 0.35) = 241
    expect(refulgent.resolvedPotency).toBe(241);
  });

  it("消費されたホークアイは後続エントリに残らない", () => {
    const result = resolve([
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    // 2発目のリフルジェントアローはホークアイ枯渇でエラーになる
    const second = result.entries[2];
    expect(second.activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(false);
    expect(second.comboErrors.length).toBeGreaterThan(0);
  });

  it("ホークアイなし・乱れ撃ちなしではリフルジェントアローは使用できない", () => {
    const result = resolve([entry("refulgent-arrow")]);

    // buffConsumptionAnyOf 不成立時は先頭候補（barrage）の buffId がエラーとして記録される
    expect(result.entries[0].comboErrors).toContain("barrage");
  });

  it("乱れ撃ち中はホークアイ不要で使用でき、威力 840 固定（proc 期待値は適用されない）", () => {
    const result = resolve([entry("barrage"), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(840);
  });

  it("乱れ撃ちとホークアイが両方有効なら乱れ撃ちを優先消費し、ホークアイは残る", () => {
    const result = resolve([
      entry("barrage"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    // 1発目: barrage 消費で 840
    expect(result.entries[2].resolvedPotency).toBe(840);
    // 2発目: 残っていたホークアイを消費して期待値 241
    const second = result.entries[3];
    expect(second.comboErrors).toEqual([]);
    expect(second.resolvedPotency).toBe(241);
  });

  it.each([
    // floor(fallback + (potency - fallback) * p)
    ["heavy-shot", "straight-shot", 168], // floor(160 + (200 - 160) * 0.2)
    ["quick-nock", "shadowbite", 152], // floor(140 + (200 - 140) * 0.2)
    ["ladonsbite", "shadowbite", 161], // floor(140 + (200 - 140) * 0.35)
  ])("%s → %s は付与元の確率で proc 期待値威力 %i になる", (sourceId, skillId, expected) => {
    const result = resolve([entry(sourceId), entry(skillId)]);

    const e = result.entries[1];
    expect(e.comboErrors).toEqual([]);
    expect(e.resolvedPotency).toBe(expected);
  });

  it.each([
    // P = 1 − Π(1 − p_i)
    [["burst-shot", "burst-shot"], 254], // floor(220 + 60 * (1 − 0.65²))
    [["heavy-shot", "burst-shot"], 248], // floor(220 + 60 * (1 − 0.8 × 0.65))
  ])("付与元 %j の後のリフルジェントアローは蓄積した確率で期待値威力 %i になる", (sourceIds, expected) => {
    const result = resolve([...sourceIds.map((id) => entry(id)), entry("refulgent-arrow")]);

    const refulgent = result.entries[sourceIds.length];
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(expected);
  });

  it("ホークアイを消費すると蓄積がリセットされ、次の消費は新たな付与元だけで計算される", () => {
    const result = resolve([
      entry("burst-shot"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
    ]);

    expect(result.entries[2].resolvedPotency).toBe(254);
    const second = result.entries[4];
    expect(second.recastError).toBeFalsy();
    expect(second.comboErrors).toEqual([]);
    expect(second.resolvedPotency).toBe(241);
  });

  // t=0 の付与元は 30 秒で切れる。t=20 の付与元でホークアイ自体は残っている
  it.each([
    [29.9, 254],
    [30, 241],
  ])("t=%s のリフルジェントアローは 30 秒より前の付与元を数えず期待値威力 %i になる", (time, expected) => {
    const result = resolve([entry("burst-shot"), entry("burst-shot", 20), entry("refulgent-arrow", time)]);

    const refulgent = result.entries[2];
    expect(refulgent.startTime).toBe(time);
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(expected);
  });

  it("乱れ撃ちを優先消費した場合はホークアイの蓄積が残る", () => {
    const result = resolve([
      entry("barrage"),
      entry("burst-shot"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    expect(result.entries[3].resolvedPotency).toBe(840);
    const second = result.entries[4];
    expect(second.comboErrors).toEqual([]);
    expect(second.resolvedPotency).toBe(254);
  });
});
