import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { BossUntargetableWindow, MultiTargetWindow, PpsRange } from "../../types/skill";
import { styles } from "./styles";

interface TimelineHeaderProps {
  untargetableWindows: BossUntargetableWindow[];
  multiTargetWindows: MultiTargetWindow[];
  hasDoTs: boolean;
  hasBuffs: boolean;
  hasRecastSkills: boolean;
  hasResources: boolean;
  showUntargetableEditor: boolean;
  setShowUntargetableEditor: Dispatch<SetStateAction<boolean>>;
  showMultiTargetEditor: boolean;
  setShowMultiTargetEditor: Dispatch<SetStateAction<boolean>>;
  showDoTs: boolean;
  setShowDoTs: Dispatch<SetStateAction<boolean>>;
  showBuffs: boolean;
  setShowBuffs: Dispatch<SetStateAction<boolean>>;
  showRecasts: boolean;
  setShowRecasts: Dispatch<SetStateAction<boolean>>;
  showResources: boolean;
  setShowResources: Dispatch<SetStateAction<boolean>>;
  showPpsRange: boolean;
  setShowPpsRange: Dispatch<SetStateAction<boolean>>;
  ppsRange: PpsRange | null;
  onPpsRangeChange: (range: PpsRange | null) => void;
  lastGcdEndTime: number;
}

/** タイムライン上部のヘッダー（レーン表示トグル群・エディタ開閉） */
export function TimelineHeader({
  untargetableWindows,
  multiTargetWindows,
  hasDoTs,
  hasBuffs,
  hasRecastSkills,
  hasResources,
  showUntargetableEditor,
  setShowUntargetableEditor,
  showMultiTargetEditor,
  setShowMultiTargetEditor,
  showDoTs,
  setShowDoTs,
  showBuffs,
  setShowBuffs,
  showRecasts,
  setShowRecasts,
  showResources,
  setShowResources,
  showPpsRange,
  setShowPpsRange,
  ppsRange,
  onPpsRangeChange,
  lastGcdEndTime,
}: TimelineHeaderProps) {
  const { t } = useTranslation();
  const arrow = (open: boolean) => (open ? "▼" : "▶");
  return (
    <div style={styles.header}>
      <h2 style={styles.title}>{t("timelineHeader.title")}</h2>
      <div style={styles.headerControls}>
        <button
          style={{
            ...styles.toggleButton,
            ...(untargetableWindows.length > 0 ? { borderColor: "color-mix(in srgb, var(--color-zone-untargetable) 50%, transparent)", color: "var(--color-zone-untargetable)" } : {}),
          }}
          onClick={() => setShowUntargetableEditor((v) => !v)}
          title={t("timelineHeader.untargetableTitle")}
        >
          {`${t("timelineHeader.untargetable")} ${arrow(showUntargetableEditor)}`}
          {untargetableWindows.length > 0 && ` (${untargetableWindows.length})`}
        </button>
        <button
          style={{
            ...styles.toggleButton,
            ...(multiTargetWindows.length > 0 ? { borderColor: "color-mix(in srgb, var(--color-zone-multi-target) 50%, transparent)", color: "var(--color-zone-multi-target)" } : {}),
          }}
          onClick={() => setShowMultiTargetEditor((v) => !v)}
          title={t("timelineHeader.multiTargetTitle")}
        >
          {`${t("timelineHeader.multiTarget")} ${arrow(showMultiTargetEditor)}`}
          {multiTargetWindows.length > 0 && ` (${multiTargetWindows.length})`}
        </button>
        {hasDoTs && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowDoTs((v) => !v)}
            title={showDoTs ? t("timelineHeader.hideDots") : t("timelineHeader.showDots")}
          >
            {showDoTs ? "DoT ▼" : "DoT ▶"}
          </button>
        )}
        {hasBuffs && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowBuffs((v) => !v)}
            title={showBuffs ? t("timelineHeader.hideBuffs") : t("timelineHeader.showBuffs")}
          >
            {`${t("timelineHeader.buffs")} ${arrow(showBuffs)}`}
          </button>
        )}
        {hasRecastSkills && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowRecasts((v) => !v)}
            title={showRecasts ? t("timelineHeader.hideRecasts") : t("timelineHeader.showRecasts")}
          >
            {`${t("timelineHeader.recasts")} ${arrow(showRecasts)}`}
          </button>
        )}
        {hasResources && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowResources((v) => !v)}
            title={showResources ? t("timelineHeader.hideResources") : t("timelineHeader.showResources")}
          >
            {`${t("timelineHeader.resources")} ${arrow(showResources)}`}
          </button>
        )}
        <button
          style={{
            ...styles.toggleButton,
            ...(ppsRange ? { borderColor: "color-mix(in srgb, var(--color-zone-pps) 50%, transparent)", color: "var(--color-zone-pps)" } : {}),
          }}
          onClick={() => {
            const next = !showPpsRange;
            setShowPpsRange(next);
            if (next && !ppsRange) {
              onPpsRangeChange({ startTime: 0, endTime: lastGcdEndTime });
            }
            if (!next) {
              onPpsRangeChange(null);
            }
          }}
          title={t("timelineHeader.ppsRangeTitle")}
        >
          {`${t("timelineHeader.ppsRange")} ${arrow(showPpsRange)}`}
        </button>
      </div>
    </div>
  );
}
