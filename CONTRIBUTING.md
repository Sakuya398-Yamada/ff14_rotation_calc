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

実装完了後、Issueに紐づいたPRを作成します。PRの本文に `closes #<issue番号>` が含まれます（マージ後に行う完了条件が残る Issue では `refs #<issue番号>` にし、残りを終えてから手でクローズします）。

### 5. 最終確認 & マージ（ユーザー）

ユーザーがPRの内容を確認し、承認・マージします。マージによりIssueが自動クローズされます。

---

## 規約の参照先

詳細は以下のファイルを参照してください：

| 内容 | ファイル |
|------|---------|
| ブランチ命名・コミットメッセージ・PR・Issue規約 | `.claude/rules/git-conventions.md` |
| TypeScript / React / Hono / Drizzle のコーディング規約 | `.claude/rules/coding-standards.md` |
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
| Visual Studio Build Tools | 通常不要 | better-sqlite3（テストで使う）等のネイティブモジュールが prebuilt 失敗時のみ |
| GitHub CLI (`gh`) | 推奨 | Issue/PR 操作。`winget install GitHub.cli` |

### 初回セットアップ

```powershell
# 依存インストール
npm install

# ローカルの D1（リポジトリ直下の .wrangler/state）にマイグレーションを適用
npm run db:migrate
```

### 日常開発コマンド

```powershell
npm run dev          # フロントと API（Worker）を同じオリジンで起動 (port 5173)
npm test             # Vitest 一括実行
npm run test:watch   # Vitest watch モード
npm run build        # フロントと Worker をビルド (dist/)
```

> **Note**: `npm run dev` 1 つで、フロントと `/api/*`（Hono）が `http://localhost:5173` から応答します。`@cloudflare/vite-plugin` が Vite の中で Worker を workerd 上で動かすため、別プロセスのバックエンドやプロキシは不要です。疎通確認は `http://localhost:5173/api/health`（`{"status":"ok"}`）。

### DB（Cloudflare D1 + Drizzle ORM）

テーブルは `src/server/db/schema.ts` に Drizzle で定義し、マイグレーションの SQL は drizzle-kit で生成して `migrations/` にコミットします。

```powershell
npm run db:generate -- --name <変更内容>   # schema.ts の変更からマイグレーションを生成（migrations/ に SQL と meta/ が増える）
npm run db:migrate                        # ローカルの D1 に適用
```

- 生成した SQL は手で編集しない。`wrangler d1 migrations create` も使わない（drizzle-kit の `migrations/meta/_journal.json` とずれ、テストが新しいマイグレーションを当てなくなる）
- ローカルの D1 は `npm run dev`（`vite.config.ts` の `persistState`）と wrangler CLI（`npx wrangler d1 execute DB --local --command "..."` 等）が同じ `.wrangler/state` を使う
- テストは D1 ではなく better-sqlite3 のメモリ上の DB に同じマイグレーションを当てる（例: `src/server/db/__tests__/timelines.test.ts`）
- 本番の D1 には、`main` のデプロイ（`npm run deploy`）がデプロイの前に適用する（後述「本番 D1 とビルド用トークン」）

---

## CI / Cloudflare Workers 配信

品質チェック（CI）と配信（Cloudflare Workers）を分担しています：

- **CI (GitHub Actions)**: `.github/workflows/ci.yml` が `main` への push / PR / `workflow_dispatch` で起動し、常駐量の予算検査（`.claude/scripts/check-context-budget.py`）→ 依存インストール → `tsc --noEmit` → `npm test` → `npm run build` → `npx wrangler deploy --config dist/ff14_rotation_calc/wrangler.json --dry-run` を実行（`npm run deploy` は本番 D1 へのマイグレーション適用を含むので、CI はデプロイの部分だけを dry-run する）
- **デプロイ (Workers Builds の Git 連携)**: Cloudflare の Workers Builds がリポジトリの push / PR を検知し、Cloudflare 上でビルドしてデプロイ（GitHub Secrets は不要。本番 D1 にマイグレーションを当てるため、Cloudflare 側のビルド用 API トークンに D1 の編集権限が要る。後述「本番 D1 とビルド用トークン」）。`main` は本番に、PR のブランチはプレビュー URL にデプロイされる
- フロント（Static Assets）と Hono の API は同じ Worker `ff14-rotation-calc` から配信する。`/api/*` は Worker が先に処理し、それ以外は `dist/client` の静的ファイル（未知のパスは `index.html`）を返す（`wrangler.jsonc`）

