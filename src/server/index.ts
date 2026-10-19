import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { Bindings } from "./env";
import { createTimelinesRoute } from "./routes/timelines";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/timelines", createTimelinesRoute((env) => drizzle(env.DB)));

export default app;
