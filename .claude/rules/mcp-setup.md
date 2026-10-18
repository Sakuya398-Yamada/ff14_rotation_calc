# MCP サーバー設定ガイド

`.claude/rules/` 配下のため起動時に自動で読み込まれる。
リポジトリ直下の `.mcp.json` に登録された MCP サーバーの一覧・接続確認・使えないときの扱いをまとめる。API キーの取得・環境変数の設定・バイナリの導入とトラブルシューティングの表は、人が手を動かす手順なので `CONTRIBUTING.md` のサーバーごとの節（「MCP サーバー（GitHub MCP による Issue/PR 操作）」等）と「MCP サーバーのトラブルシューティング」に置いてある。

## 登録済み MCP サーバー

| サーバー | 種別 | 必要シークレット | 用途 |
|---------|------|----------------|------|
| `playwright` | stdio | なし | UI 視覚検証（`.claude/skills/playwright-mcp/SKILL.md` 参照） |
| `brave-search` | stdio | `BRAVE_API_KEY` | FF14 公式ジョブガイド等の外部情報検索 |
| `github` | stdio | `GITHUB_PERSONAL_ACCESS_TOKEN` | Issue / PR の取得・作成・コメント・ラベル付与等の GitHub 操作 |

context7 MCP は本リポジトリでは未登録。必要になった時点で `.mcp.json` に追加する。

## 環境変数による API キー注入

`.mcp.json` は `${VAR}` 形式で OS 環境変数を展開する（公式仕様）。生の API キーを `.mcp.json` に書いて commit してはいけない。未定義でデフォルト値（`${VAR:-default}`）も無い変数は、展開されない `${VAR}` の文字列のまま渡る。設定の読み込みもサーバーの起動も止まらず、`claude mcp list` と `/mcp` に警告が出るだけなので、サーバーは起動したうえで API の呼び出しが認証エラーになる（Brave Search は `422 SUBSCRIPTION_TOKEN_INVALID`）。

## 接続状態の確認

セッション開始後、以下で確認する：

1. **スラッシュコマンド**: `/mcp` でサーバー一覧と接続状態を表示
2. **ToolSearch でスキーマロード**: 利用前に一度ロードする
   ```
   ToolSearch query: "select:brave_web_search"
   ```
   `No matching deferred tools found` が返る場合は未接続

## 利用不可時のフォールバック

MCP は**補助的な手段**。接続エラー・未設定時はフロー全体を止めず、以下にフォールバックする：

| サーバー | フォールバック先 |
|---------|----------------|
| `brave-search` | `WebSearch` 組み込みツール、またはユーザーに手動検索を依頼 |
| `playwright` | クラウドセッションでは Node から Playwright を直接使う（`.claude/skills/playwright-mcp/SKILL.md`「MCP が使えないとき」）。それもできなければ UI 動作確認はユーザーに依頼し、その旨を完了報告に明記 |
| `github` | `gh.exe` のフルパス起動 (`/c/Program Files/GitHub CLI/gh.exe`) を Bash 経由で利用。Issue/PR 取得は `gh issue view` / `gh pr view`、コメント投稿は `gh issue comment --body-file <tmpfile>`、PR 作成は `gh pr create`。クラウドセッションではこれらのサブコマンドが GraphQL を使うので 403 になる。REST の `gh api repos/{owner}/{repo}/...`（取得なら `.../issues/N`）に書き換える（`.claude/skills/issue-start/pitfalls.md`「クラウドセッションでは gh の GraphQL 系が使えない」）。公開リポジトリの読み取りのみなら `WebFetch` でも代用可（コメント投稿は不可）|

フォールバックで続けたうえで、ユーザーには `CONTRIBUTING.md`「MCP サーバーのトラブルシューティング」の該当行を案内する。使えていたツールが途中で見つからなくなったときは stdio サーバーの切断なので、`.claude/skills/playwright-mcp/SKILL.md` の「切断時の再接続手順」（共通）に従う。

## クラウドセッションでの差分

クラウドセッション（`CLAUDE_CODE_REMOTE=true`）でも `.mcp.json` はそのまま読み込まれる（ローカルと共用し、クラウド用に書き換えない）。サーバーごとの違い:

- `github`: 同名のクラウド組み込み GitHub ツールが優先され、`.mcp.json` の `github-mcp-server` は起動しない。ツール名は同じ `mcp__github__*` で、バイナリも PAT も要らない
- `brave-search`: `BRAVE_API_KEY` が無くても起動はするが、呼ぶと `422 SUBSCRIPTION_TOKEN_INVALID` になる。組み込みの `WebSearch` / `WebFetch` に切り替えて続ける
- `playwright`: クラウド環境の環境変数でブラウザを Chromium に切り替える（`.claude/skills/playwright-mcp/SKILL.md`「クラウドセッション」）
