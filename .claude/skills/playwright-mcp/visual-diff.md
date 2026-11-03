# Playwright MCP 補助: 変更前後の見た目の比較

`SKILL.md`「変更前後で見た目が変わらないことを確かめる」から読む。完了条件に「〜の見た目が変わらない（変更前後で比べる）」や「〜を読めるようにする（変更前後のスクリーンショットで比べる）」のような項目があるときに使う。SKILL.md が Bash の出力上限（30,000 バイト）を超えないよう、場面を限って読むこの節を分けてある。

## 変更前後で見た目が変わらないことを確かめる

スクリーンショットを目視で見比べるより、比べたい要素の属性を JSON に落として diff し、PNG はピクセル差分で差の範囲を出す方が、「変わっていない」を確実に示せる（#632 で発生）。何も変わっていなければ、JSON の diff が空で、差の範囲が `None` になる。

1. **変更前は、Phase 5 の最初の編集の前に撮る**: 作業ツリーを変えたあとでは、同じ手順では変更前を撮れない。撮った JSON と PNG はリポジトリの外（下の例では `${TMPDIR:-/tmp}/visual-diff/`）に置く
   - 撮り忘れて編集を始めていたら、作業ツリーには触らず、`origin/main` を別の worktree に出してそこで撮る。worktree には `node_modules` が無いので `npm ci` が要る。Vite は作業ツリーのものとは別のポートで起動する。Bash ツールの `cd` は作業ディレクトリの外だと次の呼び出しに残らないので、行ごとに `cd` を付ける（付けないと Vite が作業ツリーで起動し、変更後を変更前として撮ってしまう）

     ```bash
     git worktree add --detach "${TMPDIR:-/tmp}/visual-diff-main" origin/main
     cd "${TMPDIR:-/tmp}/visual-diff-main" && npm ci
     cd "${TMPDIR:-/tmp}/visual-diff-main" && npx vite --port <空きポート> --strictPort   # run_in_background: true
     ```

     撮り終えたら、その Vite を `TaskStop` で止め、リポジトリに戻って `git worktree remove "${TMPDIR:-/tmp}/visual-diff-main"` で消す
2. **ビューポートの幅を、タイムラインに横スクロールが出ない幅まで広げる**: `.timeline-scroll` は、はみ出すと末尾までスクロールした状態で描かれ、`fullPage: true` のスクリーンショットでも要素の中のスクロールは広がらない。既定の 1600px では、長いタイムラインの前半が写らない（#632 では 2400px で撮ったら、41.8 秒のうち 18〜42 秒しか写らなかった）。必要な幅は「タイムラインの秒数 × `PX_PER_SEC`（80px、`src/client/components/timeline/constants.ts`）＋ 左の列の幅」。秒数は最後のスキルの時刻ではなく、リキャスト・バフ・DoT の帯の終わりまでを含む（#706 では、所要時間 61.5 秒のタイムラインが神速魔のリキャスト 120 秒まで伸びて、10,141px 要った）。左の列（スキルパレット・レーンラベル・余白）の幅は DOM の実寸で測る。まとめると、`.timeline-scroll` の値で `innerWidth + scrollWidth - clientWidth` になる。下のスクリプトはこの幅に広げ、それでも横スクロールが残っていれば止まる。変更後は変更前と同じ幅で撮る（幅が違うと PNG の大きさが変わって比べられない）
3. **比べたい要素の属性を JSON に落として diff し、PNG はピクセル差分で差の範囲を出す**: 差の範囲は PIL の `ImageChops.difference(a, b).getbbox()` で出す（差が無ければ `None`、あれば `(左, 上, 右, 下)`）

撮るスクリプト（実行のしかたは `SKILL.md`「MCP が使えないとき」と同じ）。scratchpad に `snap.cjs` で置く:

```js
// 使い方: NODE_PATH=$(npm root -g) node <scratchpad>/snap.cjs <URL> <出力先の接頭辞> [ビューポートの幅]
const fs = require('fs');
const { chromium } = require('playwright');

// seed-data.md「保存データを注入して検証する」のスニペットを、横スクロールが出る長さのタイムラインにして貼る
const seed = async (page) => {
};

// 比べたい要素の属性。完了条件に合わせて書き換える（例はタイムラインの中で title を持つ要素の title・style・位置と大きさ）
const collect = (page) => page.$$eval('.timeline-scroll [title]', (els) => els.map((e) => {
  const r = e.getBoundingClientRect();
  return { title: e.getAttribute('title'), style: e.getAttribute('style'), box: [r.x, r.y, r.width, r.height].map(Math.round) };
}));

(async () => {
  const [url, out, fixedWidth] = process.argv.slice(2);
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    // 無いと、何も変えなくても撮るたびに角丸や文字の縁のアンチエイリアスが揺れて、PNG に差が出る（片方だけでも残る）
    args: ['--disable-partial-raster', '--disable-skia-runtime-opts'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('console', (msg) => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
    await page.goto(url);
    await page.locator('#root > *').first().waitFor();
    await seed(page);
    const scroll = page.locator('.timeline-scroll');
    const width = Number(fixedWidth) || await scroll.evaluate((s) => window.innerWidth + s.scrollWidth - s.clientWidth);
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(500);   // 幅を変えたあとの再描画を待つ
    const rest = await scroll.evaluate((s) => s.scrollWidth - s.clientWidth);
    if (rest > 0) throw new Error(`幅 ${width}px でも横スクロールが ${rest}px 残っている`);
    fs.writeFileSync(`${out}.json`, JSON.stringify(await collect(page), null, 2));
    await page.screenshot({ path: `${out}.png`, fullPage: true });
    console.log(`width=${width}`);
  } finally {
    await browser.close();
  }
})();
```

