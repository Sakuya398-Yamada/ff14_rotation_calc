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

## Bash の出力上限は、文字数ではなくバイト数で効く

- **条件**: 日本語の多い md を Bash ツールの `cat` などで読むとき、または手順書の大きさの目安（「出力上限を超えない大きさにする」のような完了条件など）を決めるとき
- **症状**: 公式ドキュメント（tools reference「Output limits」）は、Bash の出力を結果にそのまま返す上限を「約 30,000 文字」（設定 `bashOutputMaxChars` も単位は文字）としているが、実際はバイト数で効く。30,000 文字に届かなくても `Output too large (...KB). Full output saved to: <パス>` と返り、先頭 2KB のプレビューだけが届く。日本語（UTF-8 で 1 文字 3 バイト）が中心の手順書は、文字数の約 1/2（日本語だけなら約 1/3）で上限に達する
- **回避**: 手順書の大きさの目安は `wc -c` で 30,000 バイト未満にする。読むだけなら Read ツールを使う（1 回 25,000 トークンまで。超える分は `offset` / `limit` で読む）。退避されたら、出力に出たパスのファイルを Read で読む
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#178（還元元で、ASCII 29,900 バイトはそのまま返り、30,100 バイトは退避された。20,233 文字・40,870 バイトの日本語の手順書も退避された。このテンプレート元のセッションでも、日本語 10,100 文字・30,300 バイトの出力が退避された）

## フォアグラウンドで起動したサブエージェントも、2 分ほどでバックグラウンドに回される

- **条件**: Claude Code のクラウドセッションで、Agent ツールを `run_in_background: false` で起動し、そのエージェントが 2 分ほどで終わらないとき
- **症状**: 起動から約 120 秒で、呼び出しが結果ではなく `Async agent launched` を返し、エージェントはバックグラウンドで続く。同じメッセージから並列に起動したうち、それまでに終わったものだけがその場で結果を返す。バックグラウンドに回ったものの結果は、ターンを終えなくても、後のツール呼び出しの結果に添えて届く
- **回避**: 結果が届くまでは、残りの検証（テスト、md から抜き出したコマンドの実行、ほかの空回し）を先に進める。進めるものが無くなったら、ターンを終えて待つ（結果が届くとセッションが再開する）。クラウドセッションでは Stop hook にコミットを求められるが、結果が出るまではコミットしない（次項「クラウドセッションの Stop hook は、止まるたびに未コミットの変更の commit / push を 1 度だけ求める」）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#191（このテンプレート元のセッションで確認した。150 秒眠るだけのエージェントは約 2 分で `Async agent launched` を返し、そのあとの WebSearch の結果に添えて報告が届いた。同じメッセージから起動した 5 体では、3 分かかった 3 体がバックグラウンドに回り、1 分以内に終わった 2 体はその場で返った）

## クラウドセッションの Stop hook は、止まるたびに未コミットの変更の commit / push を 1 度だけ求める

- **条件**: Claude Code のクラウドセッションで、未コミットの変更・追跡外のファイル・未 push のコミットのどれかがあるままターンを終えるとき
- **症状**: 環境側の Stop hook（`~/.claude/stop-hook-git-check.sh`）が `There are uncommitted changes in the repository. Please commit and push these changes to the remote branch.` のように返し、ターンが続く。従うと、空回しの結果や設計の承認を待っている変更が、検証や承認の前にコミット・push される
- **回避**: まだコミットしない理由があるなら、コミットせずに理由を 1〜2 行で書き、もう一度ターンを終える。hook は Stop hook から続いているターン（入力の `stop_hook_active` が true）では何も求めずに通すので、2 度目で止まれる。作業ツリーを戻してよい場面（Phase 4 の承認待ちの試作など）は、`git stash` で退避してから止まれば hook に当たらない。空回しの結果待ちでは退避しない（エージェントが変更後のファイルをディスクから読んでいる）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#191（hook の本体が `stop_hook_active` が true なら exit 0 で通すことと、空回しの結果待ちで、コミットせずに 2 度目のターン終了で止まれることを、このテンプレート元のセッションで確かめた）

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

## スキルデータを import するコードを tsx / node で直接実行すると、アイコン PNG で止まる

- **条件**: スキルデータ（`src/client/data/*`）を import するコード（`src/client/logic/timeline-storage.ts` のように間接的に import するものも含む）を、確認用スクリプトなどとして `npx tsx` や `node` で直接実行するとき
- **症状**: データが import するアイコン PNG（`src/client/assets/icons/**`）を JavaScript のモジュールとして読もうとして止まる。PNG の import を URL の文字列に置き換えるのは Vite で、tsx / node はそこを通らない
  - tsx: `.../src/client/assets/icons/mnk/Twin_Snakes.png:1` で `SyntaxError: Invalid or unexpected token`
  - node（`.ts` の型を除去してそのまま実行する版）: `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".png"`
- **回避**: 確認用のコードを一時テストにして Vitest で実行する。Vitest は `vite.config.ts` を読むので、PNG の import は `/assets/icons/...` の文字列になる。`vite.config.ts` の `test.dir` が `src` なので、`src/` の下（`src/client/**/__tests__/` など）に `*.test.ts` の名前で置く。Claude Code から実行すると、Vitest は AI エージェント向けの `agent` レポーター（`std-env` が `CLAUDECODE` などの環境変数で判定）を既定にし、通ったテストの `console.log` を出さない。値を出して見るなら `--reporter=default` を付ける。終わったら消して、`git status --short` に一時ファイルが残っていないことを見る
  ```ts
  // src/client/data/__tests__/tmp-check.test.ts
  import { test } from "vitest";
  import { MNK_ATTACK_SKILLS } from "../mnk-skills";

  test("tmp", () => {
    console.log(MNK_ATTACK_SKILLS.length, MNK_ATTACK_SKILLS[0]?.icon);
  });
  ```
  ```bash
  npx vitest run src/client/data/__tests__/tmp-check.test.ts --reporter=default
  rm src/client/data/__tests__/tmp-check.test.ts
  git status --short
  ```
- **確認**: tsx 4.23.15・Node 22.22.0・Vitest 4.1.12（Claude Code 2.1.310 クラウドセッション）/ 2026-10 / #629（tsx での停止）・#655（`agent` レポーター）
