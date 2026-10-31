---
name: playwright-mcp
description: Playwright MCP で UI（src/client/**）の変更をブラウザで確かめるときの手順。ツールの事前ロード・dev サーバーの起動・dnd-kit の DnD・React 制御フォームの操作・保存データの注入・失敗時の診断・切断時の再接続・クラウドセッションのブラウザ設定と MCP が使えないときの代替（Node から Playwright を直接使う）を含む。/issue-start Phase 6 の UI 動作確認や、画面上の見え方を確かめたいときに使う。
---

# Playwright MCP 利用ガイド（Claude 向け）

**Claude が UI/フロントエンド変更時に自前で動作確認するためのランブック** であり、人間向けは `CONTRIBUTING.md` を参照。

ローカル（Windows 11）は **Microsoft Edge** を使う（`.mcp.json` の `--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}` は、環境変数が無ければ `msedge`）。クラウドセッションは後述「クラウドセッション」。

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
   worktree（`.claude/worktrees/<name>/`）で作業しているときは、`node_modules` がメインリポと共有されないので、先に worktree の直下で `npm ci` する（#434）。
   ```powershell
   npm run dev   # run_in_background: true（フロントと /api を同じオリジンで起動）
   ```
   `VITE vX.Y.Z  ready in ...ms` のログを待ってから次へ。デフォルトは `http://localhost:5173/` だが、ポート競合時は 5174 等にフォールバックされるためログで実 URL を確認する。

   検証が終わったら `TaskStop`（起動時のタスク ID）で止める。`run_in_background` 以外で起動したときは、ポートを LISTEN している PID を `kill` する（Linux は `kill $(lsof -ti:<ポート>)`）。`$!` は npm の PID で、kill しても Vite が残る。`pkill -f` は使わない（`.claude/hooks/validate-pkill-pattern.sh` が止める）。

   **Vite v8 で Local URL がログに出ない場合**: Vite v8 は `ready in 150ms` のみ出力し `Local: http://localhost:NNNN/` 行を出さないことがある。複数 worktree 並行運用時（5173〜5177 が複数 Vite で埋まる状況）はどのポートで起動したか判別できないため、以下で対処する（知見ボード #195、発生元 #255）：

   - **明示ポート指定で起動するのが確実**: `npx vite --port <空きポート> --strictPort`（`--strictPort` により競合時はフォールバックせず起動失敗するので、起動成功 = 指定ポートが確定する）
   - **listening 中のポートを確認**: `netstat -ano | findstr LISTENING | findstr 517`（PID 列と Vite プロセスを突き合わせれば worktree との対応も取れる）

## クラウドセッション

クラウドセッション（`CLAUDE_CODE_REMOTE=true`）には Edge が無いので、イメージに入っている Chromium を使う。クラウド環境の環境変数に `PLAYWRIGHT_MCP_BROWSER=chromium` と `PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を入れておく（設定はユーザー）。`@playwright/mcp@latest` が探す版の Chromium はイメージに無いため、実行ファイルの指定も要る。

- 画面が無いので自動でヘッドレスになる。snapshot・screenshot は取れる
- 未設定だと、ツールを呼んだときに `Chromium distribution 'msedge' is not found` で失敗する。ユーザーに設定を頼み、このセッションで使えなければ下の「MCP が使えないとき」の方法で確かめる（環境変数はセッションの開始時に読まれる）

### MCP が使えないとき（Node から Playwright を直接使う）

Playwright MCP に接続できない（`CONNECT_TIMEOUT`、環境変数が未設定など）ときも、イメージにグローバルで入っている `playwright`（`npm root -g`）と `/opt/pw-browsers/chromium` を Node のスクリプトから直接使えば UI を確かめられる（クラウドセッション + playwright 1.56.1 で動作検証済、2026-10-18、Issue #530）。

1. Vite を固定ポートで起動する: `npx vite --port <空きポート> --strictPort`（run_in_background: true）
2. 次のスクリプトを scratchpad に `.cjs` で置き、`NODE_PATH=$(npm root -g) node <スクリプト> http://localhost:<ポート>/` で実行する
3. 撮ったスクリーンショットを Read ツールで開いて確かめる
4. 確かめ終わったら Vite を `TaskStop`（手順 1 のタスク ID）で止める。`run_in_background` 以外で起動したときは `kill $(lsof -ti:<ポート>)` で止める（`$!` は npx の PID で、kill しても Vite が残る）。`pkill -f` は使わない（`.claude/hooks/validate-pkill-pattern.sh` が止める）

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('console', (msg) => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
    await page.goto(process.argv[2]);
    await page.locator('#root > *').first().waitFor();
    // ここで検証する: 保存データの注入（seed-data.md）や DnD（SKILL.md）のスニペットを関数として貼り、await fn(page) で呼ぶ
    await page.screenshot({ path: `${__dirname}/ui-check.png`, fullPage: true });
  } finally {
    await browser.close();
  }
})();
```

ポイント:

1. **拡張子は `.cjs`、読み込みは `require`**: `NODE_PATH` を見るのは `require` だけで、ESM の `import` は `ERR_MODULE_NOT_FOUND` になる
2. **このファイルと `seed-data.md` の `browser_run_code_unsafe` 用スニペットはそのまま使える**: `seed-data.md`「保存データを注入して検証する」と、このファイルの「dnd-kit ベース DnD の検証方法」は `async (page) => { ... }` の形なので、`const seed = async (page) => { ... };` のように貼って `await seed(page)` で呼ぶ。注入スニペットは `page.goto` の後に呼ぶ（スニペットの「アプリのページを開いてから実行する」）
3. **要素の状態は属性やテキストで読む**: snapshot の ref は無いので、`page.locator('[data-skill-entry-uid]').first().getAttribute('title')` のようにロケーターで読み、`console.log` で出す

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

## dnd-kit ベース DnD の検証方法（`browser_drag` 単発では失敗する場合）

本リポジトリの SkillPalette → Timeline ドラッグ／Timeline 内並び替え／削除ゾーンは、Issue #284 で **dnd-kit（`@dnd-kit/core`）のポインタ／タッチセンサー** に移行済み（HTML5 ネイティブ DnD と DataTransfer は廃止）。マウス・タッチの実イベントに反応するため、旧来の「DragEvent + DataTransfer を dispatch するワークアラウンド」は**不要かつ無効**。

注意点: `mcp__playwright__browser_drag`（内部 `dragTo`）は mousedown → move → mouseup を一気に行うため、**MouseSensor の activationConstraint（distance: 4）によるドラッグ開始と mouseup が競合して drop まで届かないことがある**。確実に検証するには `browser_run_code_unsafe` でステップ分割したマウス操作を使う（Windows 11 + Microsoft Edge で動作検証済、2026-08-08、Issue #284）：

```js
async (page) => {
  await page.setViewportSize({ width: 1800, height: 2400 });       // パレット下部（ロールアクション等）も画面内に収める
  const source = page.getByRole('button', { name: /グレアガ/ }).first();
  // 空タイムラインには .timeline-scroll が無いので、プレースホルダー文言をドロップ先にする
  const scroll = page.locator('.timeline-scroll');
  const zone = (await scroll.count()) > 0
    ? scroll
    : page.getByText('スキルパレットからドラッグ', { exact: false });
  const sb = await source.boundingBox();
  const zb = await zone.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100);                                  // センサー activation 猶予
  await page.mouse.move(sb.x + 60, sb.y + 10, { steps: 5 });       // distance 制約を超える小移動
  await page.mouse.move(zb.x + Math.min(400, zb.width / 2), zb.y + Math.min(40, zb.height / 2), { steps: 15 }); // ターゲットへ段階移動
  await page.waitForTimeout(200);                                  // over 判定の安定待ち
  await page.mouse.up();
  return await page.locator('[data-skill-entry-uid]').count();
}
```

実装上のポイント:

1. **mousedown 直後に mouseup しない**: 小移動 → 段階移動 → 200ms 待ち → mouseup の順にする。待ちを挟まないと dnd-kit の DragStart/collision 検出（React state 更新）と競合する
2. **タッチ経路（モバイル相当）の検証**: `page.evaluate` 内で `new Touch(...)` + `TouchEvent` を合成 dispatch する。`touchstart` → **250ms 待ち**（TouchSensor の delay: 150ms を確実に超える）→ `touchmove` を 10 分割 → `touchend`。tolerance: 8px を超える移動を delay 中に入れないこと
3. **削除ゾーンはドラッグ中のみ表示**: ドラッグ開始（activation 後）に「ここにドロップして削除」の座標を取得してから移動する
4. **並び替えの成否は順序で検証**: `page.$$eval('[data-skill-entry-uid]', els => els.map(e => e.getAttribute('title')))` でエントリ順を比較する
5. **エントリのクリック選択との共存**: MouseSensor は distance: 4 未満の移動ならクリック扱いになる。選択の回帰確認は通常の `click()` でよい（詳細パネルの表示で判定）
6. **ビューポートを先に拡大する**: 既定サイズではパレット下部（ロールアクション等）が画面外にあり、`boundingBox` の座標がビューポート外になってドロップを取りこぼす。スニペット冒頭の `setViewportSize` で全体を画面内に収める（#350 で発生）
7. **空タイムラインでは `.timeline-scroll` が存在しない**: エントリ 0 件のときはプレースホルダー（「スキルパレットからドラッグ＆ドロップしてスキルを追加」）だけが描画されるため、`.timeline-scroll` の `boundingBox` はタイムアウトする。スニペットのようにプレースホルダー文言へフォールバックする
8. **ドラッグ中の状態は 1 回だけ読まない**: 挿入インジケーターの位置（`style.left`）のようにドラッグ中にだけ出る状態は、ページ読み込み直後や HMR 直後の最初のドラッグだと、移動後に 1 回読むだけでは値が実行ごとにずれることがある。少し動かしながら間隔を空けて複数回読み（例: 250ms 間隔で 4 回）、値がそろうことを確かめてから判定する（#471 で、移動後 300ms に 1 回読むと 252px / 104px / 空とずれた。原因は未特定）

## React 制御フォーム要素の操作ワークアラウンド（`value` 直接代入が効かない場合）

本リポジトリのジョブセレクター（`<select>`）やステータス入力欄（`<input>`）は React の制御コンポーネントで実装されている。`browser_evaluate` で `select.value = 'blm'; select.dispatchEvent(new Event('change'))` と書いても、**React 内部の状態と乖離して値が反映されない**（`select.value` が空 `''` に戻る）。React が value プロパティのセッターを追跡しているため、**native setter を経由してから `change` イベントを dispatch する** 必要がある。Issue #256 のセッションで実証済み（知見ボード #195）。

```js
// React の制御 select/input は value を直接代入しても internal state と乖離する。
// React の onChange を発火させるには native setter を経由して dispatchEvent する。
const nativeSetter = Object.getOwnPropertyDescriptor(
  window.HTMLSelectElement.prototype, 'value'   // <input> なら HTMLInputElement
).set;
nativeSetter.call(select, 'blm');
select.dispatchEvent(new Event('change', { bubbles: true }));
```

ポイント:

1. **`<select>` に限らず制御コンポーネント全般に当てはまる**: `<input>`（ステータス入力欄）なら `HTMLInputElement.prototype`、`<textarea>` なら `HTMLTextAreaElement.prototype` を使う
2. **`change` イベントは `bubbles: true` で dispatch する**: React はルートでイベントを委譲リッスンしているため、バブリングしないと onChange が呼ばれない
3. **ユースケース**: ジョブセレクター切り替え・ステータス入力欄編集・フィルター変更など、UI 視覚検証で頻出
4. 可能なら `browser_evaluate` ではなく `browser_select_option` / `browser_type`（ref 指定）を優先する。これらは実ブラウザ操作をエミュレートするため React とも整合する。`browser_evaluate` でのワークアラウンドは、snapshot の ref が使えない一括操作スクリプト等で必要になった場合の手段

## 保存データを注入して検証する

検証用のタイムラインを localStorage に入れる手順（リロード直前に書くと、離脱時の保存で上書きされる）と、子節「匿名トークンの Cookie を入れる」「レート制限を超える件数をローカルの D1 に入れる」は、`.claude/skills/playwright-mcp/seed-data.md`「保存データを注入して検証する」に分けてある。保存データを入れて確かめるときだけ Read で読む。

## 失敗時の診断

| 症状 | 原因 | 対処 |
|------|------|------|
| `Failed to launch ... executable doesn't exist at /opt/...` | ローカル: `.mcp.json` が古い Linux パス前提のまま／クラウド: `PLAYWRIGHT_MCP_EXECUTABLE_PATH` のパスがイメージに無い | ローカルは `.mcp.json` の playwright 引数が `--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}` か確認して Claude Desktop 再起動。クラウドは `ls -la /opt/pw-browsers` で実在するパスをユーザーに伝え、環境変数を直してもらう |
| `Browser "chrome-for-testing" is not installed` | `--browser` 引数が欠落している、またはクラウドで `PLAYWRIGHT_MCP_EXECUTABLE_PATH` が未設定のまま `chromium` を指定している | ローカルは `.mcp.json` の `--browser` を確認 → Claude Desktop 再起動。クラウドは「クラウドセッション」の環境変数を 2 つとも設定してもらう |
| `Chromium sandboxing failed!`（`Running as root without --no-sandbox is not supported`） | クラウドで `--browser` が `msedge` のまま、実行ファイルだけ Chromium を指している（`PLAYWRIGHT_MCP_BROWSER` が未設定、または `.mcp.json` が `--browser msedge` 固定の古いブランチ）。`msedge` 指定だと sandbox が有効になり、root のコンテナでは起動できない | `PLAYWRIGHT_MCP_BROWSER=chromium` を設定してもらう。古いブランチなら `main` を取り込んでからセッションを開き直す |
| `InputValidationError` / ツールが呼べない | ToolSearch 未実行でスキーマが未ロード | `ToolSearch select:<tool_name>` で先にロード |
| `browser_navigate` でタイムアウト／接続拒否 | Vite が起動していない・ポート違い | `npm run dev` のログで実 URL（5173 or 5174）を確認 |
| `msedge` が見つからない／起動しない | システム Edge がアンインストールされている／プロファイル破損／クラウドで `PLAYWRIGHT_MCP_BROWSER` が未設定 | Edge を再インストール、または `--browser chrome` に切り替え（Chrome がインストールされている場合）。クラウドは「クラウドセッション」の環境変数を設定してもらう |
| 一度使えていた `mcp__playwright__*` ツールが突然 `No matching deferred tools found` になる | セッション長時間放置で stdio サーバーが切断 | 下記「切断時の再接続手順」を参照 |
| `browser_drag` を呼んでも DnD ターゲットが反応しない（スキルが追加されない／並び替わらない／削除されない） | dnd-kit の MouseSensor activation（distance: 4）と `dragTo` の一括ジェスチャが競合し、drop 前にドラッグが確定しない | 上記「dnd-kit ベース DnD の検証方法」のステップ分割マウス操作を `browser_run_code_unsafe` で実行する |
| `browser_evaluate` で `select.value = '...'` を代入して `change` を dispatch しても UI が変化しない（値が空に戻る） | React の制御コンポーネントは value 代入を内部状態と同期しないため、直接代入では onChange が発火しない | 上記「React 制御フォーム要素の操作ワークアラウンド」の native setter スニペットを使う |
| localStorage に保存データを書いてからリロードしても復元されない（タイムラインが空のまま） | アプリが `pagehide` で現在の状態を即時保存するため、リロード前に書いた値が離脱時の保存で上書きされる | `seed-data.md`「保存データを注入して検証する」の `page.addInitScript` スニペットで、ページの読み込み前に書き込む |
| `addCookies` が `Protocol error (Storage.setCookies): Invalid cookie fields` で止まる | `url` を渡すと Playwright が `secure` を「`url` が `https:` か」で決め直すので、http の localhost では `__Host-` の Cookie に必須の `Secure` が外れる | `seed-data.md`「匿名トークンの Cookie を入れる」のとおり、`url` の代わりに `domain: 'localhost'` と `path: '/'` を渡し、`secure: true` を付ける |
| `getByRole('status')` など `role="status"` のロケーターが `strict mode violation: getByRole('status') resolved to 2 elements` で止まる | dnd-kit の `DndContext` が、読み上げ用の `<div role="status" id="DndLiveRegion-0">` を常に描画している。画面には見えないがロケーターには当たるので、ページ全体で探すと目的の要素とあわせて 2 件以上になる | 対象のコンテナ（dialog など）の中に絞って探す（例: `page.getByRole('dialog').getByRole('status')`） |

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

クラウドセッションでは、まず「MCP が使えないとき（Node から Playwright を直接使う）」の方法で確かめる。それもできない、またはローカルで復旧に時間がかかる／ユーザーが手動再起動できない状況では、**UI 検証を飛ばさず「未検証」であることを完了報告に明記**する。`npm run build` / `tsc --noEmit` / `npm test` が通っているだけでは「機能の正しさ」は保証できない旨を添える。

## ランタイム生成物

`browser_snapshot` / `browser_take_screenshot` 等は `.playwright-mcp/` にログ・YAML・画像を自動生成する。`.gitignore` 済みなのでコミットしないこと。

検証用に手動でルート直下に保存したスクリーンショット（例: `setup-verify.png`）も、検証完了後は削除すること。リポジトリに残さない。

## 参考

- MCP 登録: リポジトリ直下 `.mcp.json`（`--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}`。ローカルは Windows 11 標準の Microsoft Edge、クラウドはイメージの Chromium を使うため、どちらも追加のブラウザのダウンロードや `npx playwright install` は不要）
- 前提環境: Windows 11 + Microsoft Edge（システム標準）、またはクラウドセッション（「クラウドセッション」）
- 人間向けセットアップ: `CONTRIBUTING.md` 「MCP サーバー（Playwright による UI 視覚検証）」
