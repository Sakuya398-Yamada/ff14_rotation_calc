import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { applySettings, loadSettings, prefersDarkScheme, saveSettings } from "../logic/app-settings";
import { SettingsDialog } from "./SettingsDialog";

interface SettingsButtonProps {
  /** 設定ダイアログの言語の切り替え先（今のページの、相手の言語版のパス） */
  languageHref: string;
}

/** 歯車のボタンと、それで開く設定ダイアログ。設定の保存と画面への反映もここで行う */
export function SettingsButton({ languageHref }: SettingsButtonProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(loadSettings);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveSettings(settings);
    applySettings(settings, prefersDarkScheme());
    if (settings.theme !== "system" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSchemeChange = (e: MediaQueryListEvent) => applySettings(settings, e.matches);
    mediaQuery.addEventListener("change", handleSchemeChange);
    return () => mediaQuery.removeEventListener("change", handleSchemeChange);
  }, [settings]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("app.settings")}
        title={t("app.settings")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        style={styles.button}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <SettingsDialog
        open={open}
        settings={settings}
        onChange={setSettings}
        onClose={() => setOpen(false)}
        returnFocusRef={buttonRef}
        languageHref={languageHref}
      />
    </>
  );
}

const styles = {
  button: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
