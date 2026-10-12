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
