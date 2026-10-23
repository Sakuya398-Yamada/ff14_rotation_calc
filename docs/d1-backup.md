# D1 のバックアップと復元

本番の D1（`wrangler.jsonc` のバインディング `DB`、DB 名 `ff14-rotation-calc`）を自宅サーバーで毎日エクスポートし、手元に 30 世代残す手順と、壊れたときの戻し方。

---

## 全体像

| 項目 | 内容 |
|------|------|
| 取るもの | 本番 D1 の全テーブル（スキーマとデータ）を SQL で。`wrangler d1 export --remote` |
| 実行する場所 | 自宅サーバー（Linux）の cron から `scripts/d1-backup.sh` |
| 時間帯 | 毎日 04:30 JST。エクスポート中は D1 への他のリクエストが止まる（"A running export will block other database requests." [Import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)）ので、アクセスの少ない時間帯にする |
| 残す数 | 30 世代。新しい順に 30 個を残し、それより古いものは **エクスポートが成功したときだけ** 消す（失敗が続いても古い世代は減らない） |
| ファイル | `ff14-rotation-calc-<UTC の日時>.sql.gz`（例: `ff14-rotation-calc-20261022T193000Z.sql.gz` は 2026-10-23 04:30 JST の分）。所有者だけが読める（600） |

### Time Travel との使い分け

D1 には、常に有効な時点復元の Time Travel もある（[Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)）。

| | Time Travel | このバックアップ |
|---|---|---|
| 戻せる範囲 | Free 7 日 / Paid 30 日以内の任意の時点（分単位） | 30 日分（1 日 1 世代） |
| 戻し方 | 本番の DB をその時点の内容で上書きする（"a destructive operation, and overwrites the database in place."） | 空の D1 に流し込む。本番に触らずに中身を確かめられる |
| 向いている場面 | 直近の誤操作（失敗したマイグレーション、`WHERE` の抜けた `DELETE` など）を本番ごと巻き戻す | Time Travel の範囲より前に戻したい／本番を上書きせずに過去の中身を見たい・一部だけ取り出したい |

迷ったら、7 日以内の時点で、そのあとに保存されたタイムラインが消えてもよいなら Time Travel。それ以外はバックアップから戻す。

---

## 準備（初回のみ）

### 1. API トークンを作る

Cloudflare ダッシュボードの **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token** で作る。Workers Builds のビルド用トークンとは別にする。

| 項目 | 設定 |
|------|------|
| Permissions | **Account** → **D1** → **Edit** |
| Account Resources | **Include** → 本番の D1 があるアカウントだけ |
| Client IP Address Filtering | 任意。自宅の IP が固定なら絞る |
| TTL | 任意 |

- D1 Edit は書き込みもできる権限。エクスポートの API（[Export D1 Database as SQL](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/)）のリファレンスには必要な権限が書かれておらず、D1 Read だけのトークンではエクスポートが HTTP 401 になるという報告が Cloudflare Community に複数あるため、Edit にしている。トークンは自宅サーバーにだけ置き、ほかの用途に使い回さない
- アカウント ID は、ダッシュボードを開いたときの URL `https://dash.cloudflare.com/<アカウント ID>/...` の部分
- スクリプトは DB をバインディング名 `DB` で指定し、ID は `wrangler.jsonc` から取る。アカウント ID も環境変数で渡すので、DB やアカウントを調べる権限は要らない

### 2. 自宅サーバーにリポジトリを置く

```bash
git clone https://github.com/Sakuya398-Yamada/ff14_rotation_calc.git ~/ff14_rotation_calc
cd ~/ff14_rotation_calc
npm ci
```

- Node.js は v22 以上（`node --version`）。wrangler はこの `node_modules` のもの（`package-lock.json` で版が決まる）を使う
- 件数の照合と中身の確認に `sqlite3` を使う（Ubuntu なら `sudo apt install sqlite3`）

### 3. トークンを置く

