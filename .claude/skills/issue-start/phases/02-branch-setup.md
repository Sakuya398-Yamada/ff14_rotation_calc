# Phase 2: ラベル付与 & ブランチ作成

## ラベル付与

Issue にラベルが付いていない場合、本文の内容から判定して付与する：

- 新しい機能やデータモデルの追加 → `feature`
- 既存機能の不具合修正 → `bug`
- 動作を変えないコード改善 → `refactor`
- ドキュメントのみの変更 → `docs`
- 判断がつかない場合 → ユーザーに確認

GitHub MCP の `issue_write`（method: `update`、`labels`）で付与する（`gh issue edit <N> --add-label <label>` でも可）。

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
git checkout -b <type>/#<issue番号>-<kebab-case説明>
```

- 説明は小文字英数字とハイフンのみ（例: `feature/#42-add-user-model`）。PreToolUse hook（`.claude/hooks/validate-branch-name.sh`）が検証し、違反はブロックされる
- **ブランチ名はクォートで囲まず裸で渡す**: `#` を含むためクォートしたくなるが、シェル的に不要（`#` が単語先頭でなければコメント扱いされない）。hook 側もクォートを strip して検証するが（#290 対応）、裸で渡すのが正
- 作業中の変更がある場合は、ユーザーに確認してから切り替える
- **同名ブランチが既にある**（ローカルまたは `origin`）場合は過去の試行の残り。黙って `-B` / force-push で上書きせず、Phase 1 手順 2「オープンな旧 PR／既存ブランチがある場合」の確認結果に従う（作り直すなら `-v2` 等を付けた別名で切る）
- `claude --worktree` で起動したセッション（`.claude/worktrees/<name>/`、初期ブランチ `worktree-<name>`）でも Issue ブランチを切ってから作業する。`main` は他の worktree で checkout 済みのことが多く `git checkout main` が失敗するため、`git fetch origin main` → `git checkout -b <type>/#<issue番号>-<kebab-case説明> origin/main` で切る

### クラウドセッションの場合（割り当て済みの作業ブランチ）

Claude Code のクラウドセッションは、開始時に作業ブランチが割り当てられ（多くは `claude/*`。`ccr-*` など別の名前のこともある）、セッションの指示で他のブランチへの push が制限されていることが多い。**`CLAUDE_CODE_REMOTE=true` で、セッションの指示が作業ブランチを指定している、または `git branch --show-current` が `claude/*` なら**（push 制限が明示されていなくても）、上の手順（`git checkout main` / `git pull` / `git checkout -b`）は行わず、**割り当てられたブランチでそのまま作業する**（ブランチ名の規約の対象外。`.claude/rules/git-conventions.md`「ブランチ命名」の例外）。それ以外（ローカル、またはクラウドでも指示に作業ブランチが無く `main` 等にいる場合）は上の通常手順に従う。GitHub MCP が無く `gh` に頼る場合、クラウドでは GraphQL 系のサブコマンドが使えない（`.claude/skills/issue-start/pitfalls.md`「クラウドセッションでは gh の GraphQL 系が使えない」）。

1. `git branch --show-current` が指示のブランチと違えば、`git switch <ブランチ名>` で切り替える（ローカルか `origin` にあれば、作成扱いにならずブランチ名 hook に当たらない）。どちらにも無ければ、`claude/*` なら `git switch -c <ブランチ名>` で作る。それ以外の名前は hook が作成を止める（hook は名前でしか判定できない）ので、ユーザーに確認する
2. `git fetch origin main` のあと、`git log --oneline origin/main..HEAD` が空であることを確かめる。コミットが残っていれば、どちらの残りかを見分ける
   - **マージ済みの前の Issue の残り**（同じセッションで 2 件目に移ったときなど）: `git diff --quiet HEAD origin/main` が成功する（squash merge 後でツリーが同じ）か、このブランチの PR（`list_pull_requests` の `head` に `<owner>:<ブランチ名>`、`state: closed`）がマージ済みで、その head の SHA が `git rev-parse HEAD` と一致する。この場合は `git reset --keep origin/main` で付け直す（未コミットの変更を消すときは止まる。`git reset --hard` は `settings.json` で deny、`git checkout -B` は `claude/*` 以外の名前だとブランチ名 hook に止められる）
   - **それ以外**: 別の作業の残りなので、続きとして使うかをユーザーに確認する（1 Issue = 1 PR）
3. 下の「古い main 派生の検知」は同じように行う
4. ブランチ名から Issue を辿れないので、次の 2 つで紐づける
   - コミット件名に `#<issue番号>` を付ける（hook が省略を許すのは `claude/*` だけで、それ以外の名前では必須になる）
   - Issue に着手の印をコメントする（`add_issue_comment`）。並行セッションが Phase 1 でこの Issue や兄弟 Issue の作業中を検知するための印：

     ```
     ## 着手
     - ブランチ: `<割り当てブランチ名>`
     - セッション: https://claude.ai/code/session_...
     ```

     セッション URL は環境変数 `CLAUDE_CODE_REMOTE_SESSION_ID`（`cse_` で始まる）の `cse_` を `session_` に置き換えて作る。変数が無ければ「セッション」の行は省く
   - 印を付けたら `git push -u origin HEAD` でブランチを先に push する（中身が `main` と同じでもよい）。Phase 1 の検知で、印のブランチが実在するかを確かめられるようにするため。手順 2 で付け直した場合、マージ後にリモートのブランチが削除されていれば（`git ls-remote --heads origin <ブランチ名>` が空）この通常の push で作り直せる（`--force-with-lease` は、ローカルに残った追跡ブランチと食い違って `stale info` で拒否されるので使わない）。リモートに旧コミットのまま残っていれば force push が要るが、`settings.json` で deny しているので、ユーザーに `git push --force-with-lease origin <ブランチ名>` を打ってもらうか、GitHub 上でブランチを削除してもらう

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

`git merge origin/main` で `Merge branch 'main' into <branch>` コミットが入るのは正常な挙動で、PR を squash merge する運用なら最終履歴には影響しない。

> 検知だけ自動化し、取り込みは hook で強制しない理由: `git merge` を hook で自動実行すると stash の取り扱いミスや conflict 解消の自動化リスクが大きい。
