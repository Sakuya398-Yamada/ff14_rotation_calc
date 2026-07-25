import type { BossUntargetableWindow } from "../../types/skill";
import { styles } from "./styles";

interface UntargetableWindowEditorProps {
  untargetableWindows: BossUntargetableWindow[];
  onUntargetableWindowsChange: (windows: BossUntargetableWindow[]) => void;
}

/** ボス離脱タイミングのウィンドウ一覧エディタ */
export function UntargetableWindowEditor({
  untargetableWindows,
  onUntargetableWindowsChange,
}: UntargetableWindowEditorProps) {
  return (
    <div style={styles.untargetableEditor}>
      <div style={styles.untargetableHeader}>
        <span style={styles.untargetableTitle}>ボス離脱タイミング</span>
        <button
          style={styles.untargetableAddButton}
          onClick={() => {
            const lastEnd = untargetableWindows.length > 0
              ? Math.max(...untargetableWindows.map((w) => w.endTime))
              : 0;
            onUntargetableWindowsChange([
              ...untargetableWindows,
              { startTime: lastEnd + 5, endTime: lastEnd + 10 },
            ]);
          }}
        >
          + 追加
        </button>
      </div>
      {untargetableWindows.length === 0 && (
        <div style={styles.untargetableEmpty}>離脱タイミングが未設定です</div>
      )}
      {untargetableWindows.map((w, i) => (
        <div key={i} style={styles.untargetableRow}>
          <label style={styles.untargetableLabel}>
            開始:
            <input
              type="number"
              step="0.5"
              min="0"
              value={w.startTime}
              style={styles.untargetableInput}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (isNaN(val) || val < 0) return;
                const next = [...untargetableWindows];
                next[i] = { ...next[i], startTime: val };
                onUntargetableWindowsChange(next);
              }}
            />
            s
          </label>
          <label style={styles.untargetableLabel}>
            終了:
            <input
              type="number"
              step="0.5"
              min="0"
              value={w.endTime}
              style={styles.untargetableInput}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (isNaN(val) || val < 0) return;
                const next = [...untargetableWindows];
                next[i] = { ...next[i], endTime: val };
                onUntargetableWindowsChange(next);
              }}
            />
            s
          </label>
          <button
            style={styles.untargetableDeleteButton}
            onClick={() => {
              onUntargetableWindowsChange(untargetableWindows.filter((_, idx) => idx !== i));
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
