---
taskId: daily-triage
title: 【毎日】Issue トリアージルーティン
schedule: "0 19 * * *"
description: メモ inbox・知見ボードから Issue を起票し、priority:* の無い Open Issue に優先度を付けて、着手順のおすすめを実行ログに出す（実装と routine-ok の付与はしない）
---

# daily-triage

あなたはこのリポジトリの日次 Issue トリアージルーティンです。**無人実行**なので、ユーザーへの質問はせず、判断できないものは起票もラベル付けもせずに実行報告へ回してください。

- 実行環境: クラウドのスケジュールタスク。実行のたびにリポジトリを clone し、その直下から、`main` から切った作業ブランチ（`claude/*` など）で起動する
- このリポジトリの名前は書かない。`gh api` の `{owner}/{repo}` は、`gh` がカレントの git リモートから埋める。git と `gh` はリポジトリ直下で、`-C` を付けずに打つ

## 共通ルール

1. リポジトリの `CLAUDE.md` と `.claude/rules/*.md` に従う。Issue の様式・ラベル・粒度は `.claude/rules/git-conventions.md`
2. 最初に `git fetch origin` し、`git show origin/main:.claude/rules/routines.md` を読む（このファイルは `paths:` 付きなので、`git show` で読む手順書では自動で読み込まれない）。そこから次の番号を控える
   - 実行ログ Issue・メモ inbox Issue の番号: 「管理用の Issue」
   - 知見ボード Issue の番号: `.claude/rules/workflow-feedback.md`「知見ボードIssue」
   - どれかが `<...>` のプレースホルダーのままなら、その Issue を使う手順は飛ばし、実行報告の「その他」に書く。実行ログの番号が無ければ、`meta: ルーティン実行ログ` の Open Issue を探して使う
3. 区分と優先度の判定基準は、`origin/main` の `/issue-priority` skill（`git show origin/main:.claude/skills/issue-priority/SKILL.md`）を読んで使う。skill が参照する `.claude/skills/issue-priority/routine-candidates.md` も同じく `git show origin/main:<path>` で読む。**作業ツリーの変更・ブランチ作成・コミット・PR はしない**
4. GitHub 操作は GitHub MCP を使い、使えなければ REST の `gh api repos/{owner}/{repo}/...` にフォールバックする。`gh issue` / `gh pr` などのサブコマンドは GraphQL を使うので、クラウドセッションでは 403 になる。使わない（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」）。ただし手順 6 のラベル付与は `gh api` を先に使う（理由は手順 6-5）
5. 書き込みは `.claude/rules/routines.md`「事前に承認した書き込み」の `daily-triage` の分だけ。これ以外の新規コメント、Issue 本文の編集、既存の Issue への `priority:*` 以外のラベル（`routine-ok` を含む）の追加・削除はしない。テンプレート元（`.claude/template-version` の `repo`）への起票・コメントもしない
   - **起票**（手順 2・3）
     - 起票の前に重複を確かめる（Open / Closed の両方を検索する）。同じ目的の Issue があれば起票しない
     - 本文は `## 背景・目的` / `## 要件`（やること・やらないこと）/ `## 完了条件（DoD）` / `## 未確定事項`（あれば）/ `## 関連Issue` で構成し、末尾に下のフッターを付ける
     - ラベルは種別を 1 つだけ付ける。`priority:*` は付けずに起票し、同じ実行の手順 6 で付ける（判定を 1 か所にまとめるため）
     - 起票は手順 2・3 を合わせて **1 回の実行で 10 件まで**（既定値。プロジェクトで変えてよい）。超えた分は実行報告の「見送り」に挙げる
   - **✅ の印の追記**（手順 2・3）: `bash .claude/scripts/knowledge-board.sh mark <コメント ID> "<印>"` で行う。最新の本文の取得・末尾への 1 行の追記・取り直しての照合はスクリプトが行う（使い方は `.claude/skills/issue-start/phases/08-issue-recording.md`「知見ボードの読み方」。このリポジトリのどの Issue のコメントにも使える）
     - `mark` が非 0 で終わったら（別の ✅ の印がある・照合が合わない）、書き直さずに、出力を実行報告の「印の追記」に書く
     - `mark` の実行自体が auto mode の分類器に止められたら、GitHub MCP の `update_issue_comment` で最新の本文の末尾に空行と印の 1 行を足し、取り直して、元の本文との差が印の行だけかを確かめる（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションの auto mode では、allow に当たる Bash も分類器が判定する」）
   - **`priority:*` の付与**: 手順 6
   - **実行報告**: 手順 8

   ```
   ---
   _日次 Issue トリアージルーティン（<系統名>）により自動起票_
   ```

