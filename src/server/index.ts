import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { skills } from "./routes/skills.js";

const app = new Hono();

app.route("/api/skills", skills);

const port = 3000;
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
