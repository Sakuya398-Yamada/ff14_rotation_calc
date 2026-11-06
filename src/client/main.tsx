import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import { PrivacyPolicyPage } from "./components/PrivacyPolicyPage";
import "./styles/tokens.css";
import { applySettings, loadSettings, prefersDarkScheme } from "./logic/app-settings";
import { initI18n } from "./i18n";
import { isPrivacyPolicyPath, languageFromPath } from "./logic/language-path";

// 描画前に保存済みのテーマを反映する（index.html の初期 data-theme からのちらつきを抑える）
applySettings(loadSettings(), prefersDarkScheme());
initI18n(languageFromPath(window.location.pathname));

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    {/* /privacy は SPA のフォールバック、/en/privacy は Worker の /en/* が、それぞれの言語の HTML を返す */}
    {isPrivacyPolicyPath(window.location.pathname) ? <PrivacyPolicyPage /> : <App />}
  </StrictMode>
);
