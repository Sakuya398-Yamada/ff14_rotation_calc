import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BLM_RESOURCES, undefined, BLM_BUFFS).entries;
}

const transpose = skillMap.get("transpose")!;
const TRANSPOSE_TARGETS = [
  ...new Set([transpose.autoTransform ?? []].flat().map((t) => t.skillId)),
];

describe("BLM: トランスのリキャストは変化先によらず共有する（#811）", () => {
  it.each(TRANSPOSE_TARGETS)("変化先 %s は transpose と同じリキャストのグループに属する", (skillId) => {
    expect(transpose.cooldownGroup).toBeDefined();
    expect(skillMap.get(skillId)?.cooldownGroup).toBe(transpose.cooldownGroup);
  });

  it("AF3 からのトランスの 5 秒以内に手動で置いたトランスは、AF1 への変化先に変わってもリキャストエラーになる", () => {
    // 4.15 秒は 1 回目のトランス（3.50 秒）のアニメーションロックが明ける時刻なので、残る原因はリキャストだけ
    const e = resolve([entry("fire-3"), entry("transpose", 3.5), entry("transpose", 4.15)]);

    expect(e[1].resolvedSkillId).toBe("transpose-to-ub1-from-af3");
    expect(e[1].recastError).toBe(false);
    expect(e[2].resolvedSkillId).toBe("transpose-to-af1");
    expect(e[2].recastError).toBe(true);
  });

  it("自動配置で続けて置いたトランスも、変化先が変わってもリキャストエラーになり、置かれる位置はアニメーションロック明けのまま", () => {
    const e = resolve([entry("fire-3"), entry("transpose"), entry("transpose")]);

    expect(e[1].resolvedSkillId).toBe("transpose-to-ub1-from-af3");
    expect(e[2].resolvedSkillId).toBe("transpose-to-af1");
    expect(e[2].startTime).toBe(4.15);
    expect(e[2].recastError).toBe(true);
  });

  it("UB3・アンブラルハート 3 からのトランスの 5 秒以内に置いたトランス（UB1 への変化先）はリキャストエラーになる", () => {
    const e = resolve([entry("blizzard-3"), entry("blizzard-4"), entry("transpose"), entry("transpose")]);

    expect(e[2].resolvedSkillId).toBe("transpose-to-af1-from-ub3");
    expect(e[2].recastError).toBe(false);
    expect(e[3].resolvedSkillId).toBe("transpose-to-ub1");
    expect(e[3].recastError).toBe(true);
  });

  it("無極性で使ったトランスの 5 秒以内に AF 中で置いたトランスはリキャストエラーになる", () => {
    const e = resolve([entry("transpose"), entry("fire"), entry("transpose")]);

    expect(e[0].resolvedSkillId).toBe("transpose");
    expect(e[2].resolvedSkillId).toBe("transpose-to-ub1");
    expect(e[2].startTime).toBeLessThan(5);
    expect(e[2].recastError).toBe(true);
  });

  it("1 回目のトランスからちょうど 5 秒後に置いたトランスはリキャストエラーにならない", () => {
    const e = resolve([entry("fire-3"), entry("transpose", 3.5), entry("transpose", 8.5)]);

    expect(e[2].resolvedSkillId).toBe("transpose-to-af1");
    expect(e[2].recastError).toBe(false);
  });
});
