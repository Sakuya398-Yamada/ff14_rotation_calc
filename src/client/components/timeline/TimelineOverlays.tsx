import type { BossUntargetableWindow, MultiTargetWindow, PpsRange } from "../../types/skill";
import { PX_PER_SEC, LANE_LABEL_WIDTH, RULER_HEIGHT } from "./constants";

interface TimelineOverlaysProps {
  untargetableWindows: BossUntargetableWindow[];
  multiTargetWindows: MultiTargetWindow[];
  ppsRange: PpsRange | null;
  showPpsRange: boolean;
}

/** タイムライン上に重ねる縦帯オーバーレイ（ボス離脱／複数体／PPS範囲） */
export function TimelineOverlays({
  untargetableWindows,
  multiTargetWindows,
  ppsRange,
  showPpsRange,
}: TimelineOverlaysProps) {
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
            title={`ボス離脱 (${w.startTime}s - ${w.endTime}s)`}
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
              離脱
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
            title={`複数体 ×${w.targetCount} (${w.startTime}s - ${w.endTime}s)`}
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
            title={`PPS範囲 (${ppsRange.startTime}s - ${ppsRange.endTime}s)`}
          />
        );
      })()}
    </>
  );
}
