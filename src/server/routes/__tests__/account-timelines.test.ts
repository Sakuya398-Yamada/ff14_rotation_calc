import { createHash, createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedAppState } from "../../../client/logic/timeline-storage";
import { timelines, userIdentities, userOwners } from "../../db/schema";
import { createAuthRoute, createMeRoute } from "../auth";
import { createMyTimelinesRoute, createTimelinesRoute, selectAccountTimelines } from "../timelines";

// ログイン（#876）と保存・一覧・削除をまたいで、匿名トークンのアカウントへの紐づけを確かめる（#878）

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../../migrations", import.meta.url));
const ORIGIN = "http://localhost";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const CURRENT_USER_URL = "https://discord.com/api/v10/users/@me";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DISCORD_ALICE = "80351110224678912";
const DISCORD_BOB = "175928847299117063";
const ID_HMAC_KEY = "test-id-hmac-key";

// src/server/routes/__tests__/timelines.test.ts と同じく、本番の D1 と同じマイグレーションを当てた better-sqlite3 の DB を使う（#574）
function createTestDb() {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validData(): PersistedAppState {
  return {
    version: 1,
    selectedJob: "blm",
    level: 100,
    entries: [{ uid: "entry-1", skillId: "fire-3" }],
    stats: { critical: 3000, directHit: 2000, determination: 2500, speed: 528 },
    untargetableWindows: [],
    multiTargetWindows: [],
  };
}

let db: ReturnType<typeof createTestDb>;
let limit: ReturnType<typeof vi.fn<(options: { key: string }) => Promise<{ success: boolean }>>>;
let clientId: string | undefined;
let discordUserId: string;
let app: Hono;

// Discord のトークンのエンドポイント・/users/@me と、Turnstile の siteverify の代わり。URL で振り分ける
async function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (url === TOKEN_URL) return Response.json({ access_token: "test-access-token", token_type: "Bearer" });
  if (url === CURRENT_USER_URL) return Response.json({ id: discordUserId, username: "user", discriminator: "0" });
  if (url === SITEVERIFY_URL) return Response.json({ success: true, "error-codes": [] });
  return new Response(null, { status: 404 });
}

