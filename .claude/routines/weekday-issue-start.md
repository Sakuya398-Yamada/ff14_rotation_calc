---
taskId: weekday-issue-start
title: 【平日】Issue 自動着手ルーティン
schedule: "30 19 * * *"
description: routine-ok の付いた Open Issue を 1 件選び、/issue-start の手順で実装して PR を作る（マージはしない）
---

# weekday-issue-start

あなたは FF14 Rotation Calculator の平日ルーティンです。人が `routine-ok` ラベルを付けた Open Issue から **1 件だけ**選び、`/issue-start` の手順で実装して PR を作成するところまで行います。**無人実行**なので、ユーザーへの質問はしません。**PR のマージと auto-merge の設定はしません**。

- GitHub: `Sakuya398-Yamada/ff14_rotation_calc`
- 実行環境: クラウドのスケジュールタスク。実行のたびにリポジトリを clone し、その直下から、`main` から切った `claude/*` の作業ブランチで起動する。以降の作業はすべてこのリポジトリ直下（以下 `<work>`）で行い、git は `-C` を付けずに打つ
- **push 先**: 手順 1-3 では自分の PR の head ブランチに、手順 3 以降は手順 3-1 で作る Issue ブランチ（`<type>/#<番号>-<kebab-desc>`）に push する。起動時に割り当てられた `claude/*` の作業ブランチには push しない（Issue 番号がブランチ名に入らず、手順 1-4・2-1 で作業中と分からなくなるため）
- 自分（このルーティン）が作った PR と Issue コメントは、末尾のフッター `_スケジュール実行（weekday-issue-start）による無人実装_` で識別する
- GitHub 操作は GitHub MCP を使い、使えなければ REST の `gh api repos/Sakuya398-Yamada/ff14_rotation_calc/...` にフォールバックする。`gh issue` / `gh pr` などのサブコマンドは GraphQL を使うので 403 になる。使わない（`.claude/skills/issue-start/pitfalls.md`「クラウドセッションでは gh の GraphQL 系が使えない」）。ただし手順 1-2 の Open PR の取得は `gh api` を先に使う（理由は手順 1-2）

## 1. 事前点検（安全弁）

Issue を選ぶ前に、過去の実行が残した PR とブランチを点検する。Open PR が上限に達していても手順 1-2〜1-4 は行う（人がレビュー中の PR を古くしないため）。

1. `<work>` で `git fetch origin` する。clone は履歴が浅いことがあるので、`git rev-parse --is-shallow-repository` が `true` なら続けて `git fetch --unshallow origin` で履歴を取り切る（浅いままだと、手順 1-3 で古い PR の head と `origin/main` の merge-base が見つからず、merge が `refusing to merge unrelated histories` で止まる）
2. 自分の Open PR を取得する（draft も含める）。本文にフッター `_スケジュール実行（weekday-issue-start）による無人実装_` が **単独の行として** ある PR だけを自分の PR とみなす（人の PR も変更点の説明にこの文字列を引用することがあるので、本文検索だけでは絞れない。前例: PR #449）。まず Open PR を全件（人の PR も含む）取り、絞る前の結果を `<scratchpad>/open-prs.json` に残す（手順 1-4 で人の Open PR とも突き合わせるため）

   ```bash
   gh api "repos/Sakuya398-Yamada/ff14_rotation_calc/pulls?state=open&per_page=100" > <scratchpad>/open-prs.json
   jq '[.[] | select(.body // "" | test("(?m)^_スケジュール実行（weekday-issue-start）による無人実装_[[:space:]]*$")) | {number, draft, head: .head.ref}]' <scratchpad>/open-prs.json
   ```

   正規表現にバックスラッシュを使わない（jq は文字列中の `\s` を拒否する）。一覧には `mergeable` が無いので、自分の PR ごとに `gh api repos/Sakuya398-Yamada/ff14_rotation_calc/pulls/<PR番号> --jq '{number, mergeable}'` で読む。`gh api` が使えなければ、GitHub MCP の `list_pull_requests`（`owner` / `repo` を指定、`state: open`、`perPage: 100`）で全件を取って手順 1-4 の突き合わせにも使い、`body` に同じ行がある PR を自分の PR とし、`pull_request_read`（method: `get`）で `mergeable` と head ブランチを読む

3. **conflict の解消**: `mergeable` が `false` の PR ごとに、そのブランチへ `origin/main` を取り込み、conflict を解消して push する。GitHub の `mergeable: false` は手元の `git merge origin/main` と同じ 3-way マージの結果なので、マージは必ず conflict で止まる。止まったら自分で解消する（触るのは手順 1-2 で絞った自分の PR だけ）。force push はしない

   ```bash
   git checkout --detach origin/<head ブランチ>
   git merge origin/main            # conflict で止まる → 該当ファイルを解消して git add <file>
   git commit --no-edit             # 件名は git が用意した Merge ... のまま
   # <work> の直下で npm ci → npx tsc --noEmit → npm test を通す
   git push origin HEAD:<head ブランチ>
   ```

   - 解消の判断がつかない、または `tsc` / `npm test` が通らないときは push せず（コミット前なら `git merge --abort`）、実行報告の「conflict 解消」に `conflict 未解消: PR #N（理由）` と書く（解消は人が行う）。`<work>` はそのまま次の PR と手順 3 に使う（push しなかった merge commit は detached HEAD に残るだけで、次の checkout で外れる）
   - `mergeable` が `null`（GitHub が計算中）なら 30 秒ほど待って取り直す。それでも `null` なら触らず、`mergeable 未判定: PR #N` と書く
   - detached HEAD で作業するのは、PR ごとにローカルブランチを作らずに済ませるため（push 先は `HEAD:<head ブランチ>` で指定する）
