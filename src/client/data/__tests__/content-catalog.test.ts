import { describe, it, expect } from "vitest";
import { CONTENT_CATALOG, CONTENT_CATEGORIES, contentName } from "../content-catalog";

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
    const categoryIds = new Set(CONTENT_CATEGORIES.map((c) => c.id));
    expect(CONTENT_CATALOG.every((c) => categoryIds.has(c.category))).toBe(true);
  });
});

describe("contentName", () => {
  it("マスタにある ID は表示名を返す", () => {
    expect(contentName("m4s")).toBe("至天の座アルカディア零式：ライトヘビー級4");
    expect(contentName("dancing-mad")).toBe("絶妖星乱舞");
  });

  it("マスタに無い ID はそのまま返す", () => {
    expect(contentName("m13s")).toBe("m13s");
    expect(contentName("constructor")).toBe("constructor");
  });
});
