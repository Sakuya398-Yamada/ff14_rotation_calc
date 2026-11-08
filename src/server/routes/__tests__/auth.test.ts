import { createHash, createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessions, userIdentities, users } from "../../db/schema";
import { createAuthRoute, createMeRoute } from "../auth";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../../migrations", import.meta.url));
const ORIGIN = "http://localhost";
const CLIENT_ID = "123456789012345678";
const CLIENT_SECRET = "test-client-secret";
const ID_HMAC_KEY = "test-id-hmac-key";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const CURRENT_USER_URL = "https://discord.com/api/v10/users/@me";
const ACCESS_TOKEN = "test-access-token";
const SESSION_RE = /__Host-session=([A-Za-z0-9_-]{43})/;
const DAY = 24 * 60 * 60;
// 時刻を固定する（セッションの期限を秒単位で比べるため）
const NOW = 1_800_000_000;

// src/server/routes/__tests__/timelines.test.ts と同じく、本番の D1 と同じマイグレーションを当てた better-sqlite3 の DB を使う（#574）
function createTestDb() {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacHex(key: string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

let db: ReturnType<typeof createTestDb>;
let discordFetch: ReturnType<typeof vi.fn<typeof fetch>>;
let discordUserId: string;
let clientId: string | undefined;
let clientSecret: string | undefined;
let idHmacKey: string | undefined;
let app: Hono;

// トークンのエンドポイントと /users/@me の代わり。URL で振り分ける
async function fakeDiscord(input: RequestInfo | URL): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (url === TOKEN_URL) {
    return Response.json({
      access_token: ACCESS_TOKEN,
      token_type: "Bearer",
      expires_in: 604800,
      refresh_token: "test-refresh-token",
      scope: "identify",
    });
  }
  if (url === CURRENT_USER_URL) return Response.json({ id: discordUserId, username: "user", discriminator: "0" });
  return new Response(null, { status: 404 });
}

function request(path: string, init: RequestInit = {}) {
  return app.request(`${ORIGIN}${path}`, init, {
    DB: undefined,
    DISCORD_CLIENT_ID: clientId,
    DISCORD_CLIENT_SECRET: clientSecret,
    DISCORD_ID_HMAC_KEY: idHmacKey,
  });
}

function setCookies(res: Response): string {
  return res.headers.getSetCookie().join("\n");
}

/** Set-Cookie のうち name の 1 本（`name=value; 属性...`） */
function findSetCookie(res: Response, name: string): string | undefined {
  return res.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
}

/** GET /api/auth/discord の応答から、ブラウザが送り返す Cookie と、認可画面の URL を取り出す */
async function startLogin(returnTo?: string) {
  const query = returnTo === undefined ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;
  const res = await request(`/api/auth/discord${query}`);
  const oauthCookie = findSetCookie(res, "__Host-discord_oauth") ?? "";
  const cookie = oauthCookie.split(";")[0];
  const authorizeUrl = new URL(res.headers.get("Location") ?? "");
  const stored = JSON.parse(decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1))) as {
    state: string;
    verifier: string;
    returnTo: string;
  };
  return { res, cookie, oauthCookie, authorizeUrl, stored };
}

/** 認可画面で承認して戻ってきたところまでを進める。extraCookie はブラウザに残っている別の Cookie */
async function login(options: { returnTo?: string; extraCookie?: string } = {}) {
  const { cookie, stored } = await startLogin(options.returnTo);
  const res = await request(`/api/auth/discord/callback?code=test-code&state=${stored.state}`, {
    headers: { Cookie: [cookie, options.extraCookie].filter(Boolean).join("; ") },
  });
  return { res, stored, sessionToken: SESSION_RE.exec(setCookies(res))?.[1] };
}

async function me(sessionToken?: string) {
  const res = await request("/api/me", sessionToken ? { headers: { Cookie: `__Host-session=${sessionToken}` } } : {});
  return { res, body: (await res.json()) as unknown };
}

