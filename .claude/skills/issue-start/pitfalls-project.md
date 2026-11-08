# 環境依存のハマりどころ（プロジェクト固有）

`/issue-start` の各 Phase から参照される補助ファイルで、常駐しない。`pitfalls.md` と同じく特定の OS・ツール・版・端末に条件付けられた回避策を置くが、こちらはテンプレートに還元しないこのプロジェクト固有の項目だけを置く（判定は `.claude/rules/workflow-feedback.md`「還元する / しないの判定」）。テンプレートには無いファイルで、`pitfalls.md` が Bash の出力上限（30,000 バイト。`pitfalls.md`「Bash の出力上限は、文字数ではなくバイト数で効く」）を超えないよう、またテンプレート更新の 3-way マージで固有の項目がぶつからないよう分けてある。

- 書き方（条件 / 症状 / 回避 / 確認）と棚卸し（条件が消えたら消す・確認から 6 か月で見直す）は `pitfalls.md` の冒頭と同じ

## npm 10.9.4 で vite / vitest の更新が `edgesOut` で落ちる

- **条件**: npm 10.9.4（Node 22.22.0 同梱）で、vite / vitest を含む依存を更新するとき（`npm audit fix` / `npm update vite vitest` / `npm install -D vite@^8.3.4` 等）
- **症状**: `npm error Cannot read properties of null (reading 'edgesOut')` で落ちる。arborist が vitest の optional peer を辿る `#loadPeerSet` で null を参照している（npm/cli#6193 のスタックトレースも同じ箇所を通る）。vite / vitest 以外のパッケージだけの更新では起きない
- **回避**: vite / vitest 以外は `npm update <pkg...>` で個別に更新し、vite / vitest は `npm update vite vitest --legacy-peer-deps` で上げる。`--legacy-peer-deps` は lock の `dev` / `devOptional` フラグを一部ずらすので、最後に通常モードの `npm install --package-lock-only` で lock を正規化し、もう一度実行しても lock が変わらないことを確かめる。`npx npm@11` での lock の再生成は、lock が 5000 行以上書き換わって最小の変更にならないので使わない
- **確認**: npm 10.9.4（Node 22.22.0）/ 2026-10 / #467・#529

## スキルデータを import するコードを tsx / node で直接実行すると、アイコン PNG で止まる

- **条件**: スキルデータ（`src/client/data/*`）を import するコード（`src/client/logic/timeline-storage.ts` のように間接的に import するものも含む）を、確認用スクリプトなどとして `npx tsx` や `node` で直接実行するとき
- **症状**: データが import するアイコン PNG（`src/client/assets/icons/**`）を JavaScript のモジュールとして読もうとして止まる。PNG の import を URL の文字列に置き換えるのは Vite で、tsx / node はそこを通らない
  - tsx: `.../src/client/assets/icons/mnk/Twin_Snakes.png:1` で `SyntaxError: Invalid or unexpected token`
  - node（`.ts` の型を除去してそのまま実行する版）: `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".png"`
- **回避**: 確認用のコードを一時テストにして Vitest で実行する。Vitest は `vite.config.ts` を読むので、PNG の import は `/assets/icons/...` の文字列になる。`vite.config.ts` の `test.dir` が `src` なので、`src/` の下（`src/client/**/__tests__/` など）に `*.test.ts` の名前で置く。Claude Code から実行すると、Vitest は AI エージェント向けの `agent` レポーター（`std-env` が `CLAUDECODE` などの環境変数で判定）を既定にし、通ったテストの `console.log` を出さない。値を出して見るなら `--reporter=default` を付ける。終わったら消して、`git status --short` に一時ファイルが残っていないことを見る
  ```ts
  // src/client/data/__tests__/tmp-check.test.ts
  import { test } from "vitest";
  import { MNK_ATTACK_SKILLS } from "../mnk-skills";

  test("tmp", () => {
    console.log(MNK_ATTACK_SKILLS.length, MNK_ATTACK_SKILLS[0]?.icon);
  });
  ```
  ```bash
  npx vitest run src/client/data/__tests__/tmp-check.test.ts --reporter=default
  rm src/client/data/__tests__/tmp-check.test.ts
  git status --short
  ```
  設計の承認前など作業ツリーを変えられない間は、scratchpad に一時テスト専用のディレクトリを作ってそこに置く（`--dir` の下の `*.test.ts` はすべて走るので、ほかのファイルと混ぜない）。テストのファイルがリポジトリの外にあるので、import はリポジトリの絶対パスで書く。リポジトリ直下で `--dir` にそのディレクトリを渡して回すと（`--dir` が `test.dir` を上書きする）、`vite.config.ts` を読んだまま、作業ツリーを変えずに値を出せる。`--dir` を広く取る（`/` など）と、テストのファイルを引数で指定していてもその下を全部走査し、`JavaScript heap out of memory` で落ちる
  ```ts
  // <scratchpad>/vitest-tmp/tmp-check.test.ts
  import { test } from "vitest";
  import { MNK_ATTACK_SKILLS } from "<リポジトリの絶対パス>/src/client/data/mnk-skills";

  test("tmp", () => {
    console.log(MNK_ATTACK_SKILLS.length, MNK_ATTACK_SKILLS[0]?.icon);
  });
  ```
  ```bash
  npx vitest run --dir <scratchpad>/vitest-tmp --reporter=default
  git status --short
  ```
- **確認**: tsx 4.23.15・Node 22.22.0・Vitest 4.1.12（Claude Code 2.1.310 クラウドセッション）/ 2026-10 / #629（tsx での停止）・#655（`agent` レポーター）・#679 と #707（scratchpad での回し方と `--dir /` のヒープ不足。Node 22.23.4）

