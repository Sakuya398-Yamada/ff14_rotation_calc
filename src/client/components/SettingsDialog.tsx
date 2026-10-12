import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { AccentColor, AppSettings, ThemePreference } from "../logic/app-settings";
import "./settings-dialog.css";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
  { value: "system", label: "OS に合わせる" },
];

const ACCENT_OPTIONS: { value: AccentColor; label: string }[] = [
  { value: "blue", label: "青" },
  { value: "orange", label: "橙" },
  { value: "purple", label: "紫" },
  { value: "green", label: "緑" },
];

const DENSITY_OPTIONS = ["標準", "コンパクト"];

interface SettingsDialogProps {
  open: boolean;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
  /** 閉じたときにフォーカスを戻す要素（開いたボタン） */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function SettingsDialog({ open, settings, onChange, onClose, returnFocusRef }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      // モーダル中は外側の要素にフォーカスできないため、close() の後で戻す
      returnFocusRef.current?.focus();
    }
  }, [open, returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby="settings-dialog-title"
      style={styles.dialog}
      onCancel={(e) => {
        // Esc はブラウザに閉じさせず、open state 経由で閉じる（state と DOM の open を一致させるため）
        e.preventDefault();
        onClose();
      }}
      // SkillDetailPanel は document で Esc / 外側クリックを拾って閉じるため、ダイアログ内の操作を document に伝播させない
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={styles.header}>
        <h2 id="settings-dialog-title" style={styles.title}>
          設定
        </h2>
        <button type="button" aria-label="設定を閉じる" onClick={onClose} style={styles.iconButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div style={styles.body}>
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>テーマ</legend>
          <div style={styles.segmented}>
            {THEME_OPTIONS.map((opt) => {
              const checked = settings.theme === opt.value;
              return (
                <label key={opt.value} className="settings-option" style={checked ? styles.segmentOn : styles.segment}>
                  <input
                    type="radio"
                    name="settings-theme"
                    value={opt.value}
                    checked={checked}
                    onChange={() => onChange({ ...settings, theme: opt.value })}
                    className="settings-visually-hidden"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>アクセントカラー</legend>
          <div style={styles.swatches}>
            {ACCENT_OPTIONS.map((opt) => {
              const checked = settings.accent === opt.value;
              return (
                <label
                  key={opt.value}
                  className="settings-option"
                  title={opt.label}
                  style={{
                    ...styles.swatch,
                    background: `var(--accent-${opt.value})`,
                    borderColor: checked ? "var(--color-text)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="settings-accent"
                    value={opt.value}
                    aria-label={opt.label}
                    checked={checked}
                    onChange={() => onChange({ ...settings, accent: opt.value })}
                    className="settings-visually-hidden"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset disabled style={styles.fieldset}>
          <legend style={styles.legend}>
            タイムラインの表示密度 <span style={styles.unsupported}>未対応</span>
          </legend>
          <div style={{ ...styles.segmented, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", opacity: 0.45 }}>
            {DENSITY_OPTIONS.map((label, i) => (
              <label key={label} style={{ ...(i === 0 ? styles.segmentOn : styles.segment), cursor: "not-allowed" }}>
                <input type="radio" name="settings-density" defaultChecked={i === 0} className="settings-visually-hidden" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div style={styles.footer}>
        <span style={styles.note}>変更はこのブラウザに保存されます</span>
        <button type="button" onClick={onClose} style={styles.primaryButton}>
          閉じる
        </button>
      </div>
    </dialog>
  );
}

const segmentBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "36px",
  borderRadius: "var(--radius-md)",
  fontSize: "12px",
  color: "var(--color-text)",
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "transparent",
};

const styles: Record<string, React.CSSProperties> = {
  dialog: {
    width: "480px",
    maxWidth: "calc(100vw - 32px)",
    padding: 0,
    borderRadius: "12px",
    border: "1px solid var(--color-line)",
    background: "var(--color-surface)",
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
    boxShadow: "0 20px 48px rgba(0, 0, 0, 0.25)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "var(--space-3) var(--space-3) var(--space-3) var(--space-5)",
    borderBottom: "1px solid var(--color-line-soft)",
  },
  title: {
    margin: 0,
    flex: "1 1 auto",
    fontSize: "15px",
    fontWeight: 700,
  },
  iconButton: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "var(--radius-md)",
    background: "transparent",
    color: "var(--color-muted)",
    cursor: "pointer",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
    padding: "var(--space-5)",
  },
  fieldset: {
    margin: 0,
    padding: 0,
    border: "none",
    minWidth: 0,
  },
  legend: {
    padding: 0,
    marginBottom: "var(--space-2)",
    fontSize: "12px",
    fontWeight: 700,
  },
  unsupported: {
    marginLeft: "var(--space-1)",
    fontSize: "11px",
    fontWeight: 400,
    color: "var(--color-muted)",
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "var(--space-1)",
    padding: "var(--space-1)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-bg)",
  },
  segment: segmentBase,
  segmentOn: {
    ...segmentBase,
    background: "var(--color-raised)",
    borderColor: "var(--color-field)",
  },
  swatches: {
    display: "flex",
    gap: "10px",
  },
  swatch: {
    width: "36px",
    height: "36px",
    boxSizing: "border-box",
    borderRadius: "50%",
    borderWidth: "2px",
    borderStyle: "solid",
    cursor: "pointer",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    padding: "var(--space-3) var(--space-5)",
    borderTop: "1px solid var(--color-line-soft)",
  },
  note: {
    flex: "1 1 auto",
    fontSize: "11px",
    color: "var(--color-muted)",
  },
  primaryButton: {
    minHeight: "36px",
    padding: "0 var(--space-4)",
    border: "none",
    borderRadius: "var(--radius-md)",
    background: "var(--color-text)",
    color: "var(--color-bg)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
};
