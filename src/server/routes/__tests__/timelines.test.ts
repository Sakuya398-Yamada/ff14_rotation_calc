import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { z } from "zod";
import type { PersistedAppState } from "../../../client/logic/timeline-storage";
import { timelines } from "../../db/schema";
import { createMyTimelinesRoute, createTimelinesRoute, selectMyTimelines } from "../timelines";
import type { persistedAppStateSchema } from "../timelines-schema";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../../migrations", import.meta.url));
const URL_BASE = "http://localhost/api/timelines";
const TOKEN_RE = /__Host-owner=([A-Za-z0-9_-]{43})/;

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
    ],
    stats: { critical: 3000, directHit: 2000, determination: 2500, speed: 528 },
    untargetableWindows: [{ startTime: 30, endTime: 45 }],
    multiTargetWindows: [{ startTime: 0, endTime: 20, targetCount: 3 }],
    ...overrides,
  };
}

let db: ReturnType<typeof createTestDb>;
let limit: ReturnType<typeof vi.fn<(options: { key: string }) => Promise<{ success: boolean }>>>;
let app: Hono;

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.request(
    URL_BASE,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
    { DB: undefined, TIMELINE_RATE_LIMITER: { limit } },
  );
}

async function rows() {
  return db.select().from(timelines);
}

beforeEach(() => {
  db = createTestDb();
  limit = vi.fn(async () => ({ success: true }));
  app = new Hono()
    .route("/api/timelines", createTimelinesRoute(() => db))
    .route("/api/me/timelines", createMyTimelinesRoute(() => db));
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
    ["エントリが 2001 件", { data: validData({ entries: entries2001 }) }],
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
