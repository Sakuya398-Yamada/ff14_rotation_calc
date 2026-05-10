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

## HTML5 ネイティブ DnD のワークアラウンド（`browser_drag` が発火しない場合）

本リポジトリの SkillPalette → Timeline ドラッグや Timeline 内の並び替えは、React の `onDragStart` + `dataTransfer.setData(...)` による **HTML5 ネイティブ DnD** で実装されている（`src/client/components/SkillPalette.tsx`, `src/client/components/Timeline.tsx`）。`mcp__playwright__browser_drag` 内部の `dragTo` は **マウス移動イベントをエミュレートするだけで `dragstart` / `drop` を発火しない** ため、ドラッグしても何も起きない（スキルが追加されない／並び替わらない）。

回避策: `browser_evaluate` で **DataTransfer インスタンスを共有**しつつ DragEvent 群を直接 dispatch する。Windows 11 + Microsoft Edge で動作検証済（2026-05-10、Issue #230）。

```js
() => {
  // 1. ソース・ターゲットを DOM クエリで特定
  //    ref は browser_snapshot 毎に変わるので、title/data-testid/textContent 等の安定属性を使う
  const source = document.querySelector('[title="グレアガ (威力: 350)"]');
  const placeholder = Array.from(document.querySelectorAll('div')).find(
    el => el.textContent === 'スキルパレットからドラッグ＆ドロップしてスキルを追加' && el.children.length === 0
  );
  // ドロップゾーンは onDrop が attach された div（このアプリでは placeholder の直接の親）
  const target = placeholder?.parentElement;
  if (!source || !target) return { error: 'source or target not found' };

  // 2. dragstart → dragenter → dragover → drop → dragend を、共有 DataTransfer で順に dispatch
  const dt = new DataTransfer();
  source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('dragover',  { bubbles: true, cancelable: true, dataTransfer: dt }));
  target.dispatchEvent(new DragEvent('drop',      { bubbles: true, cancelable: true, dataTransfer: dt }));
  source.dispatchEvent(new DragEvent('dragend',   { bubbles: true, cancelable: true, dataTransfer: dt }));

  return { skillId: dt.getData('application/skill-id') };
}
```

実装上のポイント:

1. **ソース・ターゲットは安定属性で指定**: `browser_snapshot` の `ref=eNN` は snapshot を取り直すたびに変わるため、ここでは使えない。`[title="..."]` / `data-testid` / 一意な textContent 等を使う
2. **ターゲットは onDrop が直接 attach された要素**: 本アプリの場合、placeholder（「スキルパレットからドラッグ＆ドロップして...」）の **直接の親 div**。先祖を辿りすぎると React の合成イベントが onDrop に届かない
3. **DataTransfer を共有**: `dragstart` で React の handler が `setData("application/skill-id", ...)` する。同じ `DataTransfer` を `drop` に渡さないと skillId が取れず、handler は no-op になる
4. **dragover の preventDefault は React handler が行う**: 戻り値の `overEv.defaultPrevented === true` で確認できる。false なら drop は発火しない（= ターゲットが正しくない）
5. 検証は **`browser_snapshot` で UI 状態の変化（スキル追加・期待威力の更新等）を直接観察** する

並び替え（Timeline 内 DnD）も同じパターンで動く。ソースを既存エントリに、ターゲットを別エントリ／挿入位置にすればよい。

## 失敗時の診断

| 症状 | 原因 | 対処 |
|------|------|------|
| `Failed to launch ... executable doesn't exist at /opt/...` | `.mcp.json` が古い Linux パス前提のまま | `.mcp.json` の playwright 引数が `--browser msedge` になっているか確認。違う場合は修正して Claude Desktop 再起動 |
| `Browser "chrome-for-testing" is not installed` | `--browser` 引数が欠落し、`@playwright/mcp@latest` がデフォルトの chrome-for-testing にフォールバックしている | `.mcp.json` に `--browser msedge` が入っているか確認 → Claude Desktop 再起動 |
| `InputValidationError` / ツールが呼べない | ToolSearch 未実行でスキーマが未ロード | `ToolSearch select:<tool_name>` で先にロード |
| `browser_navigate` でタイムアウト／接続拒否 | Vite が起動していない・ポート違い | `npm run dev:client` のログで実 URL（5173 or 5174）を確認 |
| `msedge` が見つからない／起動しない | システム Edge がアンインストールされている／プロファイル破損 | Edge を再インストール、または `--browser chrome` に切り替え（Chrome がインストールされている場合） |
| 一度使えていた `mcp__playwright__*` ツールが突然 `No matching deferred tools found` になる | セッション長時間放置で stdio サーバーが切断 | 下記「切断時の再接続手順」を参照 |
| `browser_drag` を呼んでも DnD ターゲットが反応しない（スキルが追加されない／並び替わらない／削除されない） | アプリが React の HTML5 ネイティブ DnD（`onDragStart` + `dataTransfer.setData`）で実装されており、`browser_drag` 内部の `dragTo` がマウス移動をエミュレートするだけで `dragstart` / `drop` を発火しない | 上記「HTML5 ネイティブ DnD のワークアラウンド」のスニペットを `browser_evaluate` で実行する |

## 切断時の再接続手順（Claude 向け）

Playwright MCP は stdio サーバーのため、HTTP/SSE サーバーと違って **Claude Code の自動再接続対象外** になり得る。セッション開始時は `<system-reminder>` で deferred tools が列挙されるが、長時間放置すると `The following deferred tools are no longer available (their MCP server disconnected)` が飛んできて、それ以降 `ToolSearch` でも見つからない状態になる。

> **検出環境の注記**: この事象は元々 Claude Code クラウド／devcontainer 環境で観測された（知見ボード #195、2026-04-28）。Windows 11 ローカル環境で同じアイドルタイムアウトが起きるかは 2026-05-10 時点で独立検証していないが、**stdio + アイドル時の socket close という機構自体は OS 非依存**であり、十分長い放置（目安: 30 分以上）では同様に再現し得る前提で復旧手順を整備しておく。Windows 11 で再現が確認できたら本セクションに環境別の挙動差分を追記する。

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
