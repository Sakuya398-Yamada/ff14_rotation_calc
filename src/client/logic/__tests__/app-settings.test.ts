import { describe, it, expect } from "vitest";
import { deserializeSettings, resolveTheme, DEFAULT_SETTINGS } from "../app-settings";

describe("deserializeSettings", () => {
  it("保存値が無ければ既定値（ダーク・青）", () => {
    expect(deserializeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ theme: "dark", accent: "blue" });
  });

  it("正しい保存値はそのまま復元する", () => {
    expect(deserializeSettings(JSON.stringify({ theme: "system", accent: "green" }))).toEqual({
      theme: "system",
      accent: "green",
    });
  });

  it("壊れた JSON は既定値に戻す", () => {
    expect(deserializeSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("不正な項目だけ既定値に戻し、正しい項目は残す", () => {
    expect(deserializeSettings(JSON.stringify({ theme: "sepia", accent: "green" }))).toEqual({
      theme: "dark",
      accent: "green",
    });
  });

  it("廃止した旧アクセント「orange」はピンクとして復元する（#396）", () => {
    expect(deserializeSettings(JSON.stringify({ theme: "light", accent: "orange" }))).toEqual({
      theme: "light",
      accent: "pink",
    });
  });

  it("プロトタイプのキー（constructor 等）は読み替えず既定値に戻す", () => {
    for (const accent of ["constructor", "toString", "__proto__"]) {
      expect(deserializeSettings(JSON.stringify({ theme: "dark", accent })).accent).toBe("blue");
    }
  });
});

describe("resolveTheme", () => {
  it("system は OS の配色に従う", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("明示指定は OS の配色に関係なくそのまま", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