### Workers Builds の設定（初回のみ）

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログイン
2. 左メニュー **Workers & Pages** → **Create application** → **Import a repository** を選択
3. GitHub で認証し、`ff14_rotation_calc` リポジトリを選択
4. 以下の設定を入力：
   - **Project name（Worker 名）**: `ff14-rotation-calc`（`wrangler.jsonc` の `name` と一致させる。違うとビルドが失敗する）
   - **Build command**: `npm run build`
   - **Deploy command**: `npm run deploy`（本番 D1 へのマイグレーション適用 → デプロイ）
   - **Preview command**（本番ブランチ以外。**Enable Preview Builds** を有効にする）: `npx wrangler preview --config dist/ff14_rotation_calc/wrangler.json`
   - **Root directory**: 空欄（`/`）のまま
5. **Build variables and secrets** に `NODE_VERSION` = `22` を追加（Workers Builds の既定は Node.js 24。CI と揃える）
6. **Deploy** で初回ビルドを開始

これで以後、`main` への push は本番（`https://ff14-rotation-calc.forestry-for.workers.dev`）に、PR はプレビュー URL に自動デプロイされます。

> **Preview command では `wrangler preview` を直接呼ぶ**: PR にプレビュー URL をコメントするのは Worker Previews の機能で、Workers Builds は独自の Preview command にも `npx wrangler preview` を呼ぶことを求めています。以前は Worker Previews に切り替えないまま Preview command を `npm run deploy:preview`（npm スクリプト）にしていて、プレビュー自体は作られたのにコメントにプレビュー URL が出なかった（#487）。`package.json` の `deploy:preview` は、ローカルから手でプレビューを作るとき用です。
>
> **Worker Previews 以前から Builds に繋いでいた Worker の場合**: **Settings** → **Builds** に **Set up Worker Previews** のバナーが出ていたら、**Set up** から一度だけ切り替える（元の方式には戻せない）。確認ダイアログで Previews 用の変数・シークレット・バインディングを聞かれるが、空のまま進めてよい（Previews は本番の設定を引き継がず、`wrangler.jsonc` の `previews` に書いたものだけが付く）。D1 の `DB` は今は本番だけで、プレビューには付かない。プレビューのビルドログに出る「These bindings are configured for your production Worker but not for Previews: DB」は想定どおり（プレビュー用の D1 は #581 で決める）。切り替えると Preview command が `npx wrangler preview` に置き換わるので、上の `--config` 付きのコマンドに直す（[Cloudflare のドキュメント](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#existing-workers-connected-to-builds)）。

> **デプロイコマンドを既定の `npx wrangler deploy` のままにしない**: Vite の `root` が `src/client` のため、`vite build` が作るデプロイ用の設定（`dist/ff14_rotation_calc/wrangler.json`）をリポジトリ直下の `wrangler` は自動で見つけられず、`assets` に `directory` が無いというエラーで失敗します。`npm run deploy` と上の Preview command は、`--config` でこの生成設定を指定しています。

### 本番 D1 とビルド用トークン（初回のみ）

`npm run deploy` は `npm run db:migrate:remote`（`wrangler d1 migrations apply DB --remote`）でマイグレーションを当ててからデプロイします。マイグレーションが失敗するとデプロイは行われず、旧版が配信され続けます（D1 の Time Travel で直前の状態にも戻せる）。

