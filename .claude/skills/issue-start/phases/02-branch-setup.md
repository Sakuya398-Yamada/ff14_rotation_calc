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

### クラウドセッションの場合（割り当て済みの `claude/*` ブランチ）

Claude Code のクラウドセッションは、開始時に `claude/*` の作業ブランチが割り当てられ、セッションの指示で他のブランチへの push が制限されていることが多い。**`CLAUDE_CODE_REMOTE=true` かつ `git branch --show-current` が `claude/*` なら**（push 制限が明示されていなくても）、上の手順（`git checkout main` / `git pull` / `git checkout -b`）は行わず、**割り当てられたブランチでそのまま作業する**（ブランチ名の規約の対象外。`.claude/rules/git-conventions.md`「ブランチ命名」の例外）。それ以外（ローカル、またはクラウドでも `main` 等にいる場合）は上の通常手順に従う。

1. `git log --oneline origin/main..HEAD` が空であることを確かめる。コミットが残っていれば別の作業の残りなので、続きとして使うかをユーザーに確認する（1 Issue = 1 PR）
2. 下の「古い main 派生の検知」は同じように行う
3. ブランチ名から Issue を辿れないので、次の 2 つで紐づける
   - コミット件名に `#<issue番号>` を付ける（hook は `claude/*` での省略を許すが、付けておく）
   - Issue に着手の印をコメントする（`add_issue_comment`）。並行セッションが Phase 1 でこの Issue や兄弟 Issue の作業中を検知するための印：

     ```
     ## 着手
     - ブランチ: `claude/xxx`
     - セッション: https://claude.ai/code/session_...
     ```

     セッション URL は環境変数 `CLAUDE_CODE_REMOTE_SESSION_ID`（`cse_` で始まる）の `cse_` を `session_` に置き換えて作る。変数が無ければ「セッション」の行は省く
   - 印を付けたら `git push -u origin HEAD` でブランチを先に push する（中身が `main` と同じでもよい）。Phase 1 の検知で、印のブランチが実在するかを確かめられるようにするため

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
