# 環境依存のハマりどころ（Claude Code のクラウドセッション）

`/issue-start` の各 Phase から参照される補助ファイルで、常駐しない。`.claude/skills/issue-start/pitfalls.md` のうち、条件が Claude Code のクラウドセッション（claude.ai/code）のものをここに分けてある（1 ファイルを Bash の出力上限より十分小さく保つため）。項目の書き方と見直しの決まりは `pitfalls.md` の冒頭と同じ。クラウドセッションで作業するときだけ読めばよい。

## クラウドセッションでは gh の GraphQL 系が使えない

- **条件**: Claude Code のクラウドセッション（`CLAUDE_CODE_REMOTE=true`）で GitHub MCP が使えず、`gh` CLI にフォールバックするとき
- **症状**: `gh issue` / `gh pr` / `gh search` / `gh label` のサブコマンドの大半（`gh issue view` / `gh issue comment` / `gh pr create` / `gh pr list` / `gh pr checks` 等）が GraphQL を使うため `HTTP 403: GitHub GraphQL is not available from Claude Code sessions` で失敗する。リポジトリをまたぐ REST（`gh api search/issues` 等）は、`sessions are bound to their configured repositories` で拒まれるセッション（2026-10）と、通るセッション（2026-11。下の「Issue の重複検索」）がある。GitHub MCP の `search_issues` / `search_pull_requests` がツール一覧に無いセッションもある
- **回避**: リポジトリを指定した REST（`gh api repos/{owner}/{repo}/...`）に書き換える。`{owner}` / `{repo}` / `{branch}` は `gh` が現在のリポジトリとブランチで置き換える（テンプレート元など別のリポジトリは明示する。セッションに付いていないリポジトリは REST でも拒まれるので、先に足す。`phases/08-issue-recording.md`「5. ワークフロー改善余地の知見ボードへの記録」の手順 4）。本文は `-F body=@<file>` でファイルから渡す
  - Issue の取得: `gh api repos/{owner}/{repo}/issues/N`（コメントは `.../issues/N/comments`、sub-issue は `.../issues/N/sub_issues`）。一覧は既定で 1 ページ 30 件で、`--paginate` は 2 ページ目で止まる（次節）
  - ラベル付与: `gh api repos/{owner}/{repo}/issues/N/labels -f "labels[]=bug"`
  - コメント投稿: `gh api repos/{owner}/{repo}/issues/N/comments -F body=@<file>`。編集は `gh api -X PATCH repos/{owner}/{repo}/issues/comments/<comment_id> -F body=@<file>`
  - Issue 作成: `gh api repos/{owner}/{repo}/issues -f title=... -F body=@<file> -f "labels[]=bug"`。sub-issue にするには続けて `gh api repos/{owner}/{repo}/issues/<親番号>/sub_issues -F sub_issue_id=<子の id>`（番号ではなく作成結果の `.id`）
  - Issue のクローズ: `gh api -X PATCH repos/{owner}/{repo}/issues/N -f state=closed -f state_reason=completed`
  - PR 作成: `gh api repos/{owner}/{repo}/pulls -f title=... -f head=<ブランチ> -f base=main -F body=@<file>`
  - ブランチの PR の有無（Phase 7 の再実行前の確認）: `gh api "repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=all"`
  - Issue の重複検索（`search_issues` の代わり）: まず検索 API を試す。`full=$(gh api "repos/{owner}/{repo}" --jq .full_name)` のあと `gh api -X GET search/issues -f q="repo:$full is:issue <キーワード>" -f per_page=20 --jq '.items[] | [.number, .state, .title] | @tsv'`。`is:issue`（PR なら `is:pull-request`）を付けないと `Query must include 'is:issue' or 'is:pull-request' (HTTP 422)` で失敗する（GitHub API 自体の要件）。`{owner}` / `{repo}` は `-f` の値の中では置き換わらないので、`full` で渡す。`sessions are bound to their configured repositories` で拒まれたら、Issue の一覧をタイトルの語で絞る: `gh api "repos/{owner}/{repo}/issues?state=all&per_page=100" --jq '.[] | select(.pull_request == null) | select(.title | test("<キーワード>")) | [.number, .state, .title] | @tsv'`。タイトルの語でしか絞れないので、言い換えた語でも引く。100 件を超えるなら次節のループで回す
  - Issue に関連する PR（検索 API の代わり）: `gh api "repos/{owner}/{repo}/issues/N/timeline?per_page=100" --jq '.[] | select(.event == "cross-referenced" and .source.issue.pull_request) | [.source.issue.html_url, .source.issue.state, (.source.issue.pull_request.merged_at // "-"), .source.issue.title] | @tsv'`。タイトルや本文でこの Issue に触れた PR だけが、マージ日時（未マージは `-`）付きで返る。別のリポジトリからこの Issue に触れた PR も混ざるので、番号ではなく URL を出し、このリポジトリの PR かどうかは URL で見分ける（番号だけだと、別リポジトリのマージ済み PR をこの Issue の PR と取り違える）。リポジトリの PR を新しい順に一定数だけ見る形と違い、古い PR も取りこぼさない。イベント（コメントを含む）が 100 件を超える Issue は次節のループで回す。超えているかは、同じ URL を `--jq 'length'` で取って見る（100 件ちょうどなら次のページがある。絞った出力の件数では分からない）
  - CI の確認: `gh api repos/{owner}/{repo}/commits/<sha>/check-runs --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'`
  - draft の ready 化・レビュースレッドの resolve・auto-merge のように GraphQL にしかない操作は、403 のメッセージに載る代替ルート（`repos/{owner}/{repo}/pulls/N/ccr/...`）を使う
