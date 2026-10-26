import { describe, it, expect } from "vitest";
import { formatComboErrors, formatComboErrorWarnings } from "../combo-error-format";
import { BLM_BUFFS } from "../../data/blm-buffs";
import type { ComboError } from "../../types/skill";

const buffDefMap = new Map(BLM_BUFFS.map((b) => [b.id, b]));

describe("formatComboErrors (#666)", () => {
  it("種類ごとに 1 行にまとめ、未達成 → 効果中の順に並べる", () => {
    const errors: ComboError[] = [
      { buffId: "ley-lines", kind: "forbidden" },
      { buffId: "thunderhead", kind: "missing" },
      { buffId: "firestarter", kind: "missing" },
    ];

    expect(formatComboErrors(errors, buffDefMap)).toEqual([
      "バフ条件未達成: サンダーヘッド, ファイアスターター",
      "バフ効果中: 黒魔紋",
    ]);
  });

  it("定義の無いバフは ID のまま出す", () => {
    expect(formatComboErrors([{ buffId: "unknown-buff", kind: "missing" }], buffDefMap)).toEqual([
      "バフ条件未達成: unknown-buff",
    ]);
  });

  it("エラーが無ければ空配列", () => {
    expect(formatComboErrors([], buffDefMap)).toEqual([]);
  });

  it("OR 条件のエラーは、候補をすべてバフ名にして「・」でつなぎ「のいずれか」を付ける (#679)", () => {
    const anyOf = ["astral-fire-1", "astral-fire-2", "astral-fire-3"];

    expect(formatComboErrors([{ buffId: anyOf[0], kind: "missing", anyOf }], buffDefMap)).toEqual([
      "バフ条件未達成: アストラルファイア I・アストラルファイア II・アストラルファイア III のいずれか",
    ]);
  });

  it("OR 条件の候補が多くても、名前を縮めずにすべて並べる (#679)", () => {
    // アンプリファイアは AF と UB の 6 段階のどれでもよい
    const anyOf = ["astral-fire-1", "astral-fire-2", "astral-fire-3", "umbral-ice-1", "umbral-ice-2", "umbral-ice-3"];

    expect(formatComboErrors([{ buffId: anyOf[0], kind: "missing", anyOf }], buffDefMap)).toEqual([
      "バフ条件未達成: アストラルファイア I・アストラルファイア II・アストラルファイア III・アンブラルブリザード I・アンブラルブリザード II・アンブラルブリザード III のいずれか",
    ]);
  });
});

describe("formatComboErrorWarnings (#666)", () => {
  it("含まれる種類ごとに 1 つずつ警告を付ける", () => {
    const errors: ComboError[] = [{ buffId: "ley-lines", kind: "forbidden" }];

    expect(formatComboErrorWarnings(errors)).toBe(" ⚠ バフ効果中");
    expect(
      formatComboErrorWarnings([
        ...errors,
        { buffId: "thunderhead", kind: "missing" },
        { buffId: "thunderhead", kind: "missing" },
      ])
    ).toBe(" ⚠ バフ条件未達成 ⚠ バフ効果中");
  });

  it("エラーが無ければ空文字", () => {
    expect(formatComboErrorWarnings([])).toBe("");
  });
});
