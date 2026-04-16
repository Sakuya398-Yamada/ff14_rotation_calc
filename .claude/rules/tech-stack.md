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
| デプロイ | pm2 or systemd + Nginx | オンプレUbuntu + Cloudflare |

## 開発環境

- WSL（Windows Subsystem for Linux）上に **開発コンテナ（Dev Container）** を作成して開発する
- コンテナ内に Node.js、SQLite等の依存をすべて閉じ込め、環境差異を排除する

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
