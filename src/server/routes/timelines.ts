import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { nanoid } from "nanoid";
import type { MyTimelinesResponse } from "../../client/logic/my-timelines";
import type { TimelineResponse } from "../../client/logic/shared-timeline";
import { timelines } from "../db/schema";
import type { AppDb, Bindings } from "../env";
import { generateOwnerToken, hashOwnerToken } from "../services/owner-token";
import { MAX_TURNSTILE_TOKEN_LENGTH, verifyTurnstileToken } from "../services/turnstile";
import { isLinkedOwner, linkOwner, selectOwnerHashesOf } from "../services/user-owners";
import { currentUserId } from "./auth";
import { clearOwnerCookie, readOwnerToken, setOwnerCookie } from "./owner-cookie";
import { requireJson } from "./require-json";
import { myTimelinesQuerySchema, saveTimelineRequestSchema, timelineIdParamSchema } from "./timelines-schema";

type RouteEnv = {
  Bindings: Bindings;
  Variables: {
    // 保存する行の持ち主と、その匿名トークン（応答の Cookie に付ける）
    ownerHash: string;
    ownerToken: string;
    // 削除できる行の持ち主。匿名トークンの owner_hash と、ログイン中ならユーザー（に紐づいた owner_hash）
    deleter: { ownerHash?: string; userId?: string };
    // 保存・削除のレート制限のキー。匿名トークンの owner_hash で、トークンの無いログイン中の削除ではユーザーの ID
    rateLimitKey: string;
  };
};

// #462 の実測で、最悪ケースの 1200 エントリが約 100KB
const MAX_BODY_BYTES = 256 * 1024;
const MY_TIMELINES_PAGE_SIZE = 20;

const ownerToken = createMiddleware<RouteEnv>(async (c, next) => {
  // 形の不正な値は無いものとして扱い、作り直す
  const token = readOwnerToken(c) ?? generateOwnerToken();
  const ownerHash = await hashOwnerToken(token);
  c.set("ownerToken", token);
  c.set("ownerHash", ownerHash);
  c.set("rateLimitKey", ownerHash);
  await next();
  // 期限を延ばすため、既存のトークンでも毎回付け直す。保存の処理でトークンを替えたら替えたものを付けるよう、処理のあとで付ける
  setOwnerCookie(c, c.get("ownerToken"));
});

/**
 * ログインしていないときに、この匿名トークンをアカウントに紐づかない持ち主として使えるか。紐づいていれば、ログアウトしたあとと同じく使わない
 * （共用の PC で前の人がログアウトせずにセッションが切れたとき、次の人の保存を前の人のアカウントに入れず、前の人の保存も見せないため。#955）。
 * ログインできない環境（クライアント ID が無い）では、currentUserId と同じくアカウントは無いものとし、DB を読まない
 */
async function isAnonymousOwner<E extends { Bindings: Bindings }>(
  c: Context<E>,
  db: AppDb,
  ownerHash: string,
): Promise<boolean> {
  return !c.env.DISCORD_CLIENT_ID || !(await isLinkedOwner(db, ownerHash));
}

/** 一覧・削除で使う Cookie の匿名トークン。ログインしていないのにアカウントに紐づいていれば、ログアウトしたときと同じく Cookie を消し、無いものとする */
async function readUsableOwnerToken<E extends { Bindings: Bindings }>(
  c: Context<E>,
  db: AppDb,
  userId: string | undefined,
): Promise<string | undefined> {
  const token = readOwnerToken(c);
  if (token === undefined || userId !== undefined || (await isAnonymousOwner(c, db, await hashOwnerToken(token)))) {
    return token;
  }
  clearOwnerCookie(c);
  return undefined;
}

const rateLimit = createMiddleware<RouteEnv>(async (c, next) => {
  const { success } = await c.env.TIMELINE_RATE_LIMITER.limit({ key: c.get("rateLimitKey") });
  if (!success) return c.json({ error: "rate_limited" }, 429);
  await next();
});

const turnstile = createMiddleware<RouteEnv>(async (c, next) => {
  const secret = c.env.TURNSTILE_SECRET_KEY;
  // 設定の誤りは利用者の失敗ではないので 403 にせず、例外（既定の onError がログに出して 500）にする。テスト用の secret には落とさない
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY is not set");
  const token = c.req.header("X-Turnstile-Token");
  if (!token || token.length > MAX_TURNSTILE_TOKEN_LENGTH) return c.json({ error: "turnstile_failed" }, 403);
  if (!(await verifyTurnstileToken(secret, token, c.req.header("CF-Connecting-IP")))) {
    return c.json({ error: "turnstile_failed" }, 403);
  }
  await next();
});

