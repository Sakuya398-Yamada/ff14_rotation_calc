import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n";
import { loginUrl, logout, type AccountStatus } from "../logic/account";
import { privacyPolicyPath } from "../logic/language-path";

interface AccountControlProps {
  status: AccountStatus;
  /** ログインした後に戻るパス */
  returnTo: string;
  onLoggedOut: () => void;
}

export function AccountControl({ status, returnTo, onLoggedOut }: AccountControlProps) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const loginLinkRef = useRef<HTMLAnchorElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
  // ログアウトすると押したボタンが消えてフォーカスが外れるので、代わりに出るログインのリンクへ移す
  const focusLoginRef = useRef(false);
  // 送信中はボタンを無効にするので、ブラウザがフォーカスを外す。失敗したら、押せるようになってから戻す
  const refocusLogoutRef = useRef(false);

  useLayoutEffect(() => {
    if (status !== "loggedOut" || !focusLoginRef.current) return;
    focusLoginRef.current = false;
    loginLinkRef.current?.focus();
  }, [status]);

  useLayoutEffect(() => {
    if (loggingOut || !refocusLogoutRef.current) return;
    refocusLogoutRef.current = false;
    logoutButtonRef.current?.focus();
  }, [loggingOut]);

  if (status === "unavailable") return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutFailed(false);
    const ok = await logout();
    if (!ok) {
      refocusLogoutRef.current = true;
      setLoggingOut(false);
      setLogoutFailed(true);
      return;
    }
    setLoggingOut(false);
    focusLoginRef.current = true;
    onLoggedOut();
  };

  return (
    <div style={styles.root}>
      {status === "loggedIn" ? (
        <>
          <span style={styles.status}>{t("accountControl.loggedIn")}</span>
          <button
            ref={logoutButtonRef}
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            style={styles.button}
          >
            {loggingOut ? t("accountControl.loggingOut") : t("accountControl.logout")}
          </button>
        </>
      ) : (
        <a ref={loginLinkRef} href={loginUrl(returnTo)} style={styles.button}>
          {t("accountControl.login")}
        </a>
      )}
      <a href={privacyPolicyPath(lang)} style={styles.privacyLink}>
        {t("accountControl.privacyPolicy")}
      </a>
      {logoutFailed && (
        <span role="alert" style={styles.error}>
          {t("accountControl.logoutFailed")}
        </span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "var(--space-2) var(--space-3)",
  },
  status: {
    fontSize: "13px",
    color: "var(--color-muted)",
  },
  button: {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    height: "36px",
    padding: "0 var(--space-4)",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-md)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    fontSize: "12px",
    textDecoration: "none",
    cursor: "pointer",
  },
  privacyLink: {
    fontSize: "12px",
    color: "var(--color-accent)",
    textDecoration: "none",
  },
  error: {
    flexBasis: "100%",
    fontSize: "12px",
    color: "var(--color-error)",
  },
};
