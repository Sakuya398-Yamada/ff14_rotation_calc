import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import { PrivacyPolicyPage } from "./components/PrivacyPolicyPage";
import "./styles/tokens.css";
import { applySettings, loadSettings, prefersDarkScheme } from "./logic/app-settings";
import { initI18n } from "./i18n";
import { consumeFflogsLoginFailed, handleFflogsCallback } from "./logic/fflogs-auth";
import { isPrivacyPolicyPath, languageFromPath } from "./logic/language-path";

// 描画前に保存済みのテーマを反映する（index.html の初期 data-theme からのちらつきを抑える）
applySettings(loadSettings(), prefersDarkScheme());
initI18n(languageFromPath(window.location.pathname));

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
const root = createRoot(rootElement);

function renderPage() {
  root.render(
    <StrictMode>
      {/* /privacy は SPA のフォールバック、/en/privacy は Worker の /en/* が、それぞれの言語の HTML を返す */}
      {isPrivacyPolicyPath(window.location.pathname) ? (
        <PrivacyPolicyPage />
      ) : (
        <App fflogsLoginFailed={consumeFflogsLoginFailed()} />
      )}
    </StrictMode>
  );
}

// FF Logs の認可画面からは、登録したリダイレクト URL（オリジン）に戻る。描画の前にログインを終えて、
// ログインを始めたページに移る（URL からコードを消し、/en/ から始めたなら英語の HTML を開き直すため）
void handleFflogsCallback(window.location).then((returnTo) => {
  if (returnTo !== null) window.location.replace(returnTo);
  else renderPage();
});
