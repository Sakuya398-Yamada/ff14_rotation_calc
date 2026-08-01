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

describe("MNK: 極意バフと派生 WS", () => {
  it("紅蓮の極意で与ダメージ15%上昇バフが付与される", () => {
    const result = resolveTimeline(
      [entry("riddle-of-fire"), entry("leaping-opo")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[1].buffMultiplier).toBeCloseTo(1.15);
  });

  it("紅蓮の極意後に乾坤闘気弾が使用でき、実行可バフと零の型が処理される", () => {
    const result = resolveTimeline(
      [entry("riddle-of-fire"), entry("fires-reply")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    const firesReply = result.entries[1];
    expect(firesReply.comboErrors).toEqual([]);
    expect(firesReply.resolvedPotency).toBe(1400);
    // 実行可バフは消費され、零の型が付与される
    expect(firesReply.activeBuffs.some((ab) => ab.buffId === "fire-rumination")).toBe(false);
    expect(firesReply.activeBuffs.some((ab) => ab.buffId === "formless-fist")).toBe(true);
  });

  it("実行可バフなしで乾坤闘気弾を使うとエラーになる", () => {
    const result = resolveTimeline(
      [entry("fires-reply")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[0].comboErrors).toContain("fire-rumination");
  });

  it("疾風の極意後に絶空拳が使用できる", () => {
    const result = resolveTimeline(
      [entry("riddle-of-wind"), entry("winds-reply")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[1].comboErrors).toEqual([]);
    expect(result.entries[1].resolvedPotency).toBe(1040);
    expect(result.entries[1].activeBuffs.some((ab) => ab.buffId === "wind-rumination")).toBe(false);
  });

  it("紅蓮の極意と桃園結義は乗算で重なる", () => {
    const result = resolveTimeline(
      [entry("riddle-of-fire"), entry("brotherhood"), entry("leaping-opo")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[2].buffMultiplier).toBeCloseTo(1.15 * 1.05);
  });
});
