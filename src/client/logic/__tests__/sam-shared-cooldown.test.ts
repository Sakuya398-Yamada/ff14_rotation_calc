import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

/**
 * 必殺剣・紅蓮（Lv70）と必殺剣・閃影（Lv72）は別アクションで、
 * リキャストタイマー 60 秒（Lv94 以降）を共有する（公式ジョブガイド、#408）。
 * cooldownGroup="hissatsu-senei-guren" でリキャストを共有する。
 *
 * 本テストは「データの cooldownGroup 配線が正しく機能するか」の検証が目的。
 * 剣気不足による resourceErrors を回避するため、resources / buffs を渡さずに
 * 純粋なリキャスト挙動だけを検証する（resourceErrors が立つとチャージ消費が
 * スキップされる仕様のため）。
 */
describe("侍: 必殺剣・紅蓮 / 閃影 の共有リキャスト", () => {
  it("紅蓮の威力は 400 / Lv70 / cooldown=60 / チャージ無し / cooldownGroup 設定", () => {
    const guren = skillMap.get("hissatsu-guren");
    expect(guren).toBeDefined();
    expect(guren?.potency).toBe(400);
    expect(guren?.acquiredLevel).toBe(70);
    expect(guren?.cooldown).toBe(60);
    expect(guren?.maxCharges).toBeUndefined();
    expect(guren?.cooldownGroup).toBe("hissatsu-senei-guren");
  });

  it("閃影は紅蓮を置換しない独立アクションで、同じ cooldownGroup を持つ", () => {
    const senei = skillMap.get("hissatsu-senei");
    expect(senei).toBeDefined();
    expect(senei?.replacesSkillId).toBeUndefined();
    expect(senei?.cooldown).toBe(60);
    expect(senei?.maxCharges).toBeUndefined();
    expect(senei?.cooldownGroup).toBe("hissatsu-senei-guren");
    expect(senei?.acquiredLevel).toBe(72);
  });

  it("紅蓮を 2 連続で使うと 2 発目はリキャストエラー", () => {
    const result = resolveTimeline(
      [entry("hissatsu-guren"), entry("hissatsu-guren")],
      skillMap,
      []
    );

    expect(result.entries[0].recastError).toBe(false);
    expect(result.entries[1].recastError).toBe(true);
  });

  it("紅蓮 → 閃影 でリキャストが共有される（閃影はエラー）", () => {
    const result = resolveTimeline(
      [entry("hissatsu-guren"), entry("hissatsu-senei")],
      skillMap,
      []
    );

    expect(result.entries[0].recastError).toBe(false);
    expect(result.entries[1].recastError).toBe(true);
  });

  it("閃影 → 紅蓮 でも同様にリキャスト共有（紅蓮はエラー）", () => {
    const result = resolveTimeline(
      [entry("hissatsu-senei"), entry("hissatsu-guren")],
      skillMap,
      []
    );

    expect(result.entries[0].recastError).toBe(false);
    expect(result.entries[1].recastError).toBe(true);
  });
});
