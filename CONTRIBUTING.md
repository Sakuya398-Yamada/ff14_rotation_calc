# 開発ガイド

このファイルは**人間の開発者向け**のクイックスタートガイドです。Claude Code 向けの詳細規約は `CLAUDE.md` および `.claude/rules/*.md` を参照してください。

> 実ユーザー（ツールを使う側）向けの手引きは [README.md](./README.md) を参照してください。

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

品質チェック（CI）とテスト配信（Cloudflare Pages）を分担しています：

- **CI (GitHub Actions)**: `.github/workflows/ci.yml` が `main` への push / PR / `workflow_dispatch` で起動し、依存インストール → Prismaクライアント生成 → `tsc --noEmit` → `npm test` → `vite build` を実行
- **デプロイ (Cloudflare Pages Git連携)**: Cloudflare Pages 側のGit連携がリポジトリの push / PR を検知し、Cloudflare 上で自動的にビルド＆デプロイ（GitHub Secrets や API トークンは不要）

> 現時点では Cloudflare Pages は **テスト配信用途**。本番の外部公開層としての利用はユーザー数拡大後に切り替える想定です（`.claude/rules/tech-stack.md` 参照）。

### Cloudflare Pages プロジェクトの作成（初回のみ）

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログイン
2. 左メニュー **Workers & Pages** → **Create application** → **Pages** タブ → **Connect to Git** を選択
3. GitHubで認証し、`ff14_rotation_calc` リポジトリを選択して **Begin setup**
4. 以下のビルド設定を入力：
   - **Project name**: `ff14-rotation-calc`
   - **Production branch**: `main`
   - **Framework preset**: `None`
   - **Build command**: `npm ci && npx vite build`
   - **Build output directory**: `dist/client`
   - **Root directory (advanced)**: 空欄のまま
5. **Environment variables (advanced)** を展開し、Production と Preview の両方に次を追加：
   - Variable name: `NODE_VERSION` / Value: `22`
6. **Save and Deploy** で初回ビルドを開始

これで以後、`main` への push は本番（`https://ff14-rotation-calc.pages.dev`）に、PR は preview URL に自動デプロイされます。

### 動作確認手順

1. 初回ビルドが成功し、`https://ff14-rotation-calc.pages.dev` でフロントエンドが表示されることを確認
2. 本PRまたは以降のPRで、Cloudflare Pagesから `Deploy Preview` コメントが付き、preview URLで確認できること
3. GitHub Actions 側（`Test & Build` ジョブ）も緑で通っていること

### トラブルシューティング

- **ビルド失敗（`npm ci`）**: Cloudflare Pages が package-lock.json の Node バージョンと合わない可能性。環境変数 `NODE_VERSION=22` が設定されているか確認
- **ビルド失敗（`tsc` 関連エラー）**: ビルドコマンドは `tsc` を呼ばない（`npx vite build` のみ）ため発生しない想定。GitHub Actions 側の `Type check` ステップで検出される
- **API (/api/*) が404**: 想定通り。Cloudflare Pages は静的ファイルのみを配信するため、Hono バックエンドは Pages では動作しない。API を含む動作確認はローカル or オンプレUbuntu本番側で行う

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

加えて、リポジトリ直下の `.mcp.json` に Claude Code が読み込む MCP サーバー（Playwright 等）を定義しています。

詳細は `CLAUDE.md` を参照してください。

---

## MCP サーバー（Playwright による UI 視覚検証）

リポジトリルートの `.mcp.json` に Playwright MCP (`@playwright/mcp`) を登録しており、Claude Code セッションから `browser_navigate` / `browser_snapshot` / `browser_click` 等のツールでフロントエンドの UI を操作・キャプチャできます。

### 初回セットアップ

Chromium バイナリをダウンロードしておきます（Playwright MCP の初回起動時に `npx` が自動で `@playwright/mcp` を取得するため、別途インストールは不要）。

```bash
# 開発コンテナ内で1回だけ実行
npx playwright install chromium
```

> Dev Container を新規ビルドした場合は再度実行が必要です。

### 利用フロー

1. 別ターミナルでフロントエンドを起動：
   ```bash
   npm run dev:client
   ```
2. Claude Code セッションから MCP ツールを呼び出す（例）：
   - `browser_navigate` で `http://localhost:5173` を開く
   - `browser_snapshot` でアクセシビリティツリー／スクリーンショットを取得
   - `browser_click` でスキルボタン等を操作

### 接続確認

Claude Code セッションで `ToolSearch` に `playwright` や `browser_navigate` を投げて該当ツールが返ってくれば接続成功です。返ってこない場合は `.mcp.json` のパスと `@playwright/mcp` のインストール可否を確認してください。
