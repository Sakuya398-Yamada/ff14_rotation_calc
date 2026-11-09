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
| 本番 D1 のバックアップ（自宅サーバーの cron）と復元（Time Travel / バックアップから） | `docs/d1-backup.md` |
| 削除の依頼（Discord の DM）を受けたときに、本番 D1 から送り主の行を探す手順 | `docs/deletion-requests.md` |

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

# Worker のローカルの secret（Turnstile のテスト用 secret）。.dev.vars は gitignore 済み
Copy-Item .dev.vars.example .dev.vars
```

クラウドセッションでは、SessionStart hook（`.claude/hooks/session-start-cloud-deps.sh`）が `.dev.vars` をコピーします（既にあれば上書きしません）。

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

### 保存時のボット対策（Cloudflare Turnstile）

保存 API（`POST /api/timelines`）は、保存ダイアログのウィジェットが発行したトークンを Turnstile の siteverify で確かめ、不合格なら 403 を返します（#479）。ローカルとテストでは、Cloudflare 公式の [テスト用キー](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) を使います。

| | 渡し方 | ローカルの値 |
|---|---|---|
| sitekey（フロント） | ビルド時の環境変数 `VITE_TURNSTILE_SITE_KEY` | 未設定なら必ず成功するテスト用キー `1x00000000000000000000AA` |
| secret（Worker） | Worker の secret `TURNSTILE_SECRET_KEY`（ローカルは `.dev.vars`） | `.dev.vars.example` の必ず成功するテスト用 secret |

- ローカルではウィジェットにテスト用である旨が表示され、確認は自動で成功します
- 失敗を試すとき:
  - 検証の不合格（403）: `.dev.vars` の値を `2x0000000000000000000000000000000AA` に替えて `npm run dev` を起動し直す（`.dev.vars` の変更は起動し直すまで反映されない）。戻すときは `1x0000000000000000000000000000000AA` にして起動し直す
  - ウィジェットのエラー: `$env:VITE_TURNSTILE_SITE_KEY="2x00000000000000000000AB"; npm run dev`。この値は止めた後もその端末に残るので、戻すときは `Remove-Item Env:VITE_TURNSTILE_SITE_KEY` してから起動し直す（または端末を閉じる）
- `.dev.vars` が無い（`TURNSTILE_SECRET_KEY` が未設定）と、保存は 500 になります。テスト用の secret には自動で切り替えません（本番で設定し忘れたときに、検証が黙って外れないようにするため）

### Discord でのログイン

ログインは Discord の OAuth 2.0（認可コード + PKCE）で、API は `GET /api/auth/discord`（Discord の認可画面へ移る。`?returnTo=<パス>` でログイン後に戻るパスを渡せる）・`GET /api/auth/discord/callback`・`POST /api/auth/logout`・`GET /api/me`（ログインできる環境か・ログイン中か）です（#876）。クライアント ID（`DISCORD_CLIENT_ID`）が無い環境では、ログインの API が 404 を返し、`/api/me` は `{"loginAvailable":false,"loggedIn":false}` を返します。ID は `wrangler.jsonc` の `vars` にありますが（#892）、`.dev.vars.example` の `DISCORD_CLIENT_ID=`（空）がローカルではそれを上書きするので、`.dev.vars.example` のままならローカルもこの状態です。#892 より前に `.dev.vars` を作ったなら、この行を足します（無いと `wrangler.jsonc` の ID が効き、secret が無いので `/api/auth/discord` が 500 になる）。

ローカルでログインを試すとき:

1. `.dev.vars` の `DISCORD_CLIENT_ID=` の行を消し（`wrangler.jsonc` の ID が使われる）、`DISCORD_CLIENT_SECRET=` の行の `#` を外して、後述「Discord のアプリ（初回のみ）」の Client Secret を書く。ユーザー ID を HMAC にする鍵（後述「Discord のユーザー ID の HMAC の鍵（初回のみ）」）は、`.dev.vars.example` の `DISCORD_ID_HMAC_KEY=` のローカル専用の値がそのまま使われる。#918 より前に `.dev.vars` を作ったなら、この行を `.dev.vars.example` から写す
2. `npm run dev` を起動し直し、`http://localhost:5173/api/auth/discord` を開く。Discord で承認するとトップに戻り、`http://localhost:5173/api/me` が `{"loginAvailable":true,"loggedIn":true}` を返す
3. ログアウトの UI はまだ無い（#880）。ブラウザの開発者ツールのコンソールで次を実行すると、`/api/me` の `loggedIn` が `false` に戻る

   ```js
   await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
   ```

