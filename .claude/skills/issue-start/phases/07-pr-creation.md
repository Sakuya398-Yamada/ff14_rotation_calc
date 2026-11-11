# Phase 7: PR作成

## push 前チェック

1 つでも該当すれば対応してから進む：

- [ ] `git status --short` に一時ファイル・生成物・ログ・個人設定（`.claude/settings.local.json` 等）が含まれていない
  - 含まれていれば `.gitignore` を確認・修正し、`git rm --cached <path>` で追跡から外す
- [ ] `git diff --name-only origin/main...HEAD` に出る各ファイルについて、なぜ変わったかを言える（記憶に無い変更は、そのファイルの diff で確かめる）。この Issue と無関係な変更（他 Issue の修正・無関係なリファクタ）が混ざっていない。この一覧は手順 2 の「## 変更点」に使う（`--stat` は表示幅でパスが `.../` に省略され、そのパスで diff を引くと何も出ないので、一覧には使わない）
  - 混ざっていれば、まだ push していないブランチは `git reset --soft <正しい基点>` で巻き戻して staging を整理し直す。push 済みのブランチ（クラウドの割り当てブランチ・無人実行の Issue ブランチなど）は、無関係な変更を戻すコミットを足す（force push しない）
- [ ] `git fetch origin main` のあと `git rev-list --count HEAD..origin/main` が 0 である（並行して進めた兄弟 Issue の PR が先にマージされていると、ここで遅れている）
  - 0 でなければ、取り込む前に、この PR が触ったファイルに `main` で入った変更を読む:

    ```bash
    git diff -z --name-only --no-renames origin/main...HEAD | xargs -0 git log -p HEAD..origin/main --
    ```

    この PR が変えた関数を、この PR が触っていないファイルから呼んでいるなら、そのファイルも `--` の後ろに足す（`--no-renames` は改名したファイルの旧パスも拾うため、`-z` と `xargs -0` は空白を含むパスのため。取り込んだあとに打つと `HEAD..origin/main` が空になり、何も出ないので重複なしと読み違える）。作業中に並行してマージされた関連 Issue が、同じ関数に同じ目的の処理を入れていたり、前提を変えていたりすることがある。両方を残すと処理が二重に走る種類の食い違いは、テキストのコンフリクトが無くても（呼び出し側の数行だけでも）起き、既存のテストでは見つからない。重複や食い違いがあれば、どちらに寄せるかを自分で決め、進捗として報告してから取り込む（承認された設計から外れるなら Phase 5「実装」手順 1 のとおりに扱う。理由を添えて報告し、「変える範囲」に無い領域に出るときやスコープが変わるときは承認を取り直す）
  - 読み終えたら `git merge origin/main` で取り込み、コンフリクトがあれば解消してから次の項目へ（Phase 2「古い main 派生の検知」と同じ手順）。`migrations/meta/` がコンフリクトしたら（並行の Issue が同じ番号のマイグレーションを先にマージした）、`.claude/skills/issue-start/pitfalls-project.md`「並行の Issue と同じ番号のマイグレーションを作っていると、`main` の取り込みで `migrations/meta/` がコンフリクトする」の手順で作り直す
- [ ] テスト・リントが最新のコミットで通っている（Phase 6 の手順 1 以降に変更があれば再実行。`origin/main` を取り込んだ場合も再実行）

## 手順

1. リモートにブランチをプッシュする：

   ```bash
   git push -u origin <ブランチ名>
   ```

