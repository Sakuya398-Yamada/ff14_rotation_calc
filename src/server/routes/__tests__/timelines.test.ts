import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { z } from "zod";
import type { PersistedAppState } from "../../../client/logic/timeline-storage";
import { timelines } from "../../db/schema";
import { createMyTimelinesRoute, createTimelinesRoute, selectMyTimelines } from "../timelines";
import type { persistedAppStateSchema } from "../timelines-schema";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../../migrations", import.meta.url));
const URL_BASE = "http://localhost/api/timelines";
const TOKEN_RE = /__Host-owner=([A-Za-z0-9_-]{43})/;
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare 公式のテスト用キー（https://developers.cloudflare.com/turnstile/troubleshooting/testing/）
const TURNSTILE_PASS_SECRET = "1x0000000000000000000000000000000AA";
const TURNSTILE_FAIL_SECRET = "2x0000000000000000000000000000000AA";
// テスト用の sitekey のウィジェットが返すダミートークン
const TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

// src/server/db/__tests__/timelines.test.ts と同じく、本番の D1 と同じマイグレーションを当てた better-sqlite3 の DB を使う（#574）
function createTestDb() {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validData(overrides: Partial<PersistedAppState> = {}): PersistedAppState {
  return {
    version: 1,
    selectedJob: "blm",
    level: 100,
    entries: [
      { uid: "entry-1", skillId: "fire-3" },
      { uid: "entry-2", skillId: "fire-4", manualStartTime: 2.5 },
      { uid: "entry-3", skillId: "fire", procOccurred: false },
    ],
    stats: { critical: 3000, directHit: 2000, determination: 2500, speed: 528 },
    untargetableWindows: [{ startTime: 30, endTime: 45 }],
    multiTargetWindows: [{ startTime: 0, endTime: 20, targetCount: 3 }],
    ...overrides,
  };
}

// siteverify の代わり。送られた secret ごとに、公式のテスト用キーと同じ結果を返す
async function fakeSiteverify(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const secret = new URLSearchParams(init?.body as URLSearchParams).get("secret");
  const result =
    secret === TURNSTILE_PASS_SECRET
      ? { success: true, "error-codes": [] }
      : secret === TURNSTILE_FAIL_SECRET
        ? { success: false, "error-codes": ["invalid-input-response"] }
        : { success: false, "error-codes": ["invalid-input-secret"] };
  return Response.json(result);
}

let db: ReturnType<typeof createTestDb>;
let limit: ReturnType<typeof vi.fn<(options: { key: string }) => Promise<{ success: boolean }>>>;
let siteverify: ReturnType<typeof vi.fn<typeof fetch>>;
let turnstileSecret: string | undefined;
let app: Hono;

// headers の値を undefined にすると、そのヘッダを送らない
function post(body: unknown, headers: Record<string, string | undefined> = {}) {
  const requestHeaders = new Headers({
    "Content-Type": "application/json",
    Origin: "http://localhost",
    "X-Turnstile-Token": TURNSTILE_TOKEN,
  });
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) requestHeaders.delete(name);
    else requestHeaders.set(name, value);
  }
  return app.request(
    URL_BASE,
    { method: "POST", headers: requestHeaders, body: typeof body === "string" ? body : JSON.stringify(body) },
    { DB: undefined, TIMELINE_RATE_LIMITER: { limit }, TURNSTILE_SECRET_KEY: turnstileSecret },
  );
}

async function rows() {
  return db.select().from(timelines);
}

