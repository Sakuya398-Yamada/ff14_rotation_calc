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

### 2. 設定場所（環境別）

#### ローカル CLI（Dev Container 内）

`~/.bashrc` または `~/.zshrc` に追記：

```bash
export BRAVE_API_KEY="BSA..."
```

追記後は新しいシェルを開くか `source ~/.bashrc` で反映。Dev Container を再ビルドした場合は再設定が必要（または Dev Container の `containerEnv` / `remoteEnv` に入れて永続化）。

#### Claude Code on the web

Web セッションは都度新規環境のため、ホスト側（Claude Code for Web のプロジェクト／ワークスペース設定）で `BRAVE_API_KEY` を環境変数として登録する。詳細は Claude Code on the web の UI で「Environment variables」または「Secrets」セクションを参照。

設定後はセッションを再起動して `.mcp.json` の再読み込みを促す。

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
