import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../skill-level";
import type { BuffDefinition, ResourceDefinition, Skill, TimelineEntry } from "../../types/skill";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import { DRG_ATTACK_SKILLS } from "../../data/drg-skills";
import { DRG_BUFFS } from "../../data/drg-buffs";
import { DRG_RESOURCES } from "../../data/drg-resources";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { PCT_BUFFS } from "../../data/pct-buffs";
import { PCT_RESOURCES } from "../../data/pct-resources";

const JOBS = {
  sam: { skills: SAM_ATTACK_SKILLS, buffs: SAM_BUFFS, resources: SAM_RESOURCES },
  drg: { skills: DRG_ATTACK_SKILLS, buffs: DRG_BUFFS, resources: DRG_RESOURCES },
  pct: { skills: PCT_ATTACK_SKILLS, buffs: PCT_BUFFS, resources: PCT_RESOURCES },
} satisfies Record<string, { skills: Skill[]; buffs: BuffDefinition[]; resources: ResourceDefinition[] }>;

function resolve(job: keyof typeof JOBS, entries: TimelineEntry[]) {
  const data = JOBS[job];
  const buffs = getBuffsForLevel(data.buffs, 100);
  const resources = getResourcesForLevel(data.resources, 100);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(data.skills, 100, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(data.skills, skills, 100, buffIds, resourceIds);
  return resolveTimeline(entries, skillMap, resources, undefined, buffs).entries;
}

let seq = 0;
function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${seq++}`, skillId, ...(manualStartTime !== undefined ? { manualStartTime } : {}) };
}

describe("WS コンボの受付時間は 30 秒", () => {
  // 時刻ごとに別のタイムラインで解決する
  it.each([
    { job: "sam", from: "gyofu", to: "jinpu", time: 20, comboError: false, potency: 300 },
    { job: "sam", from: "gyofu", to: "jinpu", time: 31, comboError: true, potency: 140 },
    { job: "drg", from: "true-thrust", to: "lance-barrage", time: 20, comboError: false, potency: 340 },
    { job: "drg", from: "true-thrust", to: "lance-barrage", time: 31, comboError: true, potency: 130 },
  ] as const)("$job: $from の $time 秒後に置いた $to はコンボ不成立 $comboError・威力 $potency", ({ job, from, to, time, comboError, potency }) => {
    const e = resolve(job, [entry(from), entry(to, time)]);

    expect(e[0].startTime).toBe(0);
    expect(e[1].startTime).toBe(time);
    expect(e[1].recastError).toBeFalsy();
    expect(e[1].wsComboError).toBe(comboError);
    expect(e[1].resolvedPotency).toBe(potency);
  });
});

describe("PCT: ハンマーコンボはイマジンハンマーから 30 秒で撃てなくなる", () => {
  // レッドファイア（詠唱 1.5 秒）の後に自動配置したイマジンハンマーは 1.5 秒。ハンマーコンボ実行可は 31.5 秒まで。
  // スタンプ等でスタックが減っても効果時間は延びない（#814）
  function hammerTimeline(stampTime: number | undefined, brushTime: number, polishTime: number) {
    const e = resolve("pct", [
      entry("fire-in-red"),
      entry("steel-muse"),
      entry("hammer-stamp", stampTime),
      entry("hammer-stamp", brushTime),
      entry("hammer-stamp", polishTime),
    ]);
    expect(e[1].startTime).toBe(1.5);
    expect(e.slice(2).map((x) => x.resolvedSkillId)).toEqual(["hammer-stamp", "hammer-brush", "polishing-hammer"]);
    for (const x of e.slice(2)) expect(x.recastError).toBeFalsy();
    return e;
  }

  it("1 段目の 20 秒後のハンマーブラッシュは成立し、1 段目から 30 秒を過ぎたハンマーポリッシュは撃てない", () => {
    // 1 段目は 2.5 秒。ポリッシュの 33 秒は 2 段目（22.5 秒）から 30 秒以内だが、1 段目から 30 秒を過ぎている
    const e = hammerTimeline(undefined, 22.5, 33);

    expect(e[2].startTime).toBe(2.5);
    expect(e[3].wsComboError).toBe(false);
    expect(e[3].comboErrors).toEqual([]);
    expect(e[4].comboErrors.map((err) => err.buffId)).toEqual(["hammer-combo-ready"]);
  });

  it.each([
    [31, []],
    [32, ["hammer-combo-ready"]],
  ])("1 段目をイマジンハンマーの 20 秒後に撃つと、ハンマーポリッシュは %s 秒で発動条件エラー %j", (polishTime, expected) => {
    // 1 段目（21.5 秒）から 30 秒以内でも、イマジンハンマーから 30 秒（31.5 秒）を過ぎた段は撃てない
    const e = hammerTimeline(21.5, 24, polishTime);

    expect(e[3].comboErrors).toEqual([]);
    expect(e[4].comboErrors.map((err) => err.buffId)).toEqual(expected);
  });
});
