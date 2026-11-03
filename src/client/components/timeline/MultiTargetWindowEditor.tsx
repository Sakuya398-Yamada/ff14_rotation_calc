import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div style={zoneStyles.editor}>
      <div style={zoneStyles.header}>
        <span style={zoneStyles.title}>{t("multiTargetWindowEditor.title")}</span>
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
          {t("multiTargetWindowEditor.add")}
        </button>
      </div>
      {multiTargetWindows.length === 0 && (
        <div style={zoneStyles.empty}>{t("multiTargetWindowEditor.empty")}</div>
      )}
      {multiTargetWindows.map((w, i) => (
        <div key={i} style={zoneStyles.row}>
          <label style={zoneStyles.label}>
            {t("multiTargetWindowEditor.start")}
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
            {t("multiTargetWindowEditor.end")}
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
            {t("multiTargetWindowEditor.targetCount")}
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
            title={t("multiTargetWindowEditor.delete")}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
