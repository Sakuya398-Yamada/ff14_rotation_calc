# 技術スタック

`.claude/rules/` 配下のため起動時に自動で読み込まれる。

## レイヤー構成

| レイヤー | 技術 | 備考 |
|---------|------|------|
| 言語 | TypeScript | フロント・バックエンド統一 |
| フロントエンド | React + Vite | SPA構成 |
| バックエンド | Hono (Cloudflare Workers) | 軽量・Web標準準拠。フロントと同じ Worker で動かす（エントリ: `src/server/index.ts`、設定: `wrangler.jsonc`） |
| DB | SQLite | Prismaで抽象化（クラウド移行時にPostgreSQL等に切替可） |
| ORM | Prisma | 型安全なDB操作 |
| テスト | Vitest | `npm test` で実行 |
| CI | GitHub Actions | `.github/workflows/ci.yml`（常駐量の予算検査・型チェック・テスト・ビルド・`wrangler deploy --dry-run`） |
| 配信 | Cloudflare Workers + Static Assets（Workers Builds の Git 連携） | `main` を本番に、PR をプレビュー URL にデプロイ（Worker 名: `ff14-rotation-calc`、トークン不要）。手順は `CONTRIBUTING.md`「CI / Cloudflare Workers 配信」 |
| ローカル実行 | `@cloudflare/vite-plugin` | `npm run dev` で Vite のフロントと Worker（API）を同じオリジンで動かす |
| UI視覚検証 | Playwright MCP (`@playwright/mcp`) | Claude Code セッション (Claude Desktop) から `browser_navigate` 等でフロントエンド操作・スクリーンショット取得。ローカルは Windows 標準の Microsoft Edge、クラウドセッションはイメージの Chromium を使用（リポジトリ直下 `.mcp.json` に `--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}` で登録） |
| Issue/PR操作 | GitHub MCP (`github/github-mcp-server` Go バイナリ) または `gh` CLI | Issue / PR の取得・作成・コメント・ラベル付与・sub-issue 紐づけを Claude Code セッションから直接操作。リポジトリ直下 `.mcp.json` に stdio 登録。PAT は OS ユーザー環境変数 `GITHUB_PERSONAL_ACCESS_TOKEN` から `${...}` 展開（設定手順は `CONTRIBUTING.md`「MCP サーバー（GitHub MCP による Issue/PR 操作）」、フォールバックは `.claude/rules/mcp-setup.md`） |

## 開発環境

- **Windows 11 ローカル開発** を前提とする
- **Claude Code のクラウドセッション**（Linux）でも開発できる。依存（`npm ci`・`prisma generate`）は SessionStart hook `.claude/hooks/session-start-cloud-deps.sh` が `CLAUDE_CODE_REMOTE=true` のときだけ入れる。クラウド環境の環境変数に `NODE_ENV=production` は入れない（devDependencies が入らなくなる）。MCP の違いは `mcp-setup.md`「クラウドセッションでの差分」
- 必要ツール: Node.js (v22 以上推奨, CIは v22)、npm、git、bash（Git Bash）、Microsoft Edge（Playwright MCP 用、Windows 11 標準）
- hooks が JSON パースに `jq` を使う（無ければ `node` か `python3` にフォールバック。どれも無いと git のブランチ・コミット系のコマンドが止まる）
- 任意ツール: `github-mcp-server` バイナリ（GitHub MCP 用、インストール手順は `CONTRIBUTING.md`「MCP サーバー（GitHub MCP による Issue/PR 操作）」）、`gh` CLI（MCP 未接続時のフォールバック）
- ネイティブモジュール (better-sqlite3 等) は基本 prebuilt バイナリで導入されるため、Visual Studio Build Tools は通常不要。フォールバック時のみ必要
- DB は SQLite ファイル (`dev.db`) をリポジトリ直下に配置（gitignore 済み）

## インフラ構成（本番）

```
[ブラウザ] → [Cloudflare Worker: ff14-rotation-calc]
               ├ /api/*  → Hono（src/server/index.ts）
               └ それ以外 → Static Assets（dist/client。未知のパスは index.html）
```

- 配信 URL: `https://ff14-rotation-calc.forestry-for.workers.dev`（独自ドメインは使わない）
- `vite build` はフロントを `dist/client` に、Worker を `dist/ff14_rotation_calc` に出力し、デプロイ用の設定 `dist/ff14_rotation_calc/wrangler.json` を生成する。Vite の `root` が `src/client` なので、リポジトリ直下の `wrangler deploy` はこの生成設定を自動では見つけない。デプロイは `npm run deploy`（`--config` で生成設定を指定）を使う

## よく使うコマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | フロントと API（Worker）を同じオリジンで起動（port 5173） |
| `npm run build` | フロントと Worker をビルド（`dist/`） |
| `npm run deploy` | ビルド済みの `dist/` を本番にデプロイ（Workers Builds が実行。`-- --dry-run` でアップロードせず検証） |
| `npm run deploy:preview` | ビルド済みの `dist/` をプレビューにデプロイ（ローカルから手で作るとき用。Workers Builds の Preview command は `npx wrangler preview --config dist/ff14_rotation_calc/wrangler.json` を直接書く。Worker Previews は Preview command が `npx wrangler preview` を呼ぶことを求めるため。#487） |
| `npm run db:migrate` | Prismaマイグレーション適用 |
| `npm run db:generate` | Prismaクライアント生成 |
| `npm test` | Vitest 一括実行 |
| `npm run test:watch` | Vitest watchモード |
| `python3 .claude/scripts/check-context-budget.py` | CLAUDE.md と `paths:` なし rules の常駐量が予算（1000 行）以内か検査（CI でも実行。`--limit N` で閾値を上書き） |

> `npm run dev` 1 つでフロントと `/api/*` が同じオリジンから応答する（Vite の中で Worker を workerd 上で動かす）。
