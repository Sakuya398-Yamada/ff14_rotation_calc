# MCP サーバー設定ガイド

このファイルは `CLAUDE.md` から `@.claude/rules/mcp-setup.md` でインポートされる。
リポジトリ直下の `.mcp.json` に登録された MCP サーバーの API キー管理・接続状態確認・トラブル対応をまとめる。

## 登録済み MCP サーバー

| サーバー | 種別 | 必要シークレット | 用途 |
|---------|------|----------------|------|
| `playwright` | stdio | なし | UI 視覚検証（`.claude/rules/playwright-mcp.md` 参照） |
| `brave-search` | stdio | `BRAVE_API_KEY` | FF14 公式ジョブガイド等の外部情報検索 |

GitHub / context7 MCP はプロジェクト `.mcp.json` では管理せず、Claude Code ホスト側（グローバル）で設定されている。

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

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| `brave_web_search` が `ToolSearch` で見つからない | `BRAVE_API_KEY` 未設定 or stdio 起動失敗 | 環境変数設定 → セッション再起動 |
| `${BRAVE_API_KEY}` が展開されずそのまま渡っている | 古い Claude Code バージョン | Claude Code を更新 |
| `/mcp` で `brave-search` が `failed` | npx キャッシュ破損 or ネットワーク | `npx clear-npx-cache` 後、セッション再起動 |
| stdio サーバー（Playwright/Brave）が途中で切断 | セッション長時間放置 | `.claude/rules/playwright-mcp.md` の「切断時の再接続手順」参照 |
