import { describe, it, expect } from "vitest";
import { JOB_DATA } from "../../data/job-registry";

// oGCD の recastTime は計算に使われず、タイムライン上のブロック表示幅にのみ使われる。
// ジョブ間で見た目を揃えるため、全ジョブでアニメーションロック相当（0.65）に統一する（#350）
describe("oGCD の recastTime 統一", () => {
  it.each(Object.entries(JOB_DATA))("%s の oGCD は recastTime 0.65", (_jobId, job) => {
    const mismatched = job.skills
      .filter((s) => s.type === "ogcd" && s.recastTime !== 0.65)
      .map((s) => `${s.id}=${s.recastTime}`);
    expect(mismatched).toEqual([]);
  });
});
