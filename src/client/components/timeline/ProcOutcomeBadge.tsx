import { styles } from "./styles";

/**
 * 確率付与の発生の有無（TimelineEntry.procOccurred）を指定したスキルアイコンの右下に表示するバッジ (#838)。
 * 発生はチェック、不発はバツのインライン SVG（自作）。
 */
export function ProcOutcomeBadge({ procOccurred, title }: { procOccurred: boolean; title: string }) {
  return (
    <div style={styles.procOutcomeBadge} title={title}>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {procOccurred ? <polyline points="5 12 10 17 19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </div>
  );
}