変更前を撮り、出力の `width=` の値を控えておく。変更後は、その値を 3 つ目の引数に渡して撮る:

```bash
mkdir -p "${TMPDIR:-/tmp}/visual-diff"
NODE_PATH=$(npm root -g) node <scratchpad>/snap.cjs http://localhost:<ポート>/ "${TMPDIR:-/tmp}/visual-diff/before"
NODE_PATH=$(npm root -g) node <scratchpad>/snap.cjs http://localhost:<ポート>/ "${TMPDIR:-/tmp}/visual-diff/after" <控えた幅>
```

比べる:

```bash
diff "${TMPDIR:-/tmp}/visual-diff/before.json" "${TMPDIR:-/tmp}/visual-diff/after.json" && echo 'JSON: 差なし'
python3 - "${TMPDIR:-/tmp}/visual-diff/before.png" "${TMPDIR:-/tmp}/visual-diff/after.png" <<'PY'
import sys
from PIL import Image, ImageChops
a, b = (Image.open(p).convert('RGB') for p in sys.argv[1:3])
if a.size != b.size:
    sys.exit(f'大きさが違う: {a.size} / {b.size}')
box = ImageChops.difference(a, b).getbbox()
print(box)
if box:
    a.crop(box).save(sys.argv[1].replace('.png', '-diff.png'))
    b.crop(box).save(sys.argv[2].replace('.png', '-diff.png'))
PY
```

ポイント:

1. **差が出たら、切り出した範囲を見る**: `before-diff.png` と `after-diff.png` に差の範囲だけを切り出して保存するので、Read ツールで開いて見比べる
2. **変更と関係の無さそうな差が出たら、変更前を 2 回撮って比べる**: 2 回の間でも差が出るなら、アニメーションなど撮るたびに揺れる部分がある。その部分が比較から外れるように `collect` のセレクターを絞り、PNG は差の範囲がその部分だけかを確かめる
3. **`.timeline-scroll` はエントリが 1 件以上あるときにしか描かれない**: `seed` を空のままにすると、幅を測る `scroll.evaluate` がタイムアウトする

## 見た目を変える変更で、要素ごとに変更前後を並べる

前の節は、差が無いこと（JSON の diff が空、差の範囲が `None`）で「変わらない」を示す。完了条件が「〜を読めるようにする（変更前後のスクリーンショットで比べる）」のように見た目を変えるものなら、差が出るのが前提なので、この節で、対象の要素ごとに変更前後を拡大して並べて見比べ、差が対象の要素の枠の外に出ていないことを確かめる。

全ページの PNG や差の範囲の切り出しを Read ツールで開くと、長辺が 2,000px に収まるよう縮小されるので、小さな文字の見え方を判断できない（#692 では全ページが幅 13,582px、差の範囲でも 7,064px になり、8px の数字が読めるかを判断できなかった）。要素の box で切り出して整数倍（最近傍）に拡大すると、1px の線も崩さずに見比べられる。

1. **前の節と同じ手順で撮る**: 変更前を撮る時機・ビューポートの幅・`snap.cjs` は前の節のとおり。`collect` は対象の要素だけに絞り（#692 では `.timeline-scroll [title^="ソウルボイス: "] span` でゲージのラベルだけ）、`box` を例のとおり `[x, y, 幅, 高さ]` で返す。`snap.cjs` は等倍でスクロールせずに撮るので、`box` がそのまま PNG の座標になる
2. **比較画像を作る**: 要素ごとに、変更前後の `box` を合わせた範囲で両方の PNG を切り出し、「変更前｜変更後」を横に並べて整数倍に拡大する。JSON の順に縦に積み、高さが 2,000px を超える手前でファイルを分ける
3. **差が対象の要素の枠の外に無いことを確かめる**: 差分から対象の要素の枠を塗ったマスクを引き、`getbbox()` が `None` になれば、差は枠の中だけにある

