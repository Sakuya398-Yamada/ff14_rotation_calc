import { useTranslation } from "react-i18next";
import { styles } from "./styles";

/**
 * マニュアル開始時刻が設定されたスキルアイコンの左下に表示するストップウォッチバッジ。
 * シンプルなインライン SVG（自作）。
 */
export function ManualStartTimeBadge() {
  const { t } = useTranslation();
  return (
    <div style={styles.manualBadge} title={t("manualStartTimeBadge.title")}>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="10" y1="2" x2="14" y2="2" />
        <circle cx="12" cy="14" r="8" />
        <line x1="12" y1="14" x2="15" y2="11" />
      </svg>
    </div>
  );
}
