import { describe, it, expect } from "vitest";
import { CONTENT_CATALOG, CONTENT_CATEGORIES } from "../content-catalog";

describe("CONTENT_CATALOG", () => {
  it("保存済みの ID を変えたり消したりしていない（ID は D1 の content_id に残る）", () => {
    const ids = CONTENT_CATALOG.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "m1s", "m2s", "m3s", "m4s", "m5s", "m6s", "m7s", "m8s", "m9s", "m10s", "m11s", "m12s",
        "ucob", "uwu", "tea", "dsr", "top", "fru", "dancing-mad",
      ])
    );
  });

  it("ID は重複せず、区分はすべて定義済み", () => {
    const ids = CONTENT_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categoryIds = new Set(CONTENT_CATEGORIES);
    expect(CONTENT_CATALOG.every((c) => categoryIds.has(c.category))).toBe(true);
  });
});
