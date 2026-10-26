import { describe, it, expect } from "vitest";
import { formatResourceErrors, formatResourceErrorWarnings } from "../resource-error-format";
import { MNK_RESOURCES } from "../../data/mnk-resources";
import type { ResourceError } from "../../types/skill";

const resourceDefMap = new Map(MNK_RESOURCES.map((r) => [r.id, r]));

describe("formatResourceErrors (#612)", () => {
  it("種類ごとに 1 行にまとめ、不足 → 超過の順に並べる", () => {
    const errors: ResourceError[] = [
      { resourceId: "opo-chakra", kind: "overMax" },
      { resourceId: "chakra", kind: "insufficient" },
      { resourceId: "raptor-chakra", kind: "overMax" },
    ];

    expect(formatResourceErrors(errors, resourceDefMap)).toEqual([
      "リソース不足: 闘気",
      "リソース超過: 壱のチャクラ, 弐のチャクラ",
    ]);
  });

  it("定義の無いリソースは ID のまま出す", () => {
    expect(formatResourceErrors([{ resourceId: "mp", kind: "insufficient" }], resourceDefMap)).toEqual([
      "リソース不足: mp",
    ]);
  });

  it("エラーが無ければ空配列", () => {
    expect(formatResourceErrors([], resourceDefMap)).toEqual([]);
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
