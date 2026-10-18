# Phase 7: PR作成

## push 前チェック

1 つでも該当すれば対応してから進む：

- [ ] `git status --short` に一時ファイル・生成物・ログ・個人設定（`.claude/settings.local.json` 等）が含まれていない
  - 含まれていれば `.gitignore` を確認・修正し、`git rm --cached <path>` で追跡から外す
- [ ] `git log origin/main..HEAD --stat` にこの Issue と無関係な変更（他 Issue の修正・無関係なリファクタ）が混ざっていない
  - 混ざっていれば `git reset --soft <正しい基点>` で巻き戻して staging を整理し直す
- [ ] `git fetch origin main` のあと `git rev-list --count HEAD..origin/main` が 0 である（並行して進めた兄弟 Issue の PR が先にマージされていると、ここで遅れている）
  - 0 でなければ、取り込む前に、この PR が触ったファイルに `main` で入った変更を読む:

    ```bash
    git diff -z --name-only --no-renames origin/main...HEAD | xargs -0 git log -p HEAD..origin/main --
    ```

    この PR が変えた関数を、この PR が触っていないファイルから呼んでいるなら、そのファイルも `--` の後ろに足す（`--no-renames` は改名したファイルの旧パスも拾うため、`-z` と `xargs -0` は空白を含むパスのため。取り込んだあとに打つと `HEAD..origin/main` が空になり、何も出ないので重複なしと読み違える）。作業中に並行してマージされた関連 Issue が、同じ関数に同じ目的の処理を入れていたり、前提を変えていたりすることがある。両方を残すと処理が二重に走る種類の食い違いは、テキストのコンフリクトが無くても（呼び出し側の数行だけでも）起き、既存のテストでは見つからない。重複や食い違いがあれば、どちらに寄せるかを自分で決め、進捗として報告してから取り込む（承認された設計から外れるなら Phase 5「実装」手順 1 と同じく理由を添え、スコープが変わるならユーザーに確認する）
  - 読み終えたら `git merge origin/main` で取り込み、コンフリクトがあれば解消してから次の項目へ（Phase 2「古い main 派生の検知」と同じ手順）
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
   - `body`:

     ```
     ## 概要
     （1〜3 行）

     ## 変更点
     - ...

     ## テスト
     - 実行したコマンドと結果（例: `npm test` 42 passed）
     - 手動確認した内容 / 未検証の項目

     closes #<issue番号>
     ```

   - PR を作ったあとにしかできない DoD（リポジトリの外の設定への反映と、その一致の確認など）が残るなら、`## テスト` にその項目を書く。マージ前に終えられる作業なら「マージ前に終える」と添え、`closes` のままにする。マージのあとでないとできない作業なら「マージ後に行う」と添え、`closes` ではなく `refs #<issue番号>` にする（`closes` だとマージの時点で Issue が閉じ、残りの DoD と Phase 8 の記録がクローズ後になる）。PR 本文にも、マージしても Issue が閉じないことを書く。残りの作業を終えたら、確認を得てから Issue をクローズする（`phases/01-issue-analysis.md`「調査だけの Issue」手順 4 と同じ）。残りの作業をユーザーが行うなら、Phase 8 のコメントに残りの項目を書き、クローズはユーザーに任せる
   - レビューを待たせずに先に見せたい場合は `draft: true` で作成し、Phase 8 の記録が終わったら ready にする
   - 作成がタイムアウトや 5xx で失敗扱いになっても、PR 自体は作成されていることがある。**再実行する前に** `search_pull_requests`（query に `head:<ブランチ名>`、`owner` / `repo` を指定）か `gh pr list --head <ブランチ名> --state all`（クラウドセッションでは REST。`SKILL.md`「全体ルール」の「GitHub 操作」） で作成有無を確認し、作成済みならその URL で手順 3 に進む（同一ブランチから重複 PR を作らない）

3. 作成された PR の URL をユーザーに返す
4. PR を購読する。クラウドセッションかどうかで手順が分かれる：
   - **クラウドセッション（`CLAUDE_CODE_REMOTE=true`）**: 「購読しますか？」とは聞かずに `mcp__claude-code-remote__subscribe_pr_activity`（`owner` / `repo` / `pullNumber`）で購読し、購読したことを報告する。ハーネスが「PR を作ったら確認せずに購読する」よう指示しているため。ツール一覧に無ければ `ToolSearch query: "select:mcp__claude-code-remote__subscribe_pr_activity"` でロードしてから呼ぶ。それでも見つからなければ下のローカルセッションの手順に従う
   - **ローカルセッション**: 購読の可否は **ツールの存在確認をしてから** 提案する（環境によっては `subscribe_pr_activity` が GitHub MCP に存在しない。`github/github-mcp-server` v1.x には無い）：
     1. まず `ToolSearch query: "select:mcp__github__subscribe_pr_activity"` でスキーマロードを試みる
     2. **見つかった場合のみ**「このPRを購読して、CIエラーやレビューコメントを自動対応しますか？」と尋ね、Y なら `subscribe_pr_activity` を呼ぶ
     3. **見つからない場合**（`No matching deferred tools found`）は購読の提案自体を省略し、Phase 7 の完了報告に「CI/レビュー結果は手動で確認してください」と明記する

## ワークフロー改善余地のメモ（Phase 8 向け）

PR 作成フロー自体への気づき（`closes #N` の付け忘れ誘因、push 周りのハマりどころ、本文テンプレートに足したい項目など）があれば短文メモで控え、Phase 8 で知見ボード（#195）に書く（ユーザー確認を挟む。詳細は `phases/08-issue-recording.md`）。
