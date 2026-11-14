/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ビルド時に渡す Turnstile の sitekey（#479）。未設定ならテスト用のキーになる
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  // ビルド時に渡す FF Logs の API クライアント（公開クライアント）の ID（#1014）。未設定なら FF Logs にログインできない表示になる
  readonly VITE_FFLOGS_CLIENT_ID?: string;
}
