# 開発ガイド

このファイルは**人間の開発者向け**のクイックスタートガイドです。Claude Code 向けの詳細規約は `CLAUDE.md` および `.claude/rules/*.md` を参照してください。

## 開発方式

本プロジェクトはIssue駆動開発を採用しています。

- **ユーザー**がGitHub Issueを作成し、要件や仕様を定義する
- **Claude Code**がIssueの内容に基づいてコーディングを行う
- 設計書・定義書などのドキュメントはIssueに紐づけて管理する
- Claude Code は必要に応じてIssueに情報を記載し、過去のIssueから情報を参照する

## 開発フロー

```
1. Issue作成（ユーザー）
2. Claude Code起動 & Issue指定（ユーザー）
3. ブランチ作成 & 実装（Claude Code）
4. PR作成（Claude Code）
5. 最終確認 & マージ（ユーザー）→ Issue自動クローズ
```

### 1. Issue作成（ユーザー）

GitHub上でIssueを作成します。Issueには以下を含めてください。

- **背景・目的**: なぜこの作業が必要か
- **要件**: やること／やらないこと
- **完了条件（DoD）**: チェックリスト形式

設計書や定義書は、Issueの本文・コメントに直接記載するか、別ドキュメントへのリンクを貼り付けてください。

### 2. Claude Code起動 & Issue指定（ユーザー）

Claude Code を起動し、作業対象のIssueを指定します。

```
/issue-start #<番号>
```

### 3. ブランチ作成 & 実装（Claude Code）

Claude Code がIssueの内容を読み取り、以下を行います。

1. Issueの要件・設計・定義、および関連する過去のIssueを確認
2. 規約に沿ったブランチを作成（hooks による自動検証あり）
3. 実装を進める
4. 必要に応じてIssueにコメントで進捗や技術的な情報を記載

### 4. PR作成（Claude Code）

実装完了後、Issueに紐づいたPRを作成します。PRの本文に `closes #<issue番号>` が含まれます。

### 5. 最終確認 & マージ（ユーザー）

ユーザーがPRの内容を確認し、承認・マージします。マージによりIssueが自動クローズされます。

---

## 規約の参照先

詳細は以下のファイルを参照してください：

| 内容 | ファイル |
|------|---------|
| ブランチ命名・コミットメッセージ・PR・Issue規約 | `.claude/rules/git-conventions.md` |
| TypeScript / React / Hono / Prisma のコーディング規約 | `.claude/rules/coding-standards.md` |
| 技術スタック・npmスクリプト・インフラ構成 | `.claude/rules/tech-stack.md` |
| Issue駆動開発の Phase別手順 | `.claude/skills/issue-start/SKILL.md` |

---

## ローカル開発

WSL上の **開発コンテナ（Dev Container）** で開発します。コンテナ内に Node.js、SQLite等の依存がすべて含まれるため、ローカル環境への個別インストールは不要です。

```bash
# 開発コンテナ内で実行

# 依存インストール
npm install

# Prismaクライアント生成
npm run db:generate

# DBマイグレーション適用
npm run db:migrate

# バックエンドサーバー起動（port 3000）
npm run dev

# フロントエンド開発サーバー起動（port 5173）
npm run dev:client

# テスト実行
npm test
```

> **Note**: 開発時はバックエンド (`npm run dev`) とフロントエンド (`npm run dev:client`) を別ターミナルで同時に起動してください。Vite開発サーバーは `/api/*` への要求をバックエンド (port 3000) にプロキシします。

---

## CI / Cloudflare Pages テスト配信

`main` ブランチへのpushとPRで `.github/workflows/ci.yml` が自動起動し、以下を実行します。

- **全イベント**: 依存インストール → Prismaクライアント生成 → `tsc --noEmit` による型チェック → `npm test` → `vite build` → ビルド成果物をArtifactとしてアップロード
- **`main` へのpush（および `workflow_dispatch`）時のみ**: Artifactを取得して Cloudflare Pages プロジェクト `ff14-rotation-calc` へ `wrangler pages deploy` でデプロイ

> 現時点では Cloudflare Pages は **テスト配信用途**。本番の外部公開層としての利用はユーザー数拡大後に切り替える想定です（`.claude/rules/tech-stack.md` 参照）。

### 必要な GitHub Secrets

CIが Cloudflare Pages へデプロイするには、リポジトリの **Settings → Secrets and variables → Actions** に以下を登録してください。

| Secret名 | 内容 | 取得元 |
|---------|------|-------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン（`Cloudflare Pages:Edit` 権限を付与） | Cloudflare ダッシュボード → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウントID | Cloudflare ダッシュボード → 右サイドバーの `Account ID` |

### Cloudflare Pages プロジェクトの事前作成

初回デプロイ前に、Cloudflare ダッシュボードで以下の Pages プロジェクトを作成してください。

- **プロジェクト名**: `ff14-rotation-calc`
- **Production branch**: `main`
- **ビルド設定**: 「Direct Upload」（CIからのデプロイのためCloudflare側でのビルドは不要）

### CI動作確認手順

1. 上記 Secrets を登録
2. Cloudflare Pages プロジェクトを作成
3. このリポジトリの `main` へ何らかの変更をマージ、または Actions タブから `CI` ワークフローを `workflow_dispatch` で起動
4. `test` ジョブと `deploy-pages` ジョブが緑になり、Cloudflare Pages の `*.pages.dev` URL で配信内容を確認できること

> **注意**: Cloudflare Pages は静的ファイルのみを配信するため、`/api/*`（Hono バックエンド）は Pages 上では動作しません。API を含む動作確認はローカル開発環境か、オンプレUbuntu上の本番系で行ってください。

---

## Claude Code 環境

このリポジトリには Claude Code 用の構成が含まれています：

```
.claude/
├── agents/      # サブエージェント定義（code-explorer, code-architect, code-reviewer）
├── rules/       # CLAUDE.md から @import される詳細規約
├── hooks/       # PreToolUse / SessionStart 用シェルスクリプト
├── settings.json # フック設定
└── skills/      # スラッシュ起動可能なスキル（/issue-start, /dev-plan）
```

詳細は `CLAUDE.md` を参照してください。
