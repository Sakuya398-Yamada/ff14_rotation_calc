import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

const port = 3000;
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
