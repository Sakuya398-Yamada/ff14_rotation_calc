import { describe, it, expect } from "vitest";
import { JOB_DATA, type JobId } from "../../data/job-registry";

/**
 * oGCD の recastTime は計算ロジックには使われず、Timeline 上のブロック表示幅にだけ効く。
 * ジョブごとに値がばらつくとアビリティの表示幅が揃わなくなるため（#350）、
 * 全ジョブで DEFAULT_ANIMATION_LOCK（0.65）に統一されていることを検証する。
 */
const OGCD_RECAST_TIME = 0.65;

const JOB_IDS = Object.keys(JOB_DATA) as JobId[];

describe("oGCD recastTime のジョブ横断統一 (#350)", () => {
  it.each(JOB_IDS)("%s の全 oGCD の recastTime が 0.65 である", (jobId) => {
    const ogcds = JOB_DATA[jobId].skills.filter((s) => s.type === "ogcd");
    expect(ogcds.length).toBeGreaterThan(0);
    const mismatched = ogcds
      .filter((s) => s.recastTime !== OGCD_RECAST_TIME)
      .map((s) => `${s.id}=${s.recastTime}`);
    expect(mismatched).toEqual([]);
  });
});
