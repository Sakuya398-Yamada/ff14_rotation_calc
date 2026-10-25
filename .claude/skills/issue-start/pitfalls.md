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

## `gh --jq` の正規表現にバックスラッシュが通らない

- **条件**: `gh api --jq` で正規表現を書くとき（`gh` 内蔵の jq は gojq）。Windows の Git Bash から `gh.exe` を呼ぶときは、引数の変換が 2 段目として重なる
- **症状**: gojq は文字列リテラル中の `\.` / `\s` を受け付けず、`test("\.sh$")` が `invalid escape sequence "\." in string literal` で止まる。`\\s` と重ねると Linux では通るが、Git Bash から Windows の `.exe` に渡す引数では `\\` が 1 本に潰れて `\s` で届き、同じエラーになる
- **回避**: `--jq` の正規表現ではバックスラッシュを使わず、`[.]` / `[[:space:]]` のような文字クラスで書く（`test("[.]sh$")`、`test("abc[[:space:]]+$")`）。一致する例が GitHub 上に無いときは、`"abc" + ([10]|implode)` のように入力を合成して確かめる。版の間の差分や特定ファイルの patch は、`gh api --jq` より `git clone --no-checkout` したクローンの `git diff` / `git show` を使う方が簡単（Phase 1 手順 3）
- **確認**: gh 2.89 / 2026-10 / issue-driven-dev-starter#28・#529（`\\` が潰れるのは Git for Windows の Git Bash + gh（版未記録）/ 2026-10 / #445）

## クラウドセッションでは gh の GraphQL 系が使えない

- **条件**: Claude Code のクラウドセッション（`CLAUDE_CODE_REMOTE=true`）で GitHub MCP が使えず、`gh` CLI にフォールバックするとき
- **症状**: `gh issue` / `gh pr` / `gh search` / `gh label` のサブコマンドの大半（`gh issue view` / `gh issue comment` / `gh pr create` / `gh pr list` / `gh pr checks` 等）が GraphQL を使うため `HTTP 403: GitHub GraphQL is not available from Claude Code sessions` で失敗する。リポジトリをまたぐ REST（`gh api search/issues` 等）も `sessions are bound to their configured repositories` で拒否される
- **回避**: リポジトリを指定した REST（`gh api repos/{owner}/{repo}/...`）に書き換える。`{owner}` / `{repo}` / `{branch}` は `gh` が現在のリポジトリとブランチで置き換える（テンプレート元など別のリポジトリは明示する。セッションに付いていないリポジトリは REST でも拒まれるので、先に足す。`phases/08-issue-recording.md`「5. ワークフロー改善余地の知見ボードへの記録」の手順 4）。本文は `-F body=@<file>` でファイルから渡す
  - Issue の取得: `gh api repos/{owner}/{repo}/issues/N`（コメントは `.../issues/N/comments`、sub-issue は `.../issues/N/sub_issues`）。一覧は既定で 1 ページ 30 件で、`--paginate` は 2 ページ目で止まる（次節）
  - ラベル付与: `gh api repos/{owner}/{repo}/issues/N/labels -f "labels[]=bug"`
  - コメント投稿: `gh api repos/{owner}/{repo}/issues/N/comments -F body=@<file>`。編集は `gh api -X PATCH repos/{owner}/{repo}/issues/comments/<comment_id> -F body=@<file>`
  - Issue 作成: `gh api repos/{owner}/{repo}/issues -f title=... -F body=@<file> -f "labels[]=bug"`。sub-issue にするには続けて `gh api repos/{owner}/{repo}/issues/<親番号>/sub_issues -F sub_issue_id=<子の id>`（番号ではなく作成結果の `.id`）
  - Issue のクローズ: `gh api -X PATCH repos/{owner}/{repo}/issues/N -f state=closed -f state_reason=completed`
  - PR 作成: `gh api repos/{owner}/{repo}/pulls -f title=... -f head=<ブランチ> -f base=main -F body=@<file>`
  - ブランチの PR の有無（Phase 7 の再実行前の確認）: `gh api "repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=all"`
  - Issue の重複検索（`search_issues` の代わり）: `gh api "repos/{owner}/{repo}/issues?state=all&per_page=100" --jq '.[] | select(.pull_request == null) | select(.title | test("<キーワード>")) | [.number, .state, .title] | @tsv'`。検索 API（`search/issues`）は `repo:` で絞っても `sessions are bound to their configured repositories` で拒まれる。タイトルの語でしか絞れないので、言い換えた語でも引く。100 件を超えるなら次節のループで回す
  - Issue に関連する PR（検索 API の代わり）: `gh api "repos/{owner}/{repo}/issues/N/timeline?per_page=100" --jq '.[] | select(.event == "cross-referenced" and .source.issue.pull_request) | [.source.issue.html_url, .source.issue.state, (.source.issue.pull_request.merged_at // "-"), .source.issue.title] | @tsv'`。タイトルや本文でこの Issue に触れた PR だけが、マージ日時（未マージは `-`）付きで返る。別のリポジトリからこの Issue に触れた PR も混ざるので、番号ではなく URL を出し、このリポジトリの PR かどうかは URL で見分ける（番号だけだと、別リポジトリのマージ済み PR をこの Issue の PR と取り違える）。リポジトリの PR を新しい順に一定数だけ見る形と違い、古い PR も取りこぼさない。イベント（コメントを含む）が 100 件を超える Issue は次節のループで回す。超えているかは、同じ URL を `--jq 'length'` で取って見る（100 件ちょうどなら次のページがある。絞った出力の件数では分からない）
  - CI の確認: `gh api repos/{owner}/{repo}/commits/<sha>/check-runs --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'`
  - draft の ready 化・レビュースレッドの resolve・auto-merge のように GraphQL にしかない操作は、403 のメッセージに載る代替ルート（`repos/{owner}/{repo}/pulls/N/ccr/...`）を使う
