export type Language = "ja" | "en";

const EN_PATH_RE = /^\/en(?:\/|$)/;

/** 表示する言語をパスだけで決める（/en/ から始まれば en、それ以外は ja） */
export function languageFromPath(pathname: string): Language {
  return EN_PATH_RE.test(pathname) ? "en" : "ja";
}

/** その言語のトップのパス（"/" か "/en/"） */
export function languageBasePath(lang: Language): string {
  return lang === "en" ? "/en/" : "/";
}

/** 同じパスの別の言語版（"/" ↔ "/en/"、"/t/<id>" ↔ "/en/t/<id>"） */
export function alternateLanguagePath(pathname: string): string {
  if (languageFromPath(pathname) === "en") {
    return pathname.replace(/^\/en/, "") || "/";
  }
  return `/en${pathname}`;
}
