import { describe, it, expect } from "vitest";
import { JOB_CATALOG, JOB_ROLES, isImplementedJob } from "../job-catalog";
import { JOB_DATA } from "../job-registry";
import type { JobId } from "../job-registry";

describe("JOB_CATALOG", () => {
  it("実装済みジョブはすべてカタログにあり、名前と略称が JOB_DATA と一致する", () => {
    for (const id of Object.keys(JOB_DATA) as JobId[]) {
      const entry = JOB_CATALOG.find((j) => j.id === id);
      expect(entry, `${id} が JOB_CATALOG にない`).toBeDefined();
      expect(entry!.name).toBe(JOB_DATA[id].name);
      expect(entry!.abbreviation).toBe(JOB_DATA[id].abbreviation);
    }
  });

  it("ID は重複せず、ロールはすべて定義済み", () => {
    const ids = JOB_CATALOG.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    const roleIds = new Set(JOB_ROLES.map((r) => r.id));
    expect(JOB_CATALOG.every((j) => roleIds.has(j.role))).toBe(true);
  });
});

describe("isImplementedJob", () => {
  it("実装済みジョブの ID は true", () => {
    expect(isImplementedJob("whm")).toBe(true);
  });

  it("Object のプロトタイプのキーは false", () => {
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(isImplementedJob(key), key).toBe(false);
    }
  });
});
