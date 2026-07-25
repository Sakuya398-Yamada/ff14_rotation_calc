import type { Dispatch, SetStateAction } from "react";
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
  totalExpectedPotency: number;
  dotExpectedPotency: number;
  overallPps: { pps: number; totalPotency: number; directPotency: number; dotPotency: number } | null;
}

/** タイムライン上部のヘッダー（レーン表示トグル群・エディタ開閉・期待威力/PPSサマリ） */
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
  totalExpectedPotency,
  dotExpectedPotency,
  overallPps,
}: TimelineHeaderProps) {
  return (
    <div style={styles.header}>
      <h2 style={styles.title}>タイムライン</h2>
      <div style={styles.headerControls}>
        <button
          style={{
            ...styles.toggleButton,
            ...(untargetableWindows.length > 0 ? { borderColor: "rgba(255, 80, 80, 0.5)", color: "#ef5350" } : {}),
          }}
          onClick={() => setShowUntargetableEditor((v) => !v)}
          title="ボス離脱タイミング設定"
        >
          {showUntargetableEditor ? "離脱 ▼" : "離脱 ▶"}
          {untargetableWindows.length > 0 && ` (${untargetableWindows.length})`}
        </button>
        <button
          style={{
            ...styles.toggleButton,
            ...(multiTargetWindows.length > 0 ? { borderColor: "rgba(180, 100, 220, 0.5)", color: "#b864dc" } : {}),
          }}
          onClick={() => setShowMultiTargetEditor((v) => !v)}
          title="複数体ウィンドウ設定（敵の数を指定する時間帯）"
        >
          {showMultiTargetEditor ? "複数体 ▼" : "複数体 ▶"}
          {multiTargetWindows.length > 0 && ` (${multiTargetWindows.length})`}
        </button>
        {hasDoTs && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowDoTs((v) => !v)}
            title={showDoTs ? "DoT表示を非表示" : "DoT表示を表示"}
          >
            {showDoTs ? "DoT ▼" : "DoT ▶"}
          </button>
        )}
        {hasBuffs && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowBuffs((v) => !v)}
            title={showBuffs ? "バフ表示を非表示" : "バフ表示を表示"}
          >
            {showBuffs ? "バフ ▼" : "バフ ▶"}
          </button>
        )}
        {hasRecastSkills && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowRecasts((v) => !v)}
            title={showRecasts ? "リキャスト表示を非表示" : "リキャスト表示を表示"}
          >
            {showRecasts ? "リキャスト ▼" : "リキャスト ▶"}
          </button>
        )}
        {hasResources && (
          <button
            style={styles.toggleButton}
            onClick={() => setShowResources((v) => !v)}
            title={showResources ? "リソースゲージを非表示" : "リソースゲージを表示"}
          >
            {showResources ? "リソース ▼" : "リソース ▶"}
          </button>
        )}
        <button
          style={{
            ...styles.toggleButton,
            ...(ppsRange ? { borderColor: "rgba(255, 183, 77, 0.5)", color: "#ffb74d" } : {}),
          }}
          onClick={() => {
            const next = !showPpsRange;
            setShowPpsRange(next);
            if (next && !ppsRange) {
              onPpsRangeChange({ startTime: 0, endTime: Math.max(lastGcdEndTime, 10) });
            }
            if (!next) {
              onPpsRangeChange(null);
            }
          }}
          title="PPS範囲選択"
        >
          {showPpsRange ? "PPS範囲 ▼" : "PPS範囲 ▶"}
        </button>
        <div style={styles.potencyDisplay}>
          {totalExpectedPotency > 0 && (
            <>
              期待威力: <span style={styles.potencyValue}>{totalExpectedPotency}</span>
              {dotExpectedPotency > 0 && (
                <span style={{ fontSize: "13px", color: "#a5d6a7" }}>
                  {" "}(DoT: {dotExpectedPotency})
                </span>
              )}
            </>
          )}
          {overallPps !== null && (
            <span style={styles.ppsDisplay}>
              {" "}PPS: <span style={styles.ppsValue}>{overallPps.pps.toFixed(2)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
