import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../skill-level";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { TimelineEntry } from "../../types/skill";

// 特性の上書きを反映した Lv100 のスキル（基本値は特性修得前の値。#607）
const buffIds = new Set(SAM_BUFFS.map((b) => b.id));
const resourceIds = new Set(SAM_RESOURCES.map((r) => r.id));
const skillMap = getAllSkillMapForLevel(
  SAM_ATTACK_SKILLS,
  getSkillsForLevel(SAM_ATTACK_SKILLS, 100, buffIds, resourceIds),
  100,
  buffIds,
  resourceIds,
);

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("侍: 燕返し 4 種と返し波切（autoTransform + exclusiveGroup）", () => {
  it("天下五剣後の燕返し → 返し五剣（威力300、剣圧+1）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("iaijutsu"),         // → 天下五剣
        entry("tsubame-gaeshi"),   // → 返し五剣
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("kaeshi-goken");
    expect(last.resolvedPotency).toBe(300);
    // 剣圧は天下五剣（居合術）でのみ +1。返し五剣（燕返し）では付与されない（実機準拠）
    expect(last.resourceSnapshot.meditation).toBe(1);
  });

  it("乱れ雪月花後の燕返し → 返し雪月花（威力680、確定クリ）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("hakaze"), entry("shifu"), entry("kasha"),
        entry("iaijutsu"),
        entry("tsubame-gaeshi"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("kaeshi-setsugekka");
    expect(last.resolvedPotency).toBe(680);
    expect(last.critRateBonus).toBe(1);
  });

  it("天道五剣後 → 天道返し五剣（威力410）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("meikyo-shisui-skill"),
        entry("iaijutsu"),         // → 天道五剣
        entry("tsubame-gaeshi"),   // → 天道返し五剣
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tendo-kaeshi-goken");
    expect(last.resolvedPotency).toBe(410);
  });

  it("天道雪月花後 → 天道返し雪月花（威力1100、確定クリ）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("hakaze"), entry("shifu"), entry("kasha"),
        entry("meikyo-shisui-skill"),
        entry("iaijutsu"),         // → 天道雪月花
        entry("tsubame-gaeshi"),   // → 天道返し雪月花
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tendo-kaeshi-setsugekka");
    expect(last.resolvedPotency).toBe(1100);
    expect(last.critRateBonus).toBe(1);
  });

  it("奥義波切後の奥義波切 → 返し波切（威力1000、確定クリ）", () => {
    const result = resolveTimeline(
      [
        entry("ikishoten"),         // 奥義波切Ready付与
        entry("hakaze"),
        entry("ogi-namikiri"),
        entry("ogi-namikiri"),      // → 返し波切
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("kaeshi-namikiri");
    expect(last.comboErrors).toEqual([]);
    expect(last.resolvedPotency).toBe(1000);
    expect(last.critRateBonus).toBe(1);
    expect(last.dhRateBonus).toBe(0);
  });

  it("奥義波切後の燕返しは返し波切に変化しない", () => {
    const result = resolveTimeline(
      [
        entry("ikishoten"),
        entry("hakaze"),
        entry("ogi-namikiri"),
        entry("tsubame-gaeshi"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tsubame-gaeshi");
  });

  it("Ready バフが排他グループ tsubame-ready で重複付与されない", () => {
    // 天下五剣 → そのまま乱れ雪月花を撃つと、tsubame-kaeshi-goken-ready は
    // tsubame-kaeshi-setsugekka-ready に置き換わる（exclusiveGroup="tsubame-ready"）
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("iaijutsu"),         // → 天下五剣 → kaeshi-goken-ready 付与
        entry("hakaze"), entry("shifu"), entry("kasha"),
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("iaijutsu"),         // → 乱れ雪月花 → kaeshi-setsugekka-ready 付与（古いReady除去）
        entry("tsubame-gaeshi"),   // → 返し雪月花になるべき（五剣ではなく）
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("kaeshi-setsugekka");
  });

  it("燕返しの準備中に奥義波切 → 返し波切を撃っても燕返しの準備が残る", () => {
    // 返し波切準備は燕返し系の排他グループ tsubame-ready に入らない（#520）
    const result = resolveTimeline(
      [
        entry("ikishoten"),
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("iaijutsu"),                       // 天下五剣 → tsubame-kaeshi-goken-ready 付与
        entry("ogi-namikiri"),                   // tsubame-kaeshi-namikiri-ready 付与
        entry("ogi-namikiri"),                   // → 返し波切
        entry("tsubame-gaeshi"),                 // → 返し五剣
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const n = result.entries.length;
    expect(result.entries[n - 2].resolvedSkillId).toBe("kaeshi-namikiri");
    expect(result.entries[n - 1].resolvedSkillId).toBe("kaeshi-goken");
    expect(result.entries[n - 1].comboErrors).toEqual([]);
  });

  it("奥義波切後に居合術 → 燕返しは返し五剣、波切Ready は残って奥義波切が返し波切になる", () => {
    const result = resolveTimeline(
      [
        entry("ikishoten"),
        entry("hakaze"),
        entry("ogi-namikiri"),                  // tsubame-kaeshi-namikiri-ready 付与
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("iaijutsu"),                       // 天下五剣 → tsubame-kaeshi-goken-ready 付与（波切Ready は残る）
        entry("tsubame-gaeshi"),
        entry("ogi-namikiri"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const n = result.entries.length;
    expect(result.entries[n - 2].resolvedSkillId).toBe("kaeshi-goken");
    expect(result.entries[n - 1].resolvedSkillId).toBe("kaeshi-namikiri");
    expect(result.entries[n - 1].comboErrors).toEqual([]);
  });

  it("燕返し系は剣圧を付与しない（実機: 剣圧は居合術・奥義波切のみで蓄積）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("hakaze"), entry("shifu"), entry("kasha"),
        entry("iaijutsu"),         // 乱れ雪月花 → meditation +1
        entry("tsubame-gaeshi"),   // 返し雪月花 → meditation 変動なし
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const iaijutsuEntry = result.entries[result.entries.length - 2];
    const tsubameEntry = result.entries[result.entries.length - 1];
    // 乱れ雪月花時点で剣圧 1、その後の返し雪月花で増えない
    expect(iaijutsuEntry.resourceSnapshot.meditation).toBe(1);
    expect(tsubameEntry.resourceSnapshot.meditation).toBe(1);
  });

  it("奥義波切は剣圧 +1、続く返し波切では付与されない", () => {
    const result = resolveTimeline(
      [
        entry("ikishoten"),
        entry("hakaze"),
        entry("ogi-namikiri"),    // 剣圧 +1
        entry("tsubame-gaeshi"),  // 返し波切 → 剣圧変動なし
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const ogiEntry = result.entries[2];
    const kaeshiEntry = result.entries[3];
    expect(ogiEntry.resourceSnapshot.meditation).toBe(1);
    expect(kaeshiEntry.resourceSnapshot.meditation).toBe(1);
  });

  it("Ready バフ無しで燕返しを使うと requiredBuff エラー", () => {
    // 燕返しを単独で使うとどの Ready バフも無いので autoTransform しない
    // → 元の tsubame-gaeshi は requiredBuff を持たないので威力0で実行されるだけ
    const result = resolveTimeline(
      [entry("tsubame-gaeshi")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[0].resolvedSkillId).toBe("tsubame-gaeshi");
    expect(result.entries[0].resolvedPotency).toBe(0);
  });
});