- **確認**: Claude Code クラウドセッション + gh 2.89 / 2026-10 / issue-driven-dev-starter#83（issue-driven-dev-starter#81 も同内容）。`search/issues` が `is:issue` 付きで通ること、GitHub MCP の `search_*` が無いセッション: 2026-11 / issue-driven-dev-starter#229（スケジュール実行のセッションでは確かめていない）

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

## クラウドセッションで `gh api` から本文やコメントを書き込むと、署名フッターが末尾に付く

- **条件**: Claude Code のクラウドセッションで、Issue の本文を `gh api`（REST。`gh api -X PATCH repos/{owner}/{repo}/issues/N`）で書き換えるとき、コメントを `gh api` で投稿する（`gh api repos/{owner}/{repo}/issues/N/comments -F body=@<file>`）・編集する（`gh api -X PATCH repos/{owner}/{repo}/issues/comments/<ID> -F body=@<file>`）とき。Issue 本文の編集・コメントの投稿・コメントの編集で確かめた
- **症状**: 本文（コメントなら、コメントの本文）の末尾に `\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_` が付け足される。付けているのは GitHub への経路の側で、取り直した本文が送った本文と一致しない（付け直しても、また付く）
  - 送る本文がこれと同じフッターでちょうど終わっていれば付かない
  - リンク先の違うフッター（`.../code/session_...` など）は別物と見なされ、二重になる
  - 元の本文が改行で終わっていると、フッターの前の空行が 1 つ多くなる
  - 本文の途中にある同じフッターは、末尾に移される。元の本文がフッターで終わっていて、その後ろに追記して送ったとき（印の追記など）に起きる。コメントの編集で確かめた（Issue 本文の編集では確かめていない）
  - GitHub MCP の `issue_write`（method: `update`）では付かない。フッターの有無に関わらず、送った本文のまま保存される
- **回避**: 本文の書き換えそのものが成果物なら、GitHub MCP の `issue_write` で書き換える。`gh api` で書き換えた・投稿したなら、送った本文と取り直した本文の両方から、位置を問わずフッターを除いて比べる：
  ```bash
  gh api "repos/{owner}/{repo}/issues/N" --jq .body > <scratchpad>/after.md
  python3 -c 'import sys; f = "---\n_Generated by [Claude Code](https://claude.ai/code)_"; t = ["\n\n".join(x.strip("\n") for x in open(p, newline="").read().split(f) if x.strip("\n")) for p in sys.argv[1:]]; print("一致" if t[0] == t[1] else "不一致")' <scratchpad>/sent.md <scratchpad>/after.md   # sent.md は送った本文そのもの
  ```
  コメントなら、取り直す URL を `repos/{owner}/{repo}/issues/comments/<コメントの ID>`（ID は投稿したときの応答の `id`）にする。フッターで区切った各部分の前後の改行を落とし、空でない部分を空行 1 つでつないでから比べる。送った本文がもとからフッターを含むとき（前に `gh api` で編集した本文をもう一度書き換えるとき、フッターを付けて投稿したとき、フッターの後ろに追記したとき）も、フッターの位置と前後の改行の数だけで食い違わないようにするため。末尾の改行は `--jq` が足す分も含めて比べない。「不一致」なら `diff <scratchpad>/sent.md <scratchpad>/after.md` で中身を見る
