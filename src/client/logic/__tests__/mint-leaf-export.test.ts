import { describe, it, expect } from "vitest";
import { toMintLeafText } from "../mint-leaf-export";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry } from "../../types/skill";
import { JOB_DATA } from "../../data/job-registry";
import { getAllSkillMapForLevel, getBuffsForLevel, getResourcesForLevel, getSkillsForLevel } from "../skill-level";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function skill(overrides: Partial<Skill> & Pick<Skill, "id" | "type">): Skill {
  return {
    potency: 100,
    target: "enemy",
    icon: "",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

describe("toMintLeafText", () => {
  const skills = [
    skill({ id: "cast-gcd", type: "gcd", gameActionId: 141, castTime: 2.0 }),
    skill({ id: "slow-gcd", type: "gcd", gameActionId: 25793, recastTime: 3.333 }),
    skill({ id: "ogcd", type: "ogcd", gameActionId: 158, recastTime: 0.65 }),
    skill({ id: "unmapped-gcd", type: "gcd" }),
    skill({ id: "unmapped-ogcd", type: "ogcd", recastTime: 0.65 }),
  ];
  const skillMap = new Map(skills.map((s) => [s.id, s]));

  function exportOf(ids: string[]) {
    const { entries } = resolveTimeline(ids.map((id) => entry(id)), skillMap, []);
    return toMintLeafText(entries, skillMap);
  }

  it("GCD は ID・リキャスト・詠唱、oGCD は ID と normal を 1 行ずつ書き出す", () => {
    expect(exportOf(["cast-gcd", "ogcd", "cast-gcd"]).text).toBe(
      "141 GCD 2.5 2\n158 oGCD normal\n141 GCD 2.5 2",
    );
  });

  it("秒数は小数 2 桁に丸める", () => {
    expect(exportOf(["slow-gcd"]).text).toBe("25793 GCD 3.33 0");
  });

  it("手動の開始時刻は書き出さない", () => {
    const { entries } = resolveTimeline([entry("cast-gcd", 10), entry("ogcd")], skillMap, []);
    expect(toMintLeafText(entries, skillMap).text).toBe("141 GCD 2.5 2\n158 oGCD normal");
  });

  it("gameActionId の無いスキルは書き出さず、ID を重複なしで出てきた順に返す", () => {
    const result = exportOf(["unmapped-ogcd", "cast-gcd", "unmapped-gcd", "unmapped-ogcd"]);
    expect(result.text).toBe("141 GCD 2.5 2");
    expect(result.skippedSkillIds).toEqual(["unmapped-ogcd", "unmapped-gcd"]);
  });

  it("書き出すものが無ければ空文字", () => {
    expect(exportOf([])).toEqual({ text: "", skippedSkillIds: [] });
    expect(exportOf(["unmapped-gcd"]).text).toBe("");
  });
});

describe("toMintLeafText: 黒魔道士", () => {
  const { skills: allSkills } = JOB_DATA.blm;
  const buffs = getBuffsForLevel(JOB_DATA.blm.buffs, 100);
  const resources = getResourcesForLevel(JOB_DATA.blm.resources, 100);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(allSkills, 100, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(allSkills, skills, 100, buffIds, resourceIds);

  function exportOf(ids: string[]) {
    const { entries } = resolveTimeline(ids.map((id) => entry(id)), skillMap, resources, undefined, buffs);
    return { entries, ...toMintLeafText(entries, skillMap) };
  }

  it("自動変化したスキルは、変化後のアクションの ID で書き出す", () => {
    const { entries, text } = exportOf(["fire", "fire", "fire-3", "manafont", "fire"]);
    expect(entries.map((e) => e.resolvedSkillId)).toEqual(["fire", "fire-up-af2", "fire-3-in-af", "manafont", "paradox-af"]);
    // ファイア 141（隠しスキルも 141）・ファイガ 152・マナフォント 158・パラドックス 25797
    expect(text.split("\n").map((line) => line.split(" ")[0])).toEqual(["141", "141", "152", "158", "25797"]);
  });

  it("三連魔の効果中は詠唱を 0 で書き出す", () => {
    const { text } = exportOf(["fire-3", "fire-4", "triplecast", "fire-4"]);
    expect(text.split("\n")).toEqual([
      expect.stringMatching(/^152 GCD /),
      "3577 GCD 2.5 2",
      "7421 oGCD normal",
      "3577 GCD 2.5 0",
    ]);
  });

  it("全スキル（隠しスキルを含む）に gameActionId がある", () => {
    const missing = allSkills
      .filter((s) => !Number.isInteger(s.gameActionId) || (s.gameActionId ?? 0) <= 0)
      .map((s) => s.id);
    expect(missing).toEqual([]);
  });
});