beforeEach(() => {
  db = createTestDb();
  limit = vi.fn(async () => ({ success: true }));
  // app.request はグローバルの fetch を使わないので、差し替わるのは siteverify の呼び出しだけ
  siteverify = vi.fn(fakeSiteverify);
  vi.stubGlobal("fetch", siteverify);
  turnstileSecret = TURNSTILE_PASS_SECRET;
  app = new Hono()
    .route("/api/timelines", createTimelinesRoute(() => db))
    .route("/api/me/timelines", createMyTimelinesRoute(() => db));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/timelines: 保存", () => {
  it("201 と id を返し、job・level・schema_ver・owner_hash の入った行を作る", async () => {
    const data = validData();
    const res = await post({ data, title: "零式4層 2分" });

    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/);
    const [row] = await db.select().from(timelines).where(eq(timelines.id, id));
    expect(row).toMatchObject({ job: "blm", level: 100, schemaVer: 1, title: "零式4層 2分", parentId: null });
    expect(row.ownerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(row.data)).toEqual(data);
  });

  it("着弾までの遅れ（hitDelays）も保存する (#901)", async () => {
    const data = validData({ hitDelays: { "fire-4": 0.6, fire: 0 } });
    const res = await post({ data });

    expect(res.status).toBe(201);
    const [row] = await rows();
    expect(JSON.parse(row.data)).toEqual(data);
  });

  it("歌の判定ごとの発生の指定（autoGenerateProcOccurred）も保存する (#900)", async () => {
    const data = validData({
      selectedJob: "brd",
      entries: [
        { uid: "entry-1", skillId: "wanderers-minuet", autoGenerateProcOccurred: [true, null, false] },
        { uid: "entry-2", skillId: "burst-shot" },
      ],
    });
    const res = await post({ data });

    expect(res.status).toBe(201);
    const [row] = await rows();
    expect(JSON.parse(row.data)).toEqual(data);
  });

  it("data の余分なキーは落として保存する", async () => {
    const data = { ...validData(), extra: "x", entries: [{ uid: "entry-1", skillId: "fire-3", note: "x" }] };
    const res = await post({ data });

    expect(res.status).toBe(201);
    const [row] = await rows();
    expect(JSON.parse(row.data)).toEqual(validData({ entries: [{ uid: "entry-1", skillId: "fire-3" }] }));
  });

  it("存在する parentId を受け取ると parent_id に書く", async () => {
    const parent = (await (await post({ data: validData() })).json()) as { id: string };
    const res = await post({ data: validData(), parentId: parent.id });

    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const [row] = await db.select().from(timelines).where(eq(timelines.id, id));
    expect(row.parentId).toBe(parent.id);
  });

  it("マスタにある contentId を content_id に書き、省略すると NULL にする", async () => {
    await post({ data: validData(), contentId: "m4s" });
    await post({ data: validData() });

    const contentIds = (await rows()).map((r) => r.contentId);
    expect(contentIds).toHaveLength(2);
    expect(contentIds).toEqual(expect.arrayContaining(["m4s", null]));
  });

  it("title 100 文字・エントリ 2000 件は上限内として保存する", async () => {
    const entries = Array.from({ length: 2000 }, (_, i) => ({ uid: `entry-${i + 1}`, skillId: "fire" }));
    const res = await post({ data: validData({ entries }), title: "あ".repeat(100) });

    expect(res.status).toBe(201);
  });

  it("空文字の title は NULL として保存する", async () => {
    const res = await post({ data: validData(), title: "" });

    expect(res.status).toBe(201);
    const [row] = await rows();
    expect(row.title).toBeNull();
  });

  it("Content-Type に charset が付いていても受け付ける", async () => {
    const res = await post({ data: validData() }, { "Content-Type": "application/json; charset=utf-8" });

    expect(res.status).toBe(201);
  });
});

describe("POST /api/timelines: 匿名トークン", () => {
  it("Cookie が無ければ __Host-owner を発行し、DB にはトークンではなくハッシュを書く", async () => {
    const res = await post({ data: validData() });

    const setCookie = res.headers.get("Set-Cookie") ?? "";
    const token = TOKEN_RE.exec(setCookie)?.[1];
    expect(token).toBeDefined();
    expect(setCookie).toContain("Max-Age=34560000");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    const [row] = await rows();
    expect(row.ownerHash).toBe(sha256Hex(token!));
    expect(row.ownerHash).not.toBe(token);
  });

  it("有効な Cookie があれば同じトークンで期限を延ばし、同じ owner_hash で保存する", async () => {
    const token = "A".repeat(43);
    const res = await post({ data: validData() }, { Cookie: `__Host-owner=${token}` });

    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(TOKEN_RE.exec(setCookie)?.[1]).toBe(token);
    expect(setCookie).toContain("Max-Age=34560000");
    const [row] = await rows();
    expect(row.ownerHash).toBe(sha256Hex(token));
  });

  it.each(["short", `${"A".repeat(42)}!`, "A".repeat(44)])("形の不正な Cookie（%s）は新しいトークンに置き換える", async (bad) => {
    const res = await post({ data: validData() }, { Cookie: `__Host-owner=${bad}` });

    const token = TOKEN_RE.exec(res.headers.get("Set-Cookie") ?? "")?.[1];
    expect(token).toBeDefined();
    expect(token).not.toBe(bad);
    const [row] = await rows();
    expect(row.ownerHash).toBe(sha256Hex(token!));
  });
});

