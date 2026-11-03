import { createMiddleware } from "hono/factory";

// hono/csrf はフォームから送れる Content-Type だけを検査する。JSON に限れば、別オリジンからの送信は CORS のプリフライトでブラウザが止める
export const requireJson = createMiddleware(async (c, next) => {
  if (!/^application\/json\s*(;|$)/i.test(c.req.header("Content-Type") ?? "")) {
    return c.json({ error: "unsupported_media_type" }, 415);
  }
  await next();
});
