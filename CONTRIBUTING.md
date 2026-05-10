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
| Claude Code のコード読解方針（Stream idle timeout 対策） | `.claude/rules/context-efficiency.md` |
| Issue駆動開発の Phase別手順 | `.claude/skills/issue-start/SKILL.md` |

---

## ローカル開発

**Windows 11 ローカル**で開発します。

### 必要ツール

| ツール | バージョン目安 | 備考 |
|--------|---------------|------|
| Node.js | v22 以上推奨（CIは v22） | `node --version` で確認 |
| npm | Node 同梱 | `npm --version` |
| git | 任意の新しめ | コミット規約は hook で検証 |
| Microsoft Edge | Windows 11 標準 | Playwright MCP の UI 検証用 |
| Visual Studio Build Tools | 通常不要 | better-sqlite3 等のネイティブモジュールが prebuilt 失敗時のみ |
| GitHub CLI (`gh`) | 推奨 | Issue/PR 操作。`winget install GitHub.cli` |

### 初回セットアップ

```powershell
# 依存インストール
npm install

# .env を作成（DATABASE_URL を Prisma に渡すため）
"DATABASE_URL=`"file:./dev.db`"" | Out-File -FilePath .env -Encoding utf8

# Prisma クライアント生成
npm run db:generate

# DB マイグレーション適用（dev.db が無ければ作成される）
npm run db:migrate
```

> **Note (Prisma drift)**: `prisma/schema.prisma` にモデル未定義のため `npm run db:migrate` の最後で「新マイグレーション名」を聞かれることがあります。Ctrl+C で抜けて構いません（既存マイグレーションは適用済み）。再適用だけしたい時は `npx prisma migrate deploy` が安全。

### 日常開発コマンド

```powershell
npm run dev          # Hono バックエンド (port 3000)
npm run dev:client   # Vite フロントエンド (port 5173)
npm test             # Vitest 一括実行
npm run test:watch   # Vitest watch モード
```

> **Note**: 開発時はバックエンド (`npm run dev`) とフロントエンド (`npm run dev:client`) を別 PowerShell タブで同時に起動してください。Vite 開発サーバーは `/api/*` への要求をバックエンド (port 3000) にプロキシします。

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

リポジトリルートの `.mcp.json` に Playwright MCP (`@playwright/mcp`) を登録しており、Claude Desktop セッションから `browser_navigate` / `browser_snapshot` / `browser_click` 等のツールでフロントエンドの UI を操作・キャプチャできます。

### 構成

`.mcp.json` の playwright エントリ（抜粋）：

```jsonc
"args": [
  "-y",
  "@playwright/mcp@latest",
  "--browser",
  "msedge"
]
```

Windows 11 標準の **Microsoft Edge** を使用します。`@playwright/mcp@latest` の `--browser` は `chrome | firefox | webkit | msedge` のみを受け付け、旧 `chromium` 指定は廃止されています。

### 初回セットアップ

特別なブラウザ配備は不要です。Windows 11 に Microsoft Edge がインストールされていれば（標準で入っています）追加ダウンロードなしで動作します。

`@playwright/mcp` 自体は `npx -y` で都度取得されるため、明示的なグローバルインストールも不要です（初回 npx 実行時にキャッシュされます）。

### 利用フロー

1. 別 PowerShell タブでフロントエンドを起動：
   ```powershell
   npm run dev:client
   ```
2. Claude Desktop セッションから MCP ツールを呼び出す（例）：
   - `browser_navigate` で `http://localhost:5173` を開く
   - `browser_snapshot` でアクセシビリティツリー／スクリーンショットを取得
   - `browser_click` でスキルボタン等を操作

### 接続確認

Claude Desktop セッションで `ToolSearch` に `mcp__playwright__browser_navigate` を投げて該当ツールが返ってくれば接続成功です。返ってこない場合は以下を確認してください：

- `.mcp.json` の playwright エントリが `--browser msedge` を指しているか
- `@playwright/mcp` が `npx` で取得可能か（ネットワーク到達性、`npx clear-npx-cache` 後に再試行）
- Claude Desktop を完全終了→再起動（タスクトレイから Quit）して `.mcp.json` を再読み込み