```bash
mkdir -p ~/.config
touch ~/.config/ff14-d1-backup.env
chmod 600 ~/.config/ff14-d1-backup.env
```

`~/.config/ff14-d1-backup.env` に次のように書く（cron から `.` で読み込むので `export` を付ける）。

```bash
export CLOUDFLARE_API_TOKEN=<1 で作ったトークン>
export CLOUDFLARE_ACCOUNT_ID=<アカウント ID>
# 保存先を変えるときだけ（既定は ~/backups/ff14-rotation-calc-d1）
# export D1_BACKUP_DIR=/path/to/dir
```

### 4. 手で 1 回実行して、件数を照合する

```bash
. ~/.config/ff14-d1-backup.env
~/ff14_rotation_calc/scripts/d1-backup.sh
```

最後に `d1-backup: saved <保存したファイル>` と出れば成功。保存先のディレクトリもここで作られる（所有者だけが入れる 700）。

続けて、バックアップを空の SQLite に流し込んだ件数と、本番の件数を比べる。

```bash
cd ~/ff14_rotation_calc
latest="$(ls -1 ~/backups/ff14-rotation-calc-d1/ff14-rotation-calc-*.sql.gz | sort | tail -n 1)"
work="$(mktemp -d)"
gunzip -c "$latest" | sqlite3 "$work/backup.sqlite"
sqlite3 "$work/backup.sqlite" "SELECT count(*) FROM timelines;"
npx wrangler d1 execute DB --remote --command "SELECT count(*) AS n FROM timelines;"
rm -r "$work"
```

2 つの数が一致すれば OK。エクスポートのあとに保存が入るとずれるので、実行の直後に続けて打つ。

---

## cron に登録する

`crontab -e` で次の 2 行を足す。

```
PATH=/usr/local/bin:/usr/bin:/bin
30 4 * * * . "$HOME/.config/ff14-d1-backup.env" && "$HOME/ff14_rotation_calc/scripts/d1-backup.sh" >>"$HOME/backups/ff14-rotation-calc-d1/backup.log" 2>&1
```

- **`PATH`**: cron の既定の `PATH` に node が無いと wrangler が動かない。`dirname "$(command -v node)"` の出力が上の 3 つに無ければ（nvm などで入れた場合）、先頭に足す
- **時刻**: cron はサーバーのタイムゾーンで動く。`timedatectl`（無ければ `date`）で `Asia/Tokyo`（JST）か確かめ、UTC なら `30 19 * * *`（UTC の 19:30 = JST の 04:30）にする
- **ログ**: 保存先のディレクトリに追記する（手順 4 で作ったディレクトリなので、先に手順 4 を済ませておく）。wrangler はエクスポートのダウンロード URL（1 時間有効）もログに出すが、ディレクトリが 700 なので他のユーザーからは読めない
- 保存先を `D1_BACKUP_DIR` で変えたときは、ログのパスも合わせて変える

## 動いているか確かめる

```bash
ls -l ~/backups/ff14-rotation-calc-d1/
tail -n 20 ~/backups/ff14-rotation-calc-d1/backup.log
```

- 毎日 1 つずつ増え、31 個目ができた日に一番古いものが消えて 30 個に保たれる
- 失敗した日はファイルが増えず、古いものも消えない。ログの最後に出たエラーで見分ける

| ログに出るもの | 原因 | 直し方 |
|---------------|------|--------|
| `CLOUDFLARE_API_TOKEN: is not set` / `CLOUDFLARE_ACCOUNT_ID: is not set` | env ファイルを読めていない | crontab の `.` のパスと、env ファイルの `export` を確かめる |
| `./node_modules/.bin/wrangler: No such file or directory` | リポジトリで `npm ci` していない | `cd ~/ff14_rotation_calc && npm ci` |
| `/usr/bin/env: 'node': No such file or directory` | cron の `PATH` に node が無い | crontab の `PATH` に node のディレクトリを足す |
| `Authentication error` | トークンの権限・期限切れ・IP 制限 | 手順 1 の設定を確かめる（作り直したら env ファイルも書き換える） |
| `the export is empty; keeping the old backups` | エクスポートが空のファイルを返した | 翌日も続くなら、手で実行してエラーを見る |