## 並行の Issue と同じ番号のマイグレーションを作っていると、`main` の取り込みで `migrations/meta/` がコンフリクトする

- **条件**: マイグレーションを足したブランチで、並行して進んだ別の Issue が同じ番号のマイグレーション（`000N_*`）を先に `main` へマージしたあと、`main` を取り込むとき（Phase 7「push 前チェック」の `git merge origin/main`）。Phase 1 の重なりの確認（`phases/01-overlap-check.md`）で、後からマージする側が作り直すと決めていたときも同じ
- **症状**: `git merge origin/main` が次のとおり止まる（`0001` は重なった番号）。SQL は名前が違うのでコンフリクトせず、同じ番号の SQL が 2 つ並ぶ
  ```
  CONFLICT (add/add): Merge conflict in migrations/meta/0001_snapshot.json
  CONFLICT (content): Merge conflict in migrations/meta/_journal.json
  ```
- **回避**: 自分のマイグレーションを `main` の次の番号で作り直す。生成物は手で編集しない（`.claude/rules/coding-standards.md`「基本方針」）
  1. `migrations/meta/` は `main` 側を採り、自分の SQL を消して `npm run db:generate` で作り直す。`db:generate` は `src/server/db/schema.ts` と最新の snapshot の差から SQL を作るので、`schema.ts` もコンフリクトしていたら、先に両方の変更を残して解消しておく:
     ```bash
     git checkout --theirs migrations/meta/<番号>_snapshot.json migrations/meta/_journal.json
     git rm migrations/<番号>_<名前>.sql
     npm run db:generate -- --name <名前>
     git add migrations/
     ```
     `<名前>` は自分の SQL のファイル名から番号と `.sql` を除いた部分。マージを終える（`git commit --no-edit`）前に、`ls migrations/` に同じ番号の SQL が並んでいないことと、作り直した SQL に自分の変更だけが入っていることを見る（`main` 側の変更が入っていれば、`meta/` が `main` 側になっていない）
  2. ローカルの D1 に古い版が当たっていたら、消して当て直す。`npx wrangler d1 execute DB --local --command "SELECT name FROM d1_migrations ORDER BY id"` に手順 1 で消した SQL の名前があれば当たっていて、そのままだと `npm run db:migrate` が作り直した版を未適用と見て、`table ... already exists`（列を足す版なら `duplicate column name`）で止まる。古い版が作ったもの（作り直した SQL と同じもの）と履歴の行を消してから当て直す。テーブルは `DROP TABLE` で消す（インデックスはテーブルと一緒に消える。複数なら並べ、外部キーで参照されているテーブルは、参照している側より後に消す）。`ALTER TABLE ... ADD` で足した列は、`DROP TABLE` の代わりに `ALTER TABLE <テーブル> DROP COLUMN <列>` で消す:
     ```bash
     npx wrangler d1 execute DB --local --command "DROP TABLE <テーブル>; DELETE FROM d1_migrations WHERE name = '<番号>_<名前>.sql'"
     npm run db:migrate
     ```
  3. プレビュー用 D1（PR のプレビューのビルドが `npm run db:migrate:preview` で当てる共有の D1）に、古い名前が当たっていないかを見る。古い名前のまま push してプレビューのビルドが走っていれば当たっている。`d1_migrations` の読み方は `CONTRIBUTING.md`「トラブルシューティング」の `table ... already exists` の項目、当たっていたときの直し方は同じファイルの「プレビュー用 D1（初回のみ）」の「マイグレーションの番号を振り直したら、`d1_migrations` の名前も揃える」（push する前に行う）
- **確認**: drizzle-kit 0.31.11・wrangler 4.151.0 / 2026-11 / #876（発見元）・#915（一時クローンで同じコンフリクトを起こして手順 1 を、手元の D1 で手順 2 を、テーブルを作る版と列を足す版の両方で流して確かめた）

## Workers Builds の PR プレビュー URL は、全パスの応答に `X-Robots-Tag: noindex` が付く

- **条件**: 応答ヘッダー（特に `X-Robots-Tag`）の有無を確かめる完了条件を作るとき（Phase 1.5「完了条件の生成」）と、それを確かめるとき
- **症状**: Workers Builds の PR プレビュー URL では、コードが触らない静的ファイル（`/robots.txt`・`/ogp.png`）や `/` も含めて、全パスの応答に `X-Robots-Tag: noindex` が付く。本番の同じパスには付かない。「プレビュー URL で確認」と書いた完了条件では「付かない」ことを確かめられず、PR を作ったあとに完了条件と `closes` / `refs` を直すことになる
- **回避**: 完了条件は、ビルド出力を `wrangler dev` で配信して確かめる形か、マージ後の本番で確かめる形にする（後者なら PR は `refs`。`phases/07-pr-creation.md`）。`wrangler dev` では、ビルドしてから起動し、別の呼び出しで `<パス>` ごとにヘッダーを見る
  ```bash
  npm run build
  npx wrangler dev --config dist/ff14_rotation_calc/wrangler.json
  ```
  ```bash
  curl -s -D - -o /dev/null http://localhost:8787<パス> | grep -i '^x-robots-tag'
  ```
  確かめ終わったら、`run_in_background` で起動したなら `TaskStop`（起動時のタスク ID）で止める。それ以外で起動したときは `kill $(lsof -ti:8787)` で止める（`$!` は `npx` の PID で、kill しても wrangler と workerd が残ってポートを開いたままになる）
- **確認**: Workers Builds のプレビュー・wrangler 4.151.0 / 2026-11 / #837・#910
