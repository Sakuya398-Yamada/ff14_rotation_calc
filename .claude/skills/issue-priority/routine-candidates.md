# 無人実装の候補条件

人のいないセッション（スケジュールタスクの無人実行など）に実装を任せてよい Issue の条件・選ぶ順・確かめ方の正本。`/issue-priority` の「ルーティン向け」と「無人向き」の判定と、無人実装の手順書の Issue の選定が、ここを参照する。ほかのファイルに書き写さない。

無人実装を使うかは、リポジトリにラベル `routine-ok` があるかで決まる（`/issue-priority`「無人実装を使うか」）。使わないプロジェクトでは「候補条件」と「選ぶ順」は使わない。「確かめ方」手順 5（マージ済み PR）だけは、`/issue-priority` 手順 1-4 が使う。

## 候補条件

Open Issue のうち、次をすべて満たすもの。

- ラベル `routine-ok` が付いている（人が無人実装を許可した印。付けるのも外すのも人だけ）
- ラベルに `feature` / `bug` / `refactor` / `docs` / `test` のいずれかがある
- ラベル `meta` / `question` が付いておらず、#2 のテンプレート Issue でもない（ほかのラベルと一緒に付いていても除く。`/issue-priority` が対象から外す Issue と同じ）
- ラベル `needs-decision` が付いていない（無人実装が判断できずに、人の決定を待っている Issue。人が決めてラベルを外すと再び候補になる）
- 紐づく Open PR が無く、リモートに `*/<番号>-*` のブランチも無い（別のセッションが着手済みの可能性があるため）
- 紐づくマージ済み PR が無い（マージ後に行う DoD が残る Issue は、PR 本文を `refs #<番号>` にしてマージ後も Open のままにする。`/issue-start` Phase 7。残っているのはマージ後の作業で、実装し直すと同じ Issue に 2 本目の PR ができる。追加の実装が要るなら、人が別の Issue に切る）
- コメントに「## 着手」の印が無い（クラウドセッションの作業ブランチ `claude/*` 等は名前に Issue 番号が入らず、ローカルの `/issue-start` が切ったブランチは Phase 7 まで push されないので、上の条件では作業中と分からないため。印の書式は `.claude/skills/issue-start/phases/02-branch-setup.md`「クラウドセッションの場合」手順 4）。「## 着手（取り下げ）」に書き換わった印は数えない。印が古くても除外し続け、作業していないと分かった印は、人が「## 着手（取り下げ）」に書き換えて外す
- 本文の `依存: #M` と GitHub の依存関係（blocked by）に挙がった Issue が、すべて `completed` でクローズ済み（片方にしか無いものも依存とみなす。`.claude/skills/issue-start/dependencies.md`「読み方」）。`not_planned` / `duplicate` で閉じた依存先と、理由を付けずに閉じた依存先は、依存した変更が入っていないので満たさない。着手してよいかは人が決める
- sub-issue を持つ親 Issue ではない。`sub_issues_summary.total` が 1 以上なら親で、子がすべて Closed でも除く（子が増えていく進捗管理用の親を実装しないため。親に残った実装は、人が片付けるか子 Issue に切る）。子の本文に「親Issue: #N」と書かれているだけ（sub-issue になっていない）の #N は、親として扱わない（親かどうかは `total` だけで決める）
- `## 未確定事項` に `[要確認]` の項目や、「ユーザー判断」のようにユーザーの決定待ちと明記された項目が無い（「`/issue-start` の探索で調べる」と書かれた項目は、決定待ちではないので数えない）

## 選ぶ順

`priority:high` → `priority:medium` → `priority:low` → `priority:*` 無しの順。同じ順位なら番号の小さい順。

## 確かめ方

`gh api` は REST だけを使う。`gh issue` / `gh pr` などのサブコマンドは GraphQL を使うので、クラウドセッションでは 403 になる（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」）。1 回で取れるのは 100 件までで、超えたら `--paginate` を使わずに `page=N` を進める（同「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」）。GitHub MCP を使うときも、同じ規則で読む。

