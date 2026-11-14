// FF Logs へのログイン（認可コード + PKCE。#1014）。secret を持たない公開クライアントとして、
// ブラウザから直接 FF Logs と通信する（Worker は経由しない）。

const AUTHORIZE_URL = "https://www.fflogs.com/oauth/authorize";
const TOKEN_URL = "https://www.fflogs.com/oauth/token";
const USER_API_URL = "https://www.fflogs.com/api/v2/user";

export const FFLOGS_SESSION_STORAGE_KEY = "ff14-rotation-calc:fflogs-session";
/** 認可画面から戻るまでのあいだだけ、state・code_verifier・戻るパスを持つ（sessionStorage） */
export const FFLOGS_PENDING_LOGIN_STORAGE_KEY = "ff14-rotation-calc:fflogs-pending-login";
/** ログインに失敗したことを、戻った先の画面に 1 度だけ伝える（sessionStorage） */
export const FFLOGS_LOGIN_FAILED_STORAGE_KEY = "ff14-rotation-calc:fflogs-login-failed";

/**
 * unavailable はクライアント ID の無い環境（PR のプレビューなど）。
 * expired は保存したトークンの期限が切れていて、再ログインが要る
 */
export type FflogsAccount =
  | { status: "unavailable" | "loggedOut" | "expired" }
  | { status: "loggedIn"; userName: string };

interface FflogsSession {
  accessToken: string;
  /** トークンが失効する時刻（エポックミリ秒） */
  expiresAt: number;
  userName: string;
}

interface PendingLogin {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

function clientId(): string {
  return import.meta.env.VITE_FFLOGS_CLIENT_ID ?? "";
}

function readStorage(storage: "localStorage" | "sessionStorage", key: string): string | null {
  try {
    return window[storage].getItem(key);
  } catch {
    // ストレージが無効な環境（プライベートモード等）では、保存していないものとして扱う
    return null;
  }
}

function writeStorage(storage: "localStorage" | "sessionStorage", key: string, value: string): boolean {
  try {
    window[storage].setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(storage: "localStorage" | "sessionStorage", key: string): void {
  try {
    window[storage].removeItem(key);
  } catch {
    // 消せない環境には、そもそも保存できていない
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function loadSession(): FflogsSession | null {
  const value = parseJsonObject(readStorage("localStorage", FFLOGS_SESSION_STORAGE_KEY));
  if (!value) return null;
  const { accessToken, expiresAt, userName } = value;
  if (typeof accessToken !== "string" || typeof expiresAt !== "number" || typeof userName !== "string") return null;
  return { accessToken, expiresAt, userName };
}

export function loadFflogsAccount(now: number = Date.now()): FflogsAccount {
  if (clientId() === "") return { status: "unavailable" };
  const session = loadSession();
  if (!session) return { status: "loggedOut" };
  if (now >= session.expiresAt) return { status: "expired" };
  return { status: "loggedIn", userName: session.userName };
}

/** ブラウザに保存したトークンを消す（FF Logs 側のトークンは失効させない） */
export function logoutFflogs(): void {
  removeStorage("localStorage", FFLOGS_SESSION_STORAGE_KEY);
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function codeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return base64Url(new Uint8Array(digest));
}

/**
 * ログインを始める。state と code_verifier を控えて、移る先の FF Logs の認可画面の URL を返す。
 * 始められないとき（クライアント ID が無い・sessionStorage に書けない）は null。
 * origin は登録したリダイレクト URL と完全に一致させる（末尾の "/" なし）
 */
export async function beginFflogsLogin(returnTo: string, origin: string): Promise<string | null> {
  const id = clientId();
  if (id === "") return null;
  const pending: PendingLogin = { state: randomToken(), codeVerifier: randomToken(), returnTo };
  if (!writeStorage("sessionStorage", FFLOGS_PENDING_LOGIN_STORAGE_KEY, JSON.stringify(pending))) return null;
  const params = new URLSearchParams({
    client_id: id,
    code_challenge: await codeChallenge(pending.codeVerifier),
    code_challenge_method: "S256",
    state: pending.state,
    redirect_uri: origin,
    response_type: "code",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

function takePendingLogin(): PendingLogin | null {
  const value = parseJsonObject(readStorage("sessionStorage", FFLOGS_PENDING_LOGIN_STORAGE_KEY));
  removeStorage("sessionStorage", FFLOGS_PENDING_LOGIN_STORAGE_KEY);
  if (!value) return null;
  const { state, codeVerifier, returnTo } = value;
  if (typeof state !== "string" || typeof codeVerifier !== "string" || typeof returnTo !== "string") return null;
  return { state, codeVerifier, returnTo };
}

/** 戻るパスは同じオリジンのパスだけを通す（"//host" や "/\host" は別のオリジンに解決される） */
function safeReturnPath(value: string | undefined): string {
  return value !== undefined && /^\/(?![/\\])/.test(value) ? value : "/";
}

async function exchangeCode(code: string, pending: PendingLogin, origin: string): Promise<{ accessToken: string; expiresAt: number } | null> {
  // フォームの形式で送る（JSON と違い、CORS のプリフライトが要らない）
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId(),
      code_verifier: pending.codeVerifier,
      redirect_uri: origin,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== "string" || body.access_token === "") return null;
  if (typeof body.expires_in !== "number" || !(body.expires_in > 0)) return null;
  // リフレッシュトークンが返っても保存しない。期限が切れたら、もう一度ログインしてもらう
  return { accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
}

async function fetchUserName(accessToken: string): Promise<string | null> {
  const res = await fetch(USER_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ userData { currentUser { name } } }" }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { userData?: { currentUser?: { name?: unknown } | null } | null } | null };
  const name = body.data?.userData?.currentUser?.name;
  return typeof name === "string" ? name : null;
}

async function completeLogin(params: URLSearchParams, pending: PendingLogin, origin: string): Promise<boolean> {
  const code = params.get("code");
  if (code === null || params.get("state") !== pending.state) return false;
  try {
    const token = await exchangeCode(code, pending, origin);
    if (!token) return false;
    const userName = await fetchUserName(token.accessToken);
    if (userName === null) return false;
    const session: FflogsSession = { ...token, userName };
    return writeStorage("localStorage", FFLOGS_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    return false;
  }
}

/**
 * FF Logs の認可画面から戻ってきた URL（"?code=…&state=…" か "?error=…&state=…"）なら、ログインを終えて、
 * 次に移るパス（ログインを始めたページ）を返す。それ以外の URL なら null。
 * 失敗したときは、移った先で consumeFflogsLoginFailed() が 1 度だけ true を返す
 */
export async function handleFflogsCallback(search: string, origin: string): Promise<string | null> {
  const params = new URLSearchParams(search);
  if (!params.has("state") || !(params.has("code") || params.has("error"))) return null;
  const pending = takePendingLogin();
  // 認可画面で拒否して戻ったときは、利用者が自分でやめたので失敗として知らせない
  const cancelled = pending !== null && params.get("error") === "access_denied" && params.get("state") === pending.state;
  if (!cancelled && !(pending !== null && (await completeLogin(params, pending, origin)))) {
    writeStorage("sessionStorage", FFLOGS_LOGIN_FAILED_STORAGE_KEY, "1");
  }
  return safeReturnPath(pending?.returnTo);
}

export function consumeFflogsLoginFailed(): boolean {
  const failed = readStorage("sessionStorage", FFLOGS_LOGIN_FAILED_STORAGE_KEY) !== null;
  removeStorage("sessionStorage", FFLOGS_LOGIN_FAILED_STORAGE_KEY);
  return failed;
}
