import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { MNK_ATTACK_SKILLS } from "../../data/mnk-skills";
import { MNK_BUFFS } from "../../data/mnk-buffs";
import { MNK_RESOURCES } from "../../data/mnk-resources";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(MNK_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("MNK: 型コンボ（壱→弐→参）と功力", () => {
  it("演武 → 双竜脚 → 双掌打 → 破砕拳 で功力が付与される", () => {
    const result = resolveTimeline(
      [entry("form-shift"), entry("dragon-kick"), entry("twin-snakes"), entry("demolish")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    // 双竜脚は零の型（演武）でバイパス成立
    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resourceSnapshot["opo-fury"]).toBe(1);
    // 双掌打: 双竜脚（壱の型のWS）から弐の型コンボ成立
    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[2].resourceSnapshot["raptor-fury"]).toBe(1);
    // 破砕拳: 参の功力が2スタック付与される
    expect(result.entries[3].wsComboError).toBe(false);
    expect(result.entries[3].resourceSnapshot["coeurl-fury"]).toBe(2);
  });

  it("功力保有時、猿舞連撃／竜頷正拳撃／虎襲崩拳が功力版に自動変化して消費する", () => {
    const result = resolveTimeline(
      [
        entry("form-shift"),
        entry("dragon-kick"), // opo-fury +1
        entry("twin-snakes"), // raptor-fury +1
        entry("demolish"), // coeurl-fury +2
        entry("leaping-opo"), // → leaping-opo-fury (460)
        entry("rising-raptor"), // → rising-raptor-fury (540)
        entry("pouncing-coeurl"), // → pouncing-coeurl-fury (520)、参の功力残1
        entry("dragon-kick"),
        entry("twin-snakes"),
        entry("pouncing-coeurl"), // → 功力版で残りの参の功力を消費
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[4].resolvedSkillId).toBe("leaping-opo-fury");
    expect(result.entries[4].resolvedPotency).toBe(460);
    expect(result.entries[4].resourceSnapshot["opo-fury"]).toBe(0);

    expect(result.entries[5].resolvedSkillId).toBe("rising-raptor-fury");
    expect(result.entries[5].resolvedPotency).toBe(540);
    expect(result.entries[5].resourceSnapshot["raptor-fury"]).toBe(0);

    // 参の功力は2スタックから1ずつ消費される
    expect(result.entries[6].resolvedSkillId).toBe("pouncing-coeurl-fury");
    expect(result.entries[6].resolvedPotency).toBe(520);
    expect(result.entries[6].resourceSnapshot["coeurl-fury"]).toBe(1);

    expect(result.entries[9].resolvedSkillId).toBe("pouncing-coeurl-fury");
    expect(result.entries[9].resourceSnapshot["coeurl-fury"]).toBe(0);
  });

  it("功力なしでは基本威力のまま（自動変化しない）", () => {
    const result = resolveTimeline(
      [entry("form-shift"), entry("leaping-opo")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[1].resolvedSkillId).toBe("leaping-opo");
    expect(result.entries[1].resolvedPotency).toBe(260);
  });

  it("型の順序違反は wsComboError になり功力も付与されない", () => {
    // 双竜脚（壱の型のWS）の直後に破砕拳（参の型のWS）は繋がらない
    const result = resolveTimeline(
      [entry("form-shift"), entry("dragon-kick"), entry("demolish")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[2].wsComboError).toBe(true);
    expect(result.entries[2].resourceSnapshot["coeurl-fury"] ?? 0).toBe(0);
  });

  it("壊神衝は壱の型成立時に威力120、不成立時は110", () => {
    const result = resolveTimeline(
      [entry("arm-of-the-destroyer"), entry("pouncing-coeurl"), entry("arm-of-the-destroyer")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    // 1体目: 型なし → 非コンボ威力
    expect(result.entries[0].wsComboError).toBe(true);
    expect(result.entries[0].resolvedPotency).toBe(110);
    // 3番目の壊神衝は虎襲崩拳（参の型のWS = 壱の型付与）から成立して威力120
    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[2].resolvedPotency).toBe(120);
  });
});
