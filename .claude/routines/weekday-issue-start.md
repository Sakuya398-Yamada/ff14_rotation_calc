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
- 起動場所: 最初に `git rev-parse --git-dir` と `git rev-parse --git-common-dir` を別々に実行し、出力が違えば **worktree 起動**（Claude Desktop のスケジュールタスクで worktree のトグルを ON にしていると、実行ごとに `<repo>/.claude/worktrees/<name>` が作られてそこで起動する）、同じなら **メイン起動**（`<repo>` で起動）とする
- worktree 起動では、Claude Code の worktree 隔離が、セッションの worktree の外（別の worktree も `<repo>` も）への Edit / Write と、git を別の場所に向けるコマンド（`git -C <repo>` など。読み取りだけでも）を拒否する（#504）。git は `-C` を付けずにセッションの worktree で打つ。refs は共有なので、fetch や ls-remote の結果は `<repo>` で打つのと同じ
- 自分（このルーティン）が作った PR と Issue コメントは、末尾のフッター `_スケジュール実行（weekday-issue-start）による無人実装_` で識別する
- `gh` は `/c/Program Files/GitHub CLI/gh.exe` のフルパスで起動する（GitHub MCP が使えるときはそちらでもよい）

## 1. 事前点検（安全弁）

Issue を選ぶ前に、過去の実行が残した PR とブランチを点検する。Open PR が上限に達していても手順 1-2〜1-4 は行う（人がレビュー中の PR を古くしないため）。

1. セッションの作業ディレクトリで `git fetch origin` する（`-C` は付けない）
2. 自分の Open PR を取得する（draft も含める）。本文にフッター `_スケジュール実行（weekday-issue-start）による無人実装_` が **単独の行として** ある PR だけを自分の PR とみなす（人の PR も変更点の説明にこの文字列を引用することがあるので、本文検索だけでは絞れない。前例: PR #449）。`gh` なら次の 1 コマンドで済む。GitHub MCP なら `search_pull_requests`（`owner` / `repo` を指定、query: `is:open in:body "スケジュール実行（weekday-issue-start）による無人実装"`）で候補を取り、`pull_request_read`（method: `get`）の `body` で同じ行の有無を確かめ、`mergeable` と head ブランチを読む

   ```bash
   gh pr list -R Sakuya398-Yamada/ff14_rotation_calc --state open \
     --search 'in:body "スケジュール実行（weekday-issue-start）による無人実装"' \
     --json number,isDraft,mergeable,headRefName,body \
     --jq '[.[] | select(.body | test("(?m)^_スケジュール実行（weekday-issue-start）による無人実装_[[:space:]]*$")) | del(.body)]'
   ```

   正規表現にバックスラッシュを使わない（`gh` の jq は文字列中の `\s` を拒否し、Git Bash 経由では `\\` も 1 本に潰れる）

3. **conflict の解消**: `mergeable` が `CONFLICTING` の PR ごとに、そのブランチへ `origin/main` を取り込み、conflict を解消して push する。GitHub の `CONFLICTING` は手元の `git merge origin/main` と同じ 3-way マージの結果なので、マージは必ず conflict で止まる。止まったら自分で解消する（触るのは手順 1-2 で絞った自分の PR だけ）。force push はしない

   PR の head を detached HEAD で取り出す場所は起動場所で分ける。

   | 起動場所 | 取り出し方 | 以降の git を打つ場所 |
   |---------|-----------|---------------------|
   | worktree 起動 | `git checkout --detach origin/<headRefName>` | セッションの worktree（`-C` なし） |
   | メイン起動 | `git -C <repo> worktree add --detach <repo>/.claude/worktrees/weekday-sync-<PR番号> origin/<headRefName>` | 作った worktree（`git -C <その worktree>`） |

   ```bash
   git merge origin/main            # conflict で止まる → 該当ファイルを解消して git add <file>
   git commit --no-edit             # 件名は git が用意した Merge ... のまま
   # 同じ場所の直下で npm ci → npx tsc --noEmit → npm test を通す
   git push origin HEAD:<headRefName>
   # メイン起動のときだけ: git -C <repo> worktree remove <repo>/.claude/worktrees/weekday-sync-<PR番号>
   ```

   - 解消の判断がつかない、または `tsc` / `npm test` が通らないときは push せず（コミット前なら `git merge --abort`）、メイン起動なら作った worktree を削除して、実行報告の「conflict 解消」に `conflict 未解消: PR #N（理由）` と書く（解消は人が行う）。worktree 起動ではセッションの worktree をそのまま次の PR と手順 3 に使う（push しなかった merge commit は detached HEAD に残るだけで、次の checkout で外れる）
   - `mergeable` が `UNKNOWN`（GitHub が計算中）なら 30 秒ほど待って取り直す。それでも `UNKNOWN` なら触らず、`mergeable 未判定: PR #N` と書く
   - detached HEAD で作業するのは、過去の実行が使った worktree（前日以前のセッションの worktree や `weekday-<番号>`）が同じブランチを checkout したまま残っていても衝突しないようにするため
4. **取り残しブランチの報告**: リモートの `<type>/#<番号>-*` ブランチのうち、**Issue が Open で、そのブランチを head にした Open PR が無い** ものを実行報告に列挙する（削除はしない。削除は人が判断する）。途中で落ちた実行の残りで、その Issue は手順 2 の条件により黙って選ばれなくなっている。クローズ済み Issue のブランチ（マージ済み PR の残り）は多数あるので列挙しない

   ```bash
   git ls-remote --heads origin | sed 's#.*refs/heads/##' | grep -E '^[a-z]+/#[0-9]+-'
   ```

   番号ごとに Issue の state と Open PR の有無を見る（`gh issue view <番号> --json state` / `gh pr list --state open --head <ブランチ名>`。手順 1-2 で取った自分の PR の `headRefName` と突き合わせるだけでは、人が作った Open PR を見落とす）
