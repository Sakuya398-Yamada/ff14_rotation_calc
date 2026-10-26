import { describe, it, expect } from "vitest";
import { JOB_DATA } from "../../data/job-registry";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";

// requiredBuff と同じバフを buffConsumptions でも消費するスキルは、両方の判定が同じバフ ID を
// comboErrors に積むと「バフ条件未達成: サンダーヘッド, サンダーヘッド」と二重に出る（#663）
const cases = Object.entries(JOB_DATA).flatMap(([jobId, job]) => {
  const buffs = getBuffsForLevel(job.buffs, 100);
  const resources = getResourcesForLevel(job.resources, 100);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(job.skills, 100, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(job.skills, skills, 100, buffIds, resourceIds);
  return [...skillMap.values()]
    .filter((s) => s.requiredBuff && s.buffConsumptions?.some((c) => c.buffId === s.requiredBuff))
    .map((s) => ({ jobId, skillId: s.id, buffId: s.requiredBuff!, skillMap, buffs, resources }));
});

describe("requiredBuff と buffConsumptions で同じバフを指定したスキル", () => {
  it("全ジョブから対象スキルを拾えている", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c) => [c.jobId, c.skillId, c.buffId, c] as const))(
    "%s の %s をバフ（%s）無しで置くと、comboErrors にそのバフ ID が 1 回だけ入る",
    (_jobId, skillId, buffId, c) => {
      const result = resolveTimeline([{ uid: skillId, skillId }], c.skillMap, c.resources, undefined, c.buffs);
      expect(result.entries[0].comboErrors.filter((e) => e.buffId === buffId)).toEqual([{ buffId, kind: "missing" }]);
    },
  );
});
