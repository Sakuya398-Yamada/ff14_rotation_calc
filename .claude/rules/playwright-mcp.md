# Playwright MCP 利用ガイド（Claude 向け）

このファイルは `CLAUDE.md` から `@.claude/rules/playwright-mcp.md` でインポートされる。
**Claude が UI/フロントエンド変更時に自前で動作確認するためのランブック** であり、人間向けは `CONTRIBUTING.md` を参照。

開発環境は **Windows 11 ローカル + Microsoft Edge** を前提とする（`.mcp.json` は `--browser msedge`）。

## いつ使うか

- React コンポーネントやページ（`src/client/**`）を追加・変更したとき
- CSS/レイアウト/インタラクションに手を入れたとき
- バグ修正で「画面上でどう見えているか」が検証に必要なとき

型チェック・ユニットテストは「コードの正しさ」は示すが「機能の正しさ」は示さない。UI 変更は必ずブラウザで確認してから完了報告する。

## 呼び出し前の必須手順

Playwright MCP のツールは **deferred** で、起動直後はスキーマが未ロードのまま名前だけ見える状態になっている。いきなり呼ぶと `InputValidationError`。

1. **ToolSearch で事前ロード**:
   ```
   ToolSearch query: "select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click"
   ```
   必要なツールをカンマ区切りで指定。一度ロードされればセッション中は使い回せる。

2. **Vite dev サーバーを別プロセスで起動**:
   ```powershell
   npm run dev:client   # run_in_background: true
   ```
   `VITE vX.Y.Z  ready in ...ms` のログを待ってから次へ。デフォルトは `http://localhost:5173/` だが、ポート競合時は 5174 等にフォールバックされるためログで実 URL を確認する。

## 典型フロー

```
browser_navigate  url=http://localhost:5173
  ↓
browser_snapshot                          # アクセシビリティツリー + 要素 ref 取得
  ↓
browser_click     ref=<snapshot の ref>   # snapshot で得た ref を指定
browser_type      ref=...  text=...
  ↓
browser_snapshot                          # 変化後の状態を再取得して検証
browser_take_screenshot                   # 必要なら画像も保存
  ↓
browser_close                             # 検証終わりに必ず閉じる
```

`click`/`type`/`hover` 等はセレクタではなく **snapshot で得た ref を使う**。ref なしで呼ぶとエラー。

## 失敗時の診断

| 症状 | 原因 | 対処 |
|------|------|------|
| `Failed to launch ... executable doesn't exist at /opt/...` | `.mcp.json` が古い Linux パス前提のまま | `.mcp.json` の playwright 引数が `--browser msedge` になっているか確認。違う場合は修正して Claude Desktop 再起動 |
| `Browser "chrome-for-testing" is not installed` | `--browser` 引数が欠落し、`@playwright/mcp@latest` がデフォルトの chrome-for-testing にフォールバックしている | `.mcp.json` に `--browser msedge` が入っているか確認 → Claude Desktop 再起動 |
| `InputValidationError` / ツールが呼べない | ToolSearch 未実行でスキーマが未ロード | `ToolSearch select:<tool_name>` で先にロード |
| `browser_navigate` でタイムアウト／接続拒否 | Vite が起動していない・ポート違い | `npm run dev:client` のログで実 URL（5173 or 5174）を確認 |
| `msedge` が見つからない／起動しない | システム Edge がアンインストールされている／プロファイル破損 | Edge を再インストール、または `--browser chrome` に切り替え（Chrome がインストールされている場合） |
| 一度使えていた `mcp__playwright__*` ツールが突然 `No matching deferred tools found` になる | セッション長時間放置で stdio サーバーが切断 | 下記「切断時の再接続手順」を参照 |

## 切断時の再接続手順（Claude 向け）

Playwright MCP は stdio サーバーのため、HTTP/SSE サーバーと違って **Claude Code の自動再接続対象外** になり得る。セッション開始時は `<system-reminder>` で deferred tools が列挙されるが、長時間放置すると `The following deferred tools are no longer available (their MCP server disconnected)` が飛んできて、それ以降 `ToolSearch` でも見つからない状態になる。

### Claude 側で取るべきアクション

UI 検証を始めようとして切断を検知したら、**自己判断で復旧を試みる → だめならユーザーに具体的な指示を返す**。

Claude Desktop 環境では `/mcp` スラッシュコマンドが UI 上で確認できないことがある。その場合は以下の段階で復旧を依頼する：

1. **まず Claude Desktop 全体の再起動を依頼**:
   ```
   Playwright MCP が切断されています。タスクトレイの Claude アイコンを右クリックして Quit → 再起動してください。
   ウィンドウを閉じるだけだとプロセスが残るため、必ず Quit を選んでください。
   ```

2. **再起動後の初期化**: スキーマを再ロードする必要がある
   ```
   ToolSearch query: "select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click"
   ```
   セッション再起動後は deferred tool 一覧がリセットされているため、初回利用前に必ず `ToolSearch` で再ロードする。

### フォールバック方針

復旧に時間がかかる／ユーザーが手動再起動できない状況では、**UI 検証を飛ばさず「未検証」であることを完了報告に明記**する。`npm run build` / `tsc --noEmit` / `npm test` が通っているだけでは「機能の正しさ」は保証できない旨を添える。

## ランタイム生成物

`browser_snapshot` / `browser_take_screenshot` 等は `.playwright-mcp/` にログ・YAML・画像を自動生成する。`.gitignore` 済みなのでコミットしないこと。

検証用に手動でルート直下に保存したスクリーンショット（例: `setup-verify.png`）も、検証完了後は削除すること。リポジトリに残さない。

## 参考

- MCP 登録: リポジトリ直下 `.mcp.json`（`--browser msedge` 指定。Windows 11 標準の Microsoft Edge を直接利用するため、追加の Chromium ダウンロードや `npx playwright install` は不要）
- 前提環境: Windows 11 + Microsoft Edge（システム標準）
- 人間向けセットアップ: `CONTRIBUTING.md` 「MCP サーバー（Playwright による UI 視覚検証）」
