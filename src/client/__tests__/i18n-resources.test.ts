import { describe, expect, it } from "vitest";
import { resources } from "../i18n";

type Dict = { [key: string]: string | Dict };

function flattenKeys(dict: Dict, prefix = ""): string[] {
  return Object.entries(dict).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flattenKeys(value, `${prefix}${key}.`)
  );
}

// en の _one は ja に無いので、satisfies typeof ja では抜けを見つけられない
function pluralKeysMissingOne(dict: Dict): string[] {
  const keys = new Set(flattenKeys(dict));
  return [...keys].filter((key) => key.endsWith("_other") && !keys.has(key.replace(/_other$/, "_one")));
}

function flattenEntries(dict: Dict, prefix = ""): [string, string][] {
  return Object.entries(dict).flatMap(([key, value]): [string, string][] =>
    typeof value === "string" ? [[`${prefix}${key}`, value]] : flattenEntries(value, `${prefix}${key}.`)
  );
}

function interpolationNames(value: string): string[] {
  return [...new Set([...value.matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1]))].sort();
}

// 型は ja の辞書から作るので、en の値の {{名前}} の書き違いや抜けは型でもテストの代表例でも見つからない
function keysWithMismatchedInterpolation(ja: Dict, en: Dict): string[] {
  const enValues = new Map(flattenEntries(en));
  return flattenEntries(ja)
    .filter(([key, value]) => {
      const enValue = enValues.get(key);
      return enValue !== undefined && interpolationNames(enValue).join() !== interpolationNames(value).join();
    })
    .map(([key]) => key);
}

describe("keysWithMismatchedInterpolation", () => {
  it("補間の名前が ja と en で違うキーを返す", () => {
    const ja = { a: { x: "{{name}}発動確率 {{rate}}", y: "{{count}}体", z: "閉じる" } };
    const en = { a: { x: "{{name}} proc chance {{rate}}", y: "{{n}} targets", z: "Close" } };
    expect(keysWithMismatchedInterpolation(ja, en)).toEqual(["a.y"]);
  });
});

describe("pluralKeysMissingOne", () => {
  it("_one の無い _other のキーを返す", () => {
    const dict = { a: { x_one: "1 target", x_other: "{{count}} targets", y_other: "{{count}} hits" }, z: "z" };
    expect(pluralKeysMissingOne(dict)).toEqual(["a.y_other"]);
  });
});

describe("en の辞書", () => {
  it.each(Object.keys(resources.en))("%s の複数形のキーには _one もある", (ns) => {
    const dict = resources.en[ns as keyof typeof resources.en] as Dict;
    expect(pluralKeysMissingOne(dict)).toEqual([]);
  });

  it.each(Object.keys(resources.ja))("%s の補間の名前が ja と揃っている", (ns) => {
    const ja = resources.ja[ns as keyof typeof resources.ja] as Dict;
    const en = resources.en[ns as keyof typeof resources.en] as Dict;
    expect(keysWithMismatchedInterpolation(ja, en)).toEqual([]);
  });
});
