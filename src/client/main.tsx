import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./styles/tokens.css";
import { applySettings, loadSettings, prefersDarkScheme } from "./logic/app-settings";
import { initI18n } from "./i18n";
import { languageFromPath } from "./logic/language-path";

// 描画前に保存済みのテーマを反映する（index.html の初期 data-theme からのちらつきを抑える）
applySettings(loadSettings(), prefersDarkScheme());
initI18n(languageFromPath(window.location.pathname));

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
