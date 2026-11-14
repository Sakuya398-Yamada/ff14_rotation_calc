// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import {
  beginFflogsLogin,
  consumeFflogsLoginFailed,
  FFLOGS_PENDING_LOGIN_STORAGE_KEY,
  FFLOGS_SESSION_STORAGE_KEY,
  handleFflogsCallback,
  loadFflogsAccount,
  logoutFflogs,
} from "../fflogs-auth";

const ORIGIN = "http://localhost:5173";
const NOW = Date.UTC(2026, 10, 14);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

/** トークンの交換とユーザー名の取得が、どちらも成功する FF Logs */
function fflogsResponds(url: string): Response {
  if (url === "https://www.fflogs.com/oauth/token") {
    return jsonResponse({ token_type: "Bearer", expires_in: 3600, access_token: "access-1", refresh_token: "refresh-1" });
  }
  return jsonResponse({ data: { userData: { currentUser: { name: "Sakuya" } } } });
}

function callbackUrl(search: string, pathname = "/") {
  return { pathname, search, origin: ORIGIN };
}

function storePendingLogin(returnTo = "/en/") {
  sessionStorage.setItem(
    FFLOGS_PENDING_LOGIN_STORAGE_KEY,
    JSON.stringify({ state: "state-1", codeVerifier: "verifier-1", returnTo })
  );
}

function storeSession(expiresAt: number) {
  localStorage.setItem(FFLOGS_SESSION_STORAGE_KEY, JSON.stringify({ accessToken: "access-1", expiresAt, userName: "Sakuya" }));
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("VITE_FFLOGS_CLIENT_ID", "client-1");
  // jsdom の crypto には subtle が無い
  vi.stubGlobal("crypto", webcrypto);
  fetchMock = vi.fn(async (url: string) => fflogsResponds(url));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("loadFflogsAccount", () => {
  it("クライアント ID が無ければ、トークンが保存されていても unavailable で、保存されていたトークンは消す", () => {
    vi.stubEnv("VITE_FFLOGS_CLIENT_ID", "");
    storeSession(NOW + 1000);
    expect(loadFflogsAccount()).toEqual({ status: "unavailable" });
    expect(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("トークンが保存されていなければ loggedOut", () => {
    expect(loadFflogsAccount()).toEqual({ status: "loggedOut" });
  });

  it("壊れた保存値は loggedOut", () => {
    localStorage.setItem(FFLOGS_SESSION_STORAGE_KEY, "{not json");
    expect(loadFflogsAccount()).toEqual({ status: "loggedOut" });
    localStorage.setItem(FFLOGS_SESSION_STORAGE_KEY, JSON.stringify({ accessToken: "access-1", userName: "Sakuya" }));
    expect(loadFflogsAccount()).toEqual({ status: "loggedOut" });
  });

  it("期限の前は loggedIn でユーザー名を返し、期限の時刻になったら expired", () => {
    storeSession(NOW + 1000);
    expect(loadFflogsAccount()).toEqual({ status: "loggedIn", userName: "Sakuya" });
    vi.setSystemTime(NOW + 999);
    expect(loadFflogsAccount()).toEqual({ status: "loggedIn", userName: "Sakuya" });
    vi.setSystemTime(NOW + 1000);
    expect(loadFflogsAccount()).toEqual({ status: "expired" });
    // 期限切れの保存値は、ログアウトかログインのし直しまで残す（再ログインを促し続けるため）
    expect(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY)).not.toBeNull();
  });
});

describe("logoutFflogs", () => {
  it("保存したトークンを消し、loggedOut になる", () => {
    storeSession(NOW + 1000);
    logoutFflogs();
    expect(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY)).toBeNull();
    expect(loadFflogsAccount()).toEqual({ status: "loggedOut" });
  });
});

describe("beginFflogsLogin", () => {
  it("クライアント ID が無ければ null を返し、何も控えない", async () => {
    vi.stubEnv("VITE_FFLOGS_CLIENT_ID", "");
    expect(await beginFflogsLogin("/", ORIGIN)).toBeNull();
    expect(sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY)).toBeNull();
  });

  it("state・code_verifier・戻るパスを控え、S256 の code_challenge を付けた認可画面の URL を返す", async () => {
    const url = new URL((await beginFflogsLogin("/en/", ORIGIN)) ?? "");
    const pending = JSON.parse(sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY) ?? "") as Record<string, string>;

    expect(url.origin + url.pathname).toBe("https://www.fflogs.com/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-1",
      code_challenge: createHash("sha256").update(pending.codeVerifier).digest("base64url"),
      code_challenge_method: "S256",
      state: pending.state,
      redirect_uri: ORIGIN,
      response_type: "code",
    });
    expect(pending.returnTo).toBe("/en/");
    // RFC 7636 の code_verifier は 43〜128 文字の unreserved 文字
    expect(pending.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pending.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pending.state).not.toBe(pending.codeVerifier);
  });

  it("呼ぶたびに別の state と code_verifier を作る", async () => {
    await beginFflogsLogin("/", ORIGIN);
    const first = sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY);
    await beginFflogsLogin("/", ORIGIN);
    const second = sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY);
    expect(JSON.parse(second ?? "").state).not.toBe(JSON.parse(first ?? "").state);
    expect(JSON.parse(second ?? "").codeVerifier).not.toBe(JSON.parse(first ?? "").codeVerifier);
  });
});

