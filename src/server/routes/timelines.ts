import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { nanoid } from "nanoid";
import { timelines } from "../db/schema";
import type { AppDb, Bindings } from "../env";
import { generateOwnerToken, hashOwnerToken, isOwnerToken } from "../services/owner-token";
import { saveTimelineRequestSchema } from "./timelines-schema";

type RouteEnv = { Bindings: Bindings; Variables: { ownerHash: string } };

// RFC 6265bis の上限の 400 日
const OWNER_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
// #462 の実測で、最悪ケースの 1200 エントリが約 100KB
const MAX_BODY_BYTES = 256 * 1024;

const requireJson = createMiddleware(async (c, next) => {
  if (!/^application\/json\s*(;|$)/i.test(c.req.header("Content-Type") ?? "")) {
    return c.json({ error: "unsupported_media_type" }, 415);
  }
  await next();
});

const ownerToken = createMiddleware<RouteEnv>(async (c, next) => {
  const current = getCookie(c, "owner", "host");
  // 形の不正な値は無いものとして扱い、作り直す
  const token = current !== undefined && isOwnerToken(current) ? current : generateOwnerToken();
  c.set("ownerHash", await hashOwnerToken(token));
  // 期限を延ばすため、既存のトークンでも毎回付け直す
  setCookie(c, "owner", token, { prefix: "host", httpOnly: true, sameSite: "Lax", maxAge: OWNER_COOKIE_MAX_AGE });
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
      const { data, title, parentId } = c.req.valid("json");
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
        ownerHash: c.get("ownerHash"),
      });
      return c.json({ id }, 201);
    },
  );
}