6. 知見ボード・メモ inbox のコメントは、GitHub MCP の `issue_read` で丸読みしない
   - **知見ボード**は `bash .claude/scripts/knowledge-board.sh` で要る分だけ読む（`open` / `grep` / `show`。2 回目以降は `--cached`）。作業ツリーのスクリプトを、カレントディレクトリをリポジトリ直下にしたまま使う（このルーティンは `main` から切ったブランチで起動するので、作業ツリーは `origin/main` と同じ）
   - **メモ inbox** は、ページごとに次で読む（`<N>` は 1 から始め、100 件返ったら次のページへ。`--paginate` は 2 ページ目で止まるので使わない。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」）。1 行に、コメント ID・起票済みの印の有無・本文の先頭が出る。起票に本文の全体が要るものだけ、`gh api repos/{owner}/{repo}/issues/comments/<ID> --jq '.body // ""'` で読む

     ```bash
     gh api "repos/{owner}/{repo}/issues/<メモ inbox>/comments?per_page=100&page=<N>" \
       --jq '.[] | [(.id | tostring), ((.body // "") | test("✅ Issue #[0-9]+(, #[0-9]+)* 起票済み") | tostring), ((.body // "") | gsub("[\r\n]+"; " ") | .[0:120])] | @tsv'
     ```

## 1. バックログを数える

手順 2 に入る前に 1 回だけ数える。数は実行報告の「その他」に書く。この数え方と上限の正本はこの節で、週次の `weekly` も同じ数え方で見送りを判定する。

1. **Open の作業 Issue** を数える。数えるのは、Open Issue から次を除いたもの。依存待ち・進行中の Issue は含める（抱えている量を測るため）
   - `meta` / `question` ラベルの Issue（ほかのラベルと一緒に付いていても除く）
   - #2 のテンプレート Issue
   - sub-issue を持つ親 Issue（`sub_issues_summary.total` が 1 以上。子がすべて Closed でも除く。`.claude/skills/issue-priority/routine-candidates.md`「候補条件」の親 Issue と同じ読み方）

   一覧は `gh api "repos/{owner}/{repo}/issues?state=open&per_page=100&page=<N>" --jq '{n: length, issues: [.[] | select(.pull_request | not) | {number, labels: [.labels[].name], sub_issues: (.sub_issues_summary.total // 0)}]}'` で取る。`n` が 100 なら次のページへ進む（`n` は PR を除く前のそのページの件数。除いたあとの `issues` の件数では、次のページがあるかを判断できない）。GitHub MCP の `list_issues` は `sub_issues_summary` を返さないので、共通ルール 4 の MCP 優先によらず `gh api` を使う。この API は PR も返すので、`pull_request` の有無で除く
2. **25 件以上なら、手順 3 の昇格の起票だけを見送る**（25 件は既定値。人が消化できる量に合わせて変えてよい）
   - 手順 3-1 の一覧と、手順 3-2 の「還元済み」の扱い（印の追記と「取り込み待ち」の報告）は、バックログを増やさないので、上限に達していても行う
   - 実行報告の「見送り」に「バックログ上限 25 件に到達（N 件）のため知見の昇格を見送り（候補 M 件）」と書く。M は手順 3-2 の「プロジェクト固有」に当たる知見の数。上限が続く間は候補がすべて残り、毎回並べると報告が長くなるので、手順 3-4 と違って ID は書かない
   - 手順 2（メモ inbox）は人が起点なので見送らない

## 2. メモ inbox から起票する

1. メモ inbox のコメントのうち、`✅ Issue #<番号> 起票済み` の行が無いものを対象にする（共通ルール 6 の 2 列目が `false` のもの。`mark` で付けた印の後ろにはクラウドの経路が署名フッターを付けるので、末尾の行だけで判定しない）
2. 各メモを正式な Issue に整えて起票する。1 つのメモに目的が複数あれば、粒度規約（`.claude/rules/git-conventions.md`「粒度」）に従って分割する。分けた Issue の一方が他方の成果を前提にするなら、本文の「## 関連Issue」の `依存: #N` と GitHub の依存関係（blocked by）の両方に付ける（`.claude/skills/issue-start/dependencies.md`「付け方」）。親 Issue と sub-issue には分けない
3. 起票したら、元のコメントの末尾に `✅ Issue #<番号> 起票済み` を `mark` で追記する（共通ルール 5）。分割したら `✅ Issue #<番号>, #<番号> 起票済み` のように 1 行に並べて、1 回で付ける（`mark` は別の印があるコメントには追記しない）
4. 曖昧で要件にできないメモは起票せず、実行報告の「要追記」に挙げる
5. フッターの系統名: `メモ inbox 系統`

## 3. 知見ボードの棚卸し

