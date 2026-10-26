import { describe, it, expect } from "vitest";
import { JOB_DATA } from "../../data/job-registry";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";

// OR 条件（requiredBuffAnyOf / buffConsumptionAnyOf）が未達のとき、先頭の候補だけを comboErrors に積むと
// 「バフ条件未達成: アストラルファイア I」のように、その候補が要ると読めてしまう（#679）
const cases = Object.entries(JOB_DATA).flatMap(([jobId, job]) => {
  const buffs = getBuffsForLevel(job.buffs, 100);
  const resources = getResourcesForLevel(job.resources, 100);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(job.skills, 100, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(job.skills, skills, 100, buffIds, resourceIds);
  return [...skillMap.values()].flatMap((s) => {
    const anyOf = s.requiredBuffAnyOf ?? s.buffConsumptionAnyOf?.map((o) => o.buffId);
    return anyOf && anyOf.length > 0 ? [{ jobId, skillId: s.id, anyOf, skillMap, buffs, resources }] : [];
  });
});

describe("OR 条件のバフを持つスキル", () => {
  it("全ジョブから対象スキルを拾えている", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c) => [c.jobId, c.skillId, c] as const))(
    "%s の %s を条件のバフ無しで置くと、comboErrors に候補をすべて持つエラーが 1 件入る",
    (_jobId, skillId, c) => {
      const result = resolveTimeline([{ uid: skillId, skillId }], c.skillMap, c.resources, undefined, c.buffs);
      expect(result.entries[0].comboErrors).toEqual([{ buffId: c.anyOf[0], kind: "missing", anyOf: c.anyOf }]);
    },
  );
});
