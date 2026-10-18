---
taskId: weekday-issue-start
title: 【平日】Issue 自動着手ルーティン
schedule: "30 19 * * *"
description: routine-ok の付いた Open Issue を 1 件選び、/issue-start の手順で実装して PR を作る（マージはしない）
---

# weekday-issue-start

あなたは FF14 Rotation Calculator の平日ルーティンです。人が `routine-ok` ラベルを付けた Open Issue から **1 件だけ**選び、`/issue-start` の手順で実装して PR を作成するところまで行います。**無人実行**なので、ユーザーへの質問はしません。**PR のマージと auto-merge の設定はしません**。

- GitHub: `Sakuya398-Yamada/ff14_rotation_calc`
- ローカル: `D:\ドキュメント_D\for_claude\ff14-dev\RotationCalc`（以下 `<repo>`）
- 自分（このルーティン）が作った PR と Issue コメントは、末尾のフッター `_スケジュール実行（weekday-issue-start）による無人実装_` で識別する
- `gh` は `/c/Program Files/GitHub CLI/gh.exe` のフルパスで起動する（GitHub MCP が使えるときはそちらでもよい）

## 1. 事前点検（安全弁）

Issue を選ぶ前に、過去の実行が残した PR とブランチを点検する。Open PR が上限に達していても手順 1-2〜1-4 は行う（人がレビュー中の PR を古くしないため）。

1. `git -C <repo> fetch origin` する
2. 自分の Open PR を取得する（draft も含める）。本文にフッター `_スケジュール実行（weekday-issue-start）による無人実装_` が **単独の行として** ある PR だけを自分の PR とみなす（人の PR も変更点の説明にこの文字列を引用することがあるので、本文検索だけでは絞れない。前例: PR #449）。`gh` なら次の 1 コマンドで済む。GitHub MCP なら `search_pull_requests`（`owner` / `repo` を指定、query: `is:open in:body "スケジュール実行（weekday-issue-start）による無人実装"`）で候補を取り、`pull_request_read`（method: `get`）の `body` で同じ行の有無を確かめ、`mergeable` と head ブランチを読む

   ```bash
   gh pr list -R Sakuya398-Yamada/ff14_rotation_calc --state open \
     --search 'in:body "スケジュール実行（weekday-issue-start）による無人実装"' \
     --json number,isDraft,mergeable,headRefName,body \
     --jq '[.[] | select(.body | test("(?m)^_スケジュール実行（weekday-issue-start）による無人実装_[[:space:]]*$")) | del(.body)]'
   ```

   正規表現にバックスラッシュを使わない（`gh` の jq は文字列中の `\s` を拒否し、Git Bash 経由では `\\` も 1 本に潰れる）

3. **conflict の解消**: `mergeable` が `CONFLICTING` の PR ごとに、そのブランチへ `origin/main` を取り込み、conflict を解消して push する。GitHub の `CONFLICTING` は手元の `git merge origin/main` と同じ 3-way マージの結果なので、マージは必ず conflict で止まる。止まったら自分で解消する（触るのは手順 1-2 で絞った自分の PR だけ）。force push はしない

   ```bash
   W=<repo>/.claude/worktrees/weekday-sync-<PR番号>
   git -C <repo> worktree add --detach "$W" origin/<headRefName>
   git -C "$W" merge origin/main            # conflict で止まる → 該当ファイルを解消して git -C "$W" add <file>
   git -C "$W" commit --no-edit             # 件名は git が用意した Merge ... のまま
   # "$W" の直下で npm ci → npx tsc --noEmit → npm test を通す
   git -C "$W" push origin HEAD:<headRefName>
   git -C <repo> worktree remove "$W"
   ```

   - 解消の判断がつかない、または `tsc` / `npm test` が通らないときは push せず（コミット前なら `git -C "$W" merge --abort`）、worktree を削除して、実行報告の「conflict 解消」に `conflict 未解消: PR #N（理由）` と書く（解消は人が行う）
   - `mergeable` が `UNKNOWN`（GitHub が計算中）なら 30 秒ほど待って取り直す。それでも `UNKNOWN` なら触らず、`mergeable 未判定: PR #N` と書く
   - detached HEAD で作業するのは、過去の実行の worktree（`weekday-<番号>`）が同じブランチを checkout したまま残っていても衝突しないようにするため
4. **取り残しブランチの報告**: リモートの `<type>/#<番号>-*` ブランチのうち、**Issue が Open で、そのブランチを head にした Open PR が無い** ものを実行報告に列挙する（削除はしない。削除は人が判断する）。途中で落ちた実行の残りで、その Issue は手順 2 の条件により黙って選ばれなくなっている。クローズ済み Issue のブランチ（マージ済み PR の残り）は多数あるので列挙しない

   ```bash
   git -C <repo> ls-remote --heads origin | sed 's#.*refs/heads/##' | grep -E '^[a-z]+/#[0-9]+-'
   ```

   番号ごとに Issue の state と Open PR の有無を見る（`gh issue view <番号> --json state` / `gh pr list --state open --head <ブランチ名>`。手順 1-2 で取った自分の PR の `headRefName` と突き合わせるだけでは、人が作った Open PR を見落とす）
5. **Open PR 上限**: 手順 1-2 の件数（draft 含む）が **5 件以上** なら、Issue の選定に進まず、実行報告の「対象」に `対象なし（Open PR 上限 5 件に到達）` と書いて終了する。上限は人がさばける PR の本数で決めてある（#445）

## 2. 対象 Issue の選定

