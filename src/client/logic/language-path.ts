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

/** その言語のプライバシーポリシーのパス（"/privacy" か "/en/privacy"） */
export function privacyPolicyPath(lang: Language): string {
  return lang === "en" ? "/en/privacy" : "/privacy";
}

const PRIVACY_POLICY_PATH_RE = /^(?:\/en)?\/privacy\/?$/;

/** プライバシーポリシーのページか（"/privacy"・"/en/privacy"。末尾の "/" は付いていてもよい） */
export function isPrivacyPolicyPath(pathname: string): boolean {
  return PRIVACY_POLICY_PATH_RE.test(pathname);
}