- **確認**: Claude Code クラウドセッション + gh 2.89 / 2026-10 / issue-driven-dev-starter#125（このテンプレート元の Issue で、REST での編集と GitHub MCP での編集を、フッターの有無を変えて試した）、issue-driven-dev-starter#156（還元元で、フッターと改行で終わる本文を REST でコメントとして投稿し、取り直して比べた。フッターの前の空行が 1 つ増え、二重にはならなかった）。issue-driven-dev-starter#174（還元元で、末尾にフッターがあるコメントの後ろに 1 行追記して REST で編集し、取り直すとフッターが末尾に移っていた。使い捨てのコメント 2 件で再現）。回避の比べ方は、issue-driven-dev-starter#125・issue-driven-dev-starter#156・issue-driven-dev-starter#174 の結果を `gh` のスタブで再現して確かめた（末尾のフッターだけを除く前の比べ方は issue-driven-dev-starter#174 の形で、取り直した本文からだけ除くさらに前の比べ方は issue-driven-dev-starter#156 の形で、一致しなかった）

## クラウドセッションの git プロキシは、別ブランチへの push を通し、ブランチの削除を通さない

- **条件**: Claude Code のクラウドセッション（Web のセッション・ルーティン）で、push・リモートのブランチの削除・古いブランチの取り込みをするとき
- **症状**:
  - 割り当て以外のブランチ（`claude/*` 以外の名前も）への push は、git のプロキシとしては通る。止めるのは、セッションの指示と、リポジトリに GitHub のブランチ保護・ルールセットがあればそれで、ルーティンの公式ドキュメントも "Claude pushes its work to a branch prefixed with `claude/` unless your prompt directs it to push to another branch" と書いている
  - リモートのブランチの削除は拒まれる。`git push --delete` は `send-pack: unexpected disconnect while reading sideband packet` → `fatal: the remote end hung up unexpectedly` で終わり、ブランチは残る。REST の refs の DELETE も、ブランチ名の `#` を `%23` にすると `Request path could not be canonicalized` で拒まれる
  - clone が shallow（既定ブランチの直近数十コミット）のことがある。古いブランチと既定ブランチの merge-base が見つからず、`git merge` が `refusing to merge unrelated histories` で止まる
- **回避**:
  - push 先は、セッションの指示にあるブランチか、割り当てられたブランチにする。プロキシが通しても、指示に無いブランチへは push しない
  - ブランチの削除は、実行するコマンドを示してユーザーに頼む（`phases/01-no-repo-change.md`「GitHub 上の操作だけで終わる Issue」手順 2）
  - shallow かどうかは `git rev-parse --is-shallow-repository` で見る。`true` なら、取り込む前に `git fetch --unshallow origin` で全履歴を取る（還元元では数秒・約 20MiB）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#132。別ブランチへの push が通ることは、還元元の報告とルーティンの公式ドキュメントに拠る（このテンプレート元では試していない）。`git push --delete` の拒否は、このテンプレート元のセッションでも同じメッセージで確かめた。REST の DELETE と shallow clone は還元元の報告で、このテンプレート元のセッションの clone は shallow ではなかった（環境やリポジトリの大きさで変わる）

## クラウドセッションの auto mode では、allow に当たる Bash も分類器が判定する

- **条件**: Claude Code のクラウドセッションを auto mode で動かし、`.claude/settings.json` の `permissions.allow` に当たる Bash コマンドを実行するとき
- **症状**: allow に当たる Bash（`git status --short` ↔ `Bash(git status *)`、`cat <file>` ↔ `Bash(cat *)` など）も auto mode の分類器が判定し、分類器が止めれば実行されない。公式ドキュメント（permission modes「How the classifier evaluates actions」）の評価順では、allow に当たる操作は分類器より先に決まるが、クラウドの Bash はこの順にならない。Read・Grep・GitHub MCP などはセッション起動時のルールで許可され、`settings.json` の deny（`Bash(rm -rf *)`）もルールで拒否される
- **回避**: 止められても allow の書き方の問題ではないので、allow を足したり広げたりして回避しない。実行するコマンドと止められた理由をユーザーに示して確認を得る。どちらで判定されたかは、セッションの transcript（`~/.claude/projects/<project>/<session>.jsonl`）の `permissionDecision` で見分ける（分類器なら `"reasonType":"classifier"`、ルールなら `"reasonType":"rule"` と `ruleSource`）
- **確認**: Claude Code 2.1.310 クラウドセッション / 2026-10 / #586 で見つけ、#645 のセッションでも同じ結果（`Bash(cat *)` に当たる `cat` が `classifier`、Read・Grep・GitHub MCP は `"ruleSource":"cliArg"`）

