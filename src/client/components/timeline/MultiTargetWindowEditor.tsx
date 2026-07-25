import type { MultiTargetWindow } from "../../types/skill";
import { styles } from "./styles";

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
    <div style={styles.multiTargetEditor}>
      <div style={styles.multiTargetHeader}>
        <span style={styles.multiTargetTitle}>複数体ウィンドウ</span>
        <button
          style={styles.multiTargetAddButton}
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
        <div style={styles.multiTargetEmpty}>複数体ウィンドウが未設定です</div>
      )}
      {multiTargetWindows.map((w, i) => (
        <div key={i} style={styles.multiTargetRow}>
          <label style={styles.multiTargetLabel}>
            開始:
            <input
              type="number"
              step="0.5"
              min="0"
              value={w.startTime}
              style={styles.multiTargetInput}
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
          <label style={styles.multiTargetLabel}>
            終了:
            <input
              type="number"
              step="0.5"
              min="0"
              value={w.endTime}
              style={styles.multiTargetInput}
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
          <label style={styles.multiTargetLabel}>
            敵の数:
            <input
              type="number"
              step="1"
              min="2"
              max="8"
              value={w.targetCount}
              style={styles.multiTargetInput}
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
            style={styles.multiTargetDeleteButton}
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
