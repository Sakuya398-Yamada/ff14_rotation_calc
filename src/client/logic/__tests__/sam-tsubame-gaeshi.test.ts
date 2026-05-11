import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("侍: 燕返し 5 種（autoTransform + exclusiveGroup）", () => {
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
    // 剣圧は天下五剣で+1、返し五剣でさらに+1 = 計2
    expect(last.resourceSnapshot.meditation).toBe(2);
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

  it("奥義波切後 → 返し波切（威力1000、確定クリ・確定DH）", () => {
    const result = resolveTimeline(
      [
        entry("ikishoten"),         // 奥義波切Ready付与
        entry("hakaze"),
        entry("ogi-namikiri"),
        entry("tsubame-gaeshi"),    // → 返し波切
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("kaeshi-namikiri");
    expect(last.resolvedPotency).toBe(1000);
    expect(last.critRateBonus).toBe(1);
    expect(last.dhRateBonus).toBe(1);
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

  it("奥義波切後に居合術 → 波切Ready が居合のReadyに置換される（exclusiveGroup の波切系も対象）", () => {
    // 奥義波切で kaeshi-namikiri-ready 付与 → その後 iaijutsu で kaeshi-goken-ready 付与
    // exclusiveGroup="tsubame-ready" により波切Ready が除去 → tsubame-gaeshi は五剣になるべき
    const result = resolveTimeline(
      [
        entry("ikishoten"),
        entry("hakaze"),
        entry("ogi-namikiri"),                  // tsubame-kaeshi-namikiri-ready 付与
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("iaijutsu"),                       // 天下五剣 → tsubame-kaeshi-goken-ready 付与（波切Ready 除去）
        entry("tsubame-gaeshi"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("kaeshi-goken");
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