4. **取り残しブランチの報告**: リモートの `<type>/#<番号>-*` ブランチのうち、**Issue が Open で、そのブランチを head にした Open PR が無い** ものを実行報告に列挙する（削除はしない。削除は人が判断する）。途中で落ちた実行の残りで（手順 4 の表「Phase 2 のブランチ作成」で先に push するので、PR を作る前に落ちた実行も残る）、その Issue は手順 2 の条件により黙って選ばれなくなっている。クローズ済み Issue のブランチ（マージ済み PR の残り）は多数あるので列挙しない

   ```bash
   git ls-remote --heads origin | sed 's#.*refs/heads/##' | grep -E '^[a-z]+/#[0-9]+-'
   ```

   番号ごとに Issue の state（`gh api repos/Sakuya398-Yamada/ff14_rotation_calc/issues/<番号> --jq .state`）を見て、Open PR の有無は手順 1-2 で取った Open PR 全件の head ブランチ（`gh api` で取ったなら `jq -r '.[].head.ref' <scratchpad>/open-prs.json`）と突き合わせる（自分の PR に絞ったあとの一覧と突き合わせるだけでは、人が作った Open PR を見落とす）
5. **Open PR 上限**: 手順 1-2 の件数（draft 含む）が **5 件以上** なら、Issue の選定に進まず、実行報告の「対象」に `対象なし（Open PR 上限 5 件に到達）` と書いて終了する。上限は人がさばける PR の本数で決めてある（#445）

## 2. 対象 Issue の選定

1. Open Issue のうち、次をすべて満たすものを候補にする
   - ラベル `routine-ok` が付いている（人が無人実装を許可した印。このルーティンは付けも外しもしない。#503）
   - ラベルに `feature` / `bug` / `refactor` / `docs` / `test` のいずれかがある（`meta` / `question` は除く。#2 のテンプレート Issue も除く）
   - ラベル `needs-decision` が付いていない（過去の実行が判断できずに人の決定を待っている Issue。人が決めてラベルを外すと再び候補になる）
   - その Issue に紐づく Open PR が無く、リモートに `*/#<番号>-*` のブランチも無い（別のセッションが着手済みの可能性があるため）
   - その Issue に紐づくマージ済み PR が無い（マージ後に行う DoD が残る Issue は、PR 本文を `refs #<番号>` にしてマージ後も Open のままにする。`/issue-start` Phase 7。残っているのはマージ後の作業で、実装し直すと同じ Issue に 2 本目の PR ができる。追加の実装が要るなら人が別の Issue に切る）
   - コメントに「## 着手」の印が無い（クラウドセッションの作業ブランチ `claude/*` 等は名前に Issue 番号が入らず、ローカルの `/issue-start` が切ったブランチは Phase 7 まで push されないので、上の条件では作業中と分からないため。印の書式は `.claude/skills/issue-start/phases/02-branch-setup.md`「クラウドセッションの場合」手順 4、ローカルで `routine-ok` の Issue に付ける場面は同じファイルの「ブランチ作成」）。「## 着手（取り下げ）」に書き換わった印は数えない。印が古くても除外し続け、作業していないと分かった印は人が「## 着手（取り下げ）」に書き換えて外す（#493）
   - 本文の `依存: #M` がすべてクローズ済み
   - sub-issue を持つ親 Issue ではない。`sub_issues_summary.total` が 1 以上なら親で、子がすべて Closed でも除く（子が増えていく進捗管理用の親（#497）を実装しないため。親に残った実装は、人が片付けるか子 Issue に切る。#738）。子の本文に「親Issue: #N」と書かれているだけ（sub-issue になっていない）の #N は、親として扱わない（親かどうかは `total` だけで決める）
   - `## 未確定事項` に `[要確認]` の項目や、「ユーザー判断」のようにユーザーの決定待ちと明記された項目が無い（「`/issue-start` の探索で調べる」と書かれた項目は決定待ちではないので数えない）

   確かめるときは、最初に `gh api "repos/Sakuya398-Yamada/ff14_rotation_calc/issues?state=open&labels=routine-ok&per_page=100" --jq '[.[] | select(.pull_request | not) | {number, title, labels: [.labels[].name], sub_issues: .sub_issues_summary.total}]'` で `routine-ok` の付いた Issue に絞る（この API は PR も返すので `pull_request` の有無で除く。`sub_issues` は親 Issue の条件に使う）。0 件なら残りの条件は確かめずに手順 2-3 へ進む

   着手の印は、候補ごとに `gh api "repos/Sakuya398-Yamada/ff14_rotation_calc/issues/<番号>/comments?per_page=100" --jq '[.[] | select(.body | startswith("## 着手\n"))] | length'` が `0` であることで確かめる（GitHub MCP なら `issue_read` の `get_comments`）。見出しの直後の改行まで含めて比べるので、「## 着手（取り下げ）」の印には当たらない

   マージ済み PR は、候補ごとに、タイトルの末尾が ` #<番号>`（`.claude/rules/git-conventions.md`「PR のタイトルと本文」）のマージ済み PR が無いことで確かめる。GitHub MCP の `search_pull_requests`（`owner` / `repo` を指定、query `is:merged "#<番号>" in:title`）の結果をタイトルの末尾で絞る。使えなければ `gh api "repos/Sakuya398-Yamada/ff14_rotation_calc/issues/<番号>/timeline?per_page=100" --jq '[.[] | select(.event == "cross-referenced" and .source.issue.pull_request.merged_at != null and (.source.issue.title | endswith(" #<番号>")))] | length'` が `0` であることで確かめる（timeline は 100 件ずつ返るので、同じ URL を `--jq 'length'` で数えて 100 なら `&page=2` も同じく見る。`gh api search/issues` はクラウドでは使えない）。`issue_read` の `closed_by_pull_requests` は `closes` の PR しか含まず、`refs` の PR を拾わないので使わない。タイトルの末尾で絞るのは、本文でこの Issue に触れただけの PR（スコープ外の起票の報告など）を除くため
