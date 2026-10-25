import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lt, lte, or } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { nanoid } from "nanoid";
import type { MyTimelinesResponse } from "../../client/logic/my-timelines";
import type { TimelineResponse } from "../../client/logic/shared-timeline";
import { timelines } from "../db/schema";
import type { AppDb, Bindings } from "../env";
import { generateOwnerToken, hashOwnerToken, isOwnerToken } from "../services/owner-token";
import { myTimelinesQuerySchema, saveTimelineRequestSchema, timelineIdParamSchema } from "./timelines-schema";

type RouteEnv = { Bindings: Bindings; Variables: { ownerHash: string } };

// RFC 6265bis の上限の 400 日
const OWNER_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
// #462 の実測で、最悪ケースの 1200 エントリが約 100KB
const MAX_BODY_BYTES = 256 * 1024;
const MY_TIMELINES_PAGE_SIZE = 20;

const requireJson = createMiddleware(async (c, next) => {
  if (!/^application\/json\s*(;|$)/i.test(c.req.header("Content-Type") ?? "")) {
    return c.json({ error: "unsupported_media_type" }, 415);
  }
  await next();
});

/** Cookie の匿名トークン。無いか、形が不正なら undefined */
function readOwnerToken(c: Context): string | undefined {
  const token = getCookie(c, "owner", "host");
  return token !== undefined && isOwnerToken(token) ? token : undefined;
}

function setOwnerCookie(c: Context, token: string) {
  setCookie(c, "owner", token, { prefix: "host", httpOnly: true, sameSite: "Lax", maxAge: OWNER_COOKIE_MAX_AGE });
}

const ownerToken = createMiddleware<RouteEnv>(async (c, next) => {
  // 形の不正な値は無いものとして扱い、作り直す
  const token = readOwnerToken(c) ?? generateOwnerToken();
  c.set("ownerHash", await hashOwnerToken(token));
  // 期限を延ばすため、既存のトークンでも毎回付け直す
  setOwnerCookie(c, token);
  await next();
});

const rateLimit = createMiddleware<RouteEnv>(async (c, next) => {
  const { success } = await c.env.TIMELINE_RATE_LIMITER.limit({ key: c.get("ownerHash") });
  if (!success) return c.json({ error: "rate_limited" }, 429);
  await next();
});

export function createTimelinesRoute(getDb: (env: Bindings) => AppDb) {
  return new Hono<RouteEnv>().post(
    "/",
    // csrf はフォームから送れる Content-Type だけを検査する。JSON の別オリジン送信は、CORS ヘッダを返さないのでプリフライトでブラウザが止める
    csrf(),
    requireJson,
    bodyLimit({ maxSize: MAX_BODY_BYTES }),
    ownerToken,
    // 不正な本文の連投も数え、検証にかかる CPU を守るため、検証より前に置く
    rateLimit,
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
        })
        .from(timelines)
        .where(eq(timelines.id, id))
        .limit(1);
      if (!row) return c.json({ error: "not_found" }, 404);
      return c.json({
        ...row,
        data: JSON.parse(row.data) as unknown,
        // DB は unixepoch() の秒
        createdAt: new Date(row.createdAt * 1000).toISOString(),
      } satisfies TimelineResponse);
    },
  );
}

/**
 * 持ち主の行を新しい順に、次のページがあるか分かるよう 1 件多く選ぶ。
 * 同じ秒の行は id の降順に並べ、cursor（前のページの最後の行）より後ろだけを選ぶ
 */
export function selectMyTimelines(db: AppDb, ownerHash: string, cursor?: { createdAt: number; id: string }) {
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
        eq(timelines.ownerHash, ownerHash),
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
      const token = readOwnerToken(c);
      // 一覧を見ただけでは Cookie を発行しない。トークンが無ければ、その持ち主の行も無い
      if (token === undefined) return c.json({ items: [], nextCursor: null } satisfies MyTimelinesResponse);
      setOwnerCookie(c, token);
      const { cursor } = c.req.valid("query");
      const rows = await selectMyTimelines(getDb(c.env), await hashOwnerToken(token), cursor);
      const page = rows.slice(0, MY_TIMELINES_PAGE_SIZE);
      const last = page[page.length - 1];
      return c.json({
        items: page.map((row) => ({ ...row, createdAt: new Date(row.createdAt * 1000).toISOString() })),
        nextCursor: rows.length > MY_TIMELINES_PAGE_SIZE ? `${last.createdAt}.${last.id}` : null,
      } satisfies MyTimelinesResponse);
    },
  );
}
