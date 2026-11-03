import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import type { Language } from "./logic/language-path";
import enCommon from "./locales/en/common.json";
import jaCommon from "./locales/ja/common.json";

export const defaultNS = "common";

// 型は ja の辞書から作る（i18next.d.ts）。en は satisfies で ja のキーをすべて持つことを確かめる
export const resources = {
  ja: { common: jaCommon },
  en: { common: enCommon satisfies typeof jaCommon },
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
