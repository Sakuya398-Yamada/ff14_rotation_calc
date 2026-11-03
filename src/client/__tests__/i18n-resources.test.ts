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
});
