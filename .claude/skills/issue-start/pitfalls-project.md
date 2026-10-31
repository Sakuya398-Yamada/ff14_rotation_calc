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
