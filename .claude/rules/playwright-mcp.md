# Playwright MCP 利用ガイド（Claude 向け）

`.claude/rules/` 配下のため起動時に自動で読み込まれる。
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
   ```powershell
   npm run dev:client   # run_in_background: true
   ```
   `VITE vX.Y.Z  ready in ...ms` のログを待ってから次へ。デフォルトは `http://localhost:5173/` だが、ポート競合時は 5174 等にフォールバックされるためログで実 URL を確認する。

   **Vite v8 で Local URL がログに出ない場合**: Vite v8 は `ready in 150ms` のみ出力し `Local: http://localhost:NNNN/` 行を出さないことがある。複数 worktree 並行運用時（5173〜5177 が複数 Vite で埋まる状況）はどのポートで起動したか判別できないため、以下で対処する（知見ボード #195、発生元 #255）：

   - **明示ポート指定で起動するのが確実**: `npx vite --port <空きポート> --strictPort`（`--strictPort` により競合時はフォールバックせず起動失敗するので、起動成功 = 指定ポートが確定する）
   - **listening 中のポートを確認**: `netstat -ano | findstr LISTENING | findstr 517`（PID 列と Vite プロセスを突き合わせれば worktree との対応も取れる）

## クラウドセッション

クラウドセッション（`CLAUDE_CODE_REMOTE=true`）には Edge が無いので、イメージに入っている Chromium を使う。クラウド環境の環境変数に `PLAYWRIGHT_MCP_BROWSER=chromium` と `PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を入れておく（設定はユーザー）。`@playwright/mcp@latest` が探す版の Chromium はイメージに無いため、実行ファイルの指定も要る。

- 画面が無いので自動でヘッドレスになる。snapshot・screenshot は取れる
- 未設定だと、ツールを呼んだときに `Chromium distribution 'msedge' is not found` で失敗する。ユーザーに設定を頼み、このセッションで使えなければ後述「フォールバック方針」に従って未検証と明記する（環境変数はセッションの開始時に読まれる）

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

検証用のタイムライン等を localStorage（キー `ff14-rotation-calc:app-state`）に書いてからリロードしても、**復元されず空のまま** になる。アプリはページ離脱（`pagehide`）で現在の状態を即時保存する（`src/client/components/App.tsx`）ため、リロード直前に書いた値が離脱時の保存で上書きされる（#387 で発生）。

ページの読み込み前に書き込めば上書きされない。アプリのページを開いた状態で `browser_run_code_unsafe` から `page.addInitScript` を登録してリロードする（Windows 11 + Microsoft Edge で動作検証済、2026-10-13、Issue #434）：

```js
async (page) => {
  // 保存形式は src/client/logic/timeline-storage.ts の PersistedAppState。
  // version 不一致・型不正なら初期状態に、選択ジョブに無い skillId のエントリは除外して復元される
  const state = {
    version: 1,
    selectedJob: 'whm',
    level: 100,
    entries: [
      { uid: 'entry-1', skillId: 'glare3' },
      { uid: 'entry-2', skillId: 'glare3' },
    ],
    stats: { critical: 420, directHit: 420, determination: 440, speed: 420 },
    untargetableWindows: [],
    multiTargetWindows: [],
  };
  const flag = `seeded-app-state:${Date.now()}`;
  await page.addInitScript(([json, flag]) => {
    if (sessionStorage.getItem(flag)) return;   // 2 回目以降の読み込みでは書き込まない
    localStorage.setItem('ff14-rotation-calc:app-state', json);
    sessionStorage.setItem(flag, '1');
  }, [JSON.stringify(state), flag]);
  await page.reload();
  await page.locator('[data-skill-entry-uid]').first().waitFor();
  return await page.locator('[data-skill-entry-uid]').count();
}
```

ポイント:

1. **sessionStorage のフラグで 1 回だけ書き込む**: `addInitScript` は以後のページ読み込みのたびに実行される。フラグが無いと、注入後に UI で編集してリロードしたときも注入データに戻り、保存・復元の確認ができない
2. **フラグ名は注入ごとに変える**: 別のデータを注入し直すときは、もう一度スニペットを実行するだけでよい。前回登録したスクリプトも残って実行されるが、そちらのフラグは立っているので書き込まない（フラグ名が同じだと新しい方も書き込まなくなる）
3. **アプリのページを開いてから実行する**: localStorage はオリジン単位なので、`browser_navigate` で Vite の URL を開いた状態から `page.reload()` する
4. 保存データの中身を手で組むのが面倒なときは、UI で状態を作ってから `localStorage.getItem('ff14-rotation-calc:app-state')` で取り出し、`JSON.parse` した値を `state` に使ってよい

## 失敗時の診断

| 症状 | 原因 | 対処 |
|------|------|------|
| `Failed to launch ... executable doesn't exist at /opt/...` | ローカル: `.mcp.json` が古い Linux パス前提のまま／クラウド: `PLAYWRIGHT_MCP_EXECUTABLE_PATH` のパスがイメージに無い | ローカルは `.mcp.json` の playwright 引数が `--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}` か確認して Claude Desktop 再起動。クラウドは `ls -la /opt/pw-browsers` で実在するパスをユーザーに伝え、環境変数を直してもらう |
| `Browser "chrome-for-testing" is not installed` | `--browser` 引数が欠落している、またはクラウドで `PLAYWRIGHT_MCP_EXECUTABLE_PATH` が未設定のまま `chromium` を指定している | ローカルは `.mcp.json` の `--browser` を確認 → Claude Desktop 再起動。クラウドは「クラウドセッション」の環境変数を 2 つとも設定してもらう |
| `Chromium sandboxing failed!`（`Running as root without --no-sandbox is not supported`） | クラウドで `--browser` が `msedge` のまま、実行ファイルだけ Chromium を指している（`PLAYWRIGHT_MCP_BROWSER` が未設定、または `.mcp.json` が `--browser msedge` 固定の古いブランチ）。`msedge` 指定だと sandbox が有効になり、root のコンテナでは起動できない | `PLAYWRIGHT_MCP_BROWSER=chromium` を設定してもらう。古いブランチなら `main` を取り込んでからセッションを開き直す |
| `InputValidationError` / ツールが呼べない | ToolSearch 未実行でスキーマが未ロード | `ToolSearch select:<tool_name>` で先にロード |
| `browser_navigate` でタイムアウト／接続拒否 | Vite が起動していない・ポート違い | `npm run dev:client` のログで実 URL（5173 or 5174）を確認 |
| `msedge` が見つからない／起動しない | システム Edge がアンインストールされている／プロファイル破損／クラウドで `PLAYWRIGHT_MCP_BROWSER` が未設定 | Edge を再インストール、または `--browser chrome` に切り替え（Chrome がインストールされている場合）。クラウドは「クラウドセッション」の環境変数を設定してもらう |
| 一度使えていた `mcp__playwright__*` ツールが突然 `No matching deferred tools found` になる | セッション長時間放置で stdio サーバーが切断 | 下記「切断時の再接続手順」を参照 |
| `browser_drag` を呼んでも DnD ターゲットが反応しない（スキルが追加されない／並び替わらない／削除されない） | dnd-kit の MouseSensor activation（distance: 4）と `dragTo` の一括ジェスチャが競合し、drop 前にドラッグが確定しない | 上記「dnd-kit ベース DnD の検証方法」のステップ分割マウス操作を `browser_run_code_unsafe` で実行する |
| `browser_evaluate` で `select.value = '...'` を代入して `change` を dispatch しても UI が変化しない（値が空に戻る） | React の制御コンポーネントは value 代入を内部状態と同期しないため、直接代入では onChange が発火しない | 上記「React 制御フォーム要素の操作ワークアラウンド」の native setter スニペットを使う |
| localStorage に保存データを書いてからリロードしても復元されない（タイムラインが空のまま） | アプリが `pagehide` で現在の状態を即時保存するため、リロード前に書いた値が離脱時の保存で上書きされる | 上記「保存データを注入して検証する」の `page.addInitScript` スニペットで、ページの読み込み前に書き込む |

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

- MCP 登録: リポジトリ直下 `.mcp.json`（`--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}`。ローカルは Windows 11 標準の Microsoft Edge、クラウドはイメージの Chromium を使うため、どちらも追加のブラウザのダウンロードや `npx playwright install` は不要）
- 前提環境: Windows 11 + Microsoft Edge（システム標準）、またはクラウドセッション（「クラウドセッション」）
- 人間向けセットアップ: `CONTRIBUTING.md` 「MCP サーバー（Playwright による UI 視覚検証）」
