import { useEffect, useEffectEvent, useRef } from "react";

// SPA では render=explicit で読み込み、描画する時機を自分で決める
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// 本番はビルド時の環境変数で渡す。未設定（ローカル・CI）なら Cloudflare 公式の必ず成功するテスト用キー
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string | null | undefined;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** api.js を 1 回だけ読み込む。失敗したら、次に呼ばれたときに読み込み直す */
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    // 読み込み直すときに、失敗した script を残さない
    const fail = (message: string) => {
      script.remove();
      reject(new Error(message));
    };
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : fail("turnstile is not defined"));
    script.onerror = () => fail("failed to load turnstile");
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

interface TurnstileWidgetProps {
  /** トークンを取れたら渡す。期限が切れたら null（既定で自動的に取り直し、また渡す） */
  onToken: (token: string | null) => void;
  /** ウィジェットのエラーとスクリプトの読み込みの失敗 */
  onError: () => void;
}

/** 保存の前のボット対策（Cloudflare Turnstile, #479）。トークンは 1 回しか使えないので、使ったら key を変えて描画し直す */
export function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleToken = useEffectEvent(onToken);
  const handleError = useEffectEvent(onError);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null | undefined;
    const mount = (turnstile: TurnstileApi) => {
      if (cancelled || !containerRef.current) return;
      widgetId = turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => handleToken(token),
        "expired-callback": () => handleToken(null),
        "error-callback": () => handleError(),
      });
    };
    // 読み込み済みなら待たずに描画する（2 回目以降に開いたとき）
    if (window.turnstile) {
      mount(window.turnstile);
    } else {
      loadTurnstile().then(mount, () => {
        if (!cancelled) handleError();
      });
    }
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, []);

  return <div ref={containerRef} />;
}
