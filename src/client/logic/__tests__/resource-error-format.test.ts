import { describe, it, expect, beforeEach, afterEach } from "vitest";
import i18next from "i18next";
import { formatResourceErrors, formatResourceErrorWarnings } from "../resource-error-format";
import type { ResourceError } from "../../types/skill";

describe("formatResourceErrors (#612)", () => {
  it("種類ごとに 1 行にまとめ、不足 → 超過の順に並べる", () => {
    const errors: ResourceError[] = [
      { resourceId: "opo-chakra", kind: "overMax" },
      { resourceId: "chakra", kind: "insufficient" },
      { resourceId: "raptor-chakra", kind: "overMax" },
    ];

    expect(formatResourceErrors(errors, "mnk")).toEqual([
      "リソース不足: 闘気",
      "リソース超過: 壱のチャクラ, 弐のチャクラ",
    ]);
  });

  it("辞書に無いリソースは ID のまま出す", () => {
    expect(formatResourceErrors([{ resourceId: "mp", kind: "insufficient" }], "mnk")).toEqual([
      "リソース不足: mp",
    ]);
  });

  it("エラーが無ければ空配列", () => {
    expect(formatResourceErrors([], "mnk")).toEqual([]);
  });
});

describe("formatResourceErrorWarnings (#612)", () => {
  it("含まれる種類ごとに 1 つずつ警告を付ける", () => {
    const errors: ResourceError[] = [
      { resourceId: "opo-chakra", kind: "overMax" },
      { resourceId: "raptor-chakra", kind: "overMax" },
    ];

    expect(formatResourceErrorWarnings(errors)).toBe(" ⚠ リソース超過");
    expect(formatResourceErrorWarnings([...errors, { resourceId: "chakra", kind: "insufficient" }])).toBe(
      " ⚠ リソース不足 ⚠ リソース超過"
    );
  });

  it("エラーが無ければ空文字", () => {
    expect(formatResourceErrorWarnings([])).toBe("");
  });
});

describe("resource-error-format（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("種類のラベルを英語にする", () => {
    const errors: ResourceError[] = [
      { resourceId: "chakra", kind: "insufficient" },
      { resourceId: "opo-chakra", kind: "overMax" },
    ];

    expect(formatResourceErrors(errors, "mnk")).toEqual(["Insufficient resources: Chakra", "Resource overcap: Opo-opo Chakra"]);
    expect(formatResourceErrorWarnings(errors)).toBe(" ⚠ Insufficient resources ⚠ Resource overcap");
  });
});
