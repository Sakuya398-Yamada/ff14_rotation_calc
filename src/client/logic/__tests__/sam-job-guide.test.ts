import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel } from "../skill-level";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));
const buffMap = new Map(SAM_BUFFS.map((b) => [b.id, b]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(skillIds: string[]) {
  return resolveTimeline(skillIds.map(entry), skillMap, SAM_RESOURCES, undefined, SAM_BUFFS);
}

/**
 * 公式ジョブガイド（侍、Patch 7.5 表記、PvE 欄）との整合（#408）
 */
describe("侍: 燕飛と燕飛効果アップ", () => {
  it("燕飛効果アップが無ければ威力100で、剣気を10上昇させる", () => {
    const result = resolve(["enpi"]);
    expect(result.entries[0].comboErrors).toEqual([]);
    expect(result.entries[0].resolvedPotency).toBe(100);
    expect(result.entries[0].resourceSnapshot.kenki).toBe(10);
  });

  it("必殺剣・夜天で燕飛効果アップが付与され、次の燕飛が威力270になり効果を消費する", () => {
    // 燕飛(+10) → 夜天(-10) → 燕飛(効果アップ消費) → 燕飛
    const result = resolve(["enpi", "hissatsu-yaten", "enpi", "enpi"]);
    expect(result.entries[1].activeBuffs.some((b) => b.buffId === "enhanced-enpi")).toBe(true);
    expect(result.entries[2].resolvedPotency).toBe(270);
    expect(result.entries[2].activeBuffs.some((b) => b.buffId === "enhanced-enpi")).toBe(false);
    expect(result.entries[3].resolvedPotency).toBe(100);
  });

  it("燕飛効果アップの効果時間は15秒", () => {
    expect(buffMap.get("enhanced-enpi")?.duration).toBe(15);
  });

  it("意気衝天は奥義波切実行可と残心実行可のみを付与する", () => {
    expect(skillMap.get("ikishoten")?.buffApplications).toEqual(["ogi-namikiri-ready", "zanshin-ready"]);
  });
});

describe("侍: 威力", () => {
  it.each([
    ["fuga", 90],
    ["fuko", 100],
  ])("%s の威力は %i", (skillId, potency) => {
    expect(skillMap.get(skillId)?.potency).toBe(potency);
  });

  it.each([
    ["jinpu", 140],
    ["shifu", 140],
    // 月光・花車はコンボ時（420）と同じく方向指定成功を前提にする
    ["gekko", 210],
    ["kasha", 210],
  ])("%s のコンボ不成立時威力は %i", (skillId, potency) => {
    expect(skillMap.get(skillId)?.nonComboPotency).toBe(potency);
  });
});

describe("侍: 範囲コンボ最終段のバフ付与", () => {
  it.each([
    ["mangetsu", "fugetsu"],
    ["oka", "fuka"],
  ])("コンボ不成立の %s では %s が付与されない", (skillId, buffId) => {
    const result = resolve([skillId]);
    expect(result.entries[0].wsComboError).toBe(true);
    expect(result.entries[0].activeBuffs.some((b) => b.buffId === buffId)).toBe(false);
  });
});

describe("侍: 剣圧", () => {
  it("彼岸花で剣圧が1上昇する", () => {
    const result = resolve(["hakaze", "yukikaze", "iaijutsu"]);
    expect(result.entries[2].resolvedSkillId).toBe("higanbana");
    expect(result.entries[2].resourceSnapshot.meditation).toBe(1);
  });
});

describe("侍: 燕返し実行可", () => {
  it.each([
    "tsubame-kaeshi-goken-ready",
    "tsubame-kaeshi-setsugekka-ready",
    "tsubame-tendo-kaeshi-goken-ready",
    "tsubame-tendo-kaeshi-setsugekka-ready",
  ])("%s の効果時間は30秒", (buffId) => {
    expect(buffMap.get(buffId)?.duration).toBe(30);
  });
});

describe("侍: 明鏡止水の消費対象", () => {
  it.each(["hakaze", "gyofu", "fuga", "fuko", "enpi"])(
    "%s の実行でも明鏡止水のスタックが減る",
    (skillId) => {
      const result = resolve(["meikyo-shisui-skill", skillId]);
      const meikyo = result.entries[1].activeBuffs.find((b) => b.buffId === "meikyo-shisui");
      expect(meikyo?.stacks).toBe(2);
    }
  );

  it("奥義波切と返し波切では明鏡止水のスタックが減らない", () => {
    const result = resolve(["ikishoten", "meikyo-shisui-skill", "ogi-namikiri", "tsubame-gaeshi"]);
    expect(result.entries[3].resolvedSkillId).toBe("kaeshi-namikiri");
    const meikyo = result.entries[3].activeBuffs.find((b) => b.buffId === "meikyo-shisui");
    expect(meikyo?.stacks).toBe(3);
  });
});

describe("侍: 習得レベル", () => {
  it.each([
    ["iaijutsu", 30],
    ["higanbana", 30],
    ["tenka-goken", 40],
    ["tsubame-gaeshi", 74],
    ["kaeshi-goken", 74],
    ["kaeshi-setsugekka", 74],
    ["hissatsu-shinten", 52],
    ["hissatsu-guren", 70],
    ["hissatsu-senei", 72],
    ["shoha", 80],
    ["enpi", 15],
  ])("%s は Lv%i で習得する", (skillId, level) => {
    expect(skillMap.get(skillId)?.acquiredLevel).toBe(level);
  });

  it.each([
    ["tsubame-kaeshi-goken-ready", 74],
    ["tsubame-kaeshi-setsugekka-ready", 74],
    ["enhanced-enpi", 56],
  ])("バフ %s は Lv%i で有効になる", (buffId, level) => {
    expect(buffMap.get(buffId)?.acquiredLevel).toBe(level);
  });

  it.each([
    ["kenki", 52],
    ["meditation", 80],
  ])("リソース %s は Lv%i で有効になる", (resourceId, level) => {
    expect(SAM_RESOURCES.find((r) => r.id === resourceId)?.acquiredLevel).toBe(level);
  });

  it("Lv100 のパレットには紅蓮と閃影が別アクションとして並ぶ", () => {
    const skills = getSkillsForLevel(
      SAM_ATTACK_SKILLS,
      100,
      new Set(SAM_BUFFS.map((b) => b.id)),
      new Set(SAM_RESOURCES.map((r) => r.id))
    );
    const ids = skills.map((s) => s.id);
    expect(ids).toContain("hissatsu-guren");
    expect(ids).toContain("hissatsu-senei");
  });
});