## クラウドセッションにリポジトリを複数付けて開始すると、settings.json が読まれない

- **条件**: Claude Code のクラウドセッション（Anthropic のクラウド環境）を、リポジトリを 2 つ以上付けて開始したとき（知見の還元の確認を減らそうと、テンプレート元を最初から付けるなど）
- **症状**:
  - 作業ディレクトリが各クローンの親（git の管理外）になる。各リポジトリの `.claude/settings.json` から読まれるのは `enabledPlugins` と `extraKnownMarketplaces` だけで、hooks と permissions の deny が黙って無効になる。SessionStart のバナーが出ず、規約違反のブランチ名が PreToolUse hook を素通りし、deny した `.env` も読める。シェルの `cd` でリポジトリに移っても効くようにはならない
  - CLAUDE.md・`.claude/rules/`・skills・agents は各リポジトリから読み込まれるので、挙動からは気付きにくい。Phase 1 手順 0 の `pwd -P` の判定で「settings.json 未読み込み」に当たる
  - 利用プロジェクトの `.claude/` とテンプレート元の `template/.claude/` には相対パスが同じファイルが多く、パスを絞らない Grep / Glob は両方に当たる。テンプレート元のクローンの `template/` 配下を Read すると、プレースホルダーのままの `template/CLAUDE.md` と `template/.claude/rules/*.md` が後から読み込まれ、利用プロジェクトの規約と並んでコンテキストに入る
  - 関連: Claude のプロジェクトのクラウドスレッドでは、リポジトリが 1 つでも settings.json の permission rules・hooks・`env` は読まれない（下の公式ドキュメント）
- **回避**: リポジトリは 1 つだけ付けて開始し、テンプレート元は必要になったときに `add_repo` で足す（Phase 8 節 5 手順 4）。テンプレート元のファイルは、クローンを Read せず `get_file_contents` で読む。複数付けて開始してしまったセッションでは、`.claude/rules/git-conventions.md` の規約と deny にある操作の回避を手で守る（Phase 1 手順 0）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#171（還元元で、SessionStart・PreToolUse hook・deny が効かないこと、`cd` しても効かないままなことを確かめた。公式ドキュメント [Settings in cloud sessions](https://code.claude.com/docs/en/settings#settings-in-cloud-sessions) に "a session with several repositories starts above the clones and reads only the `enabledPlugins` and `extraKnownMarketplaces` keys from each repository's `.claude/settings.json`, not permission rules, hooks, `env`, or other keys" とある。途中で `add_repo` で足したときに、開始時のリポジトリの hooks と deny が効き続けるかは確かめていない）

## フォアグラウンドで起動したサブエージェントも、2 分ほどでバックグラウンドに回される

- **条件**: Claude Code のクラウドセッションで、Agent ツールを `run_in_background: false` で起動し、2 分ほどで終わらないとき
- **症状**: 約 120 秒で呼び出しが `Async agent launched` を返し、エージェントはバックグラウンドで続く。結果は、ターンを終えなくても後のツール呼び出しの結果に添えて届く
- **回避**: 届くまでは残りの検証を進める。進めるものが無くなったら、ターンを終えて待つ（結果が届くとセッションが再開する）。Stop hook に求められてもコミットしない（次項）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#191（150 秒眠るだけのエージェントで再現した。空回し 2 体とレビュー 1 体も同じで、1 分以内に終わったものはその場で返った）

## クラウドセッションの Stop hook は、止まるたびに未コミットの変更の commit / push を 1 度だけ求める

