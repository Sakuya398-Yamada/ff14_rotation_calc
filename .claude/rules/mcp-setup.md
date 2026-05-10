# MCP サーバー設定ガイド

このファイルは `CLAUDE.md` から `@.claude/rules/mcp-setup.md` でインポートされる。
リポジトリ直下の `.mcp.json` に登録された MCP サーバーの API キー管理・接続状態確認・トラブル対応をまとめる。

## 登録済み MCP サーバー

| サーバー | 種別 | 必要シークレット | 用途 |
|---------|------|----------------|------|
| `playwright` | stdio | なし | UI 視覚検証（`.claude/rules/playwright-mcp.md` 参照） |
| `brave-search` | stdio | `BRAVE_API_KEY` | FF14 公式ジョブガイド等の外部情報検索 |
| `github` | stdio | `GITHUB_PERSONAL_ACCESS_TOKEN` | Issue / PR の取得・作成・コメント・ラベル付与等の GitHub 操作 |

context7 MCP は本リポジトリでは未登録。必要になった時点で `.mcp.json` に追加する。

## 環境変数による API キー注入

`.mcp.json` は `${VAR}` 形式で OS 環境変数を展開する（公式仕様）。生の API キーを `.mcp.json` に書いて commit してはいけない。

```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "${BRAVE_API_KEY}"
  }
}
```

Claude Code は `.mcp.json` 読み込み時に `${BRAVE_API_KEY}` を OS 環境変数の値に展開する。未定義の場合はサーバー起動が失敗するが、他の MCP サーバーや Claude Code セッション全体には影響しない。

## BRAVE_API_KEY の取得と設定

### 1. API キーの取得

1. [Brave Search API](https://brave.com/search/api/) にアクセス
2. アカウント登録し、無料プラン（Free: 月2,000クエリ、1 req/sec）を選択
3. ダッシュボードから API キーを発行

### 2. 設定（Windows / Claude Desktop）

PowerShell（一般ユーザー権限）でユーザー環境変数として永続的に設定する：

```powershell
[Environment]::SetEnvironmentVariable("BRAVE_API_KEY", "BSA_your_actual_key_here", "User")
```

スコープ補足：
- `"User"` … ユーザーホーム配下に永続化（管理者権限不要）
- `"Machine"` … システム全体（管理者権限が必要）
- `"Process"` … 現在のシェルだけ（再起動で消える）

設定後の反映手順：

1. **新しい PowerShell を開いて** `[Environment]::GetEnvironmentVariable("BRAVE_API_KEY","User")` で設定値を確認
2. **Claude Desktop を完全終了 → 再起動**（タスクトレイから Quit）。Claude Desktop は起動時に環境変数を読み込むため、再起動しないと既存プロセスは古い env のまま
3. 再起動後の新セッションで `ToolSearch select:mcp__brave-search__brave_web_search` でツール取得確認

削除する場合：

```powershell
[Environment]::SetEnvironmentVariable("BRAVE_API_KEY", $null, "User")
```

## GitHub MCP の取得と設定

GitHub MCP は GitHub 公式の Go バイナリ [`github/github-mcp-server`](https://github.com/github/github-mcp-server) を `.mcp.json` から stdio で起動する。npm パッケージ `@modelcontextprotocol/server-github` は archived のため使わない。

### 1. バイナリのインストール（Windows 11）

1. [Releases](https://github.com/github/github-mcp-server/releases) から `github-mcp-server_Windows_x86_64.zip` をダウンロード（v1.0.3 以降を推奨）
2. 任意の永続フォルダに解凍する（例: `C:\Tools\github-mcp-server\`）
3. 解凍先フォルダを **ユーザー環境変数 `Path`** に追加（PowerShell・管理者権限不要）：

   ```powershell
   $tool = "C:\Tools\github-mcp-server"
   $current = [Environment]::GetEnvironmentVariable("Path", "User")
   if ($current -notlike "*$tool*") {
     [Environment]::SetEnvironmentVariable("Path", "$current;$tool", "User")
   }
   ```

4. **新しい PowerShell を開いて** `github-mcp-server --version` で動作確認

PATH に追加せず `.mcp.json` でフルパス指定したい場合は、`"command": "C:\\Tools\\github-mcp-server\\github-mcp-server.exe"` に書き換えてもよい（ただしマシンごとに差が出るので非推奨）。

### 2. PAT の取得と設定

1. GitHub の [Settings → Developer settings → Personal access tokens (classic)](https://github.com/settings/tokens) で PAT を発行
2. **必要スコープ**:
   - `repo`（プライベートリポジトリのIssue/PR操作）
   - `read:org`（組織情報の読み取り）
   - `gist`（必要に応じて）
3. PowerShell でユーザー環境変数として永続的に設定：

   ```powershell
   [Environment]::SetEnvironmentVariable("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_your_actual_token_here", "User")
   ```

4. **Claude Desktop を完全終了 → 再起動**（タスクトレイから Quit）。再起動後の新セッションで `ToolSearch select:mcp__github__add_issue_comment` 等でツール取得確認

削除する場合：

```powershell
[Environment]::SetEnvironmentVariable("GITHUB_PERSONAL_ACCESS_TOKEN", $null, "User")
```

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
| `playwright` | UI 動作確認はユーザーに依頼。その旨を完了報告に明記 |
| `github` | `gh.exe` のフルパス起動 (`/c/Program Files/GitHub CLI/gh.exe`) を Bash 経由で利用。Issue/PR 取得は `gh issue view` / `gh pr view`、コメント投稿は `gh issue comment --body-file <tmpfile>`、PR 作成は `gh pr create`。公開リポジトリの読み取りのみなら `WebFetch` でも代用可（コメント投稿は不可）|

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| `brave_web_search` が `ToolSearch` で見つからない | `BRAVE_API_KEY` 未設定 or stdio 起動失敗 | 環境変数設定 → セッション再起動 |
| `${BRAVE_API_KEY}` が展開されずそのまま渡っている | 古い Claude Code バージョン | Claude Code を更新 |
| `/mcp` で `brave-search` が `failed` | npx キャッシュ破損 or ネットワーク | `npx clear-npx-cache` 後、セッション再起動 |
| stdio サーバー（Playwright/Brave/GitHub）が途中で切断 | セッション長時間放置 | `.claude/rules/playwright-mcp.md` の「切断時の再接続手順」参照（共通） |
| `mcp__github__*` ツールが `ToolSearch` で見つからない | `GITHUB_PERSONAL_ACCESS_TOKEN` 未設定、`github-mcp-server` バイナリが PATH に無い、PAT スコープ不足のいずれか | 上記「GitHub MCP の取得と設定」を実施 → Claude Desktop 再起動 |
| `github-mcp-server` 実行時に `401 Unauthorized` | PAT が無効 or スコープ不足 | PAT を再発行し `repo` / `read:org` を付与 → 環境変数を再設定 → Claude Desktop 再起動 |