比較画像を作る（3 つ目の引数が倍率）:

```bash
python3 - "${TMPDIR:-/tmp}/visual-diff/before" "${TMPDIR:-/tmp}/visual-diff/after" 4 <<'PY'
import json, sys
from PIL import Image, ImageChops
MAX = 2000   # Read ツールは長辺がこれを超える画像を縮小する
PAD = 2      # 枠の外に描かれる縁取り・影の分も切り出す
GAP = 8      # 要素と要素の間（拡大後の px）
before, after, scale = sys.argv[1], sys.argv[2], int(sys.argv[3])
imgs = [Image.open(f'{p}.png').convert('RGB') for p in (before, after)]
els = [json.load(open(f'{p}.json')) for p in (before, after)]
if len(els[0]) != len(els[1]):
    sys.exit(f'要素の数が違う: {len(els[0])} / {len(els[1])}')
rows, same = [], []
for i, (ea, eb) in enumerate(zip(*els)):
    # 大きさや位置が変わっても両方が収まるよう、変更前後の box を合わせた範囲で切り出す
    (ax, ay, aw, ah), (bx, by, bw, bh) = ea['box'], eb['box']
    box = (min(ax, bx) - PAD, min(ay, by) - PAD, max(ax + aw, bx + bw) + PAD, max(ay + ah, by + bh) + PAD)
    ca, cb = imgs[0].crop(box), imgs[1].crop(box)
    if not ImageChops.difference(ca, cb).getbbox():
        same.append(i)
    row = Image.new('RGB', (ca.width * 2 + 1, ca.height), (255, 0, 255))   # 間の 1px の線で変更前（左）と変更後（右）を分ける
    row.paste(ca, (0, 0))
    row.paste(cb, (ca.width + 1, 0))
    row = row.resize((row.width * scale, row.height * scale), Image.NEAREST)
    if max(row.size) > MAX:
        sys.exit(f'{i} 番目の要素が {scale} 倍で {row.size} になる。倍率を下げる')
    rows.append((i, row))
pages = [[]]
for i, row in rows:
    if pages[-1] and sum(r.height + GAP for _, r in pages[-1]) + row.height > MAX:
        pages.append([])
    pages[-1].append((i, row))
for n, page in enumerate(pages, 1):
    sheet = Image.new('RGB', (max(r.width for _, r in page), sum(r.height + GAP for _, r in page) - GAP), (255, 0, 255))
    y = 0
    for _, row in page:
        sheet.paste(row, (0, y))
        y += row.height + GAP
    sheet.save(f'{after}-compare-{n}.png')
    print(f'{after}-compare-{n}.png: {page[0][0]}〜{page[-1][0]} 番目')
print('差の無い要素:', same)
PY
```

差が対象の要素の枠の外に無いことを確かめる:

```bash
python3 - "${TMPDIR:-/tmp}/visual-diff/before" "${TMPDIR:-/tmp}/visual-diff/after" <<'PY'
import json, sys
from PIL import Image, ImageChops, ImageDraw
PAD = 2   # 比較画像のスクリプトと同じ値にする
before, after = sys.argv[1:3]
a, b = (Image.open(f'{p}.png').convert('RGB') for p in (before, after))
if a.size != b.size:
    sys.exit(f'大きさが違う: {a.size} / {b.size}')
mask = Image.new('RGB', a.size)
draw = ImageDraw.Draw(mask)
for p in (before, after):
    for e in json.load(open(f'{p}.json')):
        x, y, w, h = e['box']
        draw.rectangle((x - PAD, y - PAD, x + w - 1 + PAD, y + h - 1 + PAD), fill='white')
box = ImageChops.subtract(ImageChops.difference(a, b), mask).getbbox()
print(box)
if box:
    a.crop(box).save(f'{before}-outside.png')
    b.crop(box).save(f'{after}-outside.png')
PY
```

ポイント:

1. **拡大は線の形を見るためのもの**: 実際の大きさで読めるかは、倍率を 1 にした比較画像でも見る。「差の無い要素」に、変えたはずの要素が入っていたら、変更が効いていない
2. **`None` にならなかったら、枠の外の差を見る**: `before-outside.png` と `after-outside.png` に枠の外の差の範囲を切り出すので、Read ツールで開く。対象の要素の縁取りや影が枠から `PAD` より外に描かれるなら `PAD` を広げ、関係の無い場所が変わっているなら、変更が対象の外に及んでいる（撮るたびに揺れる部分かどうかは、前の節のポイント 2 で見分ける）
3. **要素の数が変わる変更では、変更前後で同じ要素が同じ順に並ぶセレクターにする**: 比較画像は JSON の順で変更前と変更後を組にする
