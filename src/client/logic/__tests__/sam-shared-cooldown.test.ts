import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getSkillsForLevel,
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
} from "../skill-level";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { PlayerLevel, TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function skillMapForLevel(level: PlayerLevel) {
  const buffIds = new Set(getBuffsForLevel(SAM_BUFFS, level).map((b) => b.id));
  const resourceIds = new Set(getResourcesForLevel(SAM_RESOURCES, level).map((r) => r.id));
  const skills = getSkillsForLevel(SAM_ATTACK_SKILLS, level, buffIds, resourceIds);
  return getAllSkillMapForLevel(SAM_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
}

/**
 * 必殺剣・紅蓮（Lv70）と必殺剣・閃影（Lv72）は別アクションで、
 * リキャストタイマーを共有する（公式ジョブガイド、#408）。
 * リキャストは 120 秒で、Lv94 特性「必殺剣効果アップ」で 60 秒に短縮される（#516）。
 * cooldownGroup="hissatsu-senei-guren" でリキャストを共有する。
 *
 * 本テストは「データの cooldownGroup 配線が正しく機能するか」の検証が目的。
 * 剣気不足による resourceErrors を回避するため、resources / buffs を渡さずに
 * 純粋なリキャスト挙動だけを検証する（resourceErrors が立つとチャージ消費が
 * スキップされる仕様のため）。
 */
describe("侍: 必殺剣・紅蓮 / 閃影 の共有リキャスト", () => {
  it("紅蓮の威力は 400 / Lv70 / cooldown=120（Lv94 で 60） / チャージ無し / cooldownGroup 設定", () => {
    const guren = skillMap.get("hissatsu-guren");
    expect(guren).toBeDefined();
    expect(guren?.potency).toBe(400);
    expect(guren?.acquiredLevel).toBe(70);
    expect(guren?.cooldown).toBe(120);
    expect(guren?.traitPotencyOverrides).toEqual([{ traitLevel: 94, cooldown: 60 }]);
    expect(guren?.maxCharges).toBeUndefined();
    expect(guren?.cooldownGroup).toBe("hissatsu-senei-guren");
  });

  it("閃影は紅蓮を置換しない独立アクションで、同じ cooldownGroup とリキャストを持つ", () => {
    const senei = skillMap.get("hissatsu-senei");
    expect(senei).toBeDefined();
    expect(senei?.replacesSkillId).toBeUndefined();
    expect(senei?.cooldown).toBe(120);
    expect(senei?.traitPotencyOverrides).toEqual([{ traitLevel: 94, cooldown: 60 }]);
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

/**
 * レベル調整後のスキルマップ（アプリの allSkillMap と同じ組み方）で、
 * 特性「必殺剣効果アップ」（Lv94）の前後のリキャストがタイムライン上で効いていることを見る。
 * 2 発目は manualStartTime で 1 発目からの経過秒に置く。
 */
describe.each([
  { level: 90 as PlayerLevel, cooldown: 120 },
  { level: 100 as PlayerLevel, cooldown: 60 },
])("侍: Lv$level の紅蓮 / 閃影のリキャストは $cooldown 秒", ({ level, cooldown }) => {
  const levelSkillMap = skillMapForLevel(level);

  function secondUseHasRecastError(first: string, second: string, elapsed: number) {
    const result = resolveTimeline([entry(first), entry(second, elapsed)], levelSkillMap, []);
    expect(result.entries[0].recastError).toBe(false);
    return result.entries[1].recastError;
  }

  it.each([
    ["hissatsu-guren", "hissatsu-guren"],
    ["hissatsu-senei", "hissatsu-senei"],
    ["hissatsu-guren", "hissatsu-senei"],
    ["hissatsu-senei", "hissatsu-guren"],
  ])("%s → %s: リキャスト明け直前はエラー、明けた後はエラーなし", (first, second) => {
    expect(secondUseHasRecastError(first, second, cooldown - 1)).toBe(true);
    expect(secondUseHasRecastError(first, second, cooldown)).toBe(false);
  });
});

describe("侍: 必殺剣効果アップ（Lv94）の前後で 60 秒後の再使用の可否が変わる", () => {
  it("Lv90 では紅蓮の 60 秒後の再使用がリキャストエラーになる", () => {
    const result = resolveTimeline(
      [entry("hissatsu-guren"), entry("hissatsu-guren", 60)],
      skillMapForLevel(90),
      []
    );
    expect(result.entries[1].recastError).toBe(true);
  });

  it("Lv100 では紅蓮の 60 秒後に再使用できる", () => {
    const result = resolveTimeline(
      [entry("hissatsu-guren"), entry("hissatsu-guren", 60)],
      skillMapForLevel(100),
      []
    );
    expect(result.entries[1].recastError).toBe(false);
  });
});
