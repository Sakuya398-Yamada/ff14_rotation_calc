# Phase 2: ラベル付与 & ブランチ作成

## ラベル付与

Issue にラベルが付いていない場合、本文の内容から判定して付与する：

- 新しい機能やデータモデルの追加 → `feature`
- 既存機能の不具合修正 → `bug`
- 動作を変えないコード改善 → `refactor`
- ドキュメントのみの変更 → `docs`
- 判断がつかない場合 → ユーザーに確認

GitHub MCP の `issue_write`（method: `update`、`labels`）で付与する（`gh issue edit <N> --add-label <label>` でも可（クラウドセッションでは REST。`SKILL.md`「全体ルール」の「GitHub 操作」））。

## ラベル → ブランチ prefix

| Issueラベル | ブランチprefix |
|-------------|---------------|
| `feature` | `feature/` |
| `bug` | `fix/` |
| `refactor` | `refactor/` |
| `docs` | `docs/` |
| `test` | `feature/` |

> `test` ラベルに専用 prefix は設けない（hook は `feature|fix|refactor|docs` の 4 種のみ許可）。テスト追加は `feature/` を使う（前例: #281、詳細は `.claude/rules/git-conventions.md`）。

## ブランチ作成

```bash
git checkout main
git pull origin main
git checkout -b <type>/<issue番号>-<kebab-case説明>
```

- 説明は小文字英数字とハイフンのみ（例: `feature/42-add-user-model`）。PreToolUse hook（`.claude/hooks/validate-branch-name.sh`）が検証し、違反はブロックされる
- 作業中の変更がある場合は、ユーザーに確認してから切り替える
- Phase 1 手順 2 で「## 着手」の印を、印のブランチがこのチェックアウトにあるので自分の印とした場合は、上のコマンドで新しく切らず、そのブランチで続ける（今いなければ `git switch <ブランチ名>`）
- **同名ブランチが既にある**（ローカルまたは `origin`）場合は過去の試行の残り。黙って `-B` / force-push で上書きせず、Phase 1 手順 2（`phases/01-existing-pr-branch.md`「オープンな旧 PR／既存ブランチがある場合」）の確認結果に従う（作り直すなら `-v2` 等を付けた別名で切る）
- `claude --worktree` で起動したセッション（`.claude/worktrees/<name>/`、初期ブランチ `worktree-<name>`）でも Issue ブランチを切ってから作業する。`main` は他の worktree で checkout 済みのことが多く `git checkout main` が失敗するため、`git fetch origin main` → `git checkout -b <type>/<issue番号>-<kebab-case説明> --no-track origin/main` で切る。`--no-track` が無いと、リモート追跡ブランチから切ったブランチの upstream が `origin/main` になり（`branch.autoSetupMerge` の既定）、Phase 7 の `git push -u` までのあいだ、素の `git pull` が main を取り込み、`git status` も main との差を表示する
- **`routine-ok` の付いた Issue では、ブランチを切ったら Issue に着手の印をコメントする**（`add_issue_comment`。書式は下の「クラウドセッションの場合」手順 4 の `## 着手` を借り、「ブランチ」の行には切ったブランチ名を書く。「セッション」の行は同じ手順のとおり、`CLAUDE_CODE_REMOTE_SESSION_ID` が無ければ（ローカルでは）省く）。同じ Issue に同じブランチ名の印（取り下げたものは除く）が既にあれば、同じ手順のとおり付け直さない。このブランチは Phase 7 まで push しないので、印が無いと日次の `weekday-issue-start` が作業中と分からず、同じ Issue を無人実装することがある（`.claude/routines/weekday-issue-start.md`「2. 対象 Issue の選定」）。作業をやめるときは、印の見出しを「## 着手（取り下げ）」に書き換える。クラウドの割り当てブランチで作業するときは、下の手順 4 の印だけを付ける（二重に付けない）。スケジュール実行の `weekday-issue-start` 自身は付けない（同ルーティンの手順 4 の表）

### クラウドセッションの場合（割り当て済みの作業ブランチ）