/** 1 つのブラウザ。応答の Set-Cookie を覚え、次の要求に Cookie として付ける */
class Browser {
  readonly cookies = new Map<string, string>();

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set("Cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    const res = await app.request(
      `${ORIGIN}${path}`,
      { ...init, headers },
      {
        DB: undefined,
        TIMELINE_RATE_LIMITER: { limit },
        TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
        DISCORD_CLIENT_ID: clientId,
        DISCORD_CLIENT_SECRET: "test-client-secret",
        DISCORD_ID_HMAC_KEY: ID_HMAC_KEY,
      },
    );
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const name = pair.slice(0, pair.indexOf("="));
      if (/Max-Age=0(;|$)/.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, pair.slice(pair.indexOf("=") + 1));
    }
    return res;
  }

  get ownerToken() {
    return this.cookies.get("__Host-owner");
  }

  /** 認可画面で承認して戻ってくるまで */
  async login(discordId: string) {
    discordUserId = discordId;
    await this.request("/api/auth/discord");
    const { state } = JSON.parse(decodeURIComponent(this.cookies.get("__Host-discord_oauth") ?? "")) as { state: string };
    return this.request(`/api/auth/discord/callback?code=test-code&state=${state}`);
  }

  logout() {
    return this.request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: "{}",
    });
  }

  async save(title: string): Promise<string> {
    const res = await this.request("/api/timelines", {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", "X-Turnstile-Token": "XXXX.DUMMY.TOKEN.XXXX" },
      body: JSON.stringify({ data: validData(), title }),
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
  }

  async list(cursor?: string) {
    const res = await this.request(`/api/me/timelines${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    expect(res.status).toBe(200);
    return (await res.json()) as { items: { id: string; title: string | null }[]; nextCursor: string | null };
  }

  /** 一覧のタイトル。同じ秒に保存した行の順は id で決まり、テストからは選べないので、並べ替えて比べる（順はページの境界のテストで見る） */
  async titles(): Promise<(string | null)[]> {
    return (await this.list()).items.map((item) => item.title).sort();
  }

  delete(id: string) {
    return this.request(`/api/timelines/${id}`, { method: "DELETE", headers: { Origin: ORIGIN } });
  }
}

async function userIdOf(discordId: string): Promise<string> {
  const [row] = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(eq(userIdentities.providerUserId, createHmac("sha256", ID_HMAC_KEY).update(discordId).digest("hex")));
  return row.userId;
}

beforeEach(() => {
  db = createTestDb();
  limit = vi.fn(async () => ({ success: true }));
  // app.request はグローバルの fetch を使わないので、差し替わるのは Discord と siteverify の呼び出しだけ
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  clientId = "123456789012345678";
  discordUserId = DISCORD_ALICE;
  app = new Hono()
    .route("/api/timelines", createTimelinesRoute(() => db))
    .route("/api/me/timelines", createMyTimelinesRoute(() => db))
    .route("/api/auth", createAuthRoute(() => db))
    .route("/api/me", createMeRoute(() => db));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ログインで匿名の保存をアカウントに紐づける", () => {
  it("端末 A で匿名のまま保存してログインし、端末 B（別の匿名トークン）で同じアカウントにログインすると、B の一覧に A の保存も出る", async () => {
    const a = new Browser();
    const b = new Browser();
    await a.save("A で保存");
    await b.save("B で保存");
    const tokenA = a.ownerToken;

    await a.login(DISCORD_ALICE);
    // ログインの前は、それぞれの端末の保存だけ
    expect(await b.titles()).toEqual(["B で保存"]);
    await b.login(DISCORD_ALICE);

    expect(await b.titles()).toEqual(["A で保存", "B で保存"]);
    expect(await a.titles()).toEqual(["A で保存", "B で保存"]);
    // 紐づけても匿名トークンは変えない
    expect(a.ownerToken).toBe(tokenA);
    const userId = await userIdOf(DISCORD_ALICE);
    expect(
      (await db.select({ ownerHash: userOwners.ownerHash, userId: userOwners.userId }).from(userOwners)).sort((x, y) =>
        x.ownerHash.localeCompare(y.ownerHash),
      ),
    ).toEqual(
      [
        { ownerHash: sha256Hex(a.ownerToken ?? ""), userId },
        { ownerHash: sha256Hex(b.ownerToken ?? ""), userId },
      ].sort((x, y) => x.ownerHash.localeCompare(y.ownerHash)),
    );
  });

  it("同じ匿名トークンでもう一度ログインしても、紐づけの行は増えない", async () => {
    const a = new Browser();
    await a.save("A で保存");
    await a.login(DISCORD_ALICE);
    await a.login(DISCORD_ALICE);

    expect(await db.select().from(userOwners)).toHaveLength(1);
  });

  it("別のユーザーに紐づいた匿名トークンを持ってログインすると、その保存は一覧に出ず、新しい匿名トークンが発行される", async () => {
    // 共用の PC で、前の人がログアウトせずに（セッションが切れて）いなくなった
    const shared = new Browser();
    await shared.save("前の人の保存");
    await shared.login(DISCORD_ALICE);
    const previousToken = shared.ownerToken;
    shared.cookies.delete("__Host-session");

    const res = await shared.login(DISCORD_BOB);

    expect(res.status).toBe(302);
    expect(shared.ownerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(shared.ownerToken).not.toBe(previousToken);
    expect(await shared.titles()).toEqual([]);
    // 前の人の紐づけは変えない
    expect(await db.select({ ownerHash: userOwners.ownerHash, userId: userOwners.userId }).from(userOwners)).toEqual([
      { ownerHash: sha256Hex(previousToken ?? ""), userId: await userIdOf(DISCORD_ALICE) },
    ]);
    const alice = new Browser();
    await alice.login(DISCORD_ALICE);
    expect(await alice.titles()).toEqual(["前の人の保存"]);

    // 新しい匿名トークンでの保存は、今の人のアカウントに紐づく
    await shared.save("今の人の保存");
    expect(await shared.titles()).toEqual(["今の人の保存"]);
    expect(await alice.titles()).toEqual(["前の人の保存"]);
  });

  it("匿名トークンが無いブラウザでログインしても、匿名トークンを発行せず、紐づけも作らない", async () => {
    const b = new Browser();
    await b.login(DISCORD_ALICE);

    expect(b.ownerToken).toBeUndefined();
    expect(await db.select().from(userOwners)).toEqual([]);
  });
});

describe("ログイン中の保存", () => {
  it("まだ紐づいていない匿名トークンで保存すると、その保存も一覧に出て、ほかの端末の一覧にも出る", async () => {
    const a = new Browser();
    await a.save("A で保存");
    await a.login(DISCORD_ALICE);
    // 匿名トークンの無い端末でログインし、保存で初めて匿名トークンが発行される
    const b = new Browser();
    await b.login(DISCORD_ALICE);
    await b.save("B でログイン後に保存");

    expect(await b.titles()).toEqual(["A で保存", "B でログイン後に保存"]);
    expect(await a.titles()).toEqual(["A で保存", "B でログイン後に保存"]);
    expect(await db.select().from(userOwners).where(eq(userOwners.ownerHash, sha256Hex(b.ownerToken ?? "")))).toEqual([
      expect.objectContaining({ userId: await userIdOf(DISCORD_ALICE) }),
    ]);
  });

  it("すでに紐づいた匿名トークンで続けて保存しても、紐づけの行は増えない", async () => {
    const a = new Browser();
    await a.login(DISCORD_ALICE);
    await a.save("1 件目");
    await a.save("2 件目");

    expect(await db.select().from(userOwners)).toHaveLength(1);
  });

  it("ログインしていなければ、保存しても紐づけない", async () => {
    const a = new Browser();
    await a.save("匿名の保存");

    expect(await db.select().from(userOwners)).toEqual([]);
  });
});

describe("ログアウト", () => {
  it("__Host-owner も消え、そのブラウザの一覧はログインしていないときと同じ動き（空）に戻る。保存はアカウントに残る", async () => {
    const a = new Browser();
    await a.save("A で保存");
    await a.login(DISCORD_ALICE);

    const res = await a.logout();

    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie().find((cookie) => cookie.startsWith("__Host-owner="))).toContain("Max-Age=0");
    expect(a.ownerToken).toBeUndefined();
    const select = vi.spyOn(db, "select");
    expect(await a.list()).toEqual({ items: [], nextCursor: null });
    // Cookie が無ければ DB に問い合わせない（ログインしていないときの今の動き）
    expect(select).not.toHaveBeenCalled();
    select.mockRestore();

    // 次に匿名で保存すると新しい匿名トークンになり、一覧はそのトークンの保存だけ
    await a.save("ログアウト後の匿名の保存");
    expect(await a.titles()).toEqual(["ログアウト後の匿名の保存"]);
    await a.login(DISCORD_ALICE);
    expect(await a.titles()).toEqual(["A で保存", "ログアウト後の匿名の保存"]);
  });

  it("セッションの Cookie が無いブラウザ（ログインしていない人）の匿名トークンは消さない", async () => {
    const a = new Browser();
    await a.save("匿名の保存");
    const res = await a.logout();

    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie().find((cookie) => cookie.startsWith("__Host-owner="))).toBeUndefined();
    expect(await a.titles()).toEqual(["匿名の保存"]);
  });
});

describe("ログイン中の一覧", () => {
  // nanoid と同じ 21 文字。n の大小が id の大小と一致するよう 0 で埋める
  function idOf(n: number): string {
    return `id${String(n).padStart(19, "0")}`;
  }

  it("複数の owner_hash にまたがる一覧で、ページの境界の行が重複も欠落もしない", async () => {
    const browser = new Browser();
    await browser.login(DISCORD_ALICE);
    const userId = await userIdOf(DISCORD_ALICE);
    const owners = ["X", "Y", "Z"].map((c) => sha256Hex(c.repeat(43)));
    await db.insert(userOwners).values(owners.map((ownerHash) => ({ ownerHash, userId })));
    // 3 件ずつ同じ秒にし、同じ秒の行の持ち主を分ける。1 ページ目の 20 件目（n=6）と 2 ページ目の先頭（n=5）は同じ秒で持ち主が違う
    for (let n = 1; n <= 25; n++) {
      await db.insert(timelines).values({
        id: idOf(n),
        schemaVer: 1,
        data: JSON.stringify(validData()),
        job: "blm",
        level: 100,
        ownerHash: owners[n % 3],
        createdAt: 1000 + Math.ceil(n / 3),
      });
    }
    // 紐づいていない持ち主の、同じ秒の行は出ない
    await db.insert(timelines).values({
      id: idOf(100),
      schemaVer: 1,
      data: JSON.stringify(validData()),
      job: "blm",
      level: 100,
      ownerHash: sha256Hex("W".repeat(43)),
      createdAt: 1002,
    });

    const first = await browser.list();
    expect(first.items.map((item) => item.id)).toEqual(Array.from({ length: 20 }, (_, i) => idOf(25 - i)));
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await browser.list(first.nextCursor ?? "");
    expect(second.items.map((item) => item.id)).toEqual([idOf(5), idOf(4), idOf(3), idOf(2), idOf(1)]);
    expect(second.nextCursor).toBeNull();
  });

  it("一覧のクエリは、1 ページ目もカーソル付きも、timelines を全件走査しない", () => {
    function queryPlan(query: { toSQL(): { sql: string; params: unknown[] } }): string[] {
      const { sql, params } = query.toSQL();
      return (db.$client.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map(
        (r) => r.detail,
      );
    }
    const first = queryPlan(selectAccountTimelines(db, "user-1"));
    const next = queryPlan(selectAccountTimelines(db, "user-1", { createdAt: 1000, id: idOf(1) }));

    expect(first).toContainEqual(expect.stringContaining("USING INDEX idx_timelines_owner (owner_hash=?)"));
    expect(next).toContainEqual(expect.stringContaining("USING INDEX idx_timelines_owner (owner_hash=? AND created_at<?)"));
    for (const plan of [first, next]) {
      expect(plan).toContainEqual(expect.stringContaining("idx_user_owners_user"));
      // better-sqlite3 と D1 で SQLite の版が違い得るので、計画の全文ではなく、表の全件走査が無いことだけを見る
      expect(plan).not.toContainEqual(expect.stringMatching(/^SCAN (timelines|user_owners)/));
    }
  });

  it("クライアント ID が無い環境（PR のプレビュー）では、セッションの Cookie が残っていてもログインしていないときと同じ一覧", async () => {
    const a = new Browser();
    await a.save("A で保存");
    await a.login(DISCORD_ALICE);
    const b = new Browser();
    await b.save("B で保存");
    await b.login(DISCORD_ALICE);
    clientId = undefined;

    expect(await b.titles()).toEqual(["B で保存"]);
  });
});

describe("ログイン中の削除", () => {
  it("別の端末で保存したタイムラインも削除でき、レート制限はこの端末の匿名トークンで数える", async () => {
    const a = new Browser();
    const id = await a.save("A で保存");
    await a.login(DISCORD_ALICE);
    const b = new Browser();
    await b.save("B で保存");
    await b.login(DISCORD_ALICE);
    limit.mockClear();

    const res = await b.delete(id);

    expect(res.status).toBe(204);
    expect(await a.titles()).toEqual(["B で保存"]);
    expect(limit).toHaveBeenCalledWith({ key: sha256Hex(b.ownerToken ?? "") });
  });

  it("匿名トークンの無い端末でも、ログイン中なら削除でき、Cookie を発行せず、レート制限はユーザーで数える", async () => {
    const a = new Browser();
    const id = await a.save("A で保存");
    await a.login(DISCORD_ALICE);
    const b = new Browser();
    await b.login(DISCORD_ALICE);
    limit.mockClear();

    const res = await b.delete(id);

    expect(res.status).toBe(204);
    expect(b.ownerToken).toBeUndefined();
    expect(limit).toHaveBeenCalledWith({ key: await userIdOf(DISCORD_ALICE) });
    expect(await a.titles()).toEqual([]);
  });

  it("別のユーザーに紐づいた保存は、ログイン中でも削除できない（404）", async () => {
    const a = new Browser();
    const id = await a.save("Alice の保存");
    await a.login(DISCORD_ALICE);
    const b = new Browser();
    await b.save("Bob の保存");
    await b.login(DISCORD_BOB);

    const res = await b.delete(id);

    expect(res.status).toBe(404);
    expect(await a.titles()).toEqual(["Alice の保存"]);
  });

  it("ログインしていなければ、別の端末の保存は削除できない（今と同じ）", async () => {
    const a = new Browser();
    const id = await a.save("A で保存");
    await a.login(DISCORD_ALICE);
    const b = new Browser();
    await b.save("B で保存");

    expect((await b.delete(id)).status).toBe(404);
    expect(await a.titles()).toEqual(["A で保存"]);
  });
});