1. **候補を絞る**: `gh api "repos/{owner}/{repo}/issues?state=open&labels=routine-ok&per_page=100&page=<N>" --jq '{n: length, issues: [.[] | select(.pull_request | not) | {number, title, labels: [.labels[].name], sub_issues: (.sub_issues_summary.total // 0)}]}'` で、`routine-ok` の付いた Issue に絞る（この API は PR も返すので、`pull_request` の有無で除く。`sub_issues` は親 Issue の条件に使う）。`n` が 100 なら次のページへ進む（`n` は PR を除く前のそのページの件数で、除いたあとの `issues` の件数では、次のページがあるかを判断できない）。0 件なら、残りの条件は確かめない
2. **紐づく Open PR とリモートブランチ**（候補ごと）: 紐づく Open PR は、タイトル末尾の ` #N` の並びに `#<番号>` がある（`.claude/rules/git-conventions.md`「PR のタイトルと本文」。複数の Issue をまとめた PR は ` #12 #13` と並ぶ）、本文に `closes #<番号>` がある、head ブランチが `*/<番号>-*` に当たる、のどれかの Open PR。`gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100" --jq '.[] | select((.title | test(" #<番号>( #[0-9]+)*$")) or ((.body // "") | test("closes #<番号>([^0-9]|$)"; "i")) or (.head.ref | test("(^|/)<番号>-"))) | .number'` の出力が空なら無い（GitHub MCP なら `list_pull_requests` の `title` / `body` / `head.ref` を同じ規則で見る）。リモートブランチは `git ls-remote --heads origin '*/<番号>-*'` の出力が空なら無い（`.claude/rules/git-conventions.md`「ブランチ命名」）
3. **着手の印**（候補ごと）: `gh api "repos/{owner}/{repo}/issues/<番号>/comments?per_page=100&page=<N>" --jq '[length, ([.[] | select(.body | startswith("## 着手\n"))] | length)] | @tsv'` で数える。1 列目がそのページのコメント数、2 列目が印の数。`<N>` は 1 から始め、1 列目が 100 なら次のページも同じく数え、100 未満のページで止める。2 列目の合計が `0` なら印は無い。見出しの直後の改行まで含めて比べるので、「## 着手（取り下げ）」の印には当たらない（GitHub MCP なら `issue_read` の `get_comments` を `perPage: 100` で読み、同じ規則で見る）
4. **本文と依存**（候補ごと）: 本文は `gh api "repos/{owner}/{repo}/issues/<番号>" --jq '.body // ""'` で取る（GitHub MCP なら `issue_read` の `get` の `body`）。手順 1 の一覧は本文を落としてあるので、`依存: #M` と `## 未確定事項` の条件はこの本文で確かめる
   - 本文の `依存: #M` として読むのは、行頭が `依存:` の行（全角の `依存：` も、前に空白や箇条書きの `- ` / `* ` を付けたものも含む）の、コロンの直後に続く `#M` の並び（`#12, #13` のように `,`・`、`・空白で区切ったもの）だけで、どの節にあっても読む。並びの後ろの括弧の注記などに出る `#N` と、文中で別の Issue の依存を説明した書き方は読まない。並びの中の `owner/repo#N` も読まない（このリポジトリの番号として引くと別の Issue を見る。別のリポジトリの依存は blocked by で拾う）。`gh api "repos/{owner}/{repo}/issues/<番号>" --jq '[(.body // "") | split("\n")[] | capture("^[\\s\\p{Zs}]*([-*][\\s\\p{Zs}]+)?依存[:：][\\s\\p{Zs}]*(?<l>([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?#[0-9]+([\\s\\p{Zs}]*[,、]?[\\s\\p{Zs}]*([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)?#[0-9]+)*)") | .l | scan("(?:^|[\\s\\p{Zs},、])#([0-9]+)") | .[0] | tonumber] | unique | .[]'` で 1 行に 1 つ出せる。読む行と番号は `.claude/scripts/issue-ready.sh` と同じ
   - 本文の依存先の状態は、番号ごとに `gh api "repos/{owner}/{repo}/issues/<M>" --jq '[.state, (.state_reason // "")] | @tsv'` で取る（GitHub MCP なら `issue_read` の `get` の `state` と `state_reason`）。手順 1 の一覧に無いことでは、閉じていると判定しない（一覧は `routine-ok` で絞ってあり、`routine-ok` の無い Open の Issue も出ないため）
   - blocked by は、候補ごとに次で取る（GitHub MCP の `issue_read` は依存を返さない）。1 列目は依存先で、このリポジトリなら `#<M>`、別のリポジトリなら `owner/repo#<M>` と出る（blocked by には別のリポジトリの Issue も付けられる）

     ```bash
     full=$(gh api "repos/{owner}/{repo}" --jq .full_name)
     gh api "repos/{owner}/{repo}/issues/<番号>/dependencies/blocked_by?per_page=100" \
       --jq '.[] | [(((.repository_url | sub(".*/repos/"; "")) as $r | if $r == "'"$full"'" then "" else $r end) + "#" + (.number | tostring)), .state, (.state_reason // "")] | @tsv'
     ```

   - どちらも、`closed` と `completed` の組なら満たす。`open` が 1 つでもあれば依存待ち。`open` が無く、`completed` 以外（`not_planned` / `duplicate`、理由の無いもの）で閉じた依存先があれば、満たさない
5. **マージ済み PR**（候補ごと）: タイトル末尾の ` #N` の並びに `#<番号>` がある（手順 2 と同じ規則）マージ済み PR が無いことで確かめる。上から順に、使えるもので見る
   - GitHub MCP の `search_pull_requests`（`owner` / `repo` を指定、query `is:merged "#<番号>" in:title`）の結果を、タイトル末尾の並びで絞る
   - `gh api "repos/{owner}/{repo}/issues/<番号>/timeline?per_page=100" --jq '[.[] | select(.event == "cross-referenced" and .source.issue.pull_request.merged_at != null and (.source.issue.title | test(" #<番号>( #[0-9]+)*$")))] | length'` が `0`（timeline は 100 件ずつ返るので、同じ URL を `--jq 'length'` で数えて 100 なら `&page=2` も同じく見る。`gh api search/issues` はクラウドセッションで拒まれることがある。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」）
   - どちらも使えなければ、GitHub MCP の `list_pull_requests`（`state: closed`、`fields: ["number", "title", "merged_at"]`、`perPage: 100`。100 件返ったら `page` を進める）のうち、`merged_at` があり、タイトル末尾の並びに `#<番号>` がある PR が無い

   `issue_read` の `closed_by_pull_requests` は `closes` の PR しか含まず、`refs` の PR を拾わないので使わない。タイトル末尾の並びで絞るのは、本文でこの Issue に触れただけの PR（スコープ外の起票の報告など）を除くため