- **確認**: Claude Code クラウドセッション + gh 2.89 / 2026-10 / issue-driven-dev-starter#83（issue-driven-dev-starter#81 も同内容）

## クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる

- **条件**: Claude Code のクラウドセッション（`CLAUDE_CODE_REMOTE=true`）で `gh api --paginate` を使うとき
- **症状**: 1 ページ目を出力したあと、2 ページ目の取得が `Numeric-ID repository paths (repositories/{id}/...) are not supported through this proxy. Use repos/{owner}/{repo}/... endpoints instead. (HTTP 403)` で失敗する。GitHub が `Link` ヘッダーで返す次ページの URL が `repositories/<数値 ID>/...` の形で、エージェントのプロキシがこの形を拒否するため。終了コードは 1 になるが、1 ページ目はもう出力されているので、ファイルやパイプに流していると途中で切れた結果を全件と取り違えやすい
- **回避**: `--paginate` を使わず、`per_page=100&page=N` を明示して、空配列 `[]` が返るまでページを進める。取れた件数が想定（コメントなら Issue の `comments` の値）と合うかも見る
  ```bash
  out=<scratchpad>/comments.jsonl; : >"$out"; failed=
  page=1
  while :; do
    body=$(gh api "repos/{owner}/{repo}/issues/N/comments?per_page=100&page=$page") || { echo "page $page で失敗" >&2; failed=1; break; }
    [ "$body" = "[]" ] && break
    printf '%s\n' "$body" >>"$out"
    page=$((page + 1))
  done
  [ -z "$failed" ] && jq -s 'add | length' "$out"   # 件数。中身は jq -s 'add | .[] | ...' "$out" で漉す
  ```
  このループは配列をそのまま返す一覧用。`check-runs` や `actions/runs` のように `{"total_count": ..., "<名前>": [...]}` で包んで返す一覧は空のページでも `[]` にならないので、中の配列が空になるまで回し、件数は `total_count` と比べる。親 Issue 1 件あたり 100 件までの sub-issue のように、上限が 100 件以下と決まっている一覧は `?per_page=100` で 1 回で取れる
- **確認**: Claude Code クラウドセッション + gh 2.89 / 2026-10 / issue-driven-dev-starter#100

## クラウドセッションで `gh api` から本文の編集やコメントの投稿をすると、末尾に署名フッターが付く

