import { useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { beginFflogsLogin, loadFflogsAccount, logoutFflogs } from "../logic/fflogs-auth";

interface FflogsControlProps {
  /** ログインした後に戻るパス */
  returnTo: string;
  /** FF Logs の認可画面へ移る（テストで差し替える） */
  navigate?: (url: string) => void;
}

export function FflogsControl({ returnTo, navigate = (url) => window.location.assign(url) }: FflogsControlProps) {
  const { t } = useTranslation();
  const [account, setAccount] = useState(() => loadFflogsAccount());
  const [loginStartFailed, setLoginStartFailed] = useState(false);
  const noteId = useId();
  const startingRef = useRef(false);
  const loginButtonRef = useRef<HTMLButtonElement>(null);
  // ログアウトすると押したボタンが消えてフォーカスが外れるので、代わりに出るログインのボタンへ移す
  const focusLoginRef = useRef(false);

  useLayoutEffect(() => {
    if (!focusLoginRef.current) return;
    focusLoginRef.current = false;
    loginButtonRef.current?.focus();
  }, [account.status]);

  const handleLogin = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setLoginStartFailed(false);
    // crypto.subtle の無い環境（https でも localhost でもないページ）では例外になる
    const url = await beginFflogsLogin(returnTo, window.location.origin).catch(() => null);
    if (url === null) {
      startingRef.current = false;
      setLoginStartFailed(true);
      return;
    }
    navigate(url);
  };

  const handleLogout = () => {
    logoutFflogs();
    focusLoginRef.current = true;
    setAccount(loadFflogsAccount());
  };

  return (
    <div style={styles.root}>
      {account.status === "loggedIn" ? (
        <>
          <span>{t("fflogsControl.connected", { name: account.userName })}</span>
          <button type="button" onClick={handleLogout} style={styles.button}>
            {t("fflogsControl.logout")}
          </button>
        </>
      ) : (
        <>
          {account.status === "expired" && (
            <span id={noteId} style={styles.note}>
              {t("fflogsControl.expired")}
            </span>
          )}
          <button
            ref={loginButtonRef}
            type="button"
            onClick={() => void handleLogin()}
            disabled={account.status === "unavailable"}
            aria-describedby={account.status === "loggedOut" ? undefined : noteId}
            style={account.status === "unavailable" ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
          >
            {t("fflogsControl.login")}
          </button>
          {/* 期限が切れたトークンも、ログインし直さずにブラウザから消せるようにする */}
          {account.status === "expired" && (
            <button type="button" onClick={handleLogout} style={styles.button}>
              {t("fflogsControl.logout")}
            </button>
          )}
          {account.status === "unavailable" && (
            <span id={noteId} style={styles.note}>
              {t("fflogsControl.unavailable")}
            </span>
          )}
        </>
      )}
      {loginStartFailed && (
        <span role="alert" style={styles.error}>
          {t("fflogsControl.loginStartFailed")}
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
    fontSize: "12px",
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
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  note: {
    flexBasis: "100%",
    color: "var(--color-muted)",
  },
  error: {
    flexBasis: "100%",
    color: "var(--color-error)",
  },
};