1. 手元で `npx wrangler login` してから、本番の D1 を作る:

   ```powershell
   npx wrangler d1 create ff14-rotation-calc
   ```

   「設定ファイルに追加するか」を聞かれたら `n` で断る。既定の Yes で進めると、binding 名 `ff14_rotation_calc` の 2 つ目のエントリが足されるだけで、`DB` は仮の ID のまま残る
2. 出力された `database_id` を `wrangler.jsonc` の `d1_databases`（binding `DB`）に書いてコミットする（ID は秘密情報ではない）
3. ビルド用 API トークンに D1 の編集権限を足す。Workers Builds が自動で作るトークン（Worker の **Settings** → **Build** の API token）の権限は Account Settings (read)・Workers Scripts (edit)・Workers KV Storage (edit)・Workers R2 Storage (edit)・Workers Routes (edit)・User Details (read)・Memberships (read) で、D1 が含まれない（[Workers Builds: Configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)）。**My Profile** → **API Tokens** でこのトークンを編集し、既存の権限は残したまま **Account** → **D1** → **Edit** を足す（ビルド用トークンはユーザートークンだけが使える）
4. `main` にマージしたら、Workers Builds のデプロイのログでマイグレーションの適用（`✅`）を確かめ、手元から適用済みであることを見る:

   ```powershell
   npx wrangler d1 migrations list DB --remote   # 「No migrations to apply」なら適用済み
   ```

### 動作確認手順

1. 初回ビルドが成功し、本番 URL でフロントエンドが表示され、`/api/health` が `{"status":"ok"}` を返すことを確認
2. PR を作ると、Workers Builds からプレビュー URL のコメントが付き、その URL で確認できること
3. GitHub Actions 側（`Test & Build` ジョブ）も緑で通っていること

### トラブルシューティング

- **ビルド失敗（`npm ci`）**: Node のバージョンが合っていない可能性。ビルド用の環境変数 `NODE_VERSION=22` が設定されているか確認
- **ビルド失敗（Worker 名の不一致）**: ダッシュボードの Worker 名と `wrangler.jsonc` の `name`（`ff14-rotation-calc`）が一致しているか確認
- **デプロイ失敗（`The assets property ... is missing the required directory property`）**: デプロイコマンドが `npx wrangler deploy` のままになっている。上記のとおり `npm run deploy`（プレビューは `npx wrangler preview --config dist/ff14_rotation_calc/wrangler.json`）にする
- **PR のコメントにプレビュー URL が出ない（「Deploying with Cloudflare Workers」の表に URL の列が無い）**: Worker Previews に切り替わっていないか、Preview command が `wrangler preview` を直接呼んでいない（npm スクリプトで包んでいる等）。上記の注記のとおりに直す
- **プレビューのデプロイ失敗（`Your Wrangler configuration is missing a previews block`）**: `wrangler.jsonc` の `"previews": {}` が消えていないか確認する（#485）
- **デプロイ失敗（`wrangler d1 migrations apply DB --remote` で認証・権限のエラー）**: ビルド用 API トークンに D1 の編集権限が無い。上記「本番 D1 とビルド用トークン」の手順 3 のとおり足す
- **デプロイ失敗（`wrangler d1 migrations apply DB --remote` で D1 が見つからない）**: `wrangler.jsonc` の `database_id` が仮の値（`00000000-...`）のまま、または別アカウントの ID。手順 1・2 のとおり本番 D1 の ID を書く
- **ビルド失敗（`tsc` 関連エラー）**: ビルドコマンドは `tsc` を呼ばない（`vite build` のみ）ため発生しない想定。GitHub Actions 側の `Type check` ステップで検出される

---

## Claude Code 環境

このリポジトリには Claude Code 用の構成が含まれています：

