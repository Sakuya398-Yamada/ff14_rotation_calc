/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    // テストは Worker を使わないので workerd を起動しない。起動すると 1 回あたり数秒遅くなり、
    // 同じチェックアウトでの並行実行が workerd の状態やインスペクタのポートを取り合って起動に失敗する（#574）
    !process.env.VITEST &&
      cloudflare({
        configPath: "../../wrangler.jsonc",
        // ローカルの D1 等の保存先。既定は Vite の root（src/client）の下だが、`wrangler d1 migrations apply --local` は
        // wrangler.jsonc の場所（リポジトリ直下）の .wrangler/state を使うので、そちらに揃えて同じ DB を見る（#475）
        persistState: { path: "../../.wrangler/state" },
      }),
  ],
  root: "src/client",
  server: {
    port: 5173,
  },
  build: {
    // プラグインが環境ごとに dist/client（フロント）と dist/ff14_rotation_calc（Worker）へ分けて出力する
    outDir: "../../dist",
  },
  test: {
    // 既定では Vite の root（src/client）の下しか探さないので、src/server のテストも拾えるよう広げる（このパスはカレントディレクトリ基準）
    dir: "src",
    // jsdom の UI テストは getByRole の多用で通常でも 0.1〜0.5 秒かかり、CPU が混むと 10 倍以上に伸びて既定の 5 秒を超える（#565）。
    // 同期のテストはタイムアウトで中断されず、遅すぎたら失敗扱いになるだけ。延ばして失うのは、終わらない非同期テストの検出が遅れることくらい
    testTimeout: 20_000,
  },
});