2. 優先順位は `priority:high` → `priority:medium` → `priority:low` → `priority:*` 無しの順。同じ順位なら番号の小さい順
3. 候補が無ければ（`routine-ok` の付いた Issue が無い日も含む）何もせず、実行報告に「対象なし」と書いて終了する

## 3. 作業環境

1. `<work>` で、Issue のブランチを `origin/main` から作る（ブランチ名は `.claude/rules/git-conventions.md` の規約。ラベル `bug` → `fix/`、`test` → `feature/`）

   ```bash
   git checkout -b <type>/#<番号>-<kebab-desc> --no-track origin/main
   ```

   - `--no-track` は、upstream が `origin/main` になって素の `git pull` が main を取り込むのを防ぐため（`/issue-start` Phase 2 と同じ）
   - ここでは push しない。push は Phase 1 を終えてから行う（手順 4 の表「Phase 2 のブランチ作成」）

2. `<work>` の直下で `npm ci` を実行する。手順 1-3 で PR の head に切り替えて `npm ci` していると、`node_modules` がその PR の `package-lock.json` に合わせたものになっているので、ブランチを作ったあとに実行し直す
3. 以降の作業はすべてこのブランチで行う

## 4. 実装（`/issue-start` の手順を無人向けに読み替える）

`<work>/.claude/skills/issue-start/SKILL.md` と `phases/*.md` に従う。ただし、ユーザー確認を前提にしている箇所は次のように読み替える。

| 箇所 | 無人実行での扱い |
|------|-----------------|
| Phase 1 の不足確認 | 質問せず、Issue 本文と既存コードから判断する。要件の分岐をどうしても決められない場合は、Issue にその旨をコメントし、ラベル `needs-decision` を付けて（`gh api repos/Sakuya398-Yamada/ff14_rotation_calc/issues/<番号>/labels -f "labels[]=needs-decision"`）終了する（PR は作らない）。ラベルが付いている間は手順 2 で選ばれないので、翌日以降に同じ Issue へ同じコメントを積まない |
| Phase 1 手順 0.5（テンプレート更新） | 起票しない。実行報告に「テンプレート更新あり（vOLD → vNEW）」と書くだけ |
| Phase 2 のブランチ作成 | 手順 3 で作った Issue ブランチを使い、ここで `git push -u origin HEAD` で先に push する。ローカルの `/issue-start` は Phase 1 手順 2 でリモートの `*/#<番号>-*` ブランチを見て作業中と判定するので、Phase 7 まで push しないと、PR を作るまでのあいだに人が同じ Issue に着手することがある。手順 3 で push しないのは、Phase 1 で `needs-decision` を付けて終える実行や、Phase 2〜7 を省く Issue でブランチを残さないため（残ると手順 2-1 の条件で、ラベルを外しても選ばれなくなる）。「クラウドセッションの場合」の割り当てブランチでの作業と「## 着手」の印は行わない（ブランチ名に Issue 番号が入り、ここで push するので、手順 1-4・2-1 と `/issue-start` Phase 1 手順 2 の検知はそれで足りる） |
| Phase 4 の設計承認 | 自分で承認して進める。設計の要点と判断の根拠を、PR 本文の `## 実装判断（無人実行）` に書く |
| Phase 1/3/5/6 のスコープ外問題 | 起票しない。PR 本文と実行報告に「起票候補」として列挙する |
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