/** 期限を指定したセッションの行を直接入れる */
async function insertSession(row: { expiresAt: number; createdAt: number }) {
  const token = "s".repeat(43);
  await db.insert(users).values({ id: "user-1" });
  await db.insert(sessions).values({ idHash: sha256Hex(token), userId: "user-1", ...row });
  return token;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
  db = createTestDb();
  discordUserId = "80351110224678912";
  // app.request はグローバルの fetch を使わないので、差し替わるのは Discord の呼び出しだけ
  discordFetch = vi.fn(fakeDiscord);
  vi.stubGlobal("fetch", discordFetch);
  clientId = CLIENT_ID;
  clientSecret = CLIENT_SECRET;
  idHmacKey = ID_HMAC_KEY;
  app = new Hono().route("/api/auth", createAuthRoute(() => db)).route("/api/me", createMeRoute(() => db));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("クライアント ID が無い環境（PR のプレビュー）", () => {
  beforeEach(() => {
    clientId = undefined;
    clientSecret = undefined;
    idHmacKey = undefined;
  });

  it.each(["/api/auth/discord", "/api/auth/discord/callback?code=test-code&state=x"])(
    "%s は 404 で、Cookie を発行せず Discord にも問い合わせない",
    async (path) => {
      const res = await request(path);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
      expect(res.headers.get("Set-Cookie")).toBeNull();
      expect(discordFetch).not.toHaveBeenCalled();
    },
  );

  it("/api/me はログインできないと返し、セッションの Cookie があっても DB を読まない", async () => {
    const select = vi.spyOn(db, "select");
    const { res, body } = await me("s".repeat(43));

    expect(res.status).toBe(200);
    expect(body).toEqual({ loginAvailable: false, loggedIn: false });
    expect(select).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/discord: 認可画面へのリダイレクト", () => {
  it("PKCE（S256）と state を付けて Discord の認可画面へリダイレクトし、state と code_verifier を短命の Cookie に入れる", async () => {
    const { res, oauthCookie, authorizeUrl, stored } = await startLogin();

    expect(res.status).toBe(302);
    expect(`${authorizeUrl.origin}${authorizeUrl.pathname}`).toBe(AUTHORIZE_URL);
    expect(Object.fromEntries(authorizeUrl.searchParams)).toEqual({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: "identify",
      redirect_uri: `${ORIGIN}/api/auth/discord/callback`,
      state: stored.state,
      code_challenge: createHash("sha256").update(stored.verifier).digest("base64url"),
      code_challenge_method: "S256",
    });
    expect(stored.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(oauthCookie).toContain("Max-Age=600");
    expect(oauthCookie).toContain("Path=/");
    expect(oauthCookie).toContain("HttpOnly");
    expect(oauthCookie).toContain("Secure");
    expect(oauthCookie).toContain("SameSite=Lax");
  });

  it("毎回別の state と code_verifier を作る", async () => {
    const first = await startLogin();
    const second = await startLogin();

    expect(second.stored.state).not.toBe(first.stored.state);
    expect(second.stored.verifier).not.toBe(first.stored.verifier);
  });

  it("ID があるのに secret が無ければ、設定の誤りとして 500 にする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    clientSecret = undefined;
    const res = await request("/api/auth/discord");

    expect(res.status).toBe(500);
    expect(res.headers.get("Location")).toBeNull();
  });
});

describe("ログイン後に戻るパス", () => {
  it.each([
    ["同じオリジンの相対パス", "/en/t/V1StGXR8_Z5jdHi6B-myT", "/en/t/V1StGXR8_Z5jdHi6B-myT"],
    ["クエリとフラグメント付き", "/?lang=en#saved", "/?lang=en#saved"],
    ["指定なし", undefined, "/"],
    // 別ホストにはパスを付ける。パスの部分だけを取り出すと、別ホストのものでも同じオリジンのパスとして通ってしまうため
    ["別オリジンの URL", "https://evil.example/en/", "/"],
    ["プロトコル相対の URL", "//evil.example/en/", "/"],
    ["バックスラッシュで始まる別ホスト", "/\\evil.example/en/", "/"],
    ["タブを挟んだ別ホスト", "/\t/evil.example/en/", "/"],
    // 解決するとオリジンは同じままパスが `//evil.example/...` になり、Location に入れるとプロトコル相対の URL として読まれる
    ["ドットセグメントで別ホスト", "/.//evil.example/en/", "/"],
    ["親ディレクトリで別ホスト", "/a/..//evil.example/en/", "/"],
    ["エンコードしたドットで別ホスト", "/%2e//evil.example/en/", "/"],
    ["ドットとバックスラッシュで別ホスト", "/./\\evil.example/en/", "/"],
    ["同じオリジンでも絶対 URL", `${ORIGIN}/en/`, "/"],
    ["javascript: の URL", "javascript:alert(1)", "/"],
  ])("%s（%j）を渡すと、ログイン後に %s へ戻る", async (_label, returnTo, expected) => {
    const { res, stored } = await login({ returnTo });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(expected);
    // コールバックでもう一度検査するが、それに頼らず、短命の Cookie に入れる時点で検査を済ませておく
    expect(stored.returnTo).toBe(expected);
  });
});

describe("GET /api/auth/discord/callback: ログイン", () => {
  it("初回のログインでユーザーと Discord の識別子を作り、セッションを発行して戻るパスへ戻す", async () => {
    const { res, stored, sessionToken } = await login({ returnTo: "/en/" });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/en/");

    // 認可コードを、PKCE の code_verifier と client の Basic 認証を付けて交換する
    expect(discordFetch).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = discordFetch.mock.calls[0];
    expect(tokenUrl).toBe(TOKEN_URL);
    expect(tokenInit?.method).toBe("POST");
    const tokenHeaders = new Headers(tokenInit?.headers);
    expect(tokenHeaders.get("Authorization")).toBe(
      `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    );
    expect(tokenHeaders.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(tokenInit?.body as URLSearchParams))).toEqual({
      grant_type: "authorization_code",
      code: "test-code",
      redirect_uri: `${ORIGIN}/api/auth/discord/callback`,
      code_verifier: stored.verifier,
    });
    const [userUrl, userInit] = discordFetch.mock.calls[1];
    expect(userUrl).toBe(CURRENT_USER_URL);
    expect(new Headers(userInit?.headers).get("Authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);

    // 生の Discord ID は保存せず、鍵の HMAC-SHA256 だけを置く（#918）
    const createdUsers = await db.select().from(users);
    expect(createdUsers).toHaveLength(1);
    expect(await db.select().from(userIdentities)).toEqual([
      expect.objectContaining({
        provider: "discord",
        providerUserId: hmacHex(ID_HMAC_KEY, discordUserId),
        userId: createdUsers[0].id,
      }),
    ]);

    // DB にはトークンの SHA-256 だけを置き、期限は 30 日
    expect(sessionToken).toBeDefined();
    expect(await db.select().from(sessions)).toEqual([
      { idHash: sha256Hex(sessionToken ?? ""), userId: createdUsers[0].id, expiresAt: NOW + 30 * DAY, createdAt: NOW },
    ]);
    const sessionCookie = findSetCookie(res, "__Host-session") ?? "";
    expect(sessionCookie).toContain(`Max-Age=${30 * DAY}`);
    expect(sessionCookie).toContain("Path=/");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("SameSite=Lax");
    // 短命の Cookie は 1 回で消す
    expect(findSetCookie(res, "__Host-discord_oauth")).toContain("Max-Age=0");

    expect((await me(sessionToken)).body).toEqual({ loginAvailable: true, loggedIn: true });
  });

  it("2 回目のログインは同じユーザーになり、前とは別のセッショントークンを発行して前のセッションを消す", async () => {
    const first = await login();
    const second = await login({ extraCookie: `__Host-session=${first.sessionToken}` });

    expect(second.sessionToken).toBeDefined();
    expect(second.sessionToken).not.toBe(first.sessionToken);
    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(userIdentities)).toHaveLength(1);
    expect(await db.select({ idHash: sessions.idHash }).from(sessions)).toEqual([
      { idHash: sha256Hex(second.sessionToken ?? "") },
    ]);
    expect((await me(first.sessionToken)).body).toEqual({ loginAvailable: true, loggedIn: false });
    expect((await me(second.sessionToken)).body).toEqual({ loginAvailable: true, loggedIn: true });
  });

  it("別の Discord アカウントでログインすると、別のユーザーになる", async () => {
    await login();
    discordUserId = "175928847299117063";
    await login();

    const identities = await db.select().from(userIdentities);
    expect(await db.select().from(users)).toHaveLength(2);
    expect(identities).toHaveLength(2);
    expect(identities[0].userId).not.toBe(identities[1].userId);
  });

  it("HMAC の鍵を変えると、同じ Discord アカウントでも別のユーザーになる（鍵を失って作り直したとき）", async () => {
    await login();
    idHmacKey = "another-id-hmac-key";
    await login();

    const identities = await db.select().from(userIdentities);
    expect(await db.select().from(users)).toHaveLength(2);
    expect(identities.map((identity) => identity.providerUserId)).toEqual([
      hmacHex(ID_HMAC_KEY, discordUserId),
      hmacHex("another-id-hmac-key", discordUserId),
    ]);
    expect(identities[0].userId).not.toBe(identities[1].userId);
  });

  it("短命の Cookie が無ければ、Discord に問い合わせずにトップへ戻し、ログインしない", async () => {
    const { stored } = await startLogin("/en/");
    const res = await request(`/api/auth/discord/callback?code=test-code&state=${stored.state}`);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
    expect(discordFetch).not.toHaveBeenCalled();
    expect(findSetCookie(res, "__Host-session")).toBeUndefined();
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it("state が短命の Cookie と一致しなければ、Discord に問い合わせずに戻るパスへ戻し、ログインしない", async () => {
    const { cookie } = await startLogin("/en/");
    const mismatched = await request("/api/auth/discord/callback?code=test-code&state=wrong-state", {
      headers: { Cookie: cookie },
    });

    expect(mismatched.status).toBe(302);
    expect(mismatched.headers.get("Location")).toBe("/en/");
    expect(findSetCookie(mismatched, "__Host-discord_oauth")).toContain("Max-Age=0");
    expect(findSetCookie(mismatched, "__Host-session")).toBeUndefined();
    expect(discordFetch).not.toHaveBeenCalled();
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it("Discord で拒否されたとき（code が無く error が付くコールバック）は、ログインせずに戻るパスへ戻す", async () => {
    const { cookie, stored } = await startLogin("/en/");
    const res = await request(
      `/api/auth/discord/callback?error=access_denied&error_description=denied&state=${stored.state}`,
      { headers: { Cookie: cookie } },
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/en/");
    expect(findSetCookie(res, "__Host-session")).toBeUndefined();
    expect(discordFetch).not.toHaveBeenCalled();
  });

  it("Discord のトークンのエンドポイントが 200 以外を返したら 500 にし、ユーザーもセッションも作らない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    discordFetch.mockImplementation(async () => Response.json({ error: "invalid_grant" }, { status: 400 }));
    const { res } = await login();

    expect(res.status).toBe(500);
    expect(await db.select().from(users)).toEqual([]);
    expect(await db.select().from(sessions)).toEqual([]);
  });

  it("ID があるのに secret が無ければ、Discord に問い合わせずに 500 にする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { cookie, stored } = await startLogin();
    clientSecret = undefined;
    const res = await request(`/api/auth/discord/callback?code=test-code&state=${stored.state}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(500);
    expect(discordFetch).not.toHaveBeenCalled();
  });

  it("ID があるのに HMAC の鍵が無ければ、Discord に問い合わせずに 500 にし、ユーザーを作らない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { cookie, stored } = await startLogin();
    idHmacKey = undefined;
    const res = await request(`/api/auth/discord/callback?code=test-code&state=${stored.state}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(500);
    expect(discordFetch).not.toHaveBeenCalled();
    expect(await db.select().from(users)).toEqual([]);
  });
});

describe("GET /api/me: ログイン中か", () => {
  it("セッションの Cookie が無ければ、ログインできるがログインしていないと返す", async () => {
    const { res, body } = await me();

    expect(res.status).toBe(200);
    expect(body).toEqual({ loginAvailable: true, loggedIn: false });
  });

  it.each([
    ["有効期限の 1 秒前", { expiresAt: NOW + 1, createdAt: NOW - 30 * DAY + 1 }, true],
    ["有効期限ちょうど", { expiresAt: NOW, createdAt: NOW - 30 * DAY }, false],
    ["有効期限切れ", { expiresAt: NOW - DAY, createdAt: NOW - 31 * DAY }, false],
    ["絶対期限の 1 秒前", { expiresAt: NOW + 20 * DAY, createdAt: NOW - 365 * DAY + 1 }, true],
    ["絶対期限ちょうど（有効期限の内）", { expiresAt: NOW + 20 * DAY, createdAt: NOW - 365 * DAY }, false],
  ])("%s のセッションでは loggedIn が %s", async (_label, row, loggedIn) => {
    const token = await insertSession(row);
    const { res, body } = await me(token);

    expect(body).toEqual({ loginAvailable: true, loggedIn });
    if (!loggedIn) {
      // 期限切れの行は読んだときに消し、Cookie も消す
      expect(await db.select().from(sessions)).toEqual([]);
      expect(findSetCookie(res, "__Host-session")).toContain("Max-Age=0");
    }
  });
});

describe("セッションの延長", () => {
  it("残りが 15 日以上なら、DB に書かず、Cookie も付け直さない", async () => {
    const token = await insertSession({ expiresAt: NOW + 15 * DAY, createdAt: NOW - 15 * DAY });
    const update = vi.spyOn(db, "update");
    const { res, body } = await me(token);

    expect(body).toEqual({ loginAvailable: true, loggedIn: true });
    expect(update).not.toHaveBeenCalled();
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(await db.select({ expiresAt: sessions.expiresAt }).from(sessions)).toEqual([{ expiresAt: NOW + 15 * DAY }]);
  });

  it("残りが 15 日を切ると、期限を今から 30 日に延ばし、Cookie も付け直す", async () => {
    const token = await insertSession({ expiresAt: NOW + 15 * DAY - 1, createdAt: NOW - 15 * DAY - 1 });
    const { res, body } = await me(token);

    expect(body).toEqual({ loginAvailable: true, loggedIn: true });
    expect(await db.select({ expiresAt: sessions.expiresAt }).from(sessions)).toEqual([{ expiresAt: NOW + 30 * DAY }]);
    const sessionCookie = findSetCookie(res, "__Host-session") ?? "";
    expect(sessionCookie).toContain(`__Host-session=${token}`);
    expect(sessionCookie).toContain(`Max-Age=${30 * DAY}`);
  });

  it("絶対期限の手前では、延長が作成から 1 年で頭打ちになる", async () => {
    const createdAt = NOW - 360 * DAY;
    const token = await insertSession({ expiresAt: NOW + DAY, createdAt });
    const { res } = await me(token);

    expect(await db.select({ expiresAt: sessions.expiresAt }).from(sessions)).toEqual([
      { expiresAt: createdAt + 365 * DAY },
    ]);
    expect(findSetCookie(res, "__Host-session")).toContain(`Max-Age=${5 * DAY}`);
  });

  it("絶対期限で頭打ちになったあとは、残りが 15 日を切っていても DB に書かない", async () => {
    const createdAt = NOW - 360 * DAY;
    const token = await insertSession({ expiresAt: createdAt + 365 * DAY, createdAt });
    const update = vi.spyOn(db, "update");
    const { res, body } = await me(token);

    expect(body).toEqual({ loginAvailable: true, loggedIn: true });
    expect(update).not.toHaveBeenCalled();
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});

describe("POST /api/auth/logout: ログアウト", () => {
  function logout(headers: Record<string, string>) {
    return request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
      body: "{}",
    });
  }

  it("セッションの行と Cookie を消し、以後そのトークンでは /api/me がログイン中と返さない", async () => {
    const { sessionToken } = await login();
    const res = await logout({ Cookie: `__Host-session=${sessionToken}` });

    expect(res.status).toBe(204);
    expect(await db.select().from(sessions)).toEqual([]);
    expect(findSetCookie(res, "__Host-session")).toContain("Max-Age=0");
    expect((await me(sessionToken)).body).toEqual({ loginAvailable: true, loggedIn: false });
  });

  it("セッションの Cookie が無くても 204 を返す", async () => {
    const res = await logout({});

    expect(res.status).toBe(204);
  });

  it("別オリジンからのフォームの送信は 403 で、セッションを消さない", async () => {
    const { sessionToken } = await login();
    const form = { Cookie: `__Host-session=${sessionToken}`, "Content-Type": "application/x-www-form-urlencoded" };
    const crossOrigin = await logout({ ...form, Origin: "https://evil.example" });
    // Origin だけを同じオリジンに戻すと、CSRF の検査は通り、JSON でないので 415 になる
    const sameOrigin = await logout(form);

    expect(crossOrigin.status).toBe(403);
    expect(sameOrigin.status).toBe(415);
    expect(await db.select().from(sessions)).toHaveLength(1);
  });
});