2. GitHub MCP の `create_pull_request` で `main` への PR を作成する（`.claude/rules/git-conventions.md`「Pull Request」）。`gh pr create --title ... --body-file <tmp>` でも可（クラウドセッションでは REST。`SKILL.md`「全体ルール」の「GitHub 操作」）

   - `owner` / `repo`: リポジトリ情報
   - `title`: `<type>: <説明> #<issue番号>`
   - `head`: 作業ブランチ名 / `base`: `main`
   - `body`: 書き方は `CLAUDE.md`「報告はそれだけで読めるように書く」に従い、下の雛形の `<...>` を埋める
     - 「## 概要」: 結論から 1〜3 行
     - 「## 変更点」: push 前チェックで出した `git diff --name-only origin/main...HEAD` のファイルを、すべて 1 行ずつ載せる。各行は、そのファイルの diff（`git diff origin/main...HEAD -- <ファイル>`）を読んで書く（記憶から書くと、小さい変更を書き漏らす）。lock ファイル・生成物・バイナリは diff を読まず、変わった理由（依存の追加など）を 1 行で書く
     - 「## 挙動の変化」: 既にある挙動のうち、利用者や呼び出し側から見て変わるもの（返す値・既定値・上限・制約・エラーの出方・画面の文言・消したオプションや手順など）を「前 → 後」で書き、無ければ「なし」と書く。挙動が変わるファイルも「## 変更点」には載せる。新しく足した機能は「## 変更点」だけでよい
     - 「レビュー:」の行: 「残した」は、Phase 6 手順 7 で後で対応／このまま進める・起票しない・還元に回すと決まった指摘と、無人実行で `## 実装判断（無人実行）` に挙げた指摘。見送った指摘は 1 件 1 行で理由と一緒に書き、無ければ見送りの行は書かない。Phase 6 を省いたときは「レビュー: 省略（<理由>）」と書く

     ```
     ## 概要
     <1〜3 行>

     ## 変更点
     - `<ファイル>`: <何を変えたか>

     ## 挙動の変化
     - なし / <変わる挙動>: <前> → <後>

     ## テスト
     - <実行したコマンドと結果（例: `npm test` 42 passed）>
     - <手動確認した内容 / 未検証の項目>
     - レビュー: 指摘 N 件（直した A 件・起票した B 件・残した C 件・見送った D 件）
       - 見送り: <指摘>（<理由>）

     closes #<issue番号>
     ```

   - PR を作ったあとにしかできない DoD（リポジトリの外の設定への反映と、その一致の確認など）が残るなら、`## テスト` にその項目を書く。マージ前に終えられる作業なら「マージ前に終える」と添え、`closes` のままにする。マージのあとでないとできない作業なら「マージ後に行う」と添え、`closes` ではなく `refs #<issue番号>` にする（`closes` だとマージの時点で Issue が閉じ、残りの DoD と Phase 8 の記録がクローズ後になる）。PR 本文にも、マージしても Issue が閉じないことを書く。残りの作業を終えたら、確認を得てから Issue をクローズする（`phases/01-no-repo-change.md`「調査だけの Issue」手順 4 と同じ）。残りの作業をユーザーが行うなら、Phase 8 のコメントに残りの項目を書き、クローズはユーザーに任せる
   - レビューを待たせずに先に見せたい場合は `draft: true` で作成し、Phase 8 の記録が終わったら ready にする
   - 作成がタイムアウトや 5xx で失敗扱いになっても、PR 自体は作成されていることがある。再実行する前に `search_pull_requests`（query に `head:<ブランチ名>`、`owner` / `repo` を指定）か `gh pr list --head <ブランチ名> --state all`（クラウドセッションでは REST。`SKILL.md`「全体ルール」の「GitHub 操作」） で作成有無を確認し、作成済みならその URL で手順 3 に進む（同一ブランチから重複 PR を作らない）

3. 作成された PR の URL をユーザーに返す
4. PR を購読する。クラウドセッションかどうかで手順が分かれる：
   - **クラウドセッション（`CLAUDE_CODE_REMOTE=true`）**: 「購読しますか？」とは聞かずに `mcp__claude-code-remote__subscribe_pr_activity`（`owner` / `repo` / `pullNumber`）で購読し、購読したことを報告する。ハーネスが「PR を作ったら確認せずに購読する」よう指示しているため。ツール一覧に無ければ `ToolSearch query: "select:mcp__claude-code-remote__subscribe_pr_activity"` でロードしてから呼ぶ。それでも見つからなければ下のローカルセッションの手順に従う
   - **ローカルセッション**: 購読の可否は **ツールの存在確認をしてから** 提案する（環境によっては `subscribe_pr_activity` が GitHub MCP に存在しない。`github/github-mcp-server` v1.x には無い）：
     1. まず `ToolSearch query: "select:mcp__github__subscribe_pr_activity"` でスキーマロードを試みる
     2. **見つかった場合のみ**「このPRを購読して、CIエラーやレビューコメントを自動対応しますか？」と尋ね、Y なら `subscribe_pr_activity` を呼ぶ
     3. **見つからない場合**（`No matching deferred tools found`）は購読の提案自体を省略し、Phase 7 の完了報告に「CI/レビュー結果は手動で確認してください」と明記する