- **条件**: Claude Code のクラウドセッションで、未コミットの変更・追跡外のファイル・未 push のコミットがあるままターンを終えるとき
- **症状**: 環境側の Stop hook（`~/.claude/stop-hook-git-check.sh`）が commit / push を求め、ターンが続く。従うと、空回しの結果や設計の承認を待つ変更が、検証・承認の前にコミット・push される
- **回避**: まだコミットしない理由があれば、コミットせずに理由を 1〜2 行で書き、もう一度ターンを終える（hook は `stop_hook_active` が true なら何も求めずに通す）。Phase 4 の承認待ちの試作のように作業ツリーを戻してよい場面は、`git stash` で退避してから止まる。空回しの結果待ちでは退避しない（エージェントがディスクから読んでいる）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#191（hook の本体と、このテンプレート元のセッションで、2 度目のターン終了で止まれることを確かめた）

## クラウドセッションでコンテナが再起動すると、バックグラウンドのサブエージェントの報告が届かない

- **条件**: Claude Code のクラウドセッションで、バックグラウンドのサブエージェントの完了通知が届く前にコンテナが再起動したとき
- **症状**: 報告は届かず、system reminder で output ファイルのパスだけが渡される（`Read the output file to get the result`）。ファイルは数百 KB の JSONL トランスクリプトで（起動時の結果は `Do NOT Read or tail this file` と言う）、報告はテキストではなく `SubagentHandback` ツール呼び出しの `input.message` にある
- **回避**: Read・`cat` せず、報告だけを取り出す（`SendMessage` で続けたエージェントは報告が複数あるので最後を取る。途中で切れた行は飛ばして読む）。ファイルが無いか「（報告なし）」なら、起動し直す

  ```bash
  jq -cR 'fromjson?' <output_file> | jq -rs '[.[] | select(.type=="assistant") | .message.content[]? | select(.type=="tool_use" and .name=="SubagentHandback") | .input.message] | last // "（報告なし）"'
  ```

- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#192（還元元と、このテンプレート元のトランスクリプトで取り出せることを確かめた）

## クラウドセッションでは、セッションに付いていないリポジトリの Release やファイルを API で読めない

- **条件**: Claude Code のクラウドセッション（`CLAUDE_CODE_REMOTE=true`）で、テンプレート元のように、セッションに付いていないリポジトリの Release notes（`gh api repos/<owner>/<repo>/releases/tags/<版>`）や、特定のタグのファイル（`gh api "repos/<owner>/<repo>/contents/<path>?ref=<タグ>"`、GitHub MCP の `get_file_contents` に `ref` を渡すもの）を読むとき
- **症状**: `gh` は `gh: GitHub access to this repository is not enabled for this session. Use add_repo to request access. ...（HTTP 403）`、`get_file_contents` は `Access denied: repository "<owner>/<repo>" is not configured for this session. ...` で失敗する。公開リポジトリでも同じ。一方、git の clone はプロキシを通るので、公開リポジトリのクローンは作れる（公開リポジトリへの読み取りの `add_repo` は、何も付けずに匿名の clone を案内してくる）
- **回避**: クローンから読む。版の決まったファイルは `git clone -q --depth 1 --branch <タグ> https://github.com/<owner>/<repo>.git <scratchpad>/<名前>` で取り、そのファイルを読む。テンプレート元の Release notes と手動対応は、テンプレート元のクローン（`/template-update`「3-way マージの定型手順」の `git clone --no-checkout`）から、vNEW のタグで読む。Release notes の自動生成の部分は、`git -C <scratchpad>/template-src show vNEW:CHANGELOG.md` の該当版の節（release-please が版ごとに書く、Release notes と同じ一覧）で代える。Release notes に後から足す「手動対応」は `CHANGELOG.md` には入っていないので、`git -C <scratchpad>/template-src show vNEW:docs/upgrade-notes.md` で読む。`HEAD` で読まないのは、`--no-checkout` のクローンの `HEAD` は clone した時点の既定ブランチのままで、あとから `git fetch --tags` しても進まず、使い回したクローンでは古い版を黙って読み（`upgrade-notes.md` がまだ無い版では `fatal: path 'docs/upgrade-notes.md' does not exist in 'HEAD'`）、新しいクローンでもまだリリースされていない記述が入りうるため。クローンで読めるので、`add_repo` でテンプレート元を足さなくてよい（push の権限で足すなら、ユーザーの確認が要る）
- **確認**: Claude Code クラウドセッション + gh 2.89 / 2026-11 / issue-driven-dev-starter#225（ファイルの読み取り: issue-driven-dev-starter#235、タグで読む: issue-driven-dev-starter#228）
