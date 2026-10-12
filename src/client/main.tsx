import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./styles/tokens.css";
import { applySettings, loadSettings, prefersDarkScheme } from "./logic/app-settings";

// 描画前に保存済みのテーマを反映する（index.html の初期 data-theme からのちらつきを抑える）
applySettings(loadSettings(), prefersDarkScheme());

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
