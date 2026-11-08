import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../skill-level";
import type { TimelineEntry } from "../../types/skill";
import { JOB_DATA, type JobId } from "../../data/job-registry";

function resolve(job: JobId, entries: TimelineEntry[]) {
  const data = JOB_DATA[job];
  const buffs = getBuffsForLevel(data.buffs, 100);
  const resources = getResourcesForLevel(data.resources, 100);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(data.skills, 100, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(data.skills, skills, 100, buffIds, resourceIds);
  return resolveTimeline(entries, skillMap, resources, undefined, buffs).entries;
}

let seq = 0;
function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${seq++}`, skillId };
}

describe("keepsCombo の GCD を挟んでも WS コンボは途切れない", () => {
  it.each([
    { job: "sam", from: "gyofu", between: "enpi", to: "jinpu", potency: 300 },
    { job: "drg", from: "true-thrust", between: "piercing-talon", to: "lance-barrage", potency: 340 },
  ] as const)("$job: $from → $between → $to で $to のコンボが成立する（威力 $potency）", ({ job, from, between, to, potency }) => {
    const e = resolve(job, [entry(from), entry(between), entry(to)]);

    expect(e.map((x) => x.resolvedSkillId)).toEqual([from, between, to]);
    for (const x of e) {
      expect(x.recastError).toBeFalsy();
      expect(x.resourceErrors).toEqual([]);
      expect(x.comboErrors).toEqual([]);
    }
    expect(e[2].wsComboError).toBe(false);
    expect(e[2].resolvedPotency).toBe(potency);
  });

  it("pct: イマジンハンマー → ハンマースタンプ → レッドファイア → ハンマーブラッシュ でブラッシュにコンボ不成立が出ない", () => {
    const e = resolve("pct", [
      entry("steel-muse"),
      entry("hammer-stamp"),
      entry("fire-in-red"),
      entry("hammer-stamp"),
    ]);

    expect(e.map((x) => x.resolvedSkillId)).toEqual(["steel-muse", "hammer-stamp", "fire-in-red", "hammer-brush"]);
    for (const x of e) {
      expect(x.recastError).toBeFalsy();
      expect(x.resourceErrors).toEqual([]);
      expect(x.comboErrors).toEqual([]);
    }
    expect(e[3].wsComboError).toBe(false);
  });
});

describe("コンボの起点・継続の GCD を挟むと WS コンボは途切れる", () => {
  it.each([
    { job: "sam", from: "gyofu", between: "fuko", to: "jinpu", potency: 140 },
    { job: "sam", from: "gyofu", between: "yukikaze", to: "jinpu", potency: 140 },
    { job: "drg", from: "true-thrust", between: "doom-spike", to: "lance-barrage", potency: 130 },
  ] as const)("$job: $from → $between → $to で $to はコンボ不成立（威力 $potency）", ({ job, from, between, to, potency }) => {
    const e = resolve(job, [entry(from), entry(between), entry(to)]);

    expect(e.map((x) => x.resolvedSkillId)).toEqual([from, between, to]);
    for (const x of e) {
      expect(x.recastError).toBeFalsy();
      expect(x.resourceErrors).toEqual([]);
      expect(x.comboErrors).toEqual([]);
    }
    expect(e[2].wsComboError).toBe(true);
    expect(e[2].resolvedPotency).toBe(potency);
  });
});

describe("WS コンボ（comboFrom）を持つジョブで、コンボの起点・継続でない GCD にだけ keepsCombo が付いている", () => {
  const cases = Object.entries(JOB_DATA).flatMap(([job, data]) => {
    const comboActionIds = new Set(data.skills.flatMap((s) => (s.comboFrom ? [s.id, ...s.comboFrom] : [])));
    if (comboActionIds.size === 0) return [];
    return data.skills
      .filter((s) => s.type === "gcd")
      .map((s) => ({ job, id: s.id, keepsCombo: !comboActionIds.has(s.id), actual: s.keepsCombo === true }));
  });

  it("対象のジョブがある", () => {
    expect(new Set(cases.map((c) => c.job))).toEqual(new Set(["sam", "drg", "pct", "pld", "war", "gnb", "drk"]));
  });

  it.each(cases)("$job: $id の keepsCombo は $keepsCombo", ({ keepsCombo, actual }) => {
    expect(actual).toBe(keepsCombo);
  });
});