- `DISCORD_CLIENT_ID=` の行を消して（または行が無いまま）secret か `DISCORD_ID_HMAC_KEY` を書かずに起動すると、`/api/me` は `loginAvailable:true` を返し、`/api/auth/discord` が 500 になります（Turnstile と同じく、設定の誤りを黙って通さない）
- テストは Discord を呼ばず、`fetch` を差し替えて確かめます（`src/server/routes/__tests__/auth.test.ts`）

---

## CI / Cloudflare Workers 配信

品質チェック（CI）と配信（Cloudflare Workers）を分担しています：

- **CI (GitHub Actions)**: `.github/workflows/ci.yml` が `main` への push / PR / `workflow_dispatch` で起動し、常駐量と skill の md の大きさの予算検査（`.claude/scripts/check-context-budget.py`。CLAUDE.md と `paths:` なし rules の合計が 1000 行以内か、`.claude/skills/` と `.claude/routines/` の md がどれも 30,000 バイト未満で、合計がスクリプトの `SKILL_TOTAL_MAX_BYTES` 以下か。外部の `skill-creator/` は除く）→ 依存インストール → `tsc --noEmit` → `npm test` → `npm run build` → `npx wrangler deploy --config dist/ff14_rotation_calc/wrangler.json --dry-run` を実行（`npm run deploy` は本番 D1 へのマイグレーション適用を含むので、CI はデプロイの部分だけを dry-run する）
- **デプロイ (Workers Builds の Git 連携)**: Cloudflare の Workers Builds がリポジトリの push / PR を検知し、Cloudflare 上でビルドしてデプロイ（GitHub Secrets は不要。本番 D1 とプレビュー用 D1 にマイグレーションを当てるため、Cloudflare 側のビルド用 API トークンに D1 の編集権限が要る。後述「本番 D1 とビルド用トークン」）。`main` は本番に、PR のブランチはプレビュー URL にデプロイされる
- フロント（Static Assets）と Hono の API は同じ Worker `ff14-rotation-calc` から配信する。`/api/*` は Worker が先に処理し、それ以外は `dist/client` の静的ファイル（未知のパスは `index.html`）を返す。英語のページの `/en/*` も Worker が先に処理し、`/en/t/<id>` のような未知のパスにも英語の `en/index.html` を返す（`wrangler.jsonc`）。共有 URL の `/t/*` も Worker が先に処理し、`index.html` を返す。共有 URL（`/t/*`・`/en/t/*`）の応答には、検索結果から外すための `X-Robots-Tag: noindex` を付ける

### Workers Builds の設定（初回のみ）

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログイン
2. 左メニュー **Workers & Pages** → **Create application** → **Import a repository** を選択
3. GitHub で認証し、`ff14_rotation_calc` リポジトリを選択
4. 以下の設定を入力：
   - **Project name（Worker 名）**: `ff14-rotation-calc`（`wrangler.jsonc` の `name` と一致させる。違うとビルドが失敗する）
   - **Build command**: `npm run build`
   - **Deploy command**: `npm run deploy`（本番 D1 へのマイグレーション適用 → デプロイ）
   - **Preview command**（本番ブランチ以外。**Enable Preview Builds** を有効にする）: `npm run db:migrate:preview && npx wrangler preview --config dist/ff14_rotation_calc/wrangler.json`（プレビュー用 D1 にマイグレーションを当ててからプレビューを作る。後述「プレビュー用 D1」）
   - **Root directory**: 空欄（`/`）のまま
5. **Build variables and secrets** に `NODE_VERSION` = `22` を追加（Workers Builds の既定は Node.js 24。CI と揃える）
6. **Deploy** で初回ビルドを開始

