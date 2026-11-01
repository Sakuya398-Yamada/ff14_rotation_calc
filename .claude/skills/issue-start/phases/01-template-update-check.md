# Phase 1 補足: テンプレート更新チェック（手順 0.5）

`phases/01-issue-analysis.md` 手順 0.5 で、バナーが `⚠ Template update available` のとき、またはバナーの版を信じる前に確かめることがあるとき（`Latest` に `(cached …)` が付く、`Checkout:` が作業ディレクトリと違う）に読む。Phase 1 の本体が Bash の出力上限を超えないよう、条件付きのこの手順を分けてある。

## バナーを信じる前の確認

- バナーの `Latest` は、hook がセッション開始時にテンプレート元から取得した版。取得に失敗したときだけ前回取得した版（キャッシュ）を使い、`(cached Nh ago; fetch failed, ...)` と付く。この表示があるときは最新リリースを反映していないことがあるので、版を前提に判断・回答する前に `git ls-remote --tags --refs --sort=-v:refname https://github.com/<owner/repo>.git 'v*' | head -n 1` で直接確認し、新しい方の版を正とする。直接の確認も失敗したら（hook と同じ取得なので、同じ環境では失敗しやすい）、キャッシュの版のまま `phases/01-issue-analysis.md` 手順 0.5 の表の動作に従う。`⚠ Template update available` なら、キャッシュの版はローカルより新しいリリースなので、その版で確認を出し、最新ではないかもしれないこと（`cached Nh ago`）を確認の文に添える
- バナーは hook が実行されたチェックアウトの状態で出る。`## Repository status` の `Checkout:` がこのセッションの作業ディレクトリ（`git rev-parse --show-toplevel`）と違えば、古いメインチェックアウトの hook と版で判定されている可能性がある。起票する前に、作業ツリーの `.claude/template-version` と既定ブランチの版（`MSYS_NO_PATHCONV=1 git show origin/main:.claude/template-version`。`MSYS_NO_PATHCONV=1` は Git Bash のパス変換を止めるためで他環境では無害）を見て、どちらかが最新版なら取り込み済みなので起票しない

## 更新があるときの確認と起票

```
テンプレート元（<owner/repo>）に新しい版があります: <ローカル版> → <最新版>
Release notes: https://github.com/<owner/repo>/releases/tag/<最新版>

このプロジェクトに更新用 Issue を起票しますか？（今の Issue の作業はそのまま続けます）
 [Y] 起票する
 [N] 今回はスキップ（このセッション中は再度聞きません）
```

- 作業中の Issue のブランチでテンプレートを直接更新しない（1 Issue = 1 PR）。[Y] でも動作は「更新用 Issue の起票」までで、その後は `phases/01-issue-analysis.md` 手順 1 に進む
- [Y] の場合: `search_issues`（`owner` / `repo` にこのプロジェクト）で同じ版の更新 Issue（`テンプレートを <最新版> に更新`）が無いか確認し、無ければ `issue_write`（method: `create`）で起票する。タイトル `refactor: テンプレートを <最新版> に更新`、ラベル `refactor`。本文は現在の版 → 最新版、Release notes URL、差分 URL（`https://github.com/<owner/repo>/compare/<ローカル版>...<最新版>`）、`template/` 配下の変更ファイル一覧（compare URL の Files changed、またはテンプレート元のクローンで `git diff --name-only <ローカル版> <最新版> -- template/`。Release notes は Issue 単位で `template/` 外の変更と混ざるので、手で起こさず機械的に得た一覧を貼る。取り込み時の DoD「変更ファイルをすべて確認した」の照合元になる）、完了条件（`.claude/skills/template-update/SKILL.md`「取り込み手順」のチェックリスト）。本文でテンプレート元の Issue や PR に触れるとき（Release notes から主な中身を書き起こすときなど）は `<owner/repo>#N` の形で書く。Release notes の `#N` をそのまま写すと、このプロジェクトの同じ番号の Issue へのリンクになる
- 起票した更新 Issue はあとで通常どおり `/issue-start` する。その Phase 5 の手順は `.claude/skills/template-update/SKILL.md`（`/template-update`）