5. **Open PR 上限**: 手順 1-2 の件数（draft 含む）が **5 件以上** なら、Issue の選定に進まず、実行報告の「対象」に `対象なし（Open PR 上限 5 件に到達）` と書いて終了する。上限は人がさばける PR の本数で決めてある（#445）

## 2. 対象 Issue の選定

1. Open Issue のうち、次をすべて満たすものを候補にする
   - ラベル `routine-ok` が付いている（人が無人実装を許可した印。このルーティンは付けも外しもしない。#503）
   - ラベルに `feature` / `bug` / `refactor` / `docs` / `test` のいずれかがある（`meta` / `question` は除く。#2 のテンプレート Issue も除く）
   - ラベル `needs-decision` が付いていない（過去の実行が判断できずに人の決定を待っている Issue。人が決めてラベルを外すと再び候補になる）
   - その Issue に紐づく Open PR が無く、リモートに `*/#<番号>-*` のブランチも無い（別のセッションが着手済みの可能性があるため）
   - コメントに「## 着手」の印が無い（クラウドセッションの作業ブランチ `claude/*` 等は名前に Issue 番号が入らず、上の条件では作業中と分からないため。印の書式は `.claude/skills/issue-start/phases/02-branch-setup.md`「クラウドセッションの場合」手順 4）。「## 着手（取り下げ）」に書き換わった印は数えない。印が古くても除外し続け、作業していないと分かった印は人が「## 着手（取り下げ）」に書き換えて外す（#493）
   - 本文の `依存: #M` がすべてクローズ済み
   - sub-issue を持つ親 Issue ではない
   - `## 未確定事項` に「要ユーザー確認」「ユーザー判断」のように、ユーザーの決定待ちと明記された項目が無い

   確かめるときは、最初に `gh issue list -R Sakuya398-Yamada/ff14_rotation_calc --state open --label routine-ok --json number,title,labels` で `routine-ok` の付いた Issue に絞る。0 件なら残りの条件は確かめずに手順 2-3 へ進む

   着手の印は、候補ごとに `gh api "repos/Sakuya398-Yamada/ff14_rotation_calc/issues/<番号>/comments?per_page=100" --jq '[.[] | select(.body | startswith("## 着手\n"))] | length'` が `0` であることで確かめる（GitHub MCP なら `issue_read` の `get_comments`）。見出しの直後の改行まで含めて比べるので、「## 着手（取り下げ）」の印には当たらない
2. 優先順位は `priority:high` → `priority:medium` → `priority:low` → `priority:*` 無しの順。同じ順位なら番号の小さい順
3. 候補が無ければ（`routine-ok` の付いた Issue が無い日も含む）何もせず、実行報告に「対象なし」と書いて終了する

## 3. 作業環境

1. Issue のブランチを `origin/main` から作る（ブランチ名は `.claude/rules/git-conventions.md` の規約。ラベル `bug` → `fix/`、`test` → `feature/`）。作業場所（以下 `<work>`）とブランチの作り方は起動場所で分ける

   | 起動場所 | `<work>` | ブランチの作り方 |
   |---------|----------|-----------------|
   | worktree 起動 | セッションの worktree | `git checkout -b <type>/#<番号>-<kebab-desc> --no-track origin/main` |
   | メイン起動 | `<repo>/.claude/worktrees/weekday-<番号>`（新しく作る） | `git -C <repo> worktree add <repo>/.claude/worktrees/weekday-<番号> -b <type>/#<番号>-<kebab-desc> --no-track origin/main` |

   - worktree 起動で別の worktree を作らないのは、作った worktree への Edit / Write が worktree 隔離に拒否されるため（#504。2026-10-13〜15 の 3 回とも発生）
   - メイン起動で `<repo>` にブランチを作らないのは、人の作業中の変更が残っていることがあるため（worktree のトグルが OFF のスケジュールタスクは、未コミットの変更も含めて作業ディレクトリの状態のまま実行される）
   - `--no-track` は、upstream が `origin/main` になって素の `git pull` が main を取り込むのを防ぐため（`/issue-start` Phase 2 と同じ）

2. `<work>` の直下で `npm ci` を実行する。worktree には `node_modules` が無く、無いまま親リポジトリ（`<repo>`）の依存を解決すると、`@dnd-kit/core` が二重に解決されてテストが落ちる（#349 の実行で発生）。手順 1-3 で同じ worktree に `npm ci` 済みでも、`package-lock.json` が違うことがあるので、ブランチを作ったあとに実行し直す
3. 以降の作業はすべて `<work>` で行う

## 4. 実装（`/issue-start` の手順を無人向けに読み替える）

`<work>/.claude/skills/issue-start/SKILL.md` と `phases/*.md` に従う。ただし、ユーザー確認を前提にしている箇所は次のように読み替える。

| 箇所 | 無人実行での扱い |
|------|-----------------|
| Phase 1 の不足確認 | 質問せず、Issue 本文と既存コードから判断する。要件の分岐をどうしても決められない場合は、Issue にその旨をコメントし、ラベル `needs-decision` を付け（`gh issue edit <番号> --add-label needs-decision`）、メイン起動なら手順 3 で作った worktree を削除して終了する（PR は作らない。セッションの worktree は削除しない）。ラベルが付いている間は手順 2 で選ばれないので、翌日以降に同じ Issue へ同じコメントを積まない |
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