これで以後、`main` への push は本番（`https://ff14-rotation-calc.forestry-for.workers.dev`）に、PR はプレビュー URL に自動デプロイされます。

> **Preview command では `wrangler preview` を直接呼ぶ**: PR にプレビュー URL をコメントするのは Worker Previews の機能で、Workers Builds は独自の Preview command にも `npx wrangler preview` を呼ぶことを求めています。以前は Worker Previews に切り替えないまま Preview command を `npm run deploy:preview`（npm スクリプト）にしていて、プレビュー自体は作られたのにコメントにプレビュー URL が出なかった（#487）。`package.json` の `deploy:preview` は、ローカルから手でプレビューを作るとき用です。前に `npm run db:migrate:preview &&` を付けるのはよいが、`wrangler preview` 自体は npm スクリプトで包まない。
>
> **Worker Previews 以前から Builds に繋いでいた Worker の場合**: **Settings** → **Builds** に **Set up Worker Previews** のバナーが出ていたら、**Set up** から一度だけ切り替える（元の方式には戻せない）。確認ダイアログで Previews 用の変数・シークレット・バインディングを聞かれるが、空のまま進めてよい（Previews は本番の設定を引き継がず、`wrangler.jsonc` の `previews` に書いたもの（D1 の `DB`、レート制限、Turnstile のテスト用 secret）だけが付く）。切り替えると Preview command が `npx wrangler preview` に置き換わるので、上のコマンドに直す（[Cloudflare のドキュメント](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#existing-workers-connected-to-builds)）。

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

### プレビュー用 D1（初回のみ）

PR のプレビューは本番の D1 を使わず、全 PR で共有するプレビュー用の D1（`ff14-rotation-calc-preview`）を使います（#581。作成済みで、ID は 2 つの設定ファイルに書いてある）。Preview command の `npm run db:migrate:preview` が、プレビューを作る前にこの D1 にマイグレーションを当てます。前節の手順 3 で足した D1 の編集権限はアカウントの D1 すべてに効くので、トークンに足すものはありません。

1. 手元で `npx wrangler login` してから、プレビュー用の D1 を作る:

   ```powershell
   npx wrangler d1 create ff14-rotation-calc-preview --location apac
   ```

   「設定ファイルに追加するか」を聞かれたら `n` で断る（前節の手順 1 と同じ理由）
2. 出力された `database_id` を、`wrangler.jsonc` の `previews.d1_databases`（binding `DB`）と `wrangler.preview-migrations.jsonc`（binding `PREVIEW_DB`）の両方に書いてコミットする。2 つが違うと、マイグレーションを当てた D1 とプレビューが使う D1 がずれる
3. Worker の **Settings** → **Build** で、Preview command を上の「Workers Builds の設定」の手順 4 のコマンドにする。ここで変えた値は、これから作るプレビューにだけ付く。すでにあるプレビューはプレビューごとにビルドの設定を持っているので、画面上部のブランチの切り替えでそのプレビューを選び、**設定**（Settings）→ **ビルド**（Build）→ **ビルド構成**（Build configuration）の **プレビューコマンド** も同じコマンドに直す（#581）
4. PR のプレビューのビルドログで、マイグレーションの適用（`✅`）と、「These bindings are configured for your production Worker but not for Previews」の警告が出ないことを確かめる

- **データは使い捨て**: PR 同士の保存が同じ D1 に混ざります。バックアップ（`docs/d1-backup.md`）も本番の D1 だけで、プレビュー用は取りません
- **マージ前の PR のマイグレーションも当たる**: その PR を閉じたり、マイグレーションを作り直したりすると、`main` の `migrations/` と D1 の中身がずれます。ずれたら `npx wrangler d1 delete ff14-rotation-calc-preview` で消し、手順 1・2 で作り直す。作り直すと ID が変わるので、開いている PR は `main` を取り込んで push し直す（古い ID のままだと、マイグレーションの適用が D1 を見つけられずに失敗する）
- **マイグレーションの番号を振り直したら、`d1_migrations` の名前も揃える**: PR のブランチのマイグレーションの番号を `main` の取り込みで振り直す（並行の PR が同じ番号を先にマージした等）と、この D1 の適用履歴 `d1_migrations` に、振り直す前の名前が残ります。そのままだと `npm run db:migrate:preview` が新しい名前を未適用と見て同じテーブルを作り直そうとし、その PR と、マージ後は `main` から派生したすべての PR のプレビューのビルドが失敗します（#896）。振り直した版をコミットしたら、push する前に次を行います
  1. 振り直す前と後で SQL が同じかを確かめる。何も出なければ同じ（`<振り直す前のコミット>` は、`main` を取り込んだマージコミットで振り直したなら `HEAD^1`）:

     ```powershell
     git diff <振り直す前のコミット>:migrations/<古い名前> HEAD:migrations/<新しい名前>
     ```

  2. 同じなら、名前を揃える:

     ```powershell
     npx wrangler d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --command "UPDATE d1_migrations SET name = '<新しい名前>' WHERE name = '<古い名前>'"
     ```

     SQL が違う（取り込んだ `main` に合わせて中身も変わった）ときは、名前を揃えると古い SQL で作ったテーブルのまま適用済みになるので、揃えずに、前の項目のとおり D1 を作り直す

### Turnstile（初回のみ・#479 のマージ前に）

保存 API は Turnstile の検証に通らない保存を拒否します。本番の sitekey と secret を入れずにマージすると、本番の保存がすべて失敗する（sitekey が無いと 403、secret が無いと 500）ので、マージの前に次を済ませます。

1. ダッシュボードの **Turnstile** で **Add widget** を選び、次を入れて **Create**:
   - **Widget name**: 任意（例: `ff14-rotation-calc`）
   - **Hostname management**: `ff14-rotation-calc.forestry-for.workers.dev`。`localhost` と PR のプレビューのホスト名は入れない（どちらもテスト用キーを使う。後述）
   - **Widget mode**: Managed
2. 表示された sitekey を、Worker の **Settings** → **Build** → **Build variables and secrets** に `VITE_TURNSTILE_SITE_KEY` として足す（ビルド時にフロントに埋め込む値で、ページから誰でも見られる公開値）
3. secret key を Worker の secret に入れる（どちらか）:

   ```powershell
   npx wrangler secret put TURNSTILE_SECRET_KEY   # 値を聞かれたら貼り付ける
   ```

   ダッシュボードなら Worker の **Settings** → **Variables and Secrets** → **Add**（Type: **Secret**）。`wrangler secret put` は今のコードのまま新しい版をデプロイするが、マージ前の版は secret を使わないので影響しない
4. マージ後、本番の保存ダイアログで、ウィジェットにテスト用の表示が出ず、保存できることを確かめる

PR のプレビューは手順 2・3 の値を使いません（#581）。プレビューのビルドには `VITE_TURNSTILE_SITE_KEY` が渡らず、フロントはテスト用の sitekey（必ず成功）で動きます。secret も本番のものを引き継がないので、対になる公開のテスト用 secret（`1x0000000000000000000000000000000AA`）を `wrangler.jsonc` の `previews.vars` に書いてあります。プレビューで保存するのに、ダッシュボードで入れるものはありません（プレビューにはボット対策が効かないが、保存先はプレビュー用 D1 で、レート制限は効く）。

- プレビューのビルドにも `VITE_TURNSTILE_SITE_KEY` が渡るように変えると、本番の sitekey のトークンをテスト用 secret が拒否し、プレビューの保存が 403 になります。その場合は、`previews.vars` の値を本番の secret にせず（設定ファイルに書くと公開される）、`previews.vars` から外して `npx wrangler preview base-config secret put TURNSTILE_SECRET_KEY` で入れ、手順 1 のホスト名にプレビューも通る `forestry-for.workers.dev` を入れる。Previews Base の secret は入れた後に新しく作るプレビューにだけ付くので、すでにあるプレビューには `npx wrangler preview secret put TURNSTILE_SECRET_KEY --name <プレビュー名>`（プレビュー URL の `-ff14-rotation-calc.` より前）で入れる

### Discord のアプリ（初回のみ）

ログイン（#876）は Discord のアプリのクライアント ID と secret を使います。本番のアプリは登録済みで、ID は #892 で `wrangler.jsonc` に書きました。この手順は、アプリを作り直すときに使います（secret を Reset Secret で作り直すだけなら手順 3 だけ）。secret が無いまま ID を入れる・置き換えると、ログインが 500 になるので、secret を先に入れます。

1. [Discord Developer Portal](https://discord.com/developers/applications) で **New Application** を選び、アプリ名（Discord の認可画面に出る）を入れて作る
2. **OAuth2** → **Redirects** に次の 2 つを足して保存する。リダイレクト URI は完全一致で照合されるので、スキーム（`https` / `http`）・ポート・末尾の `/` の有無まで揃える
   - `https://ff14-rotation-calc.forestry-for.workers.dev/api/auth/discord/callback`
   - `http://localhost:5173/api/auth/discord/callback`
3. 同じページの **Client Secret**（**Reset Secret** で表示される）を Worker の secret に入れる（どちらか）:

   ```powershell
   npx wrangler secret put DISCORD_CLIENT_SECRET   # 値を聞かれたら貼り付ける
   ```

   ダッシュボードなら Worker の **Settings** → **Variables and Secrets** → **Add**（Type: **Secret**）。**Settings** → **Build** の **Build variables and secrets** ではない（そこの値はビルドの間しか読めず、Worker からは読めないので、ログインが 500 になる。Turnstile の sitekey とは入れる場所が違う）。ローカルで試すなら、同じ値を `.dev.vars` にも書く（前述「Discord でのログイン」）
4. 同じページの **Client ID**（公開値）で、`wrangler.jsonc` の最上位の `vars` にある `DISCORD_CLIENT_ID` の値を置き換え、PR にする（`"vars"` を書き足さない。JSONC はキーが重複してもエラーにならず、後の方が使われる）。`previews` には書かない（下記）。ダッシュボードの **Variables and Secrets** に入れても、次のデプロイ（`wrangler deploy`）が `wrangler.jsonc` の `vars` で置き換えるので、ファイルに書く
5. マージ後、本番で `/api/auth/discord` を開いて Discord の認可画面に移り、承認するとトップに戻って `/api/me` の `loggedIn` が `true` になることを確かめる

PR のプレビューではログインを出しません。リダイレクト URI は完全一致でしか登録できず、プレビューの URL はブランチごとに変わるためです。プレビューのバインディングは `previews` に書いたものだけで、最上位の `vars` は付かないので、プレビューにはクライアント ID が無く、ログインの API は 404 になります。

### Discord のユーザー ID の HMAC の鍵（初回のみ）

ログインは、Discord のユーザー ID をそのまま保存せず、Worker の secret `DISCORD_ID_HMAC_KEY` を鍵にした HMAC-SHA256 を `user_identities.provider_user_id` に入れます（#918）。D1 やバックアップが漏れても、どの Discord アカウントが使ったかを分からなくするためです。クライアント ID があるのに鍵が無いと、ログインが 500 になるので、鍵を使うコードをデプロイするより先に入れます。

1. 鍵を作る（32 バイトの乱数を base64url にした 43 文字）

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

2. 出た値をパスワードマネージャーなどに控える。Worker の secret は後から読み出せないので、控えが無いと、削除の依頼を受けたときに行を探せない（`docs/deletion-requests.md`）
3. Worker の secret に入れる（どちらか）:

   ```powershell
   npx wrangler secret put DISCORD_ID_HMAC_KEY   # 値を聞かれたら貼り付ける
   ```

   ダッシュボードなら、`DISCORD_CLIENT_SECRET` と同じく Worker の **Settings** → **Variables and Secrets**（Type: **Secret**）。**Build variables and secrets** ではない

鍵は変えません。変えると、それまでの行が今の鍵で計算した値と一致しなくなり、全員が次のログインで別のユーザー（保存したタイムラインが一覧に出ない、新しいアカウント）になります。鍵を失ったときは、新しい鍵を作って同じ手順で入れ直し、これを受け入れます。前の鍵の行は消さずに残します（鍵が無いと誰のものか分からない値なので、残しても漏れる情報は無い）。ただし、その行は削除の依頼を受けても探せません。

### 動作確認手順

1. 初回ビルドが成功し、本番 URL でフロントエンドが表示され、`/api/health` が `{"status":"ok"}` を返すことを確認
2. PR を作ると、Workers Builds からプレビュー URL のコメントが付き、その URL で確認できること
3. GitHub Actions 側（`Test & Build` ジョブ）も緑で通っていること

### トラブルシューティング

- **ビルド失敗（`npm ci`）**: Node のバージョンが合っていない可能性。ビルド用の環境変数 `NODE_VERSION=22` が設定されているか確認
- **ビルド失敗（Worker 名の不一致）**: ダッシュボードの Worker 名と `wrangler.jsonc` の `name`（`ff14-rotation-calc`）が一致しているか確認
- **デプロイ失敗（`The assets property ... is missing the required directory property`）**: デプロイコマンドが `npx wrangler deploy` のままになっている。上記のとおり `npm run deploy`（プレビューは上の「Workers Builds の設定」の手順 4 の Preview command）にする
- **PR のコメントにプレビュー URL が出ない（「Deploying with Cloudflare Workers」の表に URL の列が無い）**: Worker Previews に切り替わっていないか、Preview command が `wrangler preview` を直接呼んでいない（npm スクリプトで包んでいる等）。上記の注記のとおりに直す
- **プレビューの作成失敗（`Preview creation failed: Invalid preview name`）**: ブランチ名に、プレビュー名に使えない文字（`#` など）が入っている。Workers Builds はビルドの前にブランチ名をそのままプレビュー名にするので、Preview command では直せない。`.claude/rules/git-conventions.md` の書式でブランチを切り直す（#609）
- **プレビューのデプロイ失敗（`Your Wrangler configuration is missing a previews block`）**: `wrangler.jsonc` の `"previews"` ブロックが消えていないか確認する（#485）
- **プレビューのビルドでマイグレーションが当たらない（ログの `Executing user deploy command:` に `db:migrate:preview` が無く、プレビューの API が 500 になる）**: そのプレビューが、Worker の Preview command を変える前に作られている。プレビューごとのビルドの設定を直し、push し直す（上記「プレビュー用 D1」の手順 3）
- **プレビューのビルド失敗（`Missing script: "db:migrate:preview"`）**: Preview command にマイグレーションの適用を足した（#581）より前の `main` から切ったブランチ。`main` を取り込んで push し直す
- **プレビューのビルド失敗（`wrangler d1 migrations apply PREVIEW_DB --remote` のエラー）**: 認証・権限のエラーならビルド用トークンの D1 の編集権限（「本番 D1 とビルド用トークン」の手順 3）、D1 が見つからないなら `wrangler.preview-migrations.jsonc` の `database_id`、SQL のエラーなら共有の D1 の中身のずれ（「プレビュー用 D1」の作り直し）を確かめる
- **`main` のマイグレーションが増えた直後から、全 PR のプレビューのビルドが失敗する（`db:migrate:preview` が `table ... already exists` で止まる）**: プレビュー用 D1 の `d1_migrations` に、番号を振り直す前のマイグレーションの名前が残っている（#896）。`npx wrangler d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id"` の `name` を `main` の `migrations/` のファイル名と比べ、番号だけが違う組（`0001_create_users_and_sessions.sql` と `0002_create_users_and_sessions.sql` など）があれば、上記「プレビュー用 D1」の「マイグレーションの番号を振り直したら」の手順 2 の `UPDATE` で名前を揃えて、失敗したビルドを Retry する。`migrations/` に無い名前でも、開いている PR のマイグレーションはそのままでよい（閉じた PR のものなら、同じ節のとおり D1 を作り直す）
- **デプロイ失敗（`wrangler d1 migrations apply DB --remote` で認証・権限のエラー）**: ビルド用 API トークンに D1 の編集権限が無い。上記「本番 D1 とビルド用トークン」の手順 3 のとおり足す
- **デプロイ失敗（`wrangler d1 migrations apply DB --remote` で D1 が見つからない）**: `wrangler.jsonc` の `database_id` が、ビルド用トークンのアカウントに無い D1 を指している（別アカウントで作った・作り直した等）。`npx wrangler d1 list` で ID を確かめ、手順 1・2 のとおり書き直す
- **本番の保存がいつも「ボット対策の確認ができませんでした」（403）になる**: ビルド変数 `VITE_TURNSTILE_SITE_KEY` が無いと、フロントはテスト用の sitekey で動き（ウィジェットにテスト用の表示が出る）、そのダミートークンを本番の secret が拒否する。上記「Turnstile」の手順 2 のとおり足して、ビルドし直す（ビルド変数は次のビルドから効く）。テスト用の表示が出ていなければ、sitekey と secret が別のウィジェットのものになっていないか確かめる
- **本番の保存がいつも「保存できませんでした」（500）になる**: Worker の secret `TURNSTILE_SECRET_KEY` が無い。`npx wrangler tail` で保存すると `TURNSTILE_SECRET_KEY is not set` が出る。上記「Turnstile」の手順 3 のとおり入れる
- **`/api/auth/discord` が 500 になる**: `wrangler.jsonc` に `DISCORD_CLIENT_ID` があるのに、Worker の secret `DISCORD_CLIENT_SECRET` が無い（`npx wrangler tail` に `DISCORD_CLIENT_SECRET is not set` が出る）。Build の **Build variables and secrets** に入れた値は Worker から読めないので、これに当たる。上記「Discord のアプリ」の手順 3 のとおり **Variables and Secrets** に入れる。`DISCORD_ID_HMAC_KEY is not set` が出るなら、上記「Discord のユーザー ID の HMAC の鍵」の手順 3 のとおり鍵を入れる
- **Discord の認可画面に、redirect_uri が無効という旨のエラーが出る**: 開いたオリジンのコールバックが Discord のアプリに登録されていない。上記「Discord のアプリ」の手順 2 の URI と、スキーム・ポートまで一致しているか確かめる
- **Discord で承認した後、500 になる**: トークンの交換か `/users/@me` が 200 以外を返している。`npx wrangler tail` に `Discord token endpoint returned <ステータス>` が出るなら、secret が別のアプリのものでないか、Reset Secret で古くなっていないかを確かめる
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
├── scripts/     # 手で呼ぶ補助スクリプト（知見ボードの読み出し、常駐量と skill の md の大きさの予算検査）
├── settings.json # フック設定
└── skills/      # スラッシュ起動可能なスキル（/issue-start, /issue-plan, /issue-priority, /template-update, /playwright-mcp, /dev-plan 等）
```

加えて、リポジトリ直下の `.mcp.json` に Claude Code が読み込む MCP サーバー（Playwright 等）を定義しています。

セッション開始時には SessionStart hook（`.claude/hooks/session-start-info.sh`）がリポジトリ状態のバナーを出します。バナーの `## Template version` は、`.claude/template-version` の版とテンプレート元（issue-driven-dev-starter）の最新リリースを比べた結果です（最新リリースは毎回取得し、取得に失敗したときだけ前回の結果を `cached` と付けて使う。前回の結果も無ければ `unknown`）。新しい版があれば `/issue-start` が更新用 Issue の起票を一度だけ提案します。取り込み手順は `.claude/skills/template-update/SKILL.md`（`/template-update`）を参照してください。

Claude Code のクラウドセッション（claude.ai/code など）では、もう 1 つの SessionStart hook（`.claude/hooks/session-start-cloud-deps.sh`）が `npm ci`、`.dev.vars` の作成（`.dev.vars.example` からのコピー。既にあれば何もしない）、ローカルの D1 へのマイグレーション適用（`npx wrangler d1 migrations apply DB --local`）を実行します（`CLAUDE_CODE_REMOTE=true` のときだけ動き、ローカルでは何もしません）。

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
