import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import type { Language } from "./logic/language-path";
import enCatalog from "./locales/en/catalog.json";
import enCommon from "./locales/en/common.json";
import enJobAst from "./locales/en/job-ast.json";
import enJobBlm from "./locales/en/job-blm.json";
import enJobBrd from "./locales/en/job-brd.json";
import enJobDrg from "./locales/en/job-drg.json";
import enJobMnk from "./locales/en/job-mnk.json";
import enJobPct from "./locales/en/job-pct.json";
import enJobPld from "./locales/en/job-pld.json";
import enJobSam from "./locales/en/job-sam.json";
import enJobSch from "./locales/en/job-sch.json";
import enJobSge from "./locales/en/job-sge.json";
import enJobWar from "./locales/en/job-war.json";
import enJobWhm from "./locales/en/job-whm.json";
import jaCatalog from "./locales/ja/catalog.json";
import jaCommon from "./locales/ja/common.json";
import jaJobAst from "./locales/ja/job-ast.json";
import jaJobBlm from "./locales/ja/job-blm.json";
import jaJobBrd from "./locales/ja/job-brd.json";
import jaJobDrg from "./locales/ja/job-drg.json";
import jaJobMnk from "./locales/ja/job-mnk.json";
import jaJobPct from "./locales/ja/job-pct.json";
import jaJobPld from "./locales/ja/job-pld.json";
import jaJobSam from "./locales/ja/job-sam.json";
import jaJobSch from "./locales/ja/job-sch.json";
import jaJobSge from "./locales/ja/job-sge.json";
import jaJobWar from "./locales/ja/job-war.json";
import jaJobWhm from "./locales/ja/job-whm.json";

export const defaultNS = "common";

// 型は ja の辞書から作る（i18next.d.ts）。en は satisfies で ja のキーをすべて持つことを確かめる
export const resources = {
  ja: {
    common: jaCommon,
    catalog: jaCatalog,
    "job-ast": jaJobAst,
    "job-blm": jaJobBlm,
    "job-brd": jaJobBrd,
    "job-drg": jaJobDrg,
    "job-mnk": jaJobMnk,
    "job-pct": jaJobPct,
    "job-pld": jaJobPld,
    "job-sam": jaJobSam,
    "job-sch": jaJobSch,
    "job-sge": jaJobSge,
    "job-war": jaJobWar,
    "job-whm": jaJobWhm,
  },
  en: {
    common: enCommon satisfies typeof jaCommon,
    catalog: enCatalog satisfies typeof jaCatalog,
    "job-ast": enJobAst satisfies typeof jaJobAst,
    "job-blm": enJobBlm satisfies typeof jaJobBlm,
    "job-brd": enJobBrd satisfies typeof jaJobBrd,
    "job-drg": enJobDrg satisfies typeof jaJobDrg,
    "job-mnk": enJobMnk satisfies typeof jaJobMnk,
    "job-pct": enJobPct satisfies typeof jaJobPct,
    "job-pld": enJobPld satisfies typeof jaJobPld,
    "job-sam": enJobSam satisfies typeof jaJobSam,
    "job-sch": enJobSch satisfies typeof jaJobSch,
    "job-sge": enJobSge satisfies typeof jaJobSge,
    "job-war": enJobWar satisfies typeof jaJobWar,
    "job-whm": enJobWhm satisfies typeof jaJobWhm,
  },
} as const;

/** 言語を決めて i18next を初期化する。resources を直接渡すので、戻った時点で t が使える */
export function initI18n(lng: Language): void {
  void i18next.use(initReactI18next).init({
    lng,
    fallbackLng: "ja",
    resources,
    defaultNS,
    ns: [defaultNS],
    // React が描画時にエスケープするので、i18next ではエスケープしない（二重になる）
    interpolation: { escapeValue: false },
  });
}

/** 表示中の言語。数値・日時の書式（toLocaleString）や、言語のパスを付けた URL に使う */
export function useLanguage(): Language {
  const { i18n } = useTranslation();
  return i18n.language === "en" ? "en" : "ja";
}
