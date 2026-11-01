# Phase 5 補足: 起動時に読まれる設定の検証

`phases/05-implementation.md`「起動時に読まれる設定の検証」で、Claude Code 自身がセッション起動時に読み込む設定（`.claude/settings.json` の hooks 登録・`.mcp.json`・SessionStart hook）を変える Issue だと分かったときに読む。Phase 5 の本体を Bash の出力上限より十分小さく保つため、条件付きのこの手順を分けてある。

## 起動時に読まれる設定の検証

`.claude/settings.json` の hooks 登録・`.mcp.json`・SessionStart hook のように Claude Code 自身がセッション起動時に読み込む設定を変える Issue では、作業中のセッションのままでは変更後の動きを確かめられない。hook スクリプトの出力だけなら直接実行（`bash .claude/hooks/session-start-info.sh </dev/null`）で見られるが、`.mcp.json` の読み込みと SessionStart hook は起動時にしか起きない。settings.json の hooks の登録（PreToolUse など）の変更は、逆に作業中のセッションにもすぐ効く。登録するスクリプトを先に置いてから登録する（無いスクリプトを `"onFailure": "block"` で登録すると、Bash の呼び出しがすべて止まる）。どれも、新しく起動したセッションでの動きは作業中のセッションでは確かめられないので、コミット・push してから、**PR ブランチで開いた新しいセッション** で検証する：

- クラウドセッションなら、セッション作成ツール（`create_session`。`source_url` にこのリポジトリ、`source_revision` に PR ブランチを指定）で子セッションを立てるのが確実。結果は `list_events` に `kinds: ["result"]` と `limit: 100` を付けて読む（絞り込みは読み込んだあとに掛かるので、件数が少ないと `result` が入らないことがある。子セッションの返答は `result` イベントの `result` に入る。途中経過が要るときだけ `assistant` を足す。`system` は読まない。起動時の `init` イベントが 1 件で数万トークンあり、ツールとスキルの一覧と計測値だけで検証結果は入っていない）。使えなければ、ユーザーに PR ブランチで新しいセッションを開いてもらう
- ユーザーに検証を頼むときは、渡す検証プロンプトの **先頭** に次の確認を入れる。既定ブランチで起動したセッションが変更前の状態を検証して全手順が失敗する、という往復を防ぐため：

  ```
  まず `git branch --show-current` と `git rev-parse HEAD` を表示してください。ブランチが `<PR ブランチ>`、HEAD が `<コミット SHA>` でなければ、以降の手順は実行せず、表示したブランチと HEAD を報告して止まってください。
  ```
