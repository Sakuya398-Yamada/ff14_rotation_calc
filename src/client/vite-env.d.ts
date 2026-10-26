/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ビルド時に渡す Turnstile の sitekey（#479）。未設定ならテスト用のキーになる
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
