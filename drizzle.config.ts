import { defineConfig } from "drizzle-kit";

// 出力先は wrangler.jsonc の d1_databases の migrations_dir と揃える（wrangler d1 migrations apply がそのまま読む）
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./migrations",
});