- **条件**: Claude Code のクラウドセッションで、Issue の本文を `gh api`（REST。`gh api -X PATCH repos/{owner}/{repo}/issues/N`）で書き換えるとき、またはコメントを `gh api`（`gh api repos/{owner}/{repo}/issues/N/comments -F body=@<file>`）で投稿するとき。確かめたのは Issue 本文の編集とコメントの投稿で、コメントの編集は確かめていない
- **症状**: 本文（コメントなら、コメントの本文）の末尾に `\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_` が付け足される。付けているのは GitHub への経路の側で、取り直した本文が送った本文と一致しない（付け直しても、また付く）
  - 送る本文がこれと同じフッターでちょうど終わっていれば付かない
  - リンク先の違うフッター（`.../code/session_...` など）は別物と見なされ、二重になる
  - 元の本文が改行で終わっていると、フッターの前の空行が 1 つ多くなる
  - GitHub MCP の `issue_write`（method: `update`）では付かない。フッターの有無に関わらず、送った本文のまま保存される
- **回避**: 本文の書き換えそのものが成果物なら、GitHub MCP の `issue_write` で書き換える。`gh api` で書き換えた・投稿したなら、送った本文と取り直した本文の両方から、末尾の改行とフッターを除いて比べる：
  ```bash
  gh api "repos/{owner}/{repo}/issues/N" --jq .body > <scratchpad>/after.md
  python3 -c 'import sys; f = "---\n_Generated by [Claude Code](https://claude.ai/code)_"; t = [open(p, newline="").read().rstrip("\n") for p in sys.argv[1:]]; t = [x[:-len(f)].rstrip("\n") if x.endswith(f) else x for x in t]; print("一致" if t[0] == t[1] else "不一致")' <scratchpad>/sent.md <scratchpad>/after.md   # sent.md は送った本文そのもの
  ```
  コメントなら、取り直す URL を `repos/{owner}/{repo}/issues/comments/<コメントの ID>`（ID は投稿したときの応答の `id`）にする。両方から除くのは、送った本文がもとからフッターで終わっているとき（前に `gh api` で編集した本文をもう一度書き換えるとき、フッターを付けて投稿したとき）も、フッターの前後の改行の数だけで食い違わないようにするため。末尾の改行は `--jq` が足す分も含めて比べない。「不一致」なら `diff <scratchpad>/sent.md <scratchpad>/after.md` で中身を見る
- **確認**: Claude Code クラウドセッション + gh 2.89 / 2026-10 / issue-driven-dev-starter#125（このテンプレート元の Issue で、REST での編集と GitHub MCP での編集を、フッターの有無を変えて試した）、issue-driven-dev-starter#156（還元元で、フッターと改行で終わる本文を REST でコメントとして投稿し、取り直して比べた。フッターの前の空行が 1 つ増え、二重にはならなかった）。回避の比べ方は、issue-driven-dev-starter#125 と issue-driven-dev-starter#156 の結果を `gh` のスタブで再現して確かめた（取り直した本文からだけフッターを除く前の比べ方は、issue-driven-dev-starter#156 の形で一致しなかった）

## クラウドセッションの git プロキシは、別ブランチへの push を通し、ブランチの削除を通さない

- **条件**: Claude Code のクラウドセッション（Web のセッション・ルーティン）で、push・リモートのブランチの削除・古いブランチの取り込みをするとき
- **症状**:
  - 割り当て以外のブランチ（`claude/*` 以外の名前も）への push は、git のプロキシとしては通る。止めるのは、セッションの指示と、リポジトリに GitHub のブランチ保護・ルールセットがあればそれで、ルーティンの公式ドキュメントも "Claude pushes its work to a branch prefixed with `claude/` unless your prompt directs it to push to another branch" と書いている
  - リモートのブランチの削除は拒まれる。`git push --delete` は `send-pack: unexpected disconnect while reading sideband packet` → `fatal: the remote end hung up unexpectedly` で終わり、ブランチは残る。REST の refs の DELETE も、ブランチ名の `#` を `%23` にすると `Request path could not be canonicalized` で拒まれる
  - clone が shallow（既定ブランチの直近数十コミット）のことがある。古いブランチと既定ブランチの merge-base が見つからず、`git merge` が `refusing to merge unrelated histories` で止まる
