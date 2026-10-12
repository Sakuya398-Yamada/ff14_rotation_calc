import type { MultiTargetWindow } from "../../types/skill";
import { zoneEditorStyles } from "./zone-editor-styles";

const zoneStyles = zoneEditorStyles("--color-zone-multi-target");

interface MultiTargetWindowEditorProps {
  multiTargetWindows: MultiTargetWindow[];
  onMultiTargetWindowsChange: (windows: MultiTargetWindow[]) => void;
}

/** 複数体ウィンドウ（敵数指定付き）の一覧エディタ */
export function MultiTargetWindowEditor({
  multiTargetWindows,
  onMultiTargetWindowsChange,
}: MultiTargetWindowEditorProps) {
  return (
    <div style={zoneStyles.editor}>
      <div style={zoneStyles.header}>
        <span style={zoneStyles.title}>複数体ウィンドウ</span>
        <button
          style={zoneStyles.actionButton}
          onClick={() => {
            const lastEnd = multiTargetWindows.length > 0
              ? Math.max(...multiTargetWindows.map((w) => w.endTime))
              : 0;
            onMultiTargetWindowsChange([
              ...multiTargetWindows,
              { startTime: lastEnd + 5, endTime: lastEnd + 10, targetCount: 2 },
            ]);
          }}
        >
          + 追加
        </button>
      </div>
      {multiTargetWindows.length === 0 && (
        <div style={zoneStyles.empty}>複数体ウィンドウが未設定です</div>
      )}
      {multiTargetWindows.map((w, i) => (
        <div key={i} style={zoneStyles.row}>
          <label style={zoneStyles.label}>
            開始:
            <input
              type="number"
              step="0.5"
              min="0"
              value={w.startTime}
              style={zoneStyles.input}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (isNaN(val) || val < 0) return;
                const next = [...multiTargetWindows];
                next[i] = { ...next[i], startTime: val };
                onMultiTargetWindowsChange(next);
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
              value={w.endTime}
              style={zoneStyles.input}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (isNaN(val) || val < 0) return;
                const next = [...multiTargetWindows];
                next[i] = { ...next[i], endTime: val };
                onMultiTargetWindowsChange(next);
              }}
            />
            s
          </label>
          <label style={zoneStyles.label}>
            敵の数:
            <input
              type="number"
              step="1"
              min="2"
              max="8"
              value={w.targetCount}
              style={zoneStyles.input}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 2) return;
                const next = [...multiTargetWindows];
                next[i] = { ...next[i], targetCount: val };
                onMultiTargetWindowsChange(next);
              }}
            />
          </label>
          <button
            style={zoneStyles.deleteButton}
            onClick={() => {
              onMultiTargetWindowsChange(multiTargetWindows.filter((_, idx) => idx !== i));
            }}
            title="削除"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
