import { useTranslation } from "react-i18next";
import type { BossUntargetableWindow, MultiTargetWindow, PpsRange } from "../../types/skill";
import { PX_PER_SEC, LANE_LABEL_WIDTH, RULER_HEIGHT } from "./constants";

interface TimelineOverlaysProps {
  untargetableWindows: BossUntargetableWindow[];
  multiTargetWindows: MultiTargetWindow[];
  ppsRange: PpsRange | null;
  showPpsRange: boolean;
  /** 状態のパネルを開いている時刻。縦線を引く（#1001） */
  stateTime: number | null;
}

/** タイムライン上に重ねる縦帯オーバーレイ（ボス離脱／複数体／PPS範囲）と、状態のパネルの時刻の縦線 */
export function TimelineOverlays({
  untargetableWindows,
  multiTargetWindows,
  ppsRange,
  showPpsRange,
  stateTime,
}: TimelineOverlaysProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* ボス離脱ウィンドウ */}
      {untargetableWindows.map((w, i) => {
        const left = LANE_LABEL_WIDTH + w.startTime * PX_PER_SEC;
        const width = (w.endTime - w.startTime) * PX_PER_SEC;
        return (
          <div
            key={`untargetable-${i}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: RULER_HEIGHT,
              left,
              width,
              backgroundColor: "color-mix(in srgb, var(--color-zone-untargetable) 12%, transparent)",
              borderLeft: "2px solid color-mix(in srgb, var(--color-zone-untargetable) 50%, transparent)",
              borderRight: "2px solid color-mix(in srgb, var(--color-zone-untargetable) 50%, transparent)",
              zIndex: 5,
              pointerEvents: "none",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: "2px",
            }}
            title={t("timelineOverlays.untargetableTitle", { start: w.startTime, end: w.endTime })}
          >
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-zone-untargetable)",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              {t("timelineOverlays.untargetable")}
            </span>
          </div>
        );
      })}

      {/* 複数体ウィンドウ */}
      {multiTargetWindows.map((w, i) => {
        const left = LANE_LABEL_WIDTH + w.startTime * PX_PER_SEC;
        const width = (w.endTime - w.startTime) * PX_PER_SEC;
        return (
          <div
            key={`multi-target-${i}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: RULER_HEIGHT,
              left,
              width,
              backgroundColor: "color-mix(in srgb, var(--color-zone-multi-target) 12%, transparent)",
              borderLeft: "2px solid color-mix(in srgb, var(--color-zone-multi-target) 50%, transparent)",
              borderRight: "2px solid color-mix(in srgb, var(--color-zone-multi-target) 50%, transparent)",
              zIndex: 4,
              pointerEvents: "none",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: "2px",
            }}
            title={t("timelineOverlays.multiTargetTitle", { targets: w.targetCount, start: w.startTime, end: w.endTime })}
          >
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-zone-multi-target)",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              ×{w.targetCount}
            </span>
          </div>
        );
      })}

      {/* PPS範囲選択オーバーレイ */}
      {ppsRange && showPpsRange && (() => {
        const left = LANE_LABEL_WIDTH + ppsRange.startTime * PX_PER_SEC;
        const width = (ppsRange.endTime - ppsRange.startTime) * PX_PER_SEC;
        return (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: RULER_HEIGHT,
              left,
              width,
              backgroundColor: "color-mix(in srgb, var(--color-zone-pps) 8%, transparent)",
              borderLeft: "2px solid color-mix(in srgb, var(--color-zone-pps) 60%, transparent)",
              borderRight: "2px solid color-mix(in srgb, var(--color-zone-pps) 60%, transparent)",
              zIndex: 4,
              pointerEvents: "none",
            }}
            title={t("timelineOverlays.ppsRangeTitle", { start: ppsRange.startTime, end: ppsRange.endTime })}
          />
        );
      })()}

      {/* 状態のパネルの時刻。時間軸まで引き、左のレーンのラベル（zIndex 6）の下に隠れるようにする */}
      {stateTime !== null && (
        <div
          data-testid="timeline-state-line"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: LANE_LABEL_WIDTH + stateTime * PX_PER_SEC - 1,
            width: "2px",
            backgroundColor: "var(--color-accent)",
            zIndex: 5,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}
