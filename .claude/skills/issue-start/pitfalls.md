# 環境依存のハマりどころ（pitfalls）

`/issue-start` の各 Phase から参照される補助ファイルで、常駐しない。特定の OS・ツール・版・端末に条件付けられた回避策だけを置く（書き先の仕分けは `.claude/rules/documentation-policy.md`「ハマりどころの書き先」）。該当する環境・ツールを使うときだけ読めばよい。条件が Claude Code のクラウドセッション（claude.ai/code）のものは `.claude/skills/issue-start/pitfalls-cloud.md` に分けてある（1 ファイルを Bash の出力上限より十分小さく保つため）。

- 各項目は **条件 / 症状 / 回避 / 確認** の 4 点で書く。確認は `ツール名（版が分かれば）/ 年月 / 出自 Issue`
- 条件が消えたら項目ごと消す。確認から 6 か月経った項目は棚卸しで見直す（まだ起きるなら確認を更新し、起きなければ削除する）

## 一括置換で改行コードが LF に変わる

- **条件**: Windows で `core.autocrlf=true`（作業ツリーのファイルが CRLF）
- **症状**: `sed -i` や改行を判定しない自作スクリプトで書き換えると全行が LF に変わり、`LF will be replaced by CRLF` の警告と手戻りになる
- **回避**: Edit ツールを使う。スクリプトで一括置換するなら改行コードを判定して保持する
- **確認**: Git for Windows（版未記録）/ 2026-10 / issue-driven-dev-starter#37

## Edit / Write は、`.md` 以外のファイルで行末の空白を落とす

- **条件**: Claude Code の Edit / Write ツールで、`.md` / `.mdx` 以外のファイル（`.sh`・`.json`・`.txt`・拡張子なしなど）を書くとき
- **症状**: Edit の `new_string` と Write の `content` の各行から、行末の空白（スペース・タブ）が消える。エラーは出ない。`old_string` 側の空白は一致に使われるので、行の途中の空白で終わる組（`json=0 ` → `json=1 `）を当てると、空白が消えて後ろの語とつながる（`json=1repo=...`）。行末に空白のある行を `new_string` に入れると、変えていないその行の空白も消える
- **回避**: Edit の組は行単位で作り、行の途中で切らない。行末の空白を残す必要がある行（テストのフィクスチャなど）は、Edit / Write で書いたあとに `cat -A` や `cmp` で確かめ、消えていればシェル（`printf`・`sed`）で書く（`CLAUDE.md` と `.claude/` 配下はシェルからの書き込みが分類器に止められることがあるので、そのときは行をユーザーに示す。`.claude/skills/template-update/SKILL.md`「3-way マージの定型手順」1）
- **確認**: Claude Code 2.1.316 / 2026-11 / issue-driven-dev-starter#263（`.md`・`.mdx` では Edit・Write とも行末の空白が残り、`.sh`・`.json`・`.txt`・拡張子なしでは消えることを、このテンプレート元のセッションで確かめた）

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

## Bash の出力上限は、文字数ではなくバイト数で効く

- **条件**: 日本語の多い md を Bash ツールの `cat` などで読むとき、または手順書の大きさの目安（「出力上限を超えない大きさにする」のような完了条件など）を決めるとき
- **症状**: 公式ドキュメント（tools reference「Output limits」）は、Bash の出力を結果にそのまま返す上限を「約 30,000 文字」（設定 `bashOutputMaxChars` も単位は文字）としているが、実際はバイト数で効く。30,000 文字に届かなくても `Output too large (...KB). Full output saved to: <パス>` と返り、先頭 2KB のプレビューだけが届く。日本語（UTF-8 で 1 文字 3 バイト）が中心の手順書は、文字数の約 1/2（日本語だけなら約 1/3）で上限に達する
- **回避**: 手順書の大きさの目安は `wc -c` で 30,000 バイト未満にする。読むだけなら Read ツールを使う（1 回 25,000 トークンまで。超える分は `offset` / `limit` で読む）。退避されたら、出力に出たパスのファイルを Read で読む
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#178（還元元で、ASCII 29,900 バイトはそのまま返り、30,100 バイトは退避された。20,233 文字・40,870 バイトの日本語の手順書も退避された。このテンプレート元のセッションでも、日本語 10,100 文字・30,300 バイトの出力が退避された）

## 一時リポジトリで git を試すと、検証 hook がコマンド文字列に反応して止める

- **条件**: 検証 hook（`.claude/hooks/validate-commit-message.sh` / `validate-branch-name.sh`）を登録したセッションで、Bash から一時リポジトリの git（コミット・ブランチ作成）を操作するとき
- **症状**: hook はどのリポジトリへの操作かを見分けず、規約外の件名・ブランチ名を止める。`git -C <一時リポジトリ>`、heredoc で書き出したスクリプト（本文がコマンド文字列に入る）、名前を変数に入れる形も止まる
- **回避**: 手順をスクリプトファイルに書いて `bash <スクリプト>` で回す。書き出しは Write ツールで、Write の無いサブエージェントは `printf '%s\n' '<1 行目>' '<2 行目>' > <スクリプト>` で、1 行に 1 コマンドずつ別々の引数にして書く（hook は引数の文字列の中でもコマンドの位置の git を見るので、1 つの引数の中で `;` や `&&` の後ろに git を書くと止まる）。作業中のリポジトリへの git 操作には使わない（hook の迂回になる。`CLAUDE.md`「自動ガードレール」）
- **確認**: Claude Code クラウドセッション / 2026-10 / issue-driven-dev-starter#200（還元元と、このテンプレート元で hook に同じコマンドを渡して確かめた）

## `/doctor` は Claude から呼べない

- **条件**: rules の棚卸し（`.claude/rules/documentation-policy.md`「常駐量に予算を置く」）などで、Claude が `/doctor prompt-audit` の点検を回したいとき
- **症状**: `/doctor` はモデルからの呼び出しが無効（`disableModelInvocation: true`）なので、Skill ツールの一覧に出ず、Claude からは呼べない。ユーザーにスラッシュコマンドを打ってもらうしかないように見える
- **回避**: `/doctor prompt-audit` は、同梱の `claude-api` skill の `prompt-audit` サブコマンドに引数を渡しているだけなので、Claude は `Skill(skill: "claude-api", args: "prompt-audit <パス>")` で同じ点検を回せる。読み込まれた本文の Subcommands の表に `prompt-audit` があることを確かめてから進める（内部の委ね方なので、版で変わりうる。無ければユーザーに `/doctor prompt-audit` を打ってもらう）。点検の対象（`CLAUDE.md`・rules・skills・agents）は合わせて数百 KB あるので、範囲を分け（常駐の rules と agents／`issue-start`／その他の skills など）、サブエージェントで並列に回す
- **確認**: Claude Code 2.1.317 / 2026-11 / issue-driven-dev-starter#279（還元元の CLI で確かめた。このテンプレート元のクラウドセッション（2.1.317）でも、`claude-api` skill に `prompt-audit <パス>` を渡すと、Subcommands の表に `prompt-audit` の手順があった）

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