```
.claude/
├── agents/      # サブエージェント定義（code-explorer, code-architect, code-reviewer）
├── rules/       # 詳細規約（Claude Code が起動時に自動で読み込む。frontmatter に paths: があるものは該当ファイルを触ったときだけ）
├── routines/    # スケジュールタスク（定期ルーティン）の手順書（登録側の呼び出し文が実行のたびに読む）
├── hooks/       # PreToolUse / SessionStart 用シェルスクリプト
├── scripts/     # 手で呼ぶ補助スクリプト（知見ボードの読み出し、常駐量の予算検査）
├── settings.json # フック設定
└── skills/      # スラッシュ起動可能なスキル（/issue-start, /issue-plan, /issue-priority, /template-update, /playwright-mcp, /dev-plan 等）
```

加えて、リポジトリ直下の `.mcp.json` に Claude Code が読み込む MCP サーバー（Playwright 等）を定義しています。

セッション開始時には SessionStart hook（`.claude/hooks/session-start-info.sh`）がリポジトリ状態のバナーを出します。バナーの `## Template version` は、`.claude/template-version` の版とテンプレート元（issue-driven-dev-starter）の最新リリースを比べた結果です（最新リリースは毎回取得し、取得に失敗したときだけ前回の結果を `cached` と付けて使う。前回の結果も無ければ `unknown`）。新しい版があれば `/issue-start` が更新用 Issue の起票を一度だけ提案します。取り込み手順は `.claude/skills/template-update/SKILL.md`（`/template-update`）を参照してください。

Claude Code のクラウドセッション（claude.ai/code など）では、もう 1 つの SessionStart hook（`.claude/hooks/session-start-cloud-deps.sh`）が `npm ci` と、ローカルの D1 へのマイグレーション適用（`npx wrangler d1 migrations apply DB --local`）を実行します（`CLAUDE_CODE_REMOTE=true` のときだけ動き、ローカルでは何もしません）。

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

