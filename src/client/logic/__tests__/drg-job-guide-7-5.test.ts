import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getAllSkillMapForLevel, getBuffsForLevel, getResourcesForLevel, getSkillsForLevel } from "../skill-level";
import type { PlayerLevel, TimelineEntry } from "../../types/skill";
import { DRG_ATTACK_SKILLS } from "../../data/drg-skills";
import { DRG_BUFFS } from "../../data/drg-buffs";
import { DRG_RESOURCES } from "../../data/drg-resources";

/** 公式ジョブガイド（パッチ7.5）との差分解消（Issue #412） */

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolveAtLevel(level: PlayerLevel, entries: TimelineEntry[]) {
  const buffs = getBuffsForLevel(DRG_BUFFS, level);
  const resources = getResourcesForLevel(DRG_RESOURCES, level);
  const skills = getSkillsForLevel(
    DRG_ATTACK_SKILLS,
    level,
    new Set(buffs.map((b) => b.id)),
    new Set(resources.map((r) => r.id)),
  );
  // App.tsx の allSkillMap と同じく、パレットから外れる自動変化先（雲蒸竜変等）も解決に含める
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  for (const s of DRG_ATTACK_SKILLS) {
    if (s.acquiredLevel <= level && !skillMap.has(s.id)) skillMap.set(s.id, s);
  }
  return resolveTimeline(entries, skillMap, resources, undefined, buffs);
}

// Lv100 のコンボ。4 段目の竜牙竜爪は雲蒸竜変レディで雲蒸竜変に自動変化し、竜眼が付与される
const TO_DRAKESBANE = ["true-thrust", "lance-barrage", "heavens-thrust", "fang-and-claw", "fang-and-claw"];

describe("DRG: ウィンググライドのチャージ（Lv84 特性）", () => {
  it("Lv90 では 2 チャージで連続使用できる", () => {
    const result = resolveAtLevel(90, [entry("winged-glide"), entry("winged-glide")]);
    expect(result.entries[0].recastError).toBe(false);
    expect(result.entries[1].recastError).toBe(false);
  });

  it("Lv80 では 1 チャージのため連続使用でリキャストエラーになる", () => {
    const result = resolveAtLevel(80, [entry("winged-glide"), entry("winged-glide")]);
    expect(result.entries[1].recastError).toBe(true);
  });
});

describe("DRG: 竜眼", () => {
  it("習得レベルはランスマスタリーの Lv76", () => {
    expect(getBuffsForLevel(DRG_BUFFS, 70).some((b) => b.id === "dragons-eye")).toBe(false);
    expect(getBuffsForLevel(DRG_BUFFS, 80).some((b) => b.id === "dragons-eye")).toBe(true);
  });

  it("遠隔のピアシングタロンでは解除されず、次のトゥルースラストが竜眼雷電に変化する", () => {
    const result = resolveAtLevel(100, [...TO_DRAKESBANE, "piercing-talon", "true-thrust"].map((id) => entry(id)));
    const talon = result.entries[5];
    expect(talon.activeBuffs.some((ab) => ab.buffId === "dragons-eye")).toBe(true);
    expect(result.entries[6].resolvedSkillId).toBe("raiden-thrust");
  });

  it("近接ウェポンスキルでは解除される", () => {
    const result = resolveAtLevel(100, [...TO_DRAKESBANE, "lance-barrage"].map((id) => entry(id)));
    expect(result.entries[4].activeBuffs.some((ab) => ab.buffId === "dragons-eye")).toBe(true);
    expect(result.entries[5].activeBuffs.some((ab) => ab.buffId === "dragons-eye")).toBe(false);
  });
});

describe("DRG: 紅の竜血を発動条件とするスキル", () => {
  it("スターダイバーは紅の竜血が無いとエラー", () => {
    const result = resolveAtLevel(100, [entry("stardiver")]);
    expect(result.entries[0].comboErrors).toContainEqual({ buffId: "life-of-the-dragon", kind: "missing" });
  });

  it("スターダイバーは紅の竜血効果中なら使用できる", () => {
    const result = resolveAtLevel(100, [entry("geirskogul"), entry("stardiver")]);
    expect(result.entries[1].comboErrors).toHaveLength(0);
  });

  it("紅の竜血効果中ならスタークロッサーを使用できる", () => {
    const result = resolveAtLevel(100, [entry("geirskogul"), entry("stardiver", 5), entry("starcross", 10)]);
    expect(result.entries[2].comboErrors).toHaveLength(0);
  });

  it("紅の竜血が切れた後は、スタークロッサー実行可が残っていてもエラー", () => {
    // ゲイルスコグル(0秒)の紅の竜血は20秒で切れる。スターダイバー(5秒)のスタークロッサー実行可は25秒まで残る
    const result = resolveAtLevel(100, [entry("geirskogul"), entry("stardiver", 5), entry("starcross", 22)]);
    const starcross = result.entries[2];
    expect(starcross.activeBuffsAtUse.some((ab) => ab.buffId === "starcross-ready")).toBe(true);
    expect(starcross.comboErrors).toContainEqual({ buffId: "life-of-the-dragon", kind: "missing" });
  });
});

describe("DRG: 方向指定スキルの威力は方向指定成功前提で内包する（#544）", () => {
  // ジョブガイドの「（コンボ時かつ）背面／側面攻撃時威力」
  it.each([
    ["chaos-thrust", 260, 140],
    ["fang-and-claw", 340, 180],
    ["wheeling-thrust", 340, 180],
    ["chaotic-spring", 340, 180],
  ])("%s の potency は %i、nonComboPotency は %i", (id, potency, nonComboPotency) => {
    const skill = DRG_ATTACK_SKILLS.find((s) => s.id === id)!;
    expect(skill.potency).toBe(potency);
    expect(skill.nonComboPotency).toBe(nonComboPotency);
  });

  it("Lv100 のコンボ成立時はタイムライン上でも成功前提の威力で解決される", () => {
    // resolveAtLevel は足したスキルにレベル調整がかからないため、アプリの allSkillMap と同じ組み方にする
    const level = 100;
    const buffs = getBuffsForLevel(DRG_BUFFS, level);
    const resources = getResourcesForLevel(DRG_RESOURCES, level);
    const buffIds = new Set(buffs.map((b) => b.id));
    const resourceIds = new Set(resources.map((r) => r.id));
    const skills = getSkillsForLevel(DRG_ATTACK_SKILLS, level, buffIds, resourceIds);
    const skillMap = getAllSkillMapForLevel(DRG_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
    const resolve = (skillIds: string[]) =>
      resolveTimeline(skillIds.map((id) => entry(id)), skillMap, resources, undefined, buffs).entries;

    const [, , chaoticSpring, wheelingThrust] = resolve(["true-thrust", "spiral-blow", "chaotic-spring", "wheeling-thrust"]);
    expect(chaoticSpring.resolvedPotency).toBe(340);
    expect(wheelingThrust.resolvedPotency).toBe(340);

    const [, , , fangAndClaw] = resolve(["true-thrust", "lance-barrage", "heavens-thrust", "fang-and-claw"]);
    expect(fangAndClaw.resolvedSkillId).toBe("fang-and-claw");
    expect(fangAndClaw.resolvedPotency).toBe(340);
  });
});
