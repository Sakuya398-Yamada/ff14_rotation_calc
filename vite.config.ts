import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare({ configPath: "../../wrangler.jsonc" })],
  root: "src/client",
  server: {
    port: 5173,
  },
  build: {
    // プラグインが環境ごとに dist/client（フロント）と dist/ff14_rotation_calc（Worker）へ分けて出力する
    outDir: "../../dist",
  },
});
