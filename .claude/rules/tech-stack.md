# 技術スタック

このファイルは CLAUDE.md から `@.claude/rules/tech-stack.md` でインポートされる。

## レイヤー構成

| レイヤー | 技術 | 備考 |
|---------|------|------|
| 言語 | TypeScript | フロント・バックエンド統一 |
| フロントエンド | React + Vite | SPA構成 |
| バックエンド | Hono (Node.js) | 軽量・Web標準準拠 |
| DB | SQLite | Prismaで抽象化（クラウド移行時にPostgreSQL等に切替可） |
| ORM | Prisma | 型安全なDB操作 |
| テスト | Vitest | `npm test` で実行 |
| CI | GitHub Actions | `.github/workflows/ci.yml`（型チェック・テスト・ビルド検証） |
| テスト配信 | Cloudflare Pages（Git連携） | Pages 自身が repo を監視しフロントエンドを自動ビルド＆配信（プロジェクト名: `ff14-rotation-calc`、トークン不要） |
| 本番デプロイ | pm2 or systemd + Nginx | オンプレUbuntu + Cloudflare（CDN/DNS層） |
| UI視覚検証 | Playwright MCP (`@playwright/mcp`) | Claude Code セッション (Claude Desktop) から `browser_navigate` 等でフロントエンド操作・スクリーンショット取得。Windows 標準の Microsoft Edge を使用（リポジトリ直下 `.mcp.json` に `--browser msedge` で登録） |

## 開発環境

- **Windows 11 ローカル開発** を前提とする
- 必要ツール: Node.js (v22 以上推奨, CIは v22)、npm、git、Microsoft Edge（Playwright MCP 用、Windows 11 標準）
- ネイティブモジュール (better-sqlite3 等) は基本 prebuilt バイナリで導入されるため、Visual Studio Build Tools は通常不要。フォールバック時のみ必要
- DB は SQLite ファイル (`dev.db`) をリポジトリ直下に配置（gitignore 済み）

## インフラ構成（本番）

```
[Cloudflare] → [Nginx (リバースプロキシ)] → [Node.js (Hono API + Vite静的配信)]
                                                    ↓
                                              [SQLite ファイル]
```

- ホスティング: オンプレミスUbuntuサーバー
- 外部公開: Cloudflare経由
- クラウド移行: Prismaの DB設定変更で対応可能

## npm スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | Honoバックエンドサーバー起動（port 3000） |
| `npm run dev:client` | Viteフロントエンド開発サーバー起動（port 5173） |
| `npm run db:migrate` | Prismaマイグレーション適用 |
| `npm run db:generate` | Prismaクライアント生成 |
| `npm test` | Vitest 一括実行 |
| `npm run test:watch` | Vitest watchモード |

> 開発時はバックエンド (`npm run dev`) とフロントエンド (`npm run dev:client`) を別ターミナルで同時起動する。Vite開発サーバーは `/api/*` への要求をバックエンド (port 3000) にプロキシする。
