import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { Bindings } from "./env";
import { createMyTimelinesRoute, createTimelinesRoute } from "./routes/timelines";

const app = new Hono<{ Bindings: Bindings }>();
const getDb = (env: Bindings) => drizzle(env.DB);

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/timelines", createTimelinesRoute(getDb));
app.route("/api/me/timelines", createMyTimelinesRoute(getDb));

// /en/ 配下は run_worker_first で Worker に来る。SPA のフォールバックはルートの index.html（日本語）を返すので、英語の HTML を返す。
// /en/index.html を取ると html_handling が /en へ 307 で戻すので、/en/ を取る。/en/ 配下にほかのアセットは無い
app.get("/en/*", (c) => c.env.ASSETS.fetch(new Request(new URL("/en/", c.req.url), c.req.raw)));

export default app;