Claude Code のクラウドセッションは、開始時に作業ブランチが割り当てられ（多くは `claude/*`。`ccr-*` など別の名前のこともある）、セッションの指示で他のブランチへの push が制限されていることが多い（git のプロキシ自体は通すので、制限は指示によるもの。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションの git プロキシは、別ブランチへの push を通し、ブランチの削除を通さない」）。**`CLAUDE_CODE_REMOTE=true` で、セッションの指示が作業ブランチを指定している、または `git branch --show-current` が `claude/*` なら**（push 制限が明示されていなくても）、上の手順（`git checkout main` / `git pull` / `git checkout -b`）は行わず、**割り当てられたブランチでそのまま作業する**（ブランチ名の規約の対象外。`.claude/rules/git-conventions.md`「ブランチ命名」の例外）。それ以外（ローカル、またはクラウドでも指示に作業ブランチが無く `main` 等にいる場合）は上の通常手順に従う。GitHub MCP が無く `gh` に頼る場合、クラウドでは GraphQL 系のサブコマンドが使えない（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」）。

1. `git branch --show-current` が指示のブランチと違えば、`git switch <ブランチ名>` で切り替える（ローカルか `origin` にあれば、作成扱いにならずブランチ名 hook に当たらない）。どちらにも無ければ、`claude/*` なら `git switch -c <ブランチ名>` で作る。それ以外の名前は hook が作成を止める（hook は名前でしか判定できない）ので、ユーザーに確認する
2. `git fetch origin main` のあと、`git log --oneline origin/main..HEAD` が空であることを確かめる。コミットが残っていれば、どちらの残りかを見分ける
   - **マージ済みの前の Issue の残り**（同じセッションで 2 件目に移ったときなど）: `git diff --quiet HEAD origin/main` が成功する（squash merge 後でツリーが同じ）か、このブランチの PR（`list_pull_requests` の `head` に `<owner>:<ブランチ名>`、`state: closed`）がマージ済みで、その head の SHA が `git rev-parse HEAD` と一致する。この場合は `git reset --keep origin/main` で付け直す（未コミットの変更を消すときは止まる。`git reset --hard` は `settings.json` で deny、`git checkout -B` は `claude/*` 以外の名前だとブランチ名 hook に止められる）
     - `git reset --keep` が auto mode などで拒否されたら、リモートにこのブランチが残っているかを `git ls-remote --heads origin <ブランチ名>` で見て分ける。ローカルの追跡ブランチ（`git branch -vv` の `[origin/<ブランチ名>]`）は、prune しない限りリモートでの削除を反映しないので、判断に使わない。どちらの道も `settings.json` の allow にある `git branch` / `git switch` / `git merge` で済む（ローカルでは allow にあるコマンドは auto mode でも分類器より先に許可される。クラウドセッションでは allow に当たる Bash コマンドも分類器が判定するので、こちらも止められることがある。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションの auto mode では、allow に当たる Bash も分類器が判定する」）
       - **空（マージ後に削除済み）**: 名前が `claude/*` なら、`git branch -m <ブランチ名>-merged-<HEAD の短縮 SHA>` で旧ブランチを退避し、`git switch -c <ブランチ名> origin/main` で作り直す。旧コミットは退避したブランチに残り、PR には乗らない（退避名に SHA を付けるのは、同じセッションで次に移ったときに名前がぶつからないため）。`claude/*` 以外の名前は作り直しがブランチ名 hook に止められるので、退避せずに次と同じく取り込む
       - **残っている**: `git merge origin/main` で取り込む（止まったときは下の「遅れていた場合」）。force push が要らず、squash merge する運用なら最終履歴と PR の差分（Files changed）には影響しない。PR のコミット一覧には前の Issue のコミットが残るので、Phase 7 の PR 本文に、それがマージ済みの前の Issue の分であることを一言書く
   - **この Issue の途中の作業**（同じセッションで `/clear` して同じ Issue をやり直したとき）: Phase 1 手順 2 で、この Issue にこのセッションの「## 着手」の印（セッション URL が自分のもの）があり、残っているコミットの件名がこの Issue の `#<番号>` を持つ。この場合は付け直さず、そのまま続ける
   - **それ以外**: 別の作業の残りなので、続きとして使うかをユーザーに確認する（1 Issue = 1 PR）
