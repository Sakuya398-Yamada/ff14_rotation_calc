import type { BossUntargetableWindow } from "../../types/skill";
import { zoneEditorStyles } from "./zone-editor-styles";

const zoneStyles = zoneEditorStyles("--color-zone-untargetable");

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
    <div style={zoneStyles.editor}>
      <div style={zoneStyles.header}>
        <span style={zoneStyles.title}>ボス離脱タイミング</span>
        <button
          style={zoneStyles.actionButton}
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
        <div style={zoneStyles.empty}>離脱タイミングが未設定です</div>
      )}
      {untargetableWindows.map((w, i) => (
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
                const next = [...untargetableWindows];
                next[i] = { ...next[i], startTime: val };
                onUntargetableWindowsChange(next);
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
                const next = [...untargetableWindows];
                next[i] = { ...next[i], endTime: val };
                onUntargetableWindowsChange(next);
              }}
            />
            s
          </label>
          <button
            style={zoneStyles.deleteButton}
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
