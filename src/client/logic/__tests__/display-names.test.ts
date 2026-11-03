import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18next from "i18next";
import { resources } from "../../i18n";
import { JOB_DATA } from "../../data/job-registry";
import type { JobId } from "../../data/job-registry";
import { JOB_CATALOG, JOB_ROLES } from "../../data/job-catalog";
import { CONTENT_CATALOG, CONTENT_CATEGORIES } from "../../data/content-catalog";
import {
  buffName,
  buffShortName,
  contentCategoryName,
  contentName,
  jobName,
  resourceName,
  resourceShortName,
  roleName,
  skillName,
} from "../display-names";

type Dict = { [key: string]: string | Dict };
type Lang = keyof typeof resources;

// i18next.exists や t(…, { lng: "en" }) は ja に戻るので、en の抜けを見逃す。resources を直接見る
function lookup(lang: Lang, ns: string, key: string): unknown {
  const dict = (resources[lang] as Record<string, Dict>)[ns];
  return key.split(".").reduce<unknown>((node, part) => {
    if (node === null || typeof node !== "object" || !Object.hasOwn(node, part)) return undefined;
    return (node as Dict)[part];
  }, dict);
}

// 値が空文字のキーは ja に戻らず空欄で出るので、空も抜けとして扱う
function missingKeys(entries: { ns: string; key: string }[]): string[] {
  return (["ja", "en"] as const).flatMap((lang) =>
    entries
      .filter(({ ns, key }) => {
        const value = lookup(lang, ns, key);
        return typeof value !== "string" || value.length === 0;
      })
      .map(({ ns, key }) => `${lang}:${ns}:${key}`)
  );
}

const JOB_IDS = Object.keys(JOB_DATA) as JobId[];

describe("名前の辞書", () => {
  it.each(JOB_IDS)("%s のスキル・バフ・リソースの全 ID に ja と en の名前がある", (jobId) => {
    const ns = `job-${jobId}`;
    const { skills, buffs, resources: jobResources } = JOB_DATA[jobId];
    const entries = [
      ...skills.map((s) => ({ ns, key: `skills.${s.id}.name` })),
      ...buffs.flatMap((b) => [
        { ns, key: `buffs.${b.id}.name` },
        { ns, key: `buffs.${b.id}.shortName` },
      ]),
      ...jobResources.flatMap((r) => [
        { ns, key: `resources.${r.id}.name` },
        { ns, key: `resources.${r.id}.shortName` },
      ]),
    ];
    expect(missingKeys(entries)).toEqual([]);
  });

  it("カタログ（ジョブ・ロール・コンテンツ・区分）の全 ID に ja と en の名前がある", () => {
    const ns = "catalog";
    const entries = [
      ...JOB_CATALOG.map((j) => ({ ns, key: `jobs.${j.id}.name` })),
      ...JOB_ROLES.map((r) => ({ ns, key: `roles.${r.id}.name` })),
      ...CONTENT_CATALOG.map((c) => ({ ns, key: `contents.${c.id}.name` })),
      ...CONTENT_CATEGORIES.map((c) => ({ ns, key: `contentCategories.${c}.name` })),
    ];
    expect(missingKeys(entries)).toEqual([]);
  });

  it("データの ID に、キーと名前空間の区切り（. と :）が入っていない", () => {
    const ids = [
      ...JOB_IDS.flatMap((jobId) => {
        const { skills, buffs, resources: jobResources } = JOB_DATA[jobId];
        return [...skills, ...buffs, ...jobResources].map((d) => d.id);
      }),
      ...JOB_CATALOG.map((j) => j.id),
      ...CONTENT_CATALOG.map((c) => c.id),
    ];
    expect(ids.filter((id) => /[.:]/.test(id))).toEqual([]);
  });
});

describe("名前を引く関数", () => {
  it("表示中の言語の名前を返す", () => {
    expect(skillName(i18next.t, "blm", "fire-4")).toBe("ファイジャ");
    expect(buffName(i18next.t, "drg", "lance-charge")).toBe("ランスチャージ");
    expect(buffShortName(i18next.t, "drg", "lance-charge")).toBe("ﾗﾝｽ\nﾁｬｰｼﾞ");
    expect(resourceName(i18next.t, "blm", "umbral-heart")).toBe("アンブラルハート");
    expect(resourceShortName(i18next.t, "blm", "umbral-heart")).toBe("ﾊｰﾄ");
    expect(jobName(i18next.t, "blm")).toBe("黒魔道士");
    expect(roleName(i18next.t, "caster")).toBe("遠隔魔法DPS");
    expect(contentName(i18next.t, "m4s")).toBe("至天の座アルカディア零式：ライトヘビー級4");
    expect(contentName(i18next.t, "dancing-mad")).toBe("絶妖星乱舞");
    expect(contentCategoryName(i18next.t, "ultimate")).toBe("絶");
  });

  it("同じ ID のロールアクションも、ジョブの名前空間から引く", () => {
    expect(skillName(i18next.t, "whm", "swiftcast")).toBe("迅速魔");
    expect(skillName(i18next.t, "sam", "true-north")).toBe("トゥルーノース");
  });

  it("辞書に無い ID はそのまま返す", () => {
    expect(skillName(i18next.t, "whm", "test-gcd")).toBe("test-gcd");
    expect(buffShortName(i18next.t, "whm", "test-buff")).toBe("test-buff");
    expect(jobName(i18next.t, "xyz")).toBe("xyz");
    expect(contentName(i18next.t, "m13s")).toBe("m13s");
  });

  it("Object のプロトタイプにある名前の ID も、マスタに無ければそのまま返す", () => {
    expect(jobName(i18next.t, "constructor")).toBe("constructor");
    expect(contentName(i18next.t, "constructor")).toBe("constructor");
    expect(contentName(i18next.t, "__proto__")).toBe("__proto__");
  });

  it("jobName に言語を渡すと、表示中の言語にかかわらずその言語の名前を返す", () => {
    expect(jobName(i18next.t, "blm", "en")).toBe("Black Mage");
    expect(jobName(i18next.t, "blm", "ja")).toBe("黒魔道士");
  });

  describe("英語の表示", () => {
    beforeEach(async () => {
      await i18next.changeLanguage("en");
    });
    afterEach(async () => {
      await i18next.changeLanguage("ja");
    });

    it("英語の名前を返す", () => {
      expect(skillName(i18next.t, "blm", "fire-4")).toBe("Fire IV");
      expect(skillName(i18next.t, "blm", "fire-3-in-af")).toBe("Fire III (in AF)");
      expect(buffName(i18next.t, "drg", "lance-charge")).toBe("Lance Charge");
      expect(buffShortName(i18next.t, "drg", "lance-charge")).toBe("Lance\nCharge");
      expect(resourceName(i18next.t, "blm", "umbral-heart")).toBe("Umbral Heart");
      expect(jobName(i18next.t, "blm")).toBe("Black Mage");
      expect(jobName(i18next.t, "blm", "ja")).toBe("黒魔道士");
      expect(roleName(i18next.t, "caster")).toBe("Magical Ranged DPS");
      expect(contentName(i18next.t, "fru")).toBe("Futures Rewritten (Ultimate)");
      expect(contentCategoryName(i18next.t, "savage")).toBe("Savage");
    });
  });
});