describe("handleFflogsCallback", () => {
  it.each(["", "?fight=3", "?code=code-1", "?state=state-1"])("認可画面から戻った URL でなければ（%o）null を返し、控えた値に触らない", async (search) => {
    storePendingLogin();
    expect(await handleFflogsCallback(callbackUrl(search))).toBeNull();
    expect(sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY)).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeFflogsLoginFailed()).toBe(false);
  });

  it.each(["/en/", "/privacy", "/t/V1StGXR8_Z5jdHi6B-myT"])("トップ以外のパス（%s）は、同じクエリが付いていても処理しない", async (pathname) => {
    storePendingLogin();
    expect(await handleFflogsCallback(callbackUrl("?code=code-1&state=state-1", pathname))).toBeNull();
    expect(sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY)).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("コードをトークンに交換し、ユーザー名を取って保存し、ログインを始めたパスを返す", async () => {
    storePendingLogin("/en/");
    expect(await handleFflogsCallback(callbackUrl("?code=code-1&state=state-1"))).toBe("/en/");

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://www.fflogs.com/oauth/token");
    expect(tokenInit?.method).toBe("POST");
    expect(Object.fromEntries(tokenInit?.body as URLSearchParams)).toEqual({
      client_id: "client-1",
      code_verifier: "verifier-1",
      redirect_uri: ORIGIN,
      grant_type: "authorization_code",
      code: "code-1",
    });
    const [userUrl, userInit] = fetchMock.mock.calls[1];
    expect(userUrl).toBe("https://www.fflogs.com/api/v2/user");
    // 応答が返らないときに待ち続けないよう、どちらの通信にも中断のシグナルを付ける
    expect(tokenInit?.signal).toBeInstanceOf(AbortSignal);
    expect(userInit?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(userInit?.headers).get("Authorization")).toBe("Bearer access-1");

    // リフレッシュトークンは保存しない
    expect(JSON.parse(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY) ?? "")).toEqual({
      accessToken: "access-1",
      expiresAt: NOW + 3600 * 1000,
      userName: "Sakuya",
    });
    expect(loadFflogsAccount()).toEqual({ status: "loggedIn", userName: "Sakuya" });
    expect(sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY)).toBeNull();
    expect(consumeFflogsLoginFailed()).toBe(false);
  });

  it("state が控えた値と違えば、FF Logs を呼ばずに失敗にする", async () => {
    storePendingLogin("/en/");
    expect(await handleFflogsCallback(callbackUrl("?code=code-1&state=other"))).toBe("/en/");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadFflogsAccount()).toEqual({ status: "loggedOut" });
    expect(consumeFflogsLoginFailed()).toBe(true);
    // 控えた値は 1 度きり。同じコードでやり直しても通らない
    expect(sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY)).toBeNull();
  });

  it("控えた値が無ければ（別のタブで始めたログインなど）、FF Logs を呼ばずに失敗にしてトップに戻す", async () => {
    expect(await handleFflogsCallback(callbackUrl("?code=code-1&state=state-1"))).toBe("/");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeFflogsLoginFailed()).toBe(true);
  });

  it.each([
    ["トークンの交換が 401", () => jsonResponse({ error: "invalid_client" }, 401), null],
    ["トークンの応答に access_token が無い", () => jsonResponse({ expires_in: 3600 }), null],
    ["トークンの応答に expires_in が無い", () => jsonResponse({ access_token: "access-1" }), null],
    ["トークンの応答の expires_in が 0", () => jsonResponse({ access_token: "access-1", expires_in: 0 }), null],
    ["トークンの交換で通信に失敗", () => Promise.reject(new TypeError("Failed to fetch")), null],
    ["ユーザー名の取得が 401", null, () => jsonResponse({ error: "Unauthenticated." }, 401)],
    ["ユーザー名の応答に名前が無い", null, () => jsonResponse({ data: { userData: { currentUser: null } } })],
    ["ユーザー名の応答が JSON でない", null, () => new Response("<html>", { status: 200 })],
  ] satisfies [string, (() => Response | Promise<Response>) | null, (() => Response) | null][])(
    "%s なら、トークンを保存せずに失敗にする",
    async (_name, tokenResponse, userResponse) => {
      fetchMock.mockImplementation(async (url) => {
        const override = url === "https://www.fflogs.com/oauth/token" ? tokenResponse : userResponse;
        return override ? override() : fflogsResponds(url);
      });
      storePendingLogin("/en/");
      expect(await handleFflogsCallback(callbackUrl("?code=code-1&state=state-1"))).toBe("/en/");
      expect(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY)).toBeNull();
      expect(consumeFflogsLoginFailed()).toBe(true);
    }
  );

  it("認可画面で拒否して戻ったときは、FF Logs を呼ばず、失敗としても知らせない", async () => {
    storePendingLogin("/en/");
    expect(await handleFflogsCallback(callbackUrl("?error=access_denied&state=state-1"))).toBe("/en/");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadFflogsAccount()).toEqual({ status: "loggedOut" });
    expect(consumeFflogsLoginFailed()).toBe(false);
  });

  it("拒否以外のエラーで戻ったときは、失敗にする", async () => {
    storePendingLogin("/en/");
    expect(await handleFflogsCallback(callbackUrl("?error=server_error&state=state-1"))).toBe("/en/");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeFflogsLoginFailed()).toBe(true);
  });

  it("ログインし直すと、期限の切れた保存値を新しいトークンで置き換える", async () => {
    storeSession(NOW - 1);
    expect(loadFflogsAccount()).toEqual({ status: "expired" });
    storePendingLogin("/");
    await handleFflogsCallback(callbackUrl("?code=code-1&state=state-1"));
    expect(loadFflogsAccount()).toEqual({ status: "loggedIn", userName: "Sakuya" });
  });

  it.each(["//evil.example/", "/\\evil.example/", "/\t/evil.example/", "/\n/evil.example/", "https://evil.example/", ""])(
    "控えた戻るパスが同じオリジンのパスでなければ（%o）、トップに戻す",
    async (returnTo) => {
      storePendingLogin(returnTo);
      expect(await handleFflogsCallback(callbackUrl("?code=code-1&state=state-1"))).toBe("/");
    }
  );
});

describe("consumeFflogsLoginFailed", () => {
  it("失敗は 1 度だけ伝える", async () => {
    await handleFflogsCallback(callbackUrl("?code=code-1&state=state-1"));
    expect(consumeFflogsLoginFailed()).toBe(true);
    expect(consumeFflogsLoginFailed()).toBe(false);
  });
});
