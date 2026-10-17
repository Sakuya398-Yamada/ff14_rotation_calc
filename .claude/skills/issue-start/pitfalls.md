# 環境依存のハマりどころ（pitfalls）

`/issue-start` の各 Phase から参照される補助ファイルで、常駐しない。特定の OS・ツール・版・端末に条件付けられた回避策だけを置く（書き先の仕分けは `.claude/rules/documentation-policy.md`「ハマりどころの書き先」）。該当する環境・ツールを使うときだけ読めばよい。

- 各項目は **条件 / 症状 / 回避 / 確認** の 4 点で書く。確認は `ツール名（版が分かれば）/ 年月 / 出自 Issue`
- 条件が消えたら項目ごと消す。確認から 6 か月経った項目は棚卸しで見直す（まだ起きるなら確認を更新し、起きなければ削除する）

## 一括置換で改行コードが LF に変わる

- **条件**: Windows で `core.autocrlf=true`（作業ツリーのファイルが CRLF）
- **症状**: `sed -i` や改行を判定しない自作スクリプトで書き換えると全行が LF に変わり、`LF will be replaced by CRLF` の警告と手戻りになる
- **回避**: Edit ツールを使う。スクリプトで一括置換するなら改行コードを判定して保持する
- **確認**: Git for Windows（版未記録）/ 2026-10 / issue-driven-dev-starter#37

## ヒアドキュメントでバックスラッシュが縮む

- **条件**: Windows の Git Bash 等で、シェルの `<<'EOF'` 経由でスクリプトを書き出すとき
- **症状**: `\\` が `\` に縮み、正規表現の `\b` がバックスペースになって置換が 0 件のまま黙って終わる
- **回避**: Write ツールでファイルに書き出してから実行する。一括置換のスクリプトは置換件数を出力し、0 件を検知できるようにする
- **確認**: Git for Windows の Git Bash（版未記録）/ 2026-10 / issue-driven-dev-starter#33

## gojq が `\.` を拒否する

- **条件**: `gh api --jq` で正規表現を書くとき（`gh` 内蔵の jq は gojq）
- **症状**: `test("\.sh$")` のような `\.` が `invalid escape sequence` で拒否される
- **回避**: `[.]` と書く。版の間の差分や特定ファイルの patch は、`gh api --jq` より `git clone --no-checkout` したクローンの `git diff` / `git show` を使う方が簡単（Phase 1 手順 3）
- **確認**: gh CLI（版未記録）/ 2026-10 / issue-driven-dev-starter#28

## `pkill -f` が Bash ツール自身のシェルに一致する

- **条件**: Claude Code の Bash ツールから `pkill -f <パターン>`（`pgrep -f` も同様）でバックグラウンドのプロセスを止めるとき
- **症状**: Bash ツールはコマンドを `bash -c '<コマンド全文>'` で実行するため、パターンがそのシェル自身のコマンドラインにも一致し、シェルごと落ちる（exit 144）。止めるはずのプロセスのうち、子プロセス（`npm run dev` から起動した `node` 等）は残ることがある。`pgrep -fa <パターン>` も自分のシェルの行を返す
- **回避**: `run_in_background` で起動したものは `TaskStop`（タスク ID 指定）で止める。シェルから切り離された子プロセスも一緒に止まる。それ以外（Bash ツールの外で起動したもの、`TaskStop` が無い環境）は、パターンの先頭 1 文字を `[n]ode dev-server` のように角括弧で囲む（正規表現としては同じ文字に一致するが、コマンドライン上の文字列 `[n]ode` 自体には一致しない）か、ポートから PID を引いて `kill` する（`lsof -ti:<port>` 等）。残っていないかの確認も同じ角括弧付きで `pgrep -fa "[n]ode dev-server"` とする
- **確認**: Claude Code（版未記録）/ 2026-10 / issue-driven-dev-starter#80

## クラウドセッションでは gh の GraphQL 系が使えない

- **条件**: Claude Code のクラウドセッション（`CLAUDE_CODE_REMOTE=true`）で GitHub MCP が使えず、`gh` CLI にフォールバックするとき
- **症状**: `gh issue` / `gh pr` / `gh search` / `gh label` のサブコマンドの大半（`gh issue view` / `gh issue comment` / `gh pr create` / `gh pr list` / `gh pr checks` 等）が GraphQL を使うため `HTTP 403: GitHub GraphQL is not available from Claude Code sessions` で失敗する。リポジトリをまたぐ REST（`gh api search/issues` 等）も `sessions are bound to their configured repositories` で拒否される
- **回避**: リポジトリを指定した REST（`gh api repos/{owner}/{repo}/...`）に書き換える。`{owner}` / `{repo}` / `{branch}` は `gh` が現在のリポジトリとブランチで置き換える（テンプレート元など別のリポジトリは明示する）。本文は `-F body=@<file>` でファイルから渡す
  - Issue の取得: `gh api repos/{owner}/{repo}/issues/N`（コメントは `.../issues/N/comments`、sub-issue は `.../issues/N/sub_issues`）
  - ラベル付与: `gh api repos/{owner}/{repo}/issues/N/labels -f "labels[]=bug"`
  - コメント投稿: `gh api repos/{owner}/{repo}/issues/N/comments -F body=@<file>`。編集は `gh api -X PATCH repos/{owner}/{repo}/issues/comments/<comment_id> -F body=@<file>`
  - Issue 作成: `gh api repos/{owner}/{repo}/issues -f title=... -F body=@<file> -f "labels[]=bug"`。sub-issue にするには続けて `gh api repos/{owner}/{repo}/issues/<親番号>/sub_issues -F sub_issue_id=<子の id>`（番号ではなく作成結果の `.id`）
  - Issue のクローズ: `gh api -X PATCH repos/{owner}/{repo}/issues/N -f state=closed -f state_reason=completed`
  - PR 作成: `gh api repos/{owner}/{repo}/pulls -f title=... -f head=<ブランチ> -f base=main -F body=@<file>`
  - ブランチの PR の有無（Phase 7 の再実行前の確認）: `gh api "repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=all"`
  - Issue に関連する PR（検索 API の代わり）: `gh api "repos/{owner}/{repo}/pulls?state=all&per_page=50" --jq '.[] | select((.title + " " + (.body // "")) | test("#N([^0-9]|$)")) | "\(.number)\t\(.state)\t\(.title)"'`
  - CI の確認: `gh api repos/{owner}/{repo}/commits/<sha>/check-runs --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'`
  - draft の ready 化・レビュースレッドの resolve・auto-merge のように GraphQL にしかない操作は、403 のメッセージに載る代替ルート（`repos/{owner}/{repo}/pulls/N/ccr/...`）を使う
- **確認**: Claude Code クラウドセッション + gh 2.89 / 2026-10 / issue-driven-dev-starter#83（issue-driven-dev-starter#81 も同内容）
