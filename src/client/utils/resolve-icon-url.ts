const iconModules = import.meta.glob<{ default: string }>(
  "../assets/icons/**/*.png",
  { eager: true }
);

const iconMap = new Map<string, string>();
for (const [path, mod] of Object.entries(iconModules)) {
  // path: "../assets/icons/whm/Stone.png" → key: "whm/Stone.png"
  const key = path.replace("../assets/icons/", "");
  iconMap.set(key, mod.default);
}

/**
 * DBに格納されたアイコン相対パス（例: "whm/Stone.png"）を
 * Viteが解決した実際のアセットURLに変換する。
 */
export function resolveIconUrl(iconPath: string): string {
  return iconMap.get(iconPath) ?? iconPath;
}
