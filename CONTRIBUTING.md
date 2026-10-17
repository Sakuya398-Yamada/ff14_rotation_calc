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
| 新規ジョブの追加手順（スキル/バフ/リソース定義・登録・アイコン配置） | `docs/job-addition-guide.md` |

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
npm run dev          # フロントと API（Worker）を同じオリジンで起動 (port 5173)
npm test             # Vitest 一括実行
npm run test:watch   # Vitest watch モード
npm run build        # フロントと Worker をビルド (dist/)
```

> **Note**: `npm run dev` 1 つで、フロントと `/api/*`（Hono）が `http://localhost:5173` から応答します。`@cloudflare/vite-plugin` が Vite の中で Worker を workerd 上で動かすため、別プロセスのバックエンドやプロキシは不要です。疎通確認は `http://localhost:5173/api/health`（`{"status":"ok"}`）。

---

## CI / Cloudflare Workers 配信

品質チェック（CI）と配信（Cloudflare Workers）を分担しています：

- **CI (GitHub Actions)**: `.github/workflows/ci.yml` が `main` への push / PR / `workflow_dispatch` で起動し、依存インストール → Prismaクライアント生成 → `tsc --noEmit` → `npm test` → `npm run build` → `npm run deploy -- --dry-run` を実行
- **デプロイ (Workers Builds の Git 連携)**: Cloudflare の Workers Builds がリポジトリの push / PR を検知し、Cloudflare 上でビルドしてデプロイ（GitHub Secrets や API トークンは不要）。`main` は本番に、PR のブランチはプレビュー URL にデプロイされる
- フロント（Static Assets）と Hono の API は同じ Worker `ff14-rotation-calc` から配信する。`/api/*` は Worker が先に処理し、それ以外は `dist/client` の静的ファイル（未知のパスは `index.html`）を返す（`wrangler.jsonc`）

> 旧配信の Cloudflare Pages プロジェクト `ff14-rotation-calc`（`https://ff14-rotation-calc.pages.dev`）は、Workers で本番・プレビューが動くのを確かめるまで並行稼働させます。確認できたら、ダッシュボードの **Workers & Pages** → Pages プロジェクト → **Settings** から削除してください。

### Workers Builds の設定（初回のみ）

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログイン
2. 左メニュー **Workers & Pages** → **Create application** → **Import a repository** を選択
3. GitHub で認証し、`ff14_rotation_calc` リポジトリを選択
4. 以下の設定を入力：
   - **Project name（Worker 名）**: `ff14-rotation-calc`（`wrangler.jsonc` の `name` と一致させる。違うとビルドが失敗する）
   - **Build command**: `npm run build`
   - **Deploy command**: `npm run deploy`
   - **Preview command**（本番ブランチ以外。**Builds for non-production branches** / **Enable Preview Builds** を有効にする）: `npm run deploy:preview`
   - **Root directory**: 空欄（`/`）のまま
5. **Build variables and secrets** に `NODE_VERSION` = `22` を追加（Workers Builds の既定は Node.js 24。CI と揃える）
6. **Deploy** で初回ビルドを開始

これで以後、`main` への push は本番（`https://ff14-rotation-calc.<アカウントのサブドメイン>.workers.dev`）に、PR はプレビュー URL に自動デプロイされます。

> **デプロイコマンドを既定の `npx wrangler deploy` のままにしない**: Vite の `root` が `src/client` のため、`vite build` が作るデプロイ用の設定（`dist/ff14_rotation_calc/wrangler.json`）をリポジトリ直下の `wrangler` は自動で見つけられず、`assets` に `directory` が無いというエラーで失敗します。`npm run deploy` / `npm run deploy:preview` は `--config` でこの生成設定を指定しています。

### 動作確認手順

1. 初回ビルドが成功し、本番 URL でフロントエンドが表示され、`/api/health` が `{"status":"ok"}` を返すことを確認
2. PR を作ると、Workers Builds からプレビュー URL のコメントが付き、その URL で確認できること
3. GitHub Actions 側（`Test & Build` ジョブ）も緑で通っていること

### トラブルシューティング

- **ビルド失敗（`npm ci`）**: Node のバージョンが合っていない可能性。ビルド用の環境変数 `NODE_VERSION=22` が設定されているか確認
- **ビルド失敗（Worker 名の不一致）**: ダッシュボードの Worker 名と `wrangler.jsonc` の `name`（`ff14-rotation-calc`）が一致しているか確認
- **デプロイ失敗（`The assets property ... is missing the required directory property`）**: デプロイコマンドが `npx wrangler deploy` のままになっている。上記のとおり `npm run deploy`（プレビューは `npm run deploy:preview`）にする
- **ビルド失敗（`tsc` 関連エラー）**: ビルドコマンドは `tsc` を呼ばない（`vite build` のみ）ため発生しない想定。GitHub Actions 側の `Type check` ステップで検出される

---

## Claude Code 環境

このリポジトリには Claude Code 用の構成が含まれています：

```
.claude/
├── agents/      # サブエージェント定義（code-explorer, code-architect, code-reviewer）
├── rules/       # 詳細規約（Claude Code が起動時に自動で読み込む）
├── hooks/       # PreToolUse / SessionStart 用シェルスクリプト
├── settings.json # フック設定
└── skills/      # スラッシュ起動可能なスキル（/issue-start, /issue-plan, /dev-plan）
```

加えて、リポジトリ直下の `.mcp.json` に Claude Code が読み込む MCP サーバー（Playwright 等）を定義しています。

セッション開始時には SessionStart hook（`.claude/hooks/session-start-info.sh`）がリポジトリ状態のバナーを出します。バナーの `## Template version` は、`.claude/template-version` の版とテンプレート元（issue-driven-dev-starter）の最新リリースを比べた結果です（最新リリースは毎回取得し、取得に失敗したときだけ前回の結果を `cached` と付けて使う。前回の結果も無ければ `unknown`）。新しい版があれば `/issue-start` が更新用 Issue の起票を一度だけ提案します。取り込み手順は `.claude/skills/template-update/SKILL.md`（`/template-update`）を参照してください。

Claude Code のクラウドセッション（claude.ai/code など）では、もう 1 つの SessionStart hook（`.claude/hooks/session-start-cloud-deps.sh`）が `npm ci` と `npx prisma generate` を実行します（`CLAUDE_CODE_REMOTE=true` のときだけ動き、ローカルでは何もしません）。

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
  "${PLAYWRIGHT_MCP_BROWSER:-msedge}"
]
```

ローカルでは環境変数 `PLAYWRIGHT_MCP_BROWSER` を設定しないので、Windows 11 標準の **Microsoft Edge** を使用します。クラウドセッションでは、クラウド環境の環境変数に `PLAYWRIGHT_MCP_BROWSER=chromium` と `PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を設定し、イメージに入っている Chromium を使います（`.claude/skills/playwright-mcp/SKILL.md`「クラウドセッション」）。

### 初回セットアップ

特別なブラウザ配備は不要です。Windows 11 に Microsoft Edge がインストールされていれば（標準で入っています）追加ダウンロードなしで動作します。

`@playwright/mcp` 自体は `npx -y` で都度取得されるため、明示的なグローバルインストールも不要です（初回 npx 実行時にキャッシュされます）。

### 利用フロー

1. 別 PowerShell タブで開発サーバーを起動：
   ```powershell
   npm run dev
   ```
2. Claude Desktop セッションから MCP ツールを呼び出す（例）：
   - `browser_navigate` で `http://localhost:5173` を開く
   - `browser_snapshot` でアクセシビリティツリー／スクリーンショットを取得
   - `browser_click` でスキルボタン等を操作

### 接続確認

Claude Desktop セッションで `ToolSearch` に `mcp__playwright__browser_navigate` を投げて該当ツールが返ってくれば接続成功です。返ってこない場合は以下を確認してください：

- `.mcp.json` の playwright エントリが `--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}` を指しているか
- `@playwright/mcp` が `npx` で取得可能か（ネットワーク到達性、`npx clear-npx-cache` 後に再試行）
- Claude Desktop を完全終了→再起動（タスクトレイから Quit）して `.mcp.json` を再読み込み

---

## MCP サーバー（GitHub MCP による Issue/PR 操作）

リポジトリルートの `.mcp.json` に GitHub MCP（[`github/github-mcp-server`](https://github.com/github/github-mcp-server)、Go バイナリ）を登録しており、Claude Desktop セッションから Issue / PR の取得・作成・コメント・ラベル付与等を直接操作できます。

### 構成

`.mcp.json` の github エントリ：

```jsonc
"github": {
  "command": "github-mcp-server",
  "args": ["stdio"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
  }
}
```

`@modelcontextprotocol/server-github`（npm 版）は archived のため使いません。

### 初回セットアップ

1. **バイナリのインストール**: [Releases](https://github.com/github/github-mcp-server/releases) から `github-mcp-server_Windows_x86_64.zip` をダウンロードし、任意の永続フォルダ（例: `C:\Tools\github-mcp-server\`）に解凍。解凍先を **ユーザー環境変数 `Path`** に追加
2. **PAT の発行**: GitHub の Settings → Developer settings → Personal access tokens (classic) で発行。最小スコープは `repo` / `read:org`
3. **環境変数の設定**: PowerShell（管理者権限不要）で：
   ```powershell
   [Environment]::SetEnvironmentVariable("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_your_actual_token_here", "User")
   ```
4. **Claude Desktop を完全終了 → 再起動**（タスクトレイから Quit）

詳細手順とトラブルシューティングは `.claude/rules/mcp-setup.md` を参照してください。

### 接続確認

Claude Desktop セッションで `ToolSearch` に `mcp__github__add_issue_comment` 等を投げて該当ツールが返ってくれば接続成功です。返ってこない場合は `mcp-setup.md` のトラブルシューティング表を参照してください。
