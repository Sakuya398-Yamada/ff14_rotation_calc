import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { Bindings } from "./env";
import { createMyTimelinesRoute, createTimelinesRoute } from "./routes/timelines";

const app = new Hono<{ Bindings: Bindings }>();
const getDb = (env: Bindings) => drizzle(env.DB);

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/timelines", createTimelinesRoute(getDb));
app.route("/api/me/timelines", createMyTimelinesRoute(getDb));

export default app;