export function createTimelinesRoute(getDb: (env: Bindings) => AppDb) {
  // 削除用。匿名トークンもログインも無ければ、消せる行も無いので、Cookie を発行せず DB にも触れずに「無い」と答える
  const requireDeleter = createMiddleware<RouteEnv>(async (c, next) => {
    const db = getDb(c.env);
    // 別の端末で保存した行も、ログイン中なら消せる。この端末に匿名トークンが無くてもよい
    const userId = await currentUserId(c, db);
    const token = await readUsableOwnerToken(c, db, userId);
    const ownerHash = token === undefined ? undefined : await hashOwnerToken(token);
    // 保存と同じく匿名トークンで数える。トークンの無い端末では、ユーザーで数える（ID の形が owner_hash と違うので、キーはぶつからない）
    const rateLimitKey = ownerHash ?? userId;
    if (rateLimitKey === undefined) return c.json({ error: "not_found" }, 404);
    if (token !== undefined) setOwnerCookie(c, token);
    c.set("deleter", { ownerHash, userId });
    c.set("rateLimitKey", rateLimitKey);
    await next();
  });

  return new Hono<RouteEnv>().post(
    "/",
    // csrf はフォームから送れる Content-Type だけを検査する。JSON の別オリジン送信は、CORS ヘッダを返さないのでプリフライトでブラウザが止める
    csrf(),
    requireJson,
    bodyLimit({ maxSize: MAX_BODY_BYTES }),
    ownerToken,
    // 不正な本文の連投も数え、検証にかかる CPU を守るため、検証より前に置く
    rateLimit,
    // siteverify を呼ぶ回数をレート制限で抑え、不合格の要求には本文の検証の CPU を使わせない。トークンを本文ではなくヘッダで受けるのも、本文をパースせずに判定するため
    turnstile,
    zValidator("json", saveTimelineRequestSchema, (result, c) => {
      if (!result.success) return c.json({ error: "invalid_request" }, 400);
    }),
    async (c) => {
      const { data, title, parentId, contentId } = c.req.valid("json");
      const db = getDb(c.env);
      if (parentId !== undefined) {
        const [parent] = await db
          .select({ id: timelines.id })
          .from(timelines)
          .where(eq(timelines.id, parentId))
          .limit(1);
        if (!parent) return c.json({ error: "parent_not_found" }, 400);
      }
      // ログイン中に保存したら、この匿名トークンもアカウントに紐づける（ログインの後に初めて保存した端末など）。
      // すでに紐づいていれば書かない。別のユーザーに紐づいていても付け替えない
      const userId = await currentUserId(c, db);
      if (userId !== undefined) await linkOwner(db, c.get("ownerHash"), userId);
      else if (!(await isAnonymousOwner(c, db, c.get("ownerHash")))) {
        // ログアウトしたあとと同じく、新しい匿名トークンで保存する（新しいトークンは、次にログインしたときに紐づく）
        const token = generateOwnerToken();
        c.set("ownerToken", token);
        c.set("ownerHash", await hashOwnerToken(token));
      }
      const id = nanoid();
      await db.insert(timelines).values({
        id,
        parentId: parentId ?? null,
        schemaVer: data.version,
        data: JSON.stringify(data),
        job: data.selectedJob,
        level: data.level,
        // 空文字は省略と同じ扱いにする
        title: title || null,
        contentId: contentId ?? null,
        ownerHash: c.get("ownerHash"),
      });
      return c.json({ id }, 201);
    },
  )
  // 共有 URL で誰でも開くので、匿名トークンもレート制限も使わない。id は推測できず、1 回の読み込みは主キーで 1 行だけ読む
  .get(
    "/:id",
    // この形の id は保存され得ないので、DB に問い合わせずに「無い」と答える
    zValidator("param", timelineIdParamSchema, (result, c) => {
      if (!result.success) return c.json({ error: "not_found" }, 404);
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const [row] = await getDb(c.env)
        .select({
          id: timelines.id,
          parentId: timelines.parentId,
          schemaVer: timelines.schemaVer,
          data: timelines.data,
          title: timelines.title,
          contentId: timelines.contentId,
          createdAt: timelines.createdAt,
          deletedAt: timelines.deletedAt,
        })
        .from(timelines)
        .where(eq(timelines.id, id))
        .limit(1);
      if (!row) return c.json({ error: "not_found" }, 404);
      // 共有 URL を渡された人に、URL の誤りではなく保存した人が削除したと伝えるため、無い id と区別する
      const { deletedAt, data, createdAt, ...rest } = row;
      if (deletedAt !== null) return c.json({ error: "deleted" }, 410);
      return c.json({
        ...rest,
        data: JSON.parse(data) as unknown,
        // DB は unixepoch() の秒
        createdAt: new Date(createdAt * 1000).toISOString(),
      } satisfies TimelineResponse);
    },
  )
  // 行は消さずに削除の印を付ける（#832）。保存と同じく csrf とレート制限を掛ける。Turnstile は掛けない（新しい内容を作らず、消せるのは自分の行だけ）
  .delete(
    "/:id",
    csrf(),
    requireDeleter,
    // POST と同じく、不正な id の連投も数えるため、検証より前に置く
    rateLimit,
    zValidator("param", timelineIdParamSchema, (result, c) => {
      if (!result.success) return c.json({ error: "not_found" }, 404);
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const db = getDb(c.env);
      const deleter = c.get("deleter");
      const deleted = await db
        .update(timelines)
        .set({ deletedAt: sql`(unixepoch())` })
        .where(
          and(
            eq(timelines.id, id),
            or(
              deleter.ownerHash === undefined ? undefined : eq(timelines.ownerHash, deleter.ownerHash),
              deleter.userId === undefined
                ? undefined
                : inArray(timelines.ownerHash, selectOwnerHashesOf(db, deleter.userId)),
            ),
            isNull(timelines.deletedAt),
          ),
        )
        .returning({ id: timelines.id });
      // ほかの人の行・無い行・削除済みの行を区別しない（ほかの人の行があるかを外から分からないようにする）
      if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
      return c.body(null, 204);
    },
  );
}

type MyTimelinesCursor = { createdAt: number; id: string };

/**
 * 持ち主の行を新しい順に、次のページがあるか分かるよう 1 件多く選ぶ。
 * 同じ秒の行は id の降順に並べ、cursor（前のページの最後の行）より後ろだけを選ぶ
 */
export function selectMyTimelines(db: AppDb, ownerHash: string, cursor?: MyTimelinesCursor) {
  return selectTimelinesOf(db, eq(timelines.ownerHash, ownerHash), cursor);
}

/**
 * ログイン中の一覧。ユーザーに紐づいたすべての owner_hash の行を、selectMyTimelines と同じ順・同じ cursor で選ぶ。
 * 順は owner_hash に依らない (created_at, id) なので、持ち主をまたいでもページの境界で重複も欠落もしない
 */
export function selectAccountTimelines(db: AppDb, userId: string, cursor?: MyTimelinesCursor) {
  return selectTimelinesOf(db, inArray(timelines.ownerHash, selectOwnerHashesOf(db, userId)), cursor);
}

function selectTimelinesOf(db: AppDb, owner: SQL, cursor?: MyTimelinesCursor) {
  return db
    .select({
      id: timelines.id,
      title: timelines.title,
      job: timelines.job,
      level: timelines.level,
      contentId: timelines.contentId,
      createdAt: timelines.createdAt,
    })
    .from(timelines)
    .where(
      and(
        owner,
        isNull(timelines.deletedAt),
        // 「created_at < ? OR (created_at = ? AND id < ?)」と同じ条件。その OR だけで書くと、値をパラメータで渡したときに
        // created_at がインデックスの範囲検索に使われず、持ち主の行を新しい方から全部たどることになる
        cursor && lte(timelines.createdAt, cursor.createdAt),
        cursor && or(lt(timelines.createdAt, cursor.createdAt), lt(timelines.id, cursor.id)),
      ),
    )
    .orderBy(desc(timelines.createdAt), desc(timelines.id))
    .limit(MY_TIMELINES_PAGE_SIZE + 1);
}

// /api/me/timelines にマウントする。読むのはインデックスで 1 ページ分だけなので、GET /:id と同じくレート制限は使わない
export function createMyTimelinesRoute(getDb: (env: Bindings) => AppDb) {
  return new Hono<{ Bindings: Bindings }>().get(
    "/",
    zValidator("query", myTimelinesQuerySchema, (result, c) => {
      if (!result.success) return c.json({ error: "invalid_request" }, 400);
    }),
    async (c) => {
      const db = getDb(c.env);
      const userId = await currentUserId(c, db);
      const token = await readUsableOwnerToken(c, db, userId);
      const { cursor } = c.req.valid("query");
      // ログイン中は、この端末の匿名トークンではなくアカウントで引く（この端末の匿名トークンも、ログインか保存で紐づいている）
      const query =
        userId !== undefined
          ? selectAccountTimelines(db, userId, cursor)
          : token !== undefined
            ? selectMyTimelines(db, await hashOwnerToken(token), cursor)
            : undefined;
      // 一覧を見ただけでは Cookie を発行しない。トークンもログインも無ければ、その持ち主の行も無い
      if (query === undefined) return c.json({ items: [], nextCursor: null } satisfies MyTimelinesResponse);
      if (token !== undefined) setOwnerCookie(c, token);
      const rows = await query;
      const page = rows.slice(0, MY_TIMELINES_PAGE_SIZE);
      const last = page[page.length - 1];
      return c.json({
        items: page.map((row) => ({ ...row, createdAt: new Date(row.createdAt * 1000).toISOString() })),
        nextCursor: rows.length > MY_TIMELINES_PAGE_SIZE ? `${last.createdAt}.${last.id}` : null,
      } satisfies MyTimelinesResponse);
    },
  );
}
