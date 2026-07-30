import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { MNK_ATTACK_SKILLS } from "../../data/mnk-skills";
import { MNK_BUFFS } from "../../data/mnk-buffs";
import { MNK_RESOURCES } from "../../data/mnk-resources";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(MNK_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

describe("MNK: 踏鳴とビーストチャクラ・必殺技", () => {
  it("踏鳴中は型不問で WS が成立し、型に応じたビーストチャクラが付与される", () => {
    const result = resolveTimeline(
      [
        entry("perfect-balance"),
        entry("leaping-opo"),
        entry("leaping-opo"),
        entry("leaping-opo"),
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    // 連続で壱の型のWSを使ってもバイパス成立
    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[3].wsComboError).toBe(false);
    // 壱のチャクラが3つ付与され、踏鳴3スタックは消費し切って消える
    expect(result.entries[3].resourceSnapshot["opo-chakra"]).toBe(3);
    expect(result.entries[3].activeBuffs.some((ab) => ab.buffId === "perfect-balance")).toBe(false);
  });

  it("同種チャクラ3つで必殺技が真空波に変化し、陰の闘気と零の型を得る", () => {
    const result = resolveTimeline(
      [
        entry("perfect-balance"),
        entry("leaping-opo"),
        entry("leaping-opo"),
        entry("leaping-opo"),
        entry("masterful-blitz"),
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    const blitz = result.entries[4];
    expect(blitz.resolvedSkillId).toBe("elixir-burst");
    expect(blitz.resolvedPotency).toBe(900);
    expect(blitz.resourceSnapshot["lunar-nadi"]).toBe(1);
    expect(blitz.resourceSnapshot["opo-chakra"]).toBe(0);
    expect(blitz.activeBuffs.some((ab) => ab.buffId === "formless-fist")).toBe(true);
  });

  it("3種チャクラで必殺技が鳳凰の舞に変化し、陽の闘気を得る", () => {
    const result = resolveTimeline(
      [
        entry("perfect-balance"),
        entry("leaping-opo"),
        entry("rising-raptor"),
        entry("pouncing-coeurl"),
        entry("masterful-blitz"),
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    const blitz = result.entries[4];
    expect(blitz.resolvedSkillId).toBe("rising-phoenix");
    expect(blitz.resolvedPotency).toBe(900);
    expect(blitz.resourceSnapshot["solar-nadi"]).toBe(1);
  });

  it("2+1のチャクラで必殺技が天宙脚に変化する", () => {
    const result = resolveTimeline(
      [
        entry("perfect-balance"),
        entry("leaping-opo"),
        entry("leaping-opo"),
        entry("rising-raptor"),
        entry("masterful-blitz"),
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    const blitz = result.entries[4];
    expect(blitz.resolvedSkillId).toBe("celestial-revolution");
    expect(blitz.resolvedPotency).toBe(600);
    expect(blitz.resourceSnapshot["lunar-nadi"]).toBe(1);
  });

  it("陰陽の闘気が揃った状態でチャクラ3つなら夢幻闘舞に変化し、両闘気を消費する", () => {
    const result = resolveTimeline(
      [
        // 1回目: 真空波で陰の闘気
        entry("perfect-balance"),
        entry("leaping-opo"),
        entry("leaping-opo"),
        entry("leaping-opo"),
        entry("masterful-blitz"),
        // 2回目: 鳳凰の舞で陽の闘気
        entry("perfect-balance"),
        entry("leaping-opo"),
        entry("rising-raptor"),
        entry("pouncing-coeurl"),
        entry("masterful-blitz"),
        // 3回目: 踏鳴のリキャスト（40秒 × 2チャージ）回復後に夢幻闘舞
        entry("perfect-balance", 90),
        entry("leaping-opo", 92),
        entry("leaping-opo", 94),
        entry("leaping-opo", 96),
        entry("masterful-blitz", 98),
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    const blitz = result.entries[14];
    expect(blitz.resolvedSkillId).toBe("phantom-rush");
    expect(blitz.resolvedPotency).toBe(1500);
    expect(blitz.resourceSnapshot["lunar-nadi"]).toBe(0);
    expect(blitz.resourceSnapshot["solar-nadi"]).toBe(0);
    expect(blitz.recastError).toBe(false);
  });

  it("チャクラ3つ未満では必殺技は変化せず威力0のまま", () => {
    const result = resolveTimeline(
      [
        entry("perfect-balance"),
        entry("leaping-opo"),
        entry("masterful-blitz"),
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[2].resolvedSkillId).toBe("masterful-blitz");
    expect(result.entries[2].resolvedPotency).toBe(0);
  });
});