3. 下の「古い main 派生の検知」は同じように行う
4. ブランチ名から Issue を辿れないので、次の 2 つで紐づける
   - コミット件名に `#<issue番号>` を付ける（hook が省略を許すのは `claude/*` だけで、それ以外の名前では必須になる）
   - Issue に着手の印をコメントする（`add_issue_comment`）。並行セッションが Phase 1 でこの Issue や兄弟 Issue の作業中を検知するための印。付ける前に、このブランチの印が別の Issue に残っていないかを見る。同じセッションで前の Issue をマージせずに中断し、`/clear` して移ってきた場合、前の Issue に印が残っていて、並行セッションにはそのブランチで作業中と読まれる。`/clear` より前の会話は残っていないので、リポジトリの新しいコメントから探す（同じセッションの印は新しい方にあるので、最新 100 件に無ければそれ以上は遡らない）：

     ```bash
     gh api "repos/{owner}/{repo}/issues/comments?sort=created&direction=desc&per_page=100" --jq '.[] | select(.body | startswith("## 着手\n") and contains("`<割り当てブランチ名>`")) | [.id, .issue_url] | @tsv'
     ```

     今回の Issue 以外のものが見つかり、その Issue が Open で、クローズする PR が紐づいていなければ（`issue_read` の `state` と `closed_by_pull_requests`。PR があるならマージ待ちかマージ済みで、中断ではない）、印のコメントを取り下げに書き換える（`update_issue_comment` に出力の `.id`。`gh` なら `.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」のコメント編集）。取り下げを新しいコメントで足すと印が残り、次の検索でまた見つかるので、印そのものを書き換える：

     ```
     ## 着手（取り下げ）
     - ブランチ `<割り当てブランチ名>` は #<今回の Issue 番号> に移した
     - この Issue のコミット: なし（あれば、どこに残したか）
     ```

     そのうえで、今回の Issue に印を付ける。今回の Issue に、このブランチの「## 着手」の印が既にあれば（上の検索の出力に今回の Issue が出る。「## 着手（取り下げ）」は検索に出ない）、`/clear` してやり直したときなので付け直さない。2 件になると、作業をやめるときに 1 件だけ取り下げても、もう 1 件が作業中として残る：

     ```
     ## 着手
     - ブランチ: `<割り当てブランチ名>`
     - セッション: https://claude.ai/code/session_...
     ```

     セッション URL は環境変数 `CLAUDE_CODE_REMOTE_SESSION_ID`（`cse_` で始まる）の `cse_` を `session_` に置き換えて作る。変数が無ければ「セッション」の行は省く
   - 印を付けたら `git push -u origin HEAD` でブランチを先に push する（中身が `main` と同じでもよい）。Phase 1 の検知で、印のブランチが実在するかを確かめられるようにするため。手順 2 で付け直した場合、マージ後にリモートのブランチが削除されていれば（`git ls-remote --heads origin <ブランチ名>` が空）この通常の push で作り直せる（`--force-with-lease` は、ローカルに残った追跡ブランチと食い違って `stale info` で拒否されるので使わない）。リモートに旧コミットのまま残っていれば force push が要るが、`settings.json` で deny しているので、ユーザーに `git push --force-with-lease origin <ブランチ名>` を打ってもらうか、GitHub 上でブランチを削除してもらう。手順 2 で `git merge origin/main` で取り込んだ場合は、リモートの有無にかかわらず通常の push で足りる

## 古い main 派生の検知

`git pull origin main` を忘れた、worktree がローカル main を更新できなかった、別作業から復帰した直後などに、新ブランチが古い main から派生する事故が起きる（過去事例: #210）。テストが失敗するまで気付かないと `stash → fetch → merge → unstash` の手戻りになるので、**最初のコミット前に** 確認する：

```bash
git fetch origin main
git rev-list --count HEAD..origin/main   # 0 より大きければ遅れている
```

### 遅れていた場合

```bash
git stash push -m "issue-start wip"   # 作業中の変更がある場合のみ
git merge origin/main                 # ファストフォワード or 3-way merge
git stash pop                         # stash した場合のみ
```

クラウドセッションで `git merge` が `refusing to merge unrelated histories` で止まったら、clone が shallow で merge-base が見つかっていないことがある（`git rev-parse --is-shallow-repository` で見る）。`--allow-unrelated-histories` で押し通さず、shallow なら `git fetch --unshallow origin` で全履歴を取ってから取り込み直す（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションの git プロキシは、別ブランチへの push を通し、ブランチの削除を通さない」）

`git merge origin/main` で `Merge branch 'main' into <branch>` コミットが入るのは正常な挙動で、PR を squash merge する運用なら最終履歴には影響しない。

> 検知だけ自動化し、取り込みは hook で強制しない理由: `git merge` を hook で自動実行すると stash の取り扱いミスや conflict 解消の自動化リスクが大きい。