---

## 復元する

どれも自宅サーバーのリポジトリで、トークンを読み込んでから打つ。

```bash
cd ~/ff14_rotation_calc
. ~/.config/ff14-d1-backup.env
```

### Time Travel で本番を巻き戻す（7 日以内）

```bash
# 戻したい時点のブックマークを確かめる（Unix 秒か、タイムゾーン付きの RFC3339）
npx wrangler d1 time-travel info DB --timestamp="2026-10-23T04:00:00+09:00"
# 本番をその時点の内容で上書きする。実行中のクエリは打ち切られる
npx wrangler d1 time-travel restore DB --timestamp="2026-10-23T04:00:00+09:00"
```

- その時点より後に保存されたタイムラインは消える
- `restore` の最後に出る「To undo this operation, you can restore to the previous bookmark: <ブックマーク>」を控えておくと、`npx wrangler d1 time-travel restore DB --bookmark=<ブックマーク>` で巻き戻す前に戻せる。戻す時点は何度でも選び直せる（古いブックマークは消えない）

### バックアップから新しい D1 に戻す

エクスポートした SQL は、データの入った DB には流し込めない（マイグレーションの適用履歴 `d1_migrations` の行の主キーがぶつかって止まる。`timelines` も `IF NOT EXISTS` の無い `CREATE TABLE` で作る）。空の D1 を作って流し込む。適用履歴も一緒に戻るので、流し込んだあとの DB は、そのバックアップの時点までマイグレーション済みとして扱われる。

```bash
# 1. 空の D1 を作る（設定ファイルに足すか聞かれたら No）
npx wrangler d1 create ff14-rotation-calc-restore

# 2. 戻したい世代を展開して流し込む
work="$(mktemp -d)"
gunzip -c ~/backups/ff14-rotation-calc-d1/ff14-rotation-calc-<日時>.sql.gz >"$work/restore.sql"
npx wrangler d1 execute ff14-rotation-calc-restore --remote --file "$work/restore.sql"
rm -r "$work"

# 3. 件数を確かめる
npx wrangler d1 execute ff14-rotation-calc-restore --remote --command "SELECT count(*) AS n FROM timelines;"
```

本番をこの DB に切り替えるときは、`wrangler.jsonc` の `d1_databases`（バインディング `DB`）の `database_name` と `database_id` を新しい DB のものに書き換えて `main` に入れる。Workers Builds の `npm run deploy` が、未適用のマイグレーションを新しい DB に当ててからデプロイする。切り替えるまでのあいだに古い DB に保存されたタイムラインは新しい DB に無いので、要るならその分を取り出して足す。自宅サーバーで `git pull` すれば、バックアップも新しい DB から取るようになる。

### 中身を見るだけ（本番に触らない）

```bash
work="$(mktemp -d)"
gunzip -c ~/backups/ff14-rotation-calc-d1/ff14-rotation-calc-<日時>.sql.gz | sqlite3 "$work/backup.sqlite"
sqlite3 "$work/backup.sqlite" "SELECT id, job, level, created_at FROM timelines ORDER BY created_at DESC LIMIT 10;"
rm -r "$work"
```

---

## 変えるとき・気を付けること

- **wrangler の版が上がったら**（`package-lock.json` が変わったら）、自宅サーバーで `git pull && npm ci`
- **テーブルを足しても** 手順は変わらない（DB 全体をエクスポートする）。ただし **仮想テーブル（FTS5 など）を足すとエクスポートできなくなる**（[Import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/) の Known limitations）。そのときはこの手順を見直す
- **数値の精度**: エクスポートは JavaScript の数値を通るので、2^53 を超える整数は丸まる。今の列（`created_at` の Unix 秒、`level`）はこの範囲に収まる
- **世代数を変える**ときは `scripts/d1-backup.sh` の `KEEP`
