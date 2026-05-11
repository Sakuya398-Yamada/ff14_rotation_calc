import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("侍: 3系統 WS コンボ（月/花/雪）", () => {
  it("月コンボ: 刃風 → 陣風 → 月光 で月閃+1・剣気が加算される", () => {
    const result = resolveTimeline(
      [entry("hakaze"), entry("jinpu"), entry("gekko")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[0].wsComboError).toBe(false);
    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resolvedPotency).toBe(300);
    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[2].resolvedPotency).toBe(420);
    expect(result.entries[2].resourceSnapshot.getsu).toBe(1);
    expect(result.entries[2].resourceSnapshot.setsu ?? 0).toBe(0);
    expect(result.entries[2].resourceSnapshot.ka ?? 0).toBe(0);
    // 剣気: 刃風(+5) + 陣風(+5) + 月光(+10) = 20
    expect(result.entries[2].resourceSnapshot.kenki).toBe(20);
  });

  it("花コンボ: 刃風 → 士風 → 花車 で花閃+1", () => {
    const result = resolveTimeline(
      [entry("hakaze"), entry("shifu"), entry("kasha")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[2].resolvedPotency).toBe(420);
    expect(result.entries[2].resourceSnapshot.ka).toBe(1);
    expect(result.entries[2].resourceSnapshot.getsu ?? 0).toBe(0);
  });

  it("雪コンボ: 刃風 → 雪風 で雪閃+1", () => {
    const result = resolveTimeline(
      [entry("hakaze"), entry("yukikaze")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resolvedPotency).toBe(340);
    expect(result.entries[1].resourceSnapshot.setsu).toBe(1);
  });

  it("陣風を単独で使うとコンボ不成立で nonComboPotency が適用される", () => {
    const result = resolveTimeline(
      [entry("jinpu")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[0].wsComboError).toBe(true);
    expect(result.entries[0].resolvedPotency).toBe(120);
    // 風月バフは付与されない
    expect(result.entries[0].activeBuffs.some((b) => b.buffId === "fugetsu")).toBe(false);
  });

  it("陣風コンボ成立で風月（与ダメ+13%）が付与され、後続スキルに乗る", () => {
    const result = resolveTimeline(
      [entry("hakaze"), entry("jinpu"), entry("gekko")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    // 月光時点で風月がアクティブ → buffMultiplier に反映
    expect(result.entries[2].buffMultiplier).toBeCloseTo(1.13, 2);
  });

  it("通常コンボ（陣風→月光）では月光時点で風月バフは新たに付与されない（陣風で付与済み）", () => {
    // 月光に comboBuffApplications: ["fugetsu"] は無いため、月光単体では風月を付与しない
    // ただし陣風で付与された風月は持続するため、月光時点でアクティブのまま
    const result = resolveTimeline(
      [entry("hakaze"), entry("jinpu"), entry("gekko")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    // 月光時点で風月はアクティブ（陣風由来）
    const fugetsuAtGekko = result.entries[2].activeBuffs.find((b) => b.buffId === "fugetsu");
    expect(fugetsuAtGekko).toBeDefined();
    // duration リフレッシュされていないこと: 風月の startTime が jinpu 時点（entries[1].startTime）
    expect(fugetsuAtGekko?.startTime).toBeCloseTo(result.entries[1].startTime, 2);
  });

  it("満月の通常コンボ完走では風月バフは付与されない（実機準拠）", () => {
    const result = resolveTimeline(
      [entry("fuga"), entry("mangetsu")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resourceSnapshot.getsu).toBe(1);
    expect(result.entries[1].activeBuffs.some((b) => b.buffId === "fugetsu")).toBe(false);
  });

  it("桜花の通常コンボ完走では風花バフは付与されない（実機準拠）", () => {
    const result = resolveTimeline(
      [entry("fuga"), entry("oka")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].activeBuffs.some((b) => b.buffId === "fuka")).toBe(false);
  });

  it("暁風（Lv92置換）からも陣風コンボが成立する", () => {
    const result = resolveTimeline(
      [entry("gyofu"), entry("jinpu")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resolvedPotency).toBe(300);
  });

  it("風光（Lv86置換）からも満月コンボが成立する", () => {
    const result = resolveTimeline(
      [entry("fuko"), entry("mangetsu")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resourceSnapshot.getsu).toBe(1);
  });

  it("3コンボ完走で閃3つ全て付与される", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("jinpu"), entry("gekko"),    // 月閃
        entry("hakaze"), entry("shifu"), entry("kasha"),    // 花閃
        entry("hakaze"), entry("yukikaze"),                  // 雪閃
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot.getsu).toBe(1);
    expect(last.resourceSnapshot.ka).toBe(1);
    expect(last.resourceSnapshot.setsu).toBe(1);
  });
});
