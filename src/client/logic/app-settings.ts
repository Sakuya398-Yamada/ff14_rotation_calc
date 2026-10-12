/** アプリ自体の表示設定（テーマ・アクセント色）。計算状態（timeline-storage）とは別キーで保存する */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type AccentColor = "blue" | "pink" | "purple" | "green";

export interface AppSettings {
  theme: ThemePreference;
  accent: AccentColor;
}

export const SETTINGS_STORAGE_KEY = "ff14-rotation-calc:settings";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];
export const ACCENT_COLORS: readonly AccentColor[] = ["blue", "pink", "purple", "green"];

// 旧アクセント「橙」は PPS 区間色・警告色と見分けにくいため廃止し、ピンクに置き換えた（#396）。保存済みの値は読み替える
// Map にするのは、通常のオブジェクトだと "constructor" 等のプロトタイプのキーを拾ってしまうため
const LEGACY_ACCENTS = new Map<string, AccentColor>([["orange", "pink"]]);

// 子パネルが旧配色のうちはダークの方が外枠と揃うため、初回はダーク（#382 / #383 で決定）
export const DEFAULT_SETTINGS: AppSettings = { theme: "dark", accent: "blue" };

export function deserializeSettings(json: string | null): AppSettings {
  if (json === null) return { ...DEFAULT_SETTINGS };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const obj = raw as Record<string, unknown>;
  // 項目ごとに検証し、不正な項目だけ既定値に戻す（片方の破損で両方を失わないため）
  return {
    theme: THEME_PREFERENCES.includes(obj.theme as ThemePreference)
      ? (obj.theme as ThemePreference)
      : DEFAULT_SETTINGS.theme,
    accent: ACCENT_COLORS.includes(obj.accent as AccentColor)
      ? (obj.accent as AccentColor)
      : (typeof obj.accent === "string" ? LEGACY_ACCENTS.get(obj.accent) : undefined) ?? DEFAULT_SETTINGS.accent,
  };
}

export function loadSettings(): AppSettings {
  try {
    return deserializeSettings(window.localStorage.getItem(SETTINGS_STORAGE_KEY));
  } catch {
    // localStorage 無効環境（プライベートモード等）では既定値
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存できない環境ではセッション中のみ有効
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

export function prefersDarkScheme(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applySettings(settings: AppSettings, prefersDark: boolean): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme, prefersDark);
  root.dataset.accent = settings.accent;
}
