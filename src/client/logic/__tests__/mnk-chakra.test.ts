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

describe("MNK: 闘気（チャクラ）", () => {
  it("闘気は初期値5で、陰陽闘気斬が5消費する", () => {
    const result = resolveTimeline(
      [entry("the-forbidden-chakra")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[0].resolvedPotency).toBe(400);
    expect(result.entries[0].resourceErrors).toEqual([]);
    expect(result.entries[0].resourceSnapshot["chakra"]).toBe(0);
  });

  it("闘気不足で陰陽闘気斬を使うと resourceErrors になる", () => {
    const result = resolveTimeline(
      [entry("the-forbidden-chakra"), entry("the-forbidden-chakra")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[1].resourceErrors).toContain("chakra");
  });

  it("六合星導脚は闘気1つにつき威力+80で全消費する", () => {
    // 初期値5（上限10未満であることを前提に消費→威力加算を検証する）
    const result = resolveTimeline(
      [entry("six-sided-star")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    // 780 + 80 × 5 = 1180
    expect(result.entries[0].resolvedPotency).toBe(1180);
    expect(result.entries[0].resourceSnapshot["chakra"]).toBe(0);
  });

  it("桃園結義中は WS 使用時に闘気を獲得する（Meditative Brotherhood）", () => {
    const withBrotherhood = resolveTimeline(
      [entry("the-forbidden-chakra"), entry("brotherhood"), entry("leaping-opo")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    // 陰陽闘気斬で 5→0 に消費した後、桃園結義中の WS で +1
    expect(withBrotherhood.entries[0].resourceSnapshot["chakra"]).toBe(0);
    expect(withBrotherhood.entries[2].resourceSnapshot["chakra"]).toBe(1);

    // 桃園結義なしでは WS を使っても闘気は増えない
    const withoutBrotherhood = resolveTimeline(
      [entry("the-forbidden-chakra"), entry("leaping-opo")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );
    expect(withoutBrotherhood.entries[1].resourceSnapshot["chakra"]).toBe(0);
  });

  it("陰陽闘気で闘気を1つ獲得できる", () => {
    const result = resolveTimeline(
      [entry("the-forbidden-chakra"), entry("forbidden-meditation")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[1].resourceSnapshot["chakra"]).toBe(1);
  });
});