1. **バイナリのインストール**: [Releases](https://github.com/github/github-mcp-server/releases) から `github-mcp-server_Windows_x86_64.zip` をダウンロード（v1.0.3 以降を推奨）し、任意の永続フォルダ（例: `C:\Tools\github-mcp-server\`）に解凍。解凍先を **ユーザー環境変数 `Path`** に追加（PowerShell・管理者権限不要）：
   ```powershell
   $tool = "C:\Tools\github-mcp-server"
   $current = [Environment]::GetEnvironmentVariable("Path", "User")
   if ($current -notlike "*$tool*") {
     [Environment]::SetEnvironmentVariable("Path", "$current;$tool", "User")
   }
   ```
   **新しい PowerShell を開いて** `github-mcp-server --version` で動作確認します。PATH に追加せず `.mcp.json` でフルパス指定（`"command": "C:\\Tools\\github-mcp-server\\github-mcp-server.exe"`）にしてもよいですが、マシンごとに差が出るので推奨しません
2. **PAT の発行**: GitHub の [Settings → Developer settings → Personal access tokens (classic)](https://github.com/settings/tokens) で発行。スコープは `repo`（プライベートリポジトリの Issue/PR 操作）/ `read:org`（組織情報の読み取り）、必要に応じて `gist`
3. **環境変数の設定**: PowerShell（管理者権限不要）で：
   ```powershell
   [Environment]::SetEnvironmentVariable("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_your_actual_token_here", "User")
   ```
4. **Claude Desktop を完全終了 → 再起動**（タスクトレイから Quit）

PAT を削除する場合：

```powershell
[Environment]::SetEnvironmentVariable("GITHUB_PERSONAL_ACCESS_TOKEN", $null, "User")
```

### 接続確認

Claude Desktop セッションで `ToolSearch` に `mcp__github__add_issue_comment` 等を投げて該当ツールが返ってくれば接続成功です。返ってこない場合は「MCP サーバーのトラブルシューティング」を参照してください。

---

## MCP サーバー（Brave Search による外部情報検索）

リポジトリルートの `.mcp.json` に Brave Search MCP（`@modelcontextprotocol/server-brave-search`）を登録しており、FF14 公式ジョブガイド等の外部情報を Claude Code セッションから検索できます。

### 構成

`.mcp.json` の brave-search エントリ：

```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "${BRAVE_API_KEY}"
  }
}
```

`.mcp.json` は `${VAR}` 形式で OS 環境変数を展開します（[公式仕様](https://code.claude.com/docs/en/mcp)）。生の API キーを `.mcp.json` に書いて commit しないでください。`BRAVE_API_KEY` が未定義だと、展開されない `${BRAVE_API_KEY}` の文字列のままサーバーに渡ります。設定の読み込みもサーバーの起動も止まらず、`claude mcp list` と `/mcp` に警告が出るだけなので、サーバーは起動したうえで検索の呼び出しが認証エラー（`422 SUBSCRIPTION_TOKEN_INVALID`）になります。他の MCP サーバーやセッション全体には影響しません。

### 初回セットアップ

1. **API キーの取得**: [Brave Search API](https://brave.com/search/api/) でアカウント登録し、無料プラン（Free: 月2,000クエリ、1 req/sec）を選択して、ダッシュボードから API キーを発行
2. **環境変数の設定**: PowerShell（一般ユーザー権限）でユーザー環境変数として永続的に設定：
   ```powershell
   [Environment]::SetEnvironmentVariable("BRAVE_API_KEY", "BSA_your_actual_key_here", "User")
   ```
   スコープの `"User"` はユーザーホーム配下に永続化（管理者権限不要）、`"Machine"` はシステム全体（管理者権限が必要）、`"Process"` は現在のシェルだけ（再起動で消える）です
3. **新しい PowerShell を開いて** `[Environment]::GetEnvironmentVariable("BRAVE_API_KEY","User")` で設定値を確認
4. **Claude Desktop を完全終了 → 再起動**（タスクトレイから Quit）。Claude Desktop は起動時に環境変数を読み込むため、再起動しないと既存プロセスは古い値のままです

API キーを削除する場合：

```powershell
[Environment]::SetEnvironmentVariable("BRAVE_API_KEY", $null, "User")
```

### 接続確認

再起動後の新しいセッションで `ToolSearch` に `select:mcp__brave-search__brave_web_search` を投げてツールが返り、実際に検索して結果が返れば成功です。ツールは返るのに検索が `422 SUBSCRIPTION_TOKEN_INVALID` になる場合は、`BRAVE_API_KEY` が Claude Desktop に渡っていません。

---

## MCP サーバーのトラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| `brave_web_search` が `ToolSearch` で見つからない | stdio 起動失敗（`npx` での取得失敗等）。`BRAVE_API_KEY` が未設定でもツールは見つかる（次の行） | `/mcp` で状態を確認 → `failed` なら「`/mcp` で `brave-search` が `failed`」の行の対処 |
| `brave_web_search` を呼ぶと `422 SUBSCRIPTION_TOKEN_INVALID` | `BRAVE_API_KEY` が未設定で `${BRAVE_API_KEY}` の文字列のまま渡っている（`claude mcp list` / `/mcp` に警告が出る）、またはキーが無効 | 「MCP サーバー（Brave Search による外部情報検索）」の初回セットアップ → Claude Desktop 再起動 |
| `/mcp` で `brave-search` が `failed` | npx キャッシュ破損 or ネットワーク | `npx clear-npx-cache` 後、セッション再起動 |
| stdio サーバー（Playwright/Brave/GitHub）が途中で切断 | セッション長時間放置 | Claude Desktop を完全終了 → 再起動（`.claude/skills/playwright-mcp/SKILL.md`「切断時の再接続手順」） |
| `mcp__github__*` ツールが `ToolSearch` で見つからない | `GITHUB_PERSONAL_ACCESS_TOKEN` 未設定、`github-mcp-server` バイナリが PATH に無い、PAT スコープ不足のいずれか | 「MCP サーバー（GitHub MCP による Issue/PR 操作）」の初回セットアップを実施 → Claude Desktop 再起動 |
| `github-mcp-server` 実行時に `401 Unauthorized` | PAT が無効 or スコープ不足 | PAT を再発行し `repo` / `read:org` を付与 → 環境変数を再設定 → Claude Desktop 再起動 |
