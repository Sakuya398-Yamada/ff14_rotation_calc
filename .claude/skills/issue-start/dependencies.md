# Issue の依存の付け方と読み方

`/issue-start` と `/issue-plan` から参照される補助ファイルで、常駐しない。Issue 間の依存（後続の Issue B が、先行の Issue A の完了を待つ）は、次の 2 か所に同じ内容で書く。

- B の本文の「## 関連Issue」の `依存: #<A>`: 人が本文だけで読める。`gh` が無い環境でも書ける
- GitHub の依存関係（B が A に blocked by される）: 機械が読める。Issue 一覧の `is:blocked` / `blocked-by:<A>` でも絞り込める

GitHub MCP の依存関係のツール（`issue_dependency_read` / `issue_dependency_write`）は既定では無効で（`issue_dependencies` のフィーチャーフラグで有効になる。このテンプレートの `.mcp.json` では有効にしていない）、`issue_read` / `list_issues` の結果にも依存は出ないので、依存関係は `gh api` の REST で扱う。REST なので、クラウドセッションで GraphQL 系が使えない制約（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」）には当たらない（`gh issue create --blocked-by` は GraphQL なので使わない）。

## 付け方

B を起票し、本文に `依存: #<A>` を書いたら、B に「A に blocked by される」を付ける。渡すのは A の Issue 番号ではなく、REST の Issue の `id`。番号を渡すと別の Issue を指すか、見つからずに失敗する。

```bash
id=$(gh api "repos/{owner}/{repo}/issues/<A>" --jq .id)
gh api -X POST "repos/{owner}/{repo}/issues/<B>/dependencies/blocked_by" -F issue_id="$id" --silent
```

- 成功すると B の Issue の JSON を丸ごと返すので、`--silent` で捨てる（失敗の理由は標準エラーに出る）
- 1 つの Issue に付けられる blocked by は 50 件まで
- 既に付いていれば `422`（`Target issue has already been taken`）で失敗する。付いているので、そのままでよい
- `gh` が無い環境では本文だけを書き、GitHub の画面で付けるようユーザーに案内する（B の右のサイドバーの「Relationships」→「Mark as blocked by」で A を選ぶ。リポジトリの triage 以上の権限が要る）

## 読み方

B の依存は、本文の `依存: #N` と blocked by の両方から集める。

- 本文から読むのは、行頭が `依存:` の行（全角の `依存：` も、前に空白や箇条書きの `- ` / `* ` を付けたものも含む）の、コロンの直後に続く `#N` の並び（`#12, #13` のように `,`・`、`・空白で区切ったもの）だけ。並びの後ろの注記に出る `#N` と、並びの中の `owner/repo#N` は読まない（`.claude/scripts/issue-ready.sh` と同じ）。注記は番号の並びの後ろに書く（`依存: #12（#12 で足す節を触るため）`）。別のリポジトリへの依存は blocked by に付ける
- blocked by は次で読む。1 列目は依存先で、このリポジトリなら `#<M>`、別のリポジトリなら `owner/repo#<M>` と出る（blocked by には別のリポジトリの Issue も付けられる）。別のリポジトリの依存先は、本文の `依存: #M` と番号が同じでも同じ依存先とみなさない

```bash
full=$(gh api "repos/{owner}/{repo}" --jq .full_name)
gh api "repos/{owner}/{repo}/issues/<B>/dependencies/blocked_by?per_page=100" \
  --jq '.[] | [(((.repository_url | sub(".*/repos/"; "")) as $r | if $r == "'"$full"'" then "" else $r end) + "#" + (.number | tostring)), .state, (.state_reason // ""), .title] | @tsv'
```

- 完了しているかは、その Issue の状態で見る。blocked by に出た番号は上の出力の `state` / `state_reason`、本文にしか無い番号は `issue_read`（method: `get`）で見る。`closed` でも `state_reason` が `not_planned` / `duplicate` なら、依存した変更は入っていないので、着手してよいかをユーザーに確認する
- 片方にしか無い番号も依存とみなす。そのうえで食い違っていることをユーザーに伝え、揃えるかを聞く（本文に足すなら `issue_write` の `update`、blocked by に足すなら「付け方」、blocked by から外すなら「外し方」）
- `gh` が無い環境では本文の `依存: #N` だけで判定し、blocked by は見ていないことを添える

## 外し方

依存が要らなくなったら、本文の `依存: #<A>` を消し、blocked by も外す。外すときも A の `id` を使う。

```bash
id=$(gh api "repos/{owner}/{repo}/issues/<A>" --jq .id)
gh api -X DELETE "repos/{owner}/{repo}/issues/<B>/dependencies/blocked_by/$id" --silent
```
