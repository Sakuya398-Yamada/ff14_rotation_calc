import type { PpsRange } from "../../types/skill";
import { styles } from "./styles";
import { zoneEditorStyles } from "./zone-editor-styles";

const zoneStyles = zoneEditorStyles("--color-zone-pps");

interface PpsRangeEditorProps {
  ppsRange: PpsRange | null;
  onPpsRangeChange: (range: PpsRange | null) => void;
  lastGcdEndTime: number;
  rangePps: { pps: number; totalPotency: number; directPotency: number; dotPotency: number } | null;
}

/** PPS範囲選択エディタ（開始・終了秒の入力と範囲PPSの表示） */
export function PpsRangeEditor({
  ppsRange,
  onPpsRangeChange,
  lastGcdEndTime,
  rangePps,
}: PpsRangeEditorProps) {
  return (
    <div style={zoneStyles.editor}>
      <div style={zoneStyles.header}>
        <span style={zoneStyles.title}>PPS範囲選択</span>
      </div>
      <div style={zoneStyles.row}>
        <label style={zoneStyles.label}>
          開始:
          <input
            type="number"
            step="0.5"
            min="0"
            value={ppsRange?.startTime ?? 0}
            style={zoneStyles.input}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (isNaN(val) || val < 0) return;
              onPpsRangeChange({
                startTime: val,
                endTime: ppsRange?.endTime ?? lastGcdEndTime,
              });
            }}
          />
          s
        </label>
        <label style={zoneStyles.label}>
          終了:
          <input
            type="number"
            step="0.5"
            min="0"
            value={ppsRange?.endTime ?? lastGcdEndTime}
            style={zoneStyles.input}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (isNaN(val) || val < 0) return;
              onPpsRangeChange({
                startTime: ppsRange?.startTime ?? 0,
                endTime: val,
              });
            }}
          />
          s
        </label>
        <button
          style={zoneStyles.actionButton}
          onClick={() => onPpsRangeChange({ startTime: 0, endTime: lastGcdEndTime })}
          title="全体範囲にリセット"
        >
          全体
        </button>
      </div>
      {rangePps !== null && (
        <div style={styles.ppsRangeResult}>
          <span>
            範囲PPS: <span style={styles.ppsValue}>{rangePps.pps.toFixed(2)}</span>
          </span>
          <span style={styles.ppsRangeDetail}>
            (威力: {rangePps.totalPotency} = 直接{rangePps.directPotency} + DoT{rangePps.dotPotency})
          </span>
        </div>
      )}
    </div>
  );
}