- **回避**:
  - push 先は、セッションの指示にあるブランチか、割り当てられたブランチにする。プロキシが通しても、指示に無いブランチへは push しない
  - ブランチの削除は、実行するコマンドを示してユーザーに頼む（`phases/01-issue-analysis.md`「GitHub 上の操作だけで終わる Issue」手順 2）
  - shallow かどうかは `git rev-parse --is-shallow-repository` で見る。`true` なら、取り込む前に `git fetch --unshallow origin` で全履歴を取る（還元元では数秒・約 20MiB）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#132。別ブランチへの push が通ることは、還元元の報告とルーティンの公式ドキュメントに拠る（このテンプレート元では試していない）。`git push --delete` の拒否は、このテンプレート元のセッションでも同じメッセージで確かめた。REST の DELETE と shallow clone は還元元の報告で、このテンプレート元のセッションの clone は shallow ではなかった（環境やリポジトリの大きさで変わる）

## `paths:` 付き rules の読み込みを確かめる

- **条件**: `paths:` を付けた rules が、該当ファイルを扱ったときに読み込まれるかを確かめるとき
- **症状**: `/context` は起動時に読み込まれたファイルしか見せないので、`paths:` の一致で後から読み込まれる rules は確かめられない。headless の `claude -p` で確かめようとして `--allowedTools "Read" "<プロンプト>"` と書くと、値を複数取るオプションがプロンプトまで値として取り込み、`Error: Input must be provided either through stdin or as a prompt argument when using --print` で止まる
- **回避**: 標準入力の JSON を追記するだけの InstructionsLoaded hook を `--settings` で付け、headless で該当ファイルを読ませる。プロンプトはオプションより前に置き、`--allowedTools=Read` と `=` で 1 つの値として渡し、`< /dev/null` で標準入力を閉じる
  ```bash
  echo '{"hooks":{"InstructionsLoaded":[{"hooks":[{"type":"command","command":"cat >> /tmp/il.jsonl; echo >> /tmp/il.jsonl"}]}]}}' > /tmp/il-settings.json
  rm -f /tmp/il.jsonl
  claude -p "<該当ファイル> を Read ツールで読み、1 行で要約して" --settings /tmp/il-settings.json --allowedTools=Read < /dev/null
  jq -c '{load_reason, file_path, trigger_file_path}' /tmp/il.jsonl
  ```
  `load_reason` が `path_glob_match` で、`trigger_file_path` が読ませたファイルの行があれば読み込まれている。対象外のファイルを読ませたときと、起動時（`session_start`）にはその rules の行が出ないことも合わせて見る（ログは追記なので、実行ごとに `rm -f` で消してから見る）
- **確認**: Claude Code 2.1.302 / 2026-10 / issue-driven-dev-starter#92

## npm 10.9.4 で vite / vitest の更新が `edgesOut` で落ちる

- **条件**: npm 10.9.4（Node 22.22.0 同梱）で、vite / vitest を含む依存を更新するとき（`npm audit fix` / `npm update vite vitest` / `npm install -D vite@^8.3.4` 等）
- **症状**: `npm error Cannot read properties of null (reading 'edgesOut')` で落ちる。arborist が vitest の optional peer を辿る `#loadPeerSet` で null を参照している（npm/cli#6193 のスタックトレースも同じ箇所を通る）。vite / vitest 以外のパッケージだけの更新では起きない
- **回避**: vite / vitest 以外は `npm update <pkg...>` で個別に更新し、vite / vitest は `npm update vite vitest --legacy-peer-deps` で上げる。`--legacy-peer-deps` は lock の `dev` / `devOptional` フラグを一部ずらすので、最後に通常モードの `npm install --package-lock-only` で lock を正規化し、もう一度実行しても lock が変わらないことを確かめる。`npx npm@11` での lock の再生成は、lock が 5000 行以上書き換わって最小の変更にならないので使わない
- **確認**: npm 10.9.4（Node 22.22.0）/ 2026-10 / #467・#529