1. Open Issue のうち、次をすべて満たすものを候補にする
   - ラベル `routine-ok` が付いている（人が無人実装を許可した印。このルーティンは付けも外しもしない。#503）。最初に `gh issue list -R Sakuya398-Yamada/ff14_rotation_calc --state open --label routine-ok --json number,title,labels` で絞り、0 件なら残りの条件は確かめずに手順 2-3 へ進む
   - ラベルに `feature` / `bug` / `refactor` / `docs` / `test` のいずれかがある（`meta` / `question` は除く。#2 のテンプレート Issue も除く）
   - ラベル `needs-decision` が付いていない（過去の実行が判断できずに人の決定を待っている Issue。人が決めてラベルを外すと再び候補になる）
   - その Issue に紐づく Open PR が無く、リモートに `*/#<番号>-*` のブランチも無い（別のセッションが着手済みの可能性があるため）
   - 本文の `依存: #M` がすべてクローズ済み
   - sub-issue を持つ親 Issue ではない
   - `## 未確定事項` に「要ユーザー確認」「ユーザー判断」のように、ユーザーの決定待ちと明記された項目が無い
2. 優先順位は `priority:high` → `priority:medium` → `priority:low` → `priority:*` 無しの順。同じ順位なら番号の小さい順
3. 候補が無ければ（`routine-ok` の付いた Issue が無い日も含む）何もせず、実行報告に「対象なし」と書いて終了する

## 3. 作業環境

1. worktree を作る（ブランチ名は `.claude/rules/git-conventions.md` の規約。ラベル `bug` → `fix/`、`test` → `feature/`）

   ```bash
   git -C <repo> worktree add <repo>/.claude/worktrees/weekday-<番号> -b <type>/#<番号>-<kebab-desc> origin/main
   ```

2. worktree の直下で `npm ci` を実行する。`node_modules` が無いまま親リポジトリの依存を解決すると、`@dnd-kit/core` が二重に解決されてテストが落ちる（#349 の実行で発生）
3. 以降の作業はすべてこの worktree で行う

## 4. 実装（`/issue-start` の手順を無人向けに読み替える）

`<worktree>/.claude/skills/issue-start/SKILL.md` と `phases/*.md` に従う。ただし、ユーザー確認を前提にしている箇所は次のように読み替える。

| 箇所 | 無人実行での扱い |
|------|-----------------|
| Phase 1 の不足確認 | 質問せず、Issue 本文と既存コードから判断する。要件の分岐をどうしても決められない場合は、Issue にその旨をコメントし、ラベル `needs-decision` を付け（`gh issue edit <番号> --add-label needs-decision`）、worktree を削除して終了する（PR は作らない）。ラベルが付いている間は手順 2 で選ばれないので、翌日以降に同じ Issue へ同じコメントを積まない |
| Phase 1 手順 0.5（テンプレート更新） | 起票しない。実行報告に「テンプレート更新あり（vOLD → vNEW）」と書くだけ |
| Phase 4 の設計承認 | 自分で承認して進める。設計の要点と判断の根拠を、PR 本文の `## 実装判断（無人実行）` に書く |
| Phase 3/5/6 のスコープ外問題 | 起票しない。PR 本文と実行報告に「起票候補」として列挙する |
| Phase 6 のレビュー | `code-reviewer` で実施し、指摘は修正する |
| Phase 7 の PR 作成 | push 前に `origin/main` を取り込む。PR 本文の末尾にフッター `_スケジュール実行（weekday-issue-start）による無人実装_` を付ける（手順 1 で自分の PR を識別するため）。PR は作成までで、マージ・auto-merge はしない。force push しない |
| Phase 8 の記録 | Issue への実装メモは記録する。知見ボード #195 への投稿とテンプレート元への還元はしない。気づきは実行報告に「知見ボード候補」として列挙する |

その他のルール:

- 検証として `npx tsc --noEmit` と `npm test` を必ず実行する。失敗が解消できなければ PR を draft で作成し、理由を本文に書く
- UI に関わる変更は Playwright MCP で確認する。使えなければ PR 本文の `## テスト` に「UI未検証（スケジュール実行のため）」と書く
- hook にブロックされたら規約に合わせて直す。`--no-verify` などで回避しない
- Issue に残す実装メモの見出しは `## 実装メモ（スケジュール実行 weekday-issue-start による無人セッション）` とし、末尾に `_スケジュール実行（weekday-issue-start）による無人実装_` を付ける。PR 本文の末尾にも同じフッターを付ける

## 5. 実行報告

最後に、次の形式で報告する。報告本文は実行ログ Issue #448（`meta: ルーティン実行ログ`）にもコメントとして投稿する（**1 実行 1 コメント**。「対象なし」で終わる実行も投稿する。この投稿は `.claude/rules/workflow-feedback.md`「自動化しないこと」の例外として事前承認済み）。投稿できなければ（GitHub MCP も gh も使えない等）、従来どおりセッションに報告を出すだけにする。

```
## weekday-issue-start 実行報告（YYYY-MM-DD）
- Open PR 数: K 件（上限 5、draft 含む）
- conflict 解消: PR #N を origin/main と同期（tsc / npm test 通過）／ conflict 未解消: PR #M（理由）／ mergeable 未判定: PR #L ／ なし
- 取り残しブランチ: <ブランチ名>（#N、Open PR 無し）… ／ なし
- 対象: #N タイトル（選定理由: 優先度・番号）／ または「対象なし」「対象なし（Open PR 上限 5 件に到達）」
- PR: <URL>（draft かどうか）
- 検証: tsc / npm test / UI 確認の結果（未検証の項目は明記）
- 実装判断: 無人で決めた設計判断の要約
- 起票候補（スコープ外問題）: …
- 知見ボード候補: …
- テンプレート更新: あり（vOLD → vNEW）／ なし
```
