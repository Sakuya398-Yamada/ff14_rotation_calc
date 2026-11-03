import { initI18n } from "./i18n";

// 日本語の文字列で書いたテストがそのまま通るよう、jsdom の URL に依らず ja で初期化する
initI18n("ja");