describe("POST /api/timelines: 不正な入力", () => {
  const entries2001 = Array.from({ length: 2001 }, (_, i) => ({ uid: `entry-${i + 1}`, skillId: "fire" }));

  it.each<[string, unknown]>([
    ["版が違う", { data: { ...validData(), version: 2 } }],
    ["ジョブが prototype のキー", { data: { ...validData(), selectedJob: "constructor" } }],
    ["ジョブが大文字", { data: { ...validData(), selectedJob: "BLM" } }],
    ["レベルが 70/80/90/100 以外", { data: { ...validData(), level: 85 } }],
    ["存在しないスキル ID", { data: validData({ entries: [{ uid: "entry-1", skillId: "no-such-skill" }] }) }],
    ["別のジョブのスキル ID", { data: validData({ entries: [{ uid: "entry-1", skillId: "stone" }] }) }],
    [
      "エントリの uid が重複",
      {
        data: validData({
          entries: [
            { uid: "entry-1", skillId: "fire-3" },
            { uid: "entry-1", skillId: "fire-4", manualStartTime: 2.5 },
          ],
        }),
      },
    ],
    ["エントリが 2001 件", { data: validData({ entries: entries2001 }) }],
    [
      "エントリの procOccurred が boolean でない",
      { data: { ...validData(), entries: [{ uid: "entry-1", skillId: "fire", procOccurred: "true" }] } },
    ],
    [
      "エントリの autoGenerateProcOccurred の要素が boolean・null でない",
      { data: { ...validData(), entries: [{ uid: "entry-1", skillId: "fire", autoGenerateProcOccurred: [true, "false"] }] } },
    ],
    [
      "エントリの autoGenerateProcOccurred が 15 件",
      {
        data: validData({
          entries: [{ uid: "entry-1", skillId: "fire", autoGenerateProcOccurred: Array.from({ length: 15 }, () => true) }],
        }),
      },
    ],
    ["hitDelays に存在しないスキル ID", { data: validData({ hitDelays: { "no-such-skill": 0.5 } }) }],
    ["hitDelays に別のジョブのスキル ID", { data: validData({ hitDelays: { stone: 0.5 } }) }],
    ["hitDelays のキーが prototype のキー", { data: validData({ hitDelays: { constructor: 0.5 } }) }],
    ["hitDelays の値が負", { data: validData({ hitDelays: { fire: -0.1 } }) }],
    ["hitDelays の値が文字列", { data: { ...validData(), hitDelays: { fire: "0.5" } } }],
    ["stats が文字列", { data: { ...validData(), stats: { ...validData().stats, critical: "3000" } } }],
    ["ウィンドウの endTime が無い", { data: { ...validData(), untargetableWindows: [{ startTime: 1 }] } }],
    ["targetCount が 1", { data: validData({ multiTargetWindows: [{ startTime: 0, endTime: 1, targetCount: 1 }] }) }],
    ["title が 101 文字", { data: validData(), title: "あ".repeat(101) }],
    ["parentId の形が不正", { data: validData(), parentId: "../etc" }],
    ["parentId の行が無い", { data: validData(), parentId: "V1StGXR8_Z5jdHi6B-myT" }],
    ["contentId がマスタに無い", { data: validData(), contentId: "m13s" }],
    ["contentId が大文字", { data: validData(), contentId: "M4S" }],
    ["contentId が prototype のキー", { data: validData(), contentId: "constructor" }],
    ["contentId が空文字", { data: validData(), contentId: "" }],
    ["contentId が数値", { data: validData(), contentId: 4 }],
    ["data が無い", { title: "x" }],
  ])("%s → 400 で保存しない", async (_, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("stats が JSON で Infinity になる値（1e999）→ 400", async () => {
    const raw = JSON.stringify({ data: validData() }).replace('"critical":3000', '"critical":1e999');
    const res = await post(raw);

    expect(res.status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("JSON として読めない本文 → 400", async () => {
    const res = await post("{");

    expect(res.status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("本文が 256KiB を超える → 413 で保存しない", async () => {
    const entries = Array.from({ length: 2000 }, (_, i) => ({ uid: `entry-${i + 1}-${"x".repeat(200)}`, skillId: "fire" }));
    const res = await post({ data: validData({ entries }) });

    expect(res.status).toBe(413);
    expect(await rows()).toHaveLength(0);
  });
});

describe("POST /api/timelines: CSRF と Content-Type", () => {
  it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"])(
    "別オリジンからの %s の POST → 403 で、Cookie も発行しない",
    async (contentType) => {
      const res = await post({ data: validData() }, { "Content-Type": contentType, Origin: "https://evil.example" });

      expect(res.status).toBe(403);
      expect(res.headers.get("Set-Cookie")).toBeNull();
      expect(await rows()).toHaveLength(0);
    },
  );

  it("同じオリジンでも JSON 以外の POST → 415 で保存しない", async () => {
    const res = await post({ data: validData() }, { "Content-Type": "text/plain" });

    expect(res.status).toBe(415);
    expect(await rows()).toHaveLength(0);
  });

  it("別オリジンのプリフライトに Access-Control-Allow-Origin を返さない（JSON の別オリジン POST はブラウザが送らない）", async () => {
    const res = await app.request(
      URL_BASE,
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      },
      { DB: undefined, TIMELINE_RATE_LIMITER: { limit } },
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("POST /api/timelines: レート制限", () => {
  it("制限を超えたら 429 で保存せず、owner_hash をキーに数える", async () => {
    limit.mockResolvedValue({ success: false });
    const token = "B".repeat(43);
    const res = await post({ data: validData() }, { Cookie: `__Host-owner=${token}` });

    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: sha256Hex(token) });
    expect(await rows()).toHaveLength(0);
  });

  it("制限を超えていれば、本文が不正でも検証より先に 429 を返す", async () => {
    limit.mockResolvedValue({ success: false });
    const res = await post({ data: { version: 2 } });

    expect(res.status).toBe(429);
  });

  it("制限を超えていれば、siteverify を呼ばずに 429 を返す", async () => {
    limit.mockResolvedValue({ success: false });
    const res = await post({ data: validData() });

    expect(res.status).toBe(429);
    expect(siteverify).not.toHaveBeenCalled();
  });
});

describe("POST /api/timelines: Turnstile", () => {
  it("成功用のテスト用 secret なら 201 で、siteverify に secret・トークン・接続元 IP を送る", async () => {
    const res = await post({ data: validData() }, { "CF-Connecting-IP": "203.0.113.7" });

    expect(res.status).toBe(201);
    expect(siteverify).toHaveBeenCalledTimes(1);
    const [url, init] = siteverify.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init?.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(init?.body as URLSearchParams))).toEqual({
      secret: TURNSTILE_PASS_SECRET,
      response: TURNSTILE_TOKEN,
      remoteip: "203.0.113.7",
    });
  });

  it("失敗用のテスト用 secret なら 403 で保存しない", async () => {
    turnstileSecret = TURNSTILE_FAIL_SECRET;
    const res = await post({ data: validData() });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "turnstile_failed" });
    expect(await rows()).toHaveLength(0);
  });

  it.each([
    ["無い", undefined],
    ["空", ""],
    ["2049 文字", "x".repeat(2049)],
  ])("トークンのヘッダが%sなら、siteverify を呼ばずに 403", async (_label, token) => {
    const res = await post({ data: validData() }, { "X-Turnstile-Token": token });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "turnstile_failed" });
    expect(siteverify).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(0);
  });

  it("検証に落ちれば、本文が不正でも 400 より先に 403 を返す", async () => {
    turnstileSecret = TURNSTILE_FAIL_SECRET;
    const res = await post({ data: { version: 2 } });

    expect(res.status).toBe(403);
  });

  it("secret が設定されていなければ、siteverify を呼ばずに 500 で保存しない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    turnstileSecret = undefined;
    const res = await post({ data: validData() });

    expect(res.status).toBe(500);
    expect(siteverify).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(0);
  });

  it.each([
    ["通信に失敗した", () => Promise.reject(new TypeError("fetch failed"))],
    ["200 以外を返した", async () => Response.json({ success: false, "error-codes": ["internal-error"] }, { status: 500 })],
  ])("siteverify が%sら 500 で保存しない", async (_label, response) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    siteverify.mockImplementation(response);
    const res = await post({ data: validData() });

    expect(res.status).toBe(500);
    expect(await rows()).toHaveLength(0);
  });
});

describe("GET /api/timelines/:id: 読み込み", () => {
  const SAVED_ID = "V1StGXR8_Z5jdHi6B-myT";
  const OWNER_HASH = sha256Hex("owner-token");

  function get(id: string) {
    return app.request(`${URL_BASE}/${id}`, {}, { DB: undefined, TIMELINE_RATE_LIMITER: { limit } });
  }

  async function insertRow(overrides: Partial<typeof timelines.$inferInsert> = {}) {
    await db.insert(timelines).values({
      id: SAVED_ID,
      schemaVer: 1,
      data: JSON.stringify(validData()),
      job: "blm",
      level: 100,
      ownerHash: OWNER_HASH,
      createdAt: 1700000000,
      ...overrides,
    });
  }

  it("保存した行を、data はオブジェクト・createdAt は ISO 文字列にして返し、owner_hash は返さない", async () => {
    await insertRow({ title: "零式4層 2分", contentId: "m4s" });
    const res = await get(SAVED_ID);

    expect(res.status).toBe(200);
    const text = await res.text();
    // toEqual は余分なキー（ownerHash・job・level）があると失敗する
    expect(JSON.parse(text)).toEqual({
      id: SAVED_ID,
      parentId: null,
      schemaVer: 1,
      data: validData(),
      title: "零式4層 2分",
      contentId: "m4s",
      createdAt: "2023-11-14T22:13:20.000Z",
    });
    expect(text).not.toContain(OWNER_HASH);
  });

  it("POST で複製として保存した行を、parentId 付きで読み込める", async () => {
    await insertRow();
    const data = validData({ level: 90, entries: [{ uid: "entry-1", skillId: "fire" }] });
    const { id } = (await (await post({ data, parentId: SAVED_ID })).json()) as { id: string };
    const res = await get(id);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, parentId: SAVED_ID, schemaVer: 1, data, title: null, contentId: null });
  });

  it("存在しない id → 404", async () => {
    const res = await get(SAVED_ID);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("削除した行 → 410 で、中身は返さない", async () => {
    await insertRow({ title: "零式4層 2分", deletedAt: 1700000100 });
    const res = await get(SAVED_ID);

    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "deleted" });
  });

  it("削除した行を複製元にした行は、そのまま読み込める", async () => {
    const childId = "child_StGXR8_Z5jdHi6B";
    await insertRow({ deletedAt: 1700000100 });
    await insertRow({ id: childId, parentId: SAVED_ID, ownerHash: sha256Hex("other-token") });
    const res = await get(childId);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: childId, parentId: SAVED_ID });
  });

  it("削除した行を parentId にしても保存できる（開いているタブが削除した ID を複製元に持ったまま保存することがある）", async () => {
    await insertRow({ deletedAt: 1700000100 });
    const res = await post({ data: validData(), parentId: SAVED_ID });

    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(await (await get(id)).json()).toMatchObject({ id, parentId: SAVED_ID });
  });

  it.each([
    ["20 文字", "A".repeat(20)],
    ["22 文字", "A".repeat(22)],
    ["記号入り", `${"A".repeat(20)}!`],
  ])("形式が不正な id（%s）→ DB に問い合わせずに 404", async (_label, id) => {
    const select = vi.spyOn(db, "select");
    const res = await get(id);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(select).not.toHaveBeenCalled();
  });

  it("schema_ver が今の版と違う行もそのまま返す（読み込めるかはクライアントが判定する）", async () => {
    await insertRow({ schemaVer: 2, data: JSON.stringify({ version: 2 }) });
    const res = await get(SAVED_ID);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ schemaVer: 2, data: { version: 2 } });
  });

  it("匿名トークンの Cookie を付けず、レート制限も数えない", async () => {
    await insertRow();
    const res = await get(SAVED_ID);

    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(limit).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/timelines/:id: 削除", () => {
  const SAVED_ID = "V1StGXR8_Z5jdHi6B-myT";
  const TOKEN = "A".repeat(43);
  const OTHER_TOKEN = "B".repeat(43);

  // headers の値を undefined にすると、そのヘッダを送らない
  function del(id: string, headers: Record<string, string | undefined> = {}) {
    const requestHeaders = new Headers({ Origin: "http://localhost", Cookie: `__Host-owner=${TOKEN}` });
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) requestHeaders.delete(name);
      else requestHeaders.set(name, value);
    }
    return app.request(
      `${URL_BASE}/${id}`,
      { method: "DELETE", headers: requestHeaders },
      { DB: undefined, TIMELINE_RATE_LIMITER: { limit } },
    );
  }

  async function insertRow(overrides: Partial<typeof timelines.$inferInsert> = {}) {
    await db.insert(timelines).values({
      id: SAVED_ID,
      schemaVer: 1,
      data: JSON.stringify(validData()),
      job: "blm",
      level: 100,
      ownerHash: sha256Hex(TOKEN),
      createdAt: 1700000000,
      ...overrides,
    });
  }

  async function deletedAtOf(id: string) {
    const [row] = await db.select({ deletedAt: timelines.deletedAt }).from(timelines).where(eq(timelines.id, id));
    return row?.deletedAt;
  }

  it("持ち主のトークンなら 204 で、行を残して削除の印（時刻）を付ける", async () => {
    await insertRow();
    const before = Math.floor(Date.now() / 1000);
    const res = await del(SAVED_ID);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await rows()).toHaveLength(1);
    expect(await deletedAtOf(SAVED_ID)).toBeGreaterThanOrEqual(before);
  });

  it("持ち主の有効な Cookie は、同じトークンで期限を延ばす", async () => {
    await insertRow();
    const res = await del(SAVED_ID);

    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(TOKEN_RE.exec(setCookie)?.[1]).toBe(TOKEN);
    expect(setCookie).toContain("Max-Age=34560000");
  });

  it("ほかの人のトークン → 404 で、削除の印を付けない", async () => {
    await insertRow();
    const res = await del(SAVED_ID, { Cookie: `__Host-owner=${OTHER_TOKEN}` });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(await deletedAtOf(SAVED_ID)).toBeNull();
  });

  it.each([
    ["無い", undefined],
    ["不正な形の", "__Host-owner=short"],
  ])("Cookie が%sとき → DB に問い合わせずに 404 で、Cookie を発行せず、レート制限も数えない", async (_label, cookie) => {
    await insertRow();
    const update = vi.spyOn(db, "update");
    const res = await del(SAVED_ID, { Cookie: cookie });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
    expect(await deletedAtOf(SAVED_ID)).toBeNull();
  });

  it("存在しない id → 404", async () => {
    const res = await del(SAVED_ID);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("削除済みの行をもう一度削除 → 404 で、削除の時刻は変えない", async () => {
    await insertRow({ deletedAt: 1700000100 });
    const res = await del(SAVED_ID);

    expect(res.status).toBe(404);
    expect(await deletedAtOf(SAVED_ID)).toBe(1700000100);
  });

  it("形式が不正な id → DB に問い合わせずに 404", async () => {
    const update = vi.spyOn(db, "update");
    const res = await del(`${"A".repeat(20)}!`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(update).not.toHaveBeenCalled();
  });

  it("削除した行の複製（parent_id で参照する、ほかの人の行）は変えない", async () => {
    const childId = "child_StGXR8_Z5jdHi6B";
    await insertRow();
    await insertRow({ id: childId, parentId: SAVED_ID, ownerHash: sha256Hex(OTHER_TOKEN) });
    const res = await del(SAVED_ID);

    expect(res.status).toBe(204);
    const [child] = await db.select().from(timelines).where(eq(timelines.id, childId));
    expect(child).toMatchObject({ parentId: SAVED_ID, deletedAt: null });
  });

  it("削除すると一覧に出ず、共有 URL の読み込みは 410 になる", async () => {
    await insertRow();
    await del(SAVED_ID);

    const mine = await app.request("http://localhost/api/me/timelines", { headers: { Cookie: `__Host-owner=${TOKEN}` } }, {
      DB: undefined,
      TIMELINE_RATE_LIMITER: { limit },
    });
    expect(await mine.json()).toEqual({ items: [], nextCursor: null });
    const shared = await app.request(`${URL_BASE}/${SAVED_ID}`, {}, { DB: undefined, TIMELINE_RATE_LIMITER: { limit } });
    expect(shared.status).toBe(410);
  });

  it("別オリジンからの削除 → 403 で削除の印を付けず、同じ要求でもオリジンが同じなら削除する", async () => {
    await insertRow();
    const crossOrigin = await del(SAVED_ID, { Origin: "https://evil.example" });

    expect(crossOrigin.status).toBe(403);
    expect(await deletedAtOf(SAVED_ID)).toBeNull();
    expect((await del(SAVED_ID, { Origin: "http://localhost" })).status).toBe(204);
  });

  it("別オリジンのプリフライトに Access-Control-Allow-Origin を返さない（別オリジンの DELETE はブラウザが送らない）", async () => {
    const res = await app.request(
      `${URL_BASE}/${SAVED_ID}`,
      { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "DELETE" } },
      { DB: undefined, TIMELINE_RATE_LIMITER: { limit } },
    );

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("制限を超えたら 429 で削除せず、保存と同じく owner_hash をキーに数える", async () => {
    await insertRow();
    limit.mockResolvedValue({ success: false });
    const res = await del(SAVED_ID);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect(limit).toHaveBeenCalledWith({ key: sha256Hex(TOKEN) });
    expect(await deletedAtOf(SAVED_ID)).toBeNull();
  });

  it("制限を超えていれば、形式が不正な id でも 429 を返す（不正な要求の連投も数える）", async () => {
    limit.mockResolvedValue({ success: false });
    const res = await del(`${"A".repeat(20)}!`);

    expect(res.status).toBe(429);
  });

  it("Turnstile は確かめない（siteverify を呼ばない）", async () => {
    await insertRow();
    const res = await del(SAVED_ID);

    expect(res.status).toBe(204);
    expect(siteverify).not.toHaveBeenCalled();
  });
});

describe("GET /api/me/timelines: 自分のタイムラインの一覧", () => {
  const TOKEN = "A".repeat(43);
  const OTHER_TOKEN = "B".repeat(43);
  const ME_URL = "http://localhost/api/me/timelines";

  function getMine(query = "", headers: Record<string, string> = { Cookie: `__Host-owner=${TOKEN}` }) {
    return app.request(`${ME_URL}${query}`, { headers }, { DB: undefined, TIMELINE_RATE_LIMITER: { limit } });
  }

  // nanoid と同じ 21 文字。n の大小が id の大小と一致するよう 0 で埋める
  function idOf(n: number): string {
    return `id${String(n).padStart(19, "0")}`;
  }

  async function insertRow(n: number, createdAt: number, overrides: Partial<typeof timelines.$inferInsert> = {}) {
    await db.insert(timelines).values({
      id: idOf(n),
      schemaVer: 1,
      data: JSON.stringify(validData()),
      job: "blm",
      level: 100,
      ownerHash: sha256Hex(TOKEN),
      createdAt,
      ...overrides,
    });
  }

  async function ids(res: Response): Promise<string[]> {
    return ((await res.json()) as { items: { id: string }[] }).items.map((item) => item.id);
  }

  function queryPlan(query: { toSQL(): { sql: string; params: unknown[] } }): string[] {
    const { sql, params } = query.toSQL();
    return (db.$client.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((r) => r.detail);
  }

  it("Cookie の持ち主の行だけを新しい順に返し、同じ秒の行は id の降順に並べる", async () => {
    await insertRow(1, 100);
    // 同じ秒の 2 行は、id の大きい方を先に入れる（挿入順＝rowid 順と、id 順が逆になるように）
    await insertRow(4, 300);
    await insertRow(3, 200);
    await insertRow(2, 300);
    await insertRow(5, 400, { ownerHash: sha256Hex(OTHER_TOKEN) });

    expect(await ids(await getMine())).toEqual([idOf(4), idOf(2), idOf(3), idOf(1)]);
    expect(await ids(await getMine("", { Cookie: `__Host-owner=${OTHER_TOKEN}` }))).toEqual([idOf(5)]);
  });

  it("id・title・job・level・contentId・createdAt（ISO 文字列）だけを返し、data と owner_hash は返さない", async () => {
    await insertRow(1, 1700000000, { title: "零式4層 2分", contentId: "m4s", job: "drg", level: 90 });
    const res = await getMine();

    expect(res.status).toBe(200);
    const text = await res.text();
    // toEqual は余分なキー（data・ownerHash・parentId・schemaVer）があると失敗する
    expect(JSON.parse(text)).toEqual({
      items: [
        { id: idOf(1), title: "零式4層 2分", job: "drg", level: 90, contentId: "m4s", createdAt: "2023-11-14T22:13:20.000Z" },
      ],
      nextCursor: null,
    });
    expect(text).not.toContain(sha256Hex(TOKEN));
  });

  it("有効な Cookie は同じトークンで期限を延ばし、レート制限は数えない", async () => {
    const res = await getMine();

    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(TOKEN_RE.exec(setCookie)?.[1]).toBe(TOKEN);
    expect(setCookie).toContain("Max-Age=34560000");
    expect(limit).not.toHaveBeenCalled();
  });

  it.each([
    ["無い", {}],
    ["不正な形の", { Cookie: "__Host-owner=short" }],
  ])("Cookie が%sときは、DB に問い合わせずに空の一覧を返し、Cookie を発行しない", async (_label, headers) => {
    await insertRow(1, 100);
    const select = vi.spyOn(db, "select");
    const res = await getMine("", headers);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextCursor: null });
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("21 件以上なら 20 件と nextCursor を返し、nextCursor で続きを重複も欠落も無く返す", async () => {
    // 3 件ずつ同じ秒にし、1 ページ目の 20 件目（n=6）と 2 ページ目の先頭（n=5）を同じ秒にする
    for (let n = 1; n <= 25; n++) await insertRow(n, 1000 + Math.ceil(n / 3));

    const first = (await (await getMine()).json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(first.items.map((item) => item.id)).toEqual(Array.from({ length: 20 }, (_, i) => idOf(25 - i)));
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await getMine(`?cursor=${encodeURIComponent(first.nextCursor!)}`);
    expect(second.status).toBe(200);
    expect(await second.clone().json()).toMatchObject({ nextCursor: null });
    expect(await ids(second)).toEqual([idOf(5), idOf(4), idOf(3), idOf(2), idOf(1)]);
  });

  it("ちょうど 20 件なら nextCursor は null", async () => {
    for (let n = 1; n <= 20; n++) await insertRow(n, 1000 + n);

    expect(await (await getMine()).json()).toMatchObject({ nextCursor: null });
  });

  it("削除した行は出さず、ページの件数にも数えない", async () => {
    for (let n = 1; n <= 21; n++) await insertRow(n, 1000 + n, n === 10 ? { deletedAt: 2000 } : {});
    const res = await getMine();

    const body = (await res.clone().json()) as { nextCursor: string | null };
    expect(await ids(res)).toEqual(Array.from({ length: 21 }, (_, i) => idOf(21 - i)).filter((id) => id !== idOf(10)));
    expect(body.nextCursor).toBeNull();
  });

  it.each([
    ["形の違う文字列", "?cursor=abc"],
    ["id が短い", "?cursor=1700000000.short"],
    ["秒が負", `?cursor=-1.${idOf(1)}`],
    ["秒が 11 桁", `?cursor=${"1".repeat(11)}.${idOf(1)}`],
    ["cursor が 2 つ", `?cursor=1700000000.${idOf(1)}&cursor=1700000000.${idOf(2)}`],
  ])("不正なカーソル（%s）→ 400", async (_label, query) => {
    const res = await getMine(query);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });

  it("一覧のクエリは、1 ページ目もカーソル付きも、インデックス (owner_hash, created_at) で持ち主の行だけを読む", () => {
    const first = queryPlan(selectMyTimelines(db, sha256Hex(TOKEN)));
    const next = queryPlan(selectMyTimelines(db, sha256Hex(TOKEN), { createdAt: 1000, id: idOf(1) }));

    expect(first).toContainEqual(expect.stringContaining("USING INDEX idx_timelines_owner (owner_hash=?)"));
    expect(next).toContainEqual(expect.stringContaining("USING INDEX idx_timelines_owner (owner_hash=? AND created_at<?)"));
    // better-sqlite3 と D1 で SQLite の版が違い得るので、計画の全文ではなく、表の全件走査が無いことだけを見る
    for (const plan of [first, next]) expect(plan).not.toContainEqual(expect.stringMatching(/^SCAN timelines/));
  });
});

describe("persistedAppStateSchema", () => {
  it("PersistedAppState と同じ形を表す（version は型が number、スキーマが 1 なので除く）", () => {
    expectTypeOf<Omit<z.infer<typeof persistedAppStateSchema>, "version">>().toEqualTypeOf<
      Omit<PersistedAppState, "version">
    >();
  });
});
