import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

/**
 * 必殺剣・紅蓮（Lv62）と必殺剣・閃影（Lv96 トレイトで紅蓮を置換）は
 * 共有リキャスト 60 秒 / 2 チャージを持つ実機仕様。
 * cooldownGroup="hissatsu-senei-guren" でチャージを共有する。
 *
 * 本テストは「データの cooldownGroup 配線が正しく機能するか」の検証が目的。
 * 剣気不足による resourceErrors を回避するため、resources / buffs を渡さずに
 * 純粋なリキャスト挙動だけを検証する（resourceErrors が立つとチャージ消費が
 * スキップされる仕様のため）。
 */
describe("侍: 必殺剣・紅蓮 / 閃影 の共有リキャスト", () => {
  it("紅蓮の威力は 400 / Lv62 / cooldown=60 / maxCharges=2 / cooldownGroup 設定", () => {
    const guren = skillMap.get("hissatsu-guren");
    expect(guren).toBeDefined();
    expect(guren?.potency).toBe(400);
    expect(guren?.acquiredLevel).toBe(62);
    expect(guren?.cooldown).toBe(60);
    expect(guren?.maxCharges).toBe(2);
    expect(guren?.cooldownGroup).toBe("hissatsu-senei-guren");
  });

  it("閃影は紅蓮を置換し、同じ cooldownGroup / maxCharges=2 を持つ", () => {
    const senei = skillMap.get("hissatsu-senei");
    expect(senei).toBeDefined();
    expect(senei?.replacesSkillId).toBe("hissatsu-guren");
    expect(senei?.cooldown).toBe(60);
    expect(senei?.maxCharges).toBe(2);
    expect(senei?.cooldownGroup).toBe("hissatsu-senei-guren");
    expect(senei?.acquiredLevel).toBe(96);
  });

  it("紅蓮を 2 連続で使えるが、3 連続目はリキャストエラー", () => {
    const result = resolveTimeline(
      [entry("hissatsu-guren"), entry("hissatsu-guren"), entry("hissatsu-guren")],
      skillMap,
      []
    );

    expect(result.entries[0].recastError).toBe(false);
    expect(result.entries[1].recastError).toBe(false);
    expect(result.entries[2].recastError).toBe(true);
  });

  it("紅蓮 → 閃影 でチャージが共有消費される（閃影 2 発目はエラー）", () => {
    const result = resolveTimeline(
      [
        entry("hissatsu-guren"),
        entry("hissatsu-senei"),
        entry("hissatsu-senei"),
      ],
      skillMap,
      []
    );

    expect(result.entries[0].recastError).toBe(false);
    expect(result.entries[1].recastError).toBe(false);
    expect(result.entries[2].recastError).toBe(true);
  });

  it("閃影 → 紅蓮 でも同様にチャージ共有（紅蓮 2 発目はエラー）", () => {
    const result = resolveTimeline(
      [
        entry("hissatsu-senei"),
        entry("hissatsu-guren"),
        entry("hissatsu-guren"),
      ],
      skillMap,
      []
    );

    expect(result.entries[0].recastError).toBe(false);
    expect(result.entries[1].recastError).toBe(false);
    expect(result.entries[2].recastError).toBe(true);
  });
});
