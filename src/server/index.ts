import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { Bindings } from "./env";
import { createAuthRoute, createMeRoute } from "./routes/auth";
import { createMyTimelinesRoute, createTimelinesRoute } from "./routes/timelines";
import { deleteExpiredSessions } from "./services/session";

export const app = new Hono<{ Bindings: Bindings }>();
const getDb = (env: Bindings) => drizzle(env.DB);

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/timelines", createTimelinesRoute(getDb));
app.route("/api/me/timelines", createMyTimelinesRoute(getDb));
app.route("/api/auth", createAuthRoute(getDb));
app.route("/api/me", createMeRoute(getDb));

// 共有 URL（/t/<id>・/en/t/<id>）は利用者のタイムラインなので、検索結果に載せない。robots.txt で塞ぐとクローラーが
// noindex を読めず、リンクされた URL が中身の無いまま載ることがあるので、ヘッダーで外す（#837）。
// ASSETS.fetch の応答はヘッダーを書き換えられないので、詰め直してから付ける
function withNoindex(res: Response): Response {
  const copy = new Response(res.body, res);
  copy.headers.set("X-Robots-Tag", "noindex");
  return copy;
}

// /t/ 配下も run_worker_first で Worker に来る。SPA のフォールバックと同じく、ルートの index.html を返す
app.get("/t/*", async (c) => withNoindex(await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url), c.req.raw))));

// /en/ 配下は run_worker_first で Worker に来る。SPA のフォールバックはルートの index.html（日本語）を返すので、英語の HTML を返す。
// /en/index.html を取ると html_handling が /en へ 307 で戻すので、/en/ を取る。/en/ 配下にほかのアセットは無い
app.get("/en/*", async (c) => {
  const res = await c.env.ASSETS.fetch(new Request(new URL("/en/", c.req.url), c.req.raw));
  return c.req.path.startsWith("/en/t/") ? withNoindex(res) : res;
});

export default {
  fetch: app.fetch,
  // Cron Trigger（wrangler.jsonc の triggers.crons。1 日 1 回）。ログアウトせずに期限が切れたセッションの行を消す（#919）。
  // 引数の controller は使わないので型を付けない（Bindings と同じく workers-types を入れないため）
  async scheduled(_controller: unknown, env: Bindings): Promise<void> {
    await deleteExpiredSessions(getDb(env));
  },
};
