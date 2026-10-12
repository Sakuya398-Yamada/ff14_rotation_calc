import { describe, it, expect } from "vitest";
import { deserializeRecentJobs, pushRecentJob, MAX_RECENT_JOBS } from "../recent-jobs";

describe("pushRecentJob", () => {
  it("先頭に追加し、重複は前に移す", () => {
    expect(pushRecentJob(["whm", "blm"], "blm")).toEqual(["blm", "whm"]);
  });

  it(`上限 ${MAX_RECENT_JOBS} 件に切り詰める`, () => {
    expect(pushRecentJob(["whm", "blm", "sam"], "drg")).toEqual(["drg", "whm", "blm"]);
  });
});

describe("deserializeRecentJobs", () => {
  it("未実装・不正な ID と重複を捨てる", () => {
    expect(deserializeRecentJobs(JSON.stringify(["blm", "pld", 3, "blm", "whm"]))).toEqual(["blm", "whm"]);
  });

  it("壊れた JSON・配列以外は空", () => {
    expect(deserializeRecentJobs("{")).toEqual([]);
    expect(deserializeRecentJobs(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(deserializeRecentJobs(null)).toEqual([]);
  });
});