1. **未回収の知見を一覧する**: `knowledge-board.sh open` を実行する。回収済みの判定（`✅ Issue #<番号>` と `✅ Issue <owner>/<repo>#<番号>` の 2 形式）はスクリプトが行う。振り分けや起票に本文が要るものだけ `show <ID>` で読む
2. 未回収の知見を `**還元先**` の行で振り分ける
   - **`テンプレート汎用（↗ 還元済み: <URL>）`**: このプロジェクトでは昇格しない（テンプレート更新で戻ってくるので、昇格すると二重に対応することになる）
     - 還元先 URL のリポジトリ（`https://github.com/<owner>/<repo>/issues/<番号>` の `<owner>/<repo>`）が `.claude/template-version` の `repo` と違えば（大文字と小文字は区別しない。別のテンプレートやフォークに還元した）、テンプレート元の番号とは対応しないので版は探さず、実行報告の「取り込み待ち」に「還元先が template-version の repo と違う」と添えて挙げる（印を付けるかは人が決める）
     - その還元先の Issue の修正を含む版を、テンプレート元の `CHANGELOG.md` で探す。テンプレート元（`.claude/template-version` の `repo`）を `git clone -q --no-checkout https://github.com/<repo>.git <scratchpad>/template-src` で取り、`git -C <scratchpad>/template-src show HEAD:CHANGELOG.md` の版の節のうち、`#<還元先の番号>` を含む節が、その修正を含む版。すぐ後ろに数字が続くもの（`#42` に対する `#420`）は、別の番号なので数えない（Release notes はセッションに付いていないリポジトリだと読めないので、クローンで読む。`.claude/skills/template-update/SKILL.md` と同じ）
     - このプロジェクトに、その版以上の版の更新用 Issue（`refactor: テンプレートを vX.Y.Z に更新`）があれば、元のコメントに `✅ Issue #<更新用 Issue の番号> で対応` を `mark` で追記する（共通ルール 5）。まだ無ければ、または版を確かめられなければ（クローンに失敗した、など）、実行報告の「取り込み待ち」に挙げる
   - **`テンプレート汎用（未還元）`**: このプロジェクトでは昇格しない。テンプレート元で直してテンプレート更新で取り込むので、ここで直すと二重に対応することになる。実行報告の「要還元（ユーザー）」に挙げる（還元は人が `/issue-start` Phase 8 手順 6 の形で行い、`還元先` を `テンプレート汎用（↗ 還元済み: <URL>）` に書き換える。ルーティンは還元しない）
   - **上記以外**（プロジェクト固有／記入なし）: **重要度を問わず**（Low も含めて）独立した Issue へ昇格して起票する。同じ対象ファイル・同じ目的の知見は 1 件にまとめてよい。起票したら元のコメントに `✅ Issue #<番号> で対応` を `mark` で追記する（共通ルール 5）。バックログが上限に達した日は起票しない（手順 1-2）
3. **昇格の起票は 1 回の実行で 3 件まで**（既定値。手順 3-2 の「上記以外」だけを数える。✅ の印の追記は数えない）。対象が多ければ重要度 High → Medium → Low、同じ重要度なら古い順に起票し、残りは実行報告の「見送り」に ID を書く（次の実行で起票する）
4. フッターの系統名: `知見ボード棚卸し系統`。フッターに `元知見: 知見ボード #<番号> の [#<作業Issue番号>] コメント` を添える

## 4. 集めて要約する

`/issue-priority` の手順 1・2 を、引数なし（Open Issue 全件）として行う。skill の「無人実装を使うか」も確かめる。手順 2・3 で起票した Issue も含める。本文とコメントは、skill 手順 2 の委譲プロンプトのまま `general-purpose` エージェントに任せ、要約だけを受け取る（自分で丸読みしない）。

## 5. 区分と優先度を判定する

- 全件に `/issue-priority` の skill 手順 3 の区分を付ける（無人実装を使わないなら、進行中／人がいるセッション向けの 2 つ）
- `priority:*` が無い Issue だけ、skill 手順 4 で優先度の案を出す。付いている Issue は、今のラベルをそのまま使う
- （無人実装を使う場合）人がいるセッション向けの Issue について、skill 手順 3 の「無人向き」に当たるかを判定する（手順 7-4 で使う）

## 6. priority を付ける（新着のみ）

1. 対象（ここでいう「新着」）は、次をすべて満たす Issue
   - `priority:*` が付いていない
   - ラベル `meta` / `question` が付いておらず（ほかのラベルと一緒に付いていても対象外。手順 1-1 と同じ）、#2 のテンプレート Issue でもない
   - 手順 5 の区分が「進行中」ではない
