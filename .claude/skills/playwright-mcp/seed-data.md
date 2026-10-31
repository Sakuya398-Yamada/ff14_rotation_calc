# Playwright MCP 補助: 検証用の保存データの注入

`SKILL.md`「保存データを注入して検証する」から読む。検証用のタイムラインを localStorage に入れる、匿名トークンの Cookie を入れる、レート制限を超える件数をローカルの D1 に入れるときに使う。SKILL.md が Bash の出力上限（30,000 バイト）を超えないよう、場面を限って読むこの節を分けてある。

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

### 匿名トークンの Cookie を入れる

保存したタイムラインの持ち主は、Cookie `__Host-owner` の匿名トークンで見分ける（`src/server/routes/timelines.ts` の `readOwnerToken`）。決まったトークンの持ち主として確かめたいときは、アプリのページを開いた状態から `browser_run_code_unsafe` で Cookie を入れる（クラウドセッションの Chromium 153 + playwright 1.63 で動作検証済、2026-10-26、Issue #626）：

```js
async (page) => {
  // 32 バイトの乱数を base64url（パディング無し）にした 43 文字（src/server/services/owner-token.ts）。
  // 形が違うと、サーバーは Cookie が無いものとして扱う。Node なら crypto.randomBytes(32).toString('base64url') で作れる
  const token = '<トークン>';
  await page.context().addCookies([
    { name: '__Host-owner', value: token, domain: 'localhost', path: '/', secure: true, sameSite: 'Lax' },
  ]);
  // この持ち主の保存一覧の 1 ページ目（新しい順に 20 件）
  return await page.evaluate(async () => (await fetch('/api/me/timelines')).json());
}
```

ポイント:

1. **`url` ではなく `domain` と `path` を渡す**: `url` を渡すと、Playwright が `secure` を「`url` が `https:` か」で決め直す。http の localhost では `Secure` が外れ、`Secure` が必須の `__Host-` の Cookie として `Invalid cookie fields` で拒まれる（#480）
2. ページを開いてから `page.evaluate` で `` document.cookie = `__Host-owner=${token}; Secure; Path=/; SameSite=Lax` `` と書いても入る（localhost は安全なコンテキストなので `Secure` 付きでも入る。サーバーは HttpOnly かどうかを見ない）。ただし、有効なトークンで一覧や保存の API を一度呼ぶと、サーバーが同じ Cookie を HttpOnly で付け直すので、そのあと別のトークンへの切り替えは `document.cookie` では効かない（エラーにならず無視される）。切り替えは `addCookies` で行う（HttpOnly の Cookie も上書きできる）

### レート制限を超える件数をローカルの D1 に入れる

保存 API には持ち主ごとのレート制限（60 秒に 10 件。`wrangler.jsonc` の `ratelimits`）があるので、ページングのように多くの件数が要る確認では、ローカルの D1 に行を直接入れる。本番（`--remote`）には入れない。

1. 次のスクリプトを scratchpad に `.cjs` で置き、`node <スクリプト> <件数> <SQL の出力先>` で実行する。新しいトークンとそのハッシュが出るので控える
2. dev サーバーを起動したまま、リポジトリ直下で `npx wrangler d1 execute ff14-rotation-calc --local --file <SQL の出力先>` を実行する。dev サーバーを再起動しなくても、次の API の呼び出しから見える
3. 上の「匿名トークンの Cookie を入れる」のスニペットに控えたトークンを入れて確かめる。一覧 API の続きのページは、応答の `nextCursor` を `/api/me/timelines?cursor=` に渡すと返る
4. 確かめ終わったら `npx wrangler d1 execute ff14-rotation-calc --local --command "DELETE FROM timelines WHERE owner_hash = '<ハッシュ>'"` で消す。確かめる間に同じ Cookie で保存した行も一緒に消える

```js
// 新しいトークンを作り、その持ち主の行を <件数> 件入れる SQL を書き出す
const crypto = require('crypto');
const fs = require('fs');

const [count, out] = [Number(process.argv[2]), process.argv[3]];
const token = crypto.randomBytes(32).toString('base64url');
// DB には SHA-256 の hex を書く（src/server/services/owner-token.ts の hashOwnerToken）
const hash = crypto.createHash('sha256').update(token).digest('hex');
// data は PersistedAppState の JSON（上の localStorage のスニペットと同じ形式）。列の定義は src/server/db/schema.ts
const data = JSON.stringify({
  version: 1, selectedJob: 'whm', level: 100,
  entries: [{ uid: 'entry-1', skillId: 'glare3' }],
  stats: { critical: 420, directHit: 420, determination: 440, speed: 420 },
  untargetableWindows: [], multiTargetWindows: [],
});
const now = Math.floor(Date.now() / 1000);
const sql = Array.from({ length: count }, (_, i) => {
  // id は nanoid と同じ 21 文字。共有 URL（/api/timelines/:id）と一覧のカーソルはこの形しか受け付けない
  const id = crypto.randomBytes(16).toString('base64url').slice(0, 21);
  // created_at を 1 秒ずつずらし、新しい順の並びを title（seed 1 が最新）で追えるようにする。
  // D1 は 1 文の長さに上限があるので、1 行ずつ別の INSERT にする
  return `INSERT INTO timelines (id, schema_ver, data, job, level, title, owner_hash, created_at) VALUES ('${id}', 1, '${data}', 'whm', 100, 'seed ${i + 1}', '${hash}', ${now - i});`;
});
fs.writeFileSync(out, sql.join('\n') + '\n');
console.log(JSON.stringify({ token, hash }));
```
