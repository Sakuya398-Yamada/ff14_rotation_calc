# Playwright MCP 利用ガイド（Claude 向け）

このファイルは `CLAUDE.md` から `@.claude/rules/playwright-mcp.md` でインポートされる。
**Claude が UI/フロントエンド変更時に自前で動作確認するためのランブック** であり、人間向けは `CONTRIBUTING.md` を参照。

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
   ```bash
   npm run dev:client   # run_in_background: true
   ```
   `VITE vX.Y.Z  ready in ...ms` のログを待ってから次へ。

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
```

`click`/`type`/`hover` 等はセレクタではなく **snapshot で得た ref を使う**。ref なしで呼ぶとエラー。

## 失敗時の診断

| 症状 | 原因 | 対処 |
|------|------|------|
| `Browser "chrome-for-testing" is not installed` | `.mcp.json` の `--executable-path` が欠落し、`@playwright/mcp@latest` が `chrome-for-testing` にフォールバックしている（旧 `--browser chromium` は廃止済み） | `.mcp.json` に `--executable-path /opt/pw-browsers/chromium-1194/chrome-linux/chrome` が入っているか確認 → Claude Code セッションを再起動 |
| `InputValidationError` / ツールが呼べない | ToolSearch 未実行でスキーマが未ロード | `ToolSearch select:<tool_name>` で先にロード |
| `browser_navigate` でタイムアウト／接続拒否 | Vite が起動していない・ポート違い | `npm run dev:client` のログで `http://localhost:5173/` を確認 |
| `--executable-path` で指定したパスに Chromium が無い | `/opt/pw-browsers/chromium-1194` 未配備（新規 DevContainer 直後など） | 環境側で `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` のもと `npx playwright install chromium` を実行して `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` を用意 |
| 一度使えていた `mcp__playwright__*` ツールが突然 `No matching deferred tools found` になる | セッション長時間放置で stdio サーバーが切断 | 下記「切断時の再接続手順」を参照 |

## 切断時の再接続手順（Claude 向け）

Playwright MCP は stdio サーバーのため、HTTP/SSE サーバーと違って **Claude Code の自動再接続対象外** になり得る。セッション開始時は `<system-reminder>` で deferred tools が列挙されるが、長時間放置すると `The following deferred tools are no longer available (their MCP server disconnected)` が飛んできて、それ以降 `ToolSearch` でも見つからない状態になる。

### Claude 側で取るべきアクション

UI 検証を始めようとして切断を検知したら、**自己判断で復旧を試みる → だめならユーザーに具体的な指示を返す**。

1. **まず `/mcp` 相当の状態確認をユーザーに依頼**:
   ```
   Playwright MCP が切断されています。`/mcp` を実行して playwright サーバーの状態を確認し、`failed` 表示なら画面の指示で Retry してください。
   ```
   `/mcp` はスラッシュコマンドなので Claude からは直接実行できない。ユーザー操作が必要。

2. **Retry でも戻らない／`/mcp` が使えない環境の場合**: セッション再起動を依頼
   ```
   セッションを再起動してください（CLI なら exit → 再入、Web なら新規セッション）。再起動後、.mcp.json が再読み込みされて playwright が再接続されます。
   ```

3. **再接続後の初期化**: スキーマを再ロードする必要がある
   ```
   ToolSearch query: "select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click"
   ```
   セッション再起動後は deferred tool 一覧がリセットされているため、初回利用前に必ず `ToolSearch` で再ロードする。

### フォールバック方針

復旧に時間がかかる／ユーザーが手動再起動できない状況では、**UI 検証を飛ばさず「未検証」であることを完了報告に明記**する。`npm run build` / `tsc --noEmit` / `npm test` が通っているだけでは「機能の正しさ」は保証できない旨を添える。

## ランタイム生成物

`browser_snapshot` / `browser_take_screenshot` 等は `.playwright-mcp/` にログ・YAML・画像を自動生成する。`.gitignore` 済みなのでコミットしないこと。

## 参考

- MCP 登録: リポジトリ直下 `.mcp.json`（`--executable-path /opt/pw-browsers/chromium-1194/chrome-linux/chrome` 必須。`@playwright/mcp@latest` では `--browser chromium` が廃止されているため `--executable-path` でプリインストール済み Chromium を直接指す）
- 前提環境: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` が設定され、同パス配下に Playwright 公式 Chromium（`chromium-1194/chrome-linux/chrome`）が配備されていること
- 人間向けセットアップ: `CONTRIBUTING.md` 「MCP サーバー（Playwright による UI 視覚検証）」