2. **`priority:*` が付いている Issue と、手順 5 の区分が「進行中」の Issue のラベルは変えない**
3. 1 回の実行で付けるのは **10 件まで**（既定値）。案が high → medium → low の順、同じ優先度なら番号の小さい順に付け、超えた分は実行報告の「見送り」に案を添えて書く（次の実行で付ける）
4. 付ける直前に `gh api repos/{owner}/{repo}/issues/<N> --jq '{state, labels: [.labels[].name]}'` で取り直し、Closed になっていたり `priority:*` が付いていたりしたら触らない
5. `gh api repos/{owner}/{repo}/issues/<N>/labels -f "labels[]=priority:<high|medium|low>"` で付ける（追加だけなので、ほかのラベルを落とさない）。GitHub MCP の `issue_write`（method: `update`）を使うときは、`labels` がラベル全体を置き換えるので、手順 6-4 で取り直したラベルに新しい `priority:*` を 1 つ足した配列を渡す

## 7. 着手順のおすすめを選ぶ

1. 手順 6 で付けたあとのラベルで、進行中を除く Issue を `priority:high` → `priority:medium` → `priority:low` → `priority:*` 無し（見送り分）の順に並べる。同じ優先度の中は、塞いでいる後続の Open Issue が多い順（鎖の先まで数える。数え方は `/issue-priority` の skill 手順 4）、次に番号の小さい順
2. 依存先が Open の Issue（依存待ち）は今は着手できないので除き、上から **3 件** をおすすめにする。区分は問わず、表の列に書く
3. 理由は `/issue-priority` の skill の言い回しで書く。priority の根拠は手順 4「priority の根拠」（後続 N 件の起点、依存は解消済み、など）、区分の理由は手順 3「区分の理由と注記」（要判断: …、など）に従う
4. （無人実装を使う場合）**`routine-ok` を付ける候補**: 手順 5 で無人向きと判定した Issue を、手順 7-1 の並びで上から **3 件まで** 挙げる。理由は手順 7-3 と同じ言い回しで書く。ラベルは付けない（付けるかは、人が実行報告を読んで決める）

## 8. 実行報告

最後に、次の形式で報告する。報告の本文は、実行ログ Issue にもコメントとして投稿する（**1 実行 1 コメント**。起票も付与も 0 件の実行も投稿する）。投稿できなければ（GitHub MCP も gh も使えない等）、セッションに報告を出すだけにする。無人実装を使わないプロジェクトでは、「`routine-ok` を付ける候補」の節を出さない。

```
## daily-triage 実行報告（YYYY-MM-DD）
### メモ inbox
- 起票: #N タイトル（元コメント ID）／ 印の追記: <ID → #N。失敗したら mark の出力> ／ 要追記: <コメント ID と理由> ／ なし
### 知見ボード
- 起票: #N タイトル（元コメント ID）／ 印の追記: <ID → #N> ／ なし
- 取り込み待ち: <ID と還元先 URL> ／ 要還元（ユーザー）: <ID と気づきの要約> ／ なし
### 付与した priority（新着 N 件中 M 件）
| Issue | 付与 | 区分 | 理由 |
|-------|------|------|------|
| #N タイトル | priority:high | 人がいるセッション向け | 後続 1 件の起点、依存は解消済み |
- 付けなかった新着: #N（理由: 手順 6-4 で Closed／付与済み、判断できず: …）… ／ なし
### 着手順のおすすめ（上位 3 件）
| 順 | Issue | priority | 区分 | 理由 |
|----|-------|----------|------|------|
| 1 | #N タイトル | high | 人がいるセッション向け | 後続 N 件の起点、依存は解消済み／要判断: … |
### routine-ok を付ける候補（無人向き、上位 3 件。ラベルは付けていない）
| 順 | Issue | priority | 理由 |
|----|-------|----------|------|
| 1 | #N タイトル | medium | `bug` ラベル／`routine-ok` 無し。無人向き候補（`routine-ok` を付ければルーティン向け） |
- （該当が無ければ「なし」）
### 注記
- （無人実装を使う場合）次の無人実装が選ぶ見込み: #N タイトル（ルーティン向けの 1 番目）／ 候補なし（`routine-ok` の付いた候補なし）／ なし（無人実装の Open PR が N 件で上限に到達。`/issue-priority` 手順 5 の注記と同じ判定）
- 進行中: #N（PR #M、マージ可能）… ／ なし
- ファイルが重なる組み合わせ・依存とリスクの食い違い: … ／ なし
### その他
- 見送り（起票 1 回 10 件・知見 1 回 3 件・priority 1 回 10 件の上限超過、重複、バックログ上限による知見の昇格）: … ／ なし
- バックログ（Open の作業 Issue、上限 25）: N 件
- 飛ばした手順（管理用の Issue の番号がプレースホルダーのまま、など）: … ／ なし
- テンプレート更新: SessionStart のバナーに更新ありと出ていれば「あり（vOLD → vNEW）」と書くだけで、起票はしない
```
