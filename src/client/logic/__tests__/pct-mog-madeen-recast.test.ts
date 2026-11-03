import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../skill-level";
import type { TimelineEntry } from "../../types/skill";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { PCT_BUFFS } from "../../data/pct-buffs";
import { PCT_RESOURCES } from "../../data/pct-resources";

const LEVEL = 100;
const buffs = getBuffsForLevel(PCT_BUFFS, LEVEL);
const resources = getResourcesForLevel(PCT_RESOURCES, LEVEL);
const buffIds = new Set(buffs.map((b) => b.id));
const resourceIds = new Set(resources.map((r) => r.id));
const skills = getSkillsForLevel(PCT_ATTACK_SKILLS, LEVEL, buffIds, resourceIds);
const skillMap = getAllSkillMapForLevel(PCT_ATTACK_SKILLS, skills, LEVEL, buffIds, resourceIds);

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, resources, undefined, buffs).entries;
}

// ポンポン（3 秒）・ウィング（7 秒）・クロー（11 秒）まで具現化し、モーグリシンボルとファングの準備を持った状態にする。
// リビングミューズの 3 チャージをここで使い切るので、ファングは 1 チャージ戻る 43 秒以降に置く
function untilClawedMuse(): TimelineEntry[] {
  return [
    entry("creature-motif"), entry("pom-muse"),
    entry("creature-motif"), entry("pom-muse"),
    entry("creature-motif"), entry("pom-muse"),
    entry("creature-motif"),
  ];
}

const mog = skillMap.get("mog-of-the-ages")!;
const MOG_TARGETS = [...new Set([mog.autoTransform ?? []].flat().map((t) => t.skillId))];

describe("PCT: モーグリストリームとマディーンレトリビューションはリキャストを共有する（#871）", () => {
  it.each(MOG_TARGETS)("変化先 %s は mog-of-the-ages と同じリキャストのグループに属する", (skillId) => {
    expect(mog.cooldownGroup).toBeDefined();
    expect(skillMap.get(skillId)?.cooldownGroup).toBe(mog.cooldownGroup);
  });

  it("モーグリストリームの 30 秒以内に置いたマディーンレトリビューションはリキャストエラーになる", () => {
    const e = resolve([
      ...untilClawedMuse(),
      entry("mog-of-the-ages", 35),
      entry("pom-muse", 43),
      entry("mog-of-the-ages"),
    ]);

    expect(e[7].resolvedSkillId).toBe("mog-of-the-ages");
    expect(e[7].recastError).toBe(false);
    expect(e[8].resolvedSkillId).toBe("fanged-muse");
    expect(e[8].recastError).toBe(false);
    // 自動配置なので、残る原因はモーグリストリームからのリキャストだけ
    expect(e[9].resolvedSkillId).toBe("retribution-of-the-madeen");
    expect(e[9].startTime).toBe(43.65);
    expect(e[9].recastError).toBe(true);
  });

  it("モーグリストリームからちょうど 30 秒後に置いたマディーンレトリビューションはリキャストエラーにならない", () => {
    const e = resolve([
      ...untilClawedMuse(),
      entry("mog-of-the-ages", 35),
      entry("pom-muse", 43),
      entry("mog-of-the-ages", 65),
    ]);

    expect(e[9].resolvedSkillId).toBe("retribution-of-the-madeen");
    expect(e[9].recastError).toBe(false);
  });

  it("マディーンレトリビューションの 30 秒以内に置いたモーグリストリームはリキャストエラーになる", () => {
    // モーグリシンボルを残したままマディーンシンボルを得て、マディーンレトリビューション → モーグリストリームと続ける
    const e = resolve([
      ...untilClawedMuse(),
      entry("pom-muse", 43),
      entry("mog-of-the-ages"),
      entry("mog-of-the-ages"),
    ]);

    expect(e[7].resolvedSkillId).toBe("fanged-muse");
    expect(e[7].recastError).toBe(false);
    expect(e[8].resolvedSkillId).toBe("retribution-of-the-madeen");
    expect(e[8].recastError).toBe(false);
    expect(e[9].resolvedSkillId).toBe("mog-of-the-ages");
    expect(e[9].startTime).toBe(44.3);
    expect(e[9].recastError).toBe(true);
  });

  it("マディーンレトリビューションからちょうど 30 秒後に置いたモーグリストリームはリキャストエラーにならない", () => {
    const e = resolve([
      ...untilClawedMuse(),
      entry("pom-muse", 43),
      entry("mog-of-the-ages", 44),
      entry("mog-of-the-ages", 74),
    ]);

    expect(e[8].resolvedSkillId).toBe("retribution-of-the-madeen");
    expect(e[9].resolvedSkillId).toBe("mog-of-the-ages");
    expect(e[9].recastError).toBe(false);
  });
});
