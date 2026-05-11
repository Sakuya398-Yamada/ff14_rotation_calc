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

describe("侍: 居合術 autoTransform（閃数 ＋ 天道バフ分岐）", () => {
  it("閃0で居合術を使うとマッチせず元 iaijutsu のままで威力0、閃も消費されない", () => {
    const result = resolveTimeline(
      [entry("iaijutsu")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[0].resolvedSkillId).toBe("iaijutsu");
    expect(result.entries[0].resolvedPotency).toBe(0);
    // 閃は全て 0 のまま（autoTransform にマッチしなかったため consumeAllResources も発火しない）
    expect(result.entries[0].resourceSnapshot.setsu ?? 0).toBe(0);
    expect(result.entries[0].resourceSnapshot.getsu ?? 0).toBe(0);
    expect(result.entries[0].resourceSnapshot.ka ?? 0).toBe(0);
  });

  it("1閃（雪のみ）で居合術 → 彼岸花（威力200、DoT付与）", () => {
    const result = resolveTimeline(
      [entry("hakaze"), entry("yukikaze"), entry("iaijutsu")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[2].resolvedSkillId).toBe("higanbana");
    expect(result.entries[2].resolvedPotency).toBe(200);
    expect(result.entries[2].resourceSnapshot.setsu).toBe(0);
  });

  it("1閃（月のみ）でも彼岸花に変化する", () => {
    const result = resolveTimeline(
      [entry("hakaze"), entry("jinpu"), entry("gekko"), entry("iaijutsu")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[3].resolvedSkillId).toBe("higanbana");
  });

  it("2閃（雪＋月）で居合術 → 天下五剣（威力300、剣圧+1、返し五剣Ready付与）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),                // 雪閃
        entry("hakaze"), entry("jinpu"), entry("gekko"),   // 月閃
        entry("iaijutsu"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tenka-goken");
    expect(last.resolvedPotency).toBe(300);
    expect(last.resourceSnapshot.meditation).toBe(1);
    // 燕返し Ready が付与されている
    const next = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("iaijutsu"),
        entry("tsubame-gaeshi"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );
    expect(next.entries[next.entries.length - 1].resolvedSkillId).toBe("kaeshi-goken");
  });

  it("3閃で居合術 → 乱れ雪月花（威力680、確定クリ）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("hakaze"), entry("shifu"), entry("kasha"),
        entry("iaijutsu"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("midare-setsugekka");
    expect(last.resolvedPotency).toBe(680);
    expect(last.critRateBonus).toBe(1);
    // 閃が全消費されている
    expect(last.resourceSnapshot.setsu).toBe(0);
    expect(last.resourceSnapshot.getsu).toBe(0);
    expect(last.resourceSnapshot.ka).toBe(0);
  });

  it("2閃＋天道バフ → 天道五剣（威力410、天道バフ消費）", () => {
    // 明鏡止水で天道バフ付与（Lv100ジョブ前提）
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("meikyo-shisui-skill"),  // 天道バフ付与
        entry("iaijutsu"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tendo-goken");
    expect(last.resolvedPotency).toBe(410);
    // 天道バフが消費されて消えている
    expect(last.activeBuffs.some((b) => b.buffId === "tendo")).toBe(false);
  });

  it("2閃（雪＋花）でも天下五剣に変化する", () => {
    // 月コンボを使わず雪と花のみを揃える: 風雅 → 桜花 + 刃風 → 雪風
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),                  // 雪閃
        entry("fuga"), entry("oka"),                          // 花閃
        entry("iaijutsu"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tenka-goken");
  });

  it("2閃（月＋花）でも天下五剣に変化する", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("jinpu"), entry("gekko"),     // 月閃
        entry("fuga"), entry("oka"),                          // 花閃
        entry("iaijutsu"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tenka-goken");
  });

  it("3閃＋天道バフ → 天道雪月花（威力1100、確定クリ、最優先）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("hakaze"), entry("shifu"), entry("kasha"),
        entry("meikyo-shisui-skill"),
        entry("iaijutsu"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resolvedSkillId).toBe("tendo-setsugekka");
    expect(last.resolvedPotency).toBe(1100);
    expect(last.critRateBonus).toBe(1);
  });
});
