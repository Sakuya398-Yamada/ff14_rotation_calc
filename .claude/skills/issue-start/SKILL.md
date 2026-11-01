---
name: issue-start
description: GitHub Issue を起点に、ブランチ作成・探索・設計・実装・レビュー・PR作成・Issueへの記録まで一連の開発を行うスキル。「Issue #N をやって」「#N を実装して」「/issue-start #N」のように Issue 番号を指定して作業を依頼されたときに使う。Issue の分割・起票だけなら /issue-plan を使う。各 Phase の詳細は phases/ 配下に分割してあり、該当 Phase に入る直前に読む（progressive disclosure）。
argument-hint: "#<Issue番号>"
---

# Issue開発スキル（/issue-start）

対象 Issue: **$ARGUMENTS**（`#` の有無は問わない。番号が読み取れなければ最初に質問する）

指定された GitHub Issue に基づいて、ブランチ作成から実装・レビュー・PR作成・Issue への記録までを一連で行う。

## Phase一覧（progressive disclosure）

各 Phase の手順は `phases/` 配下に分割してある。**該当 Phase に入る直前にそのファイルを読む**。冒頭でまとめて読み込まない。読むのは Read ツールで行う（Bash の `cat` だと、出力上限を超えたファイルは退避されて先頭しか届かない。`.claude/skills/issue-start/pitfalls.md`「Bash の出力上限は、文字数ではなくバイト数で効く」）。

| # | Phase | ファイル | スキップ |
|---|-------|---------|---------|
| 1 | Issue分析・不足確認・補完（+ テンプレート更新チェック） | `phases/01-issue-analysis.md`（条件付きの手順は `phases/01-*.md` に分けてあり、本体から該当するときだけ読む） | 不可 |
| 2 | ラベル付与・ブランチ作成 | `phases/02-branch-setup.md` | 不可 |
| 3 | コード探索（code-explorer） | `phases/03-exploration.md` | 修正箇所が明確な bug / docs は可（利用者から見える挙動・上限・制約を変える Issue では、利用者向けドキュメントの Grep だけは行う。扱いは `phases/03-exploration.md`「スキップ条件」） |
| 4 | 設計（code-architect）とユーザー承認 | `phases/04-design.md` | 差分を 1 文で説明できる変更は可（手順書・規約から人の確認を外す・弱める変更と、無人ルーティンの書き込み・判断の手順（ルーティンが参照する skill の判定基準を含む。`weekday-issue-start` が従う `/issue-start` の手順は除く）を変える変更は不可） |
| 5 | 実装・検証・コミット | `phases/05-implementation.md`（条件付きの手順は `phases/05-*.md` に分けてあり、本体から該当するときだけ読む） | 不可 |
| 6 | コードレビュー（code-reviewer） | `phases/06-review.md` | 散文のみの docs は可（手順・コマンドを含むランブックは不可） |
| 7 | PR作成 | `phases/07-pr-creation.md` | 不可 |
| 8 | Issueへの記録（+ 知見ボード・テンプレート元への還元） | `phases/08-issue-recording.md` | 不可 |

> **リポジトリへの変更が出ない Issue**（「〜を裏取りし、必要なら修正 Issue を起票、不要ならクローズ」のような調査だけの Issue と、Issue 本文の書き換えやマージ済みブランチの削除のような GitHub 上の操作だけで終わる Issue）は、Phase 2〜7 を省略して Phase 8 に進む。調査の結果リポジトリへの変更が出れば、通常どおり Phase 2 から進める。どちらに当たるかは `phases/01-issue-analysis.md`「リポジトリへの変更が出ない Issue（調査・GitHub 上の操作だけ）」で見分け、手順は `phases/01-no-repo-change.md` にある

## 全体ルール

- **確認ポイント**: Phase 1 の不足確認、Phase 4 の設計承認、スコープ外問題の起票、GitHub 上の操作だけで終わる Issue の適用前（dry-run の結果を示す）、Phase 8 の知見ボード追記とテンプレート元への起票では、ユーザーの Y/E/N を得てから進む。それ以外の場面では進捗を 2〜3 行で共有しながら自律的に進める
- **確認の聞き方**: 確認ポイントと各 Phase の提示フォーマットの問いは、`AskUserQuestion` で選択式に聞く。1 つのテキストに並べて聞くと、「Y」だけの返事がどれへの答えか読めない
  - 設計案・起票本文などの中身は先にメッセージ本文に出し、質問には問いと選択肢だけを載せる。問いには候補番号とタイトルを入れ、質問だけでどれへの確認か読めるようにする
  - 選択肢はフォーマットの選択肢の行（[Y] / [N]、Phase 1 の旧 PR の [R] / [N] など）から取る。行の無い問い（Phase 4 の案の選択、Phase 1.5 の [Y/E/N]）は、案が複数なら案ごと（推奨を先頭）、1 つなら「進める / 進めない」のように立てる。[E] や修正点は選択肢に入れず、自由記述（Other）で受ける。受けたあとの扱いは各フォーマットの [E] の行のとおり
  - 独立した確認が複数あるとき（起票候補が複数ある等）は、1 回の呼び出しの中で別々の質問にする（1 回 4 問まで。超えたら呼び出しを分ける）。前の答えで次が決まる確認（知見ボードへの投稿のあとのテンプレート元への起票など）はまとめず、順に聞く。plan mode で設計承認を `ExitPlanMode` に乗せるときは、ほかの確認を先に聞いてから `ExitPlanMode` を呼ぶ
  - `AskUserQuestion` が使えないときは、質問ごとに名前（`設計`・`候補1` など）を付けて並べ、`設計-Y 候補1-N` の形で答えてもらう
- **判断の線引き**: 読み方が分かれて成果物が変わる曖昧さは質問する。調べれば分かること（コードの構造・ライブラリの使い方・既存の挙動）は自分で調べる。ツール呼び出しの回数を理由に止まらない
- **1 Issue = 1 PR**: スコープ外の変更を混ぜない（後述「スコープ外問題の起票提案」）
- **GitHub 操作**: `.mcp.json` の GitHub MCP（`github-mcp-server` バイナリ）を使う。未接続・エラー時は `gh` CLI（`/c/Program Files/GitHub CLI/gh.exe` のフルパス起動。`.claude/rules/mcp-setup.md`「利用不可時のフォールバック」）にフォールバックし（各 Phase の `gh issue` / `gh pr` などのサブコマンドは、クラウドセッション（`CLAUDE_CODE_REMOTE=true`）では GraphQL を使うので 403 になる。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」の REST に置き換える）、それも無ければ整形済みの本文を提示してユーザーに操作を依頼する。フロー全体は止めない
- **セッション**: 1 セッション 1 Issue。別の Issue に移るときは `/clear` してから始める

## サブエージェント

Phase 3/4/6 で使う専門エージェントは `.claude/agents/` に定義済み（`Agent` ツールの `subagent_type` で指定する）：

| subagent_type | 役割 | 定義 |
|---------------|------|------|
| `code-explorer` | コード探索・トレース。生の探索ログを主会話に入れず要約だけ受け取る | `.claude/agents/code-explorer.md` |
| `code-architect` | 実装ブループリント（1 案に絞って提案） | `.claude/agents/code-architect.md` |
| `code-reviewer` | 実装者とは別の新しいコンテキストでの批判的レビュー（信頼度80以上のみ報告） | `.claude/agents/code-reviewer.md` |

起動数は各 Phase の起動数表に従う（単純な変更は 1 個、観点が複数あるときだけ 2〜3 個を並列）。サブエージェントはチャット 1 往復の十数倍のトークンを使うので、Grep 1 回で済むことには使わない。プロンプトには目的・スコープ・返却フォーマットと上限・除外事項を含める。バックグラウンドのサブエージェントの報告が届かず、output ファイルのパスだけが渡されたら（クラウドでコンテナが再起動したとき）、ファイルを読まずに `.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでコンテナが再起動すると、バックグラウンドのサブエージェントの報告が届かない」のコマンドで報告だけを取り出す。

`subagent_type` が見つからない（`Agent type '...' not found`）ときは、エージェント定義がセッション開始時にしか読み込まれないのが原因（クラウドセッションの途中でリポジトリを付けた場合など）。クラウドでリポジトリを付けた直後なら、クローン後に登録ツール（`register_repo_root`）を呼べば次のターンから使える。それでも見つからなければ `general-purpose` に `.claude/agents/<name>.md` を読ませて代わりにする。その場合、定義の `tools` に無い操作（`code-reviewer` ならファイルの編集）はしないようプロンプトに書く。

## MCP ツール

サーバー一覧とフォールバックは `.claude/rules/mcp-setup.md`、接続設定・API キーの設定手順は `CONTRIBUTING.md` のサーバーごとの節を参照。MCP は補助手段であり、未接続時は下表のフォールバックで進めてフロー全体を止めない。

| 用途 | 使うもの | 未接続時のフォールバック |
|------|---------|------------------------|
| Issue / PR 操作 | GitHub MCP（`github-mcp-server` バイナリ）: `issue_read` / `issue_write` / `search_issues` / `list_issues` / `sub_issue_write` / `add_issue_comment` / `update_issue_comment` / `pull_request_read` / `search_pull_requests` / `create_pull_request` / `subscribe_pr_activity`（クラウドセッションでは claude-code-remote 側の `mcp__claude-code-remote__subscribe_pr_activity`。`phases/07-pr-creation.md` 手順 4） | `/c/Program Files/GitHub CLI/gh.exe` のフルパス起動で `gh issue ...` / `gh pr ...`（クラウドセッションでは `gh api` の REST。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」） |
| 外部仕様・技術情報（FF14 公式ジョブガイド・ゲーム仕様等） | Brave Search MCP: `brave_web_search` | 組み込みの `WebSearch` / `WebFetch`、またはユーザーに確認 |
| ライブラリの最新ドキュメント | context7 MCP（`resolve-library-id` → `query-docs`）※本リポジトリでは未登録。必要時に `.mcp.json` へ追加 | 公式ドキュメントを `WebFetch` |
| UI 動作確認 | Playwright MCP（`browser_navigate` / `browser_snapshot` 等、`--browser ${PLAYWRIGHT_MCP_BROWSER:-msedge}`。`.claude/skills/playwright-mcp/SKILL.md`） | クラウドセッションでは Node から Playwright を直接使う（`playwright-mcp/SKILL.md`「MCP が使えないとき」）。それもできなければユーザーに手動確認を依頼し、未検証と明記する |

## スコープ外問題の起票提案（Phase横断）

当該 Issue のスコープ外の問題を見つけたら **その場で直さず、別 Issue としての起票を提案する**（1 Issue = 1 PR）。

### 検出タイミング

| Phase | 検出場面 | 扱い |
|-------|---------|------|
| 1（Issue 分析） | 乖離チェック・外部情報の裏取りなどで見つけた別の問題 | Phase 1.5「補完結果の確認」と同じ呼び出しで、別の質問にして聞く（補完が無ければ、それだけを聞いてから Phase 2 に進む）。親の本文に子の番号を書くなら、まとめずに起票の確認を先に聞いて起票し、その番号を入れた補完案で確認する（「全体ルール」の「確認の聞き方」の、前の答えで次が決まる確認） |
| 3（コード探索） | 既存コードの別バグ・設計上の違和感 | Phase 末尾で一覧化して提示 |
| 5（実装） | 実装中に周辺コードのバグに遭遇 | 即時は記録のみ、Phase 末尾でまとめて提示 |
| 6（レビュー） | レビュアーの指摘が当該 Issue の DoD 外 | スコープ内（即修正）／外（起票候補）に仕分け |

### 起票判定基準

- **起票する**: 機能不具合／仕様乖離／データ誤り／ユーザー体験を損なう振る舞い／複数ジョブ横断の類似問題
- **起票しない**: コードスタイルの好み／影響の無いリファクタ案／当該 Issue の DoD 内／重複が確かな既存 Issue（重複かもしれないだけの候補は、起票フローで [A] を示す）

### 起票フロー（共通）

1. **重複チェック**: GitHub MCP の `search_issues`（`owner` / `repo` を指定、query は自然文）で近い Issue を探す。候補があれば、手順 2 の提示にリンクを載せ、選択肢に [A]（既存 Issue への追記）を足す。書き方のパターンが原因の問題（使えないコマンドの指定・古い参照・同じ誤記など）は、起票の前に同じ書き方をリポジトリ全体で Grep し、当たったうち同じ誤りの箇所を 1 つの候補にまとめる（別の語の一部として当たったものや、CHANGELOG のような履歴の記述は入れない）。同じ書き方は Open Issue の本文からも探す。ガイドや知見から写した完了条件・手順に同じ誤りが残っていることがあり、残したままだと、その Issue を `/issue-start` したときの乖離チェックで 1 件ずつ見つかって手戻りになる。`search_issues` は意味で探すので文字列の一致には使わず、Open Issue を本文ごと一覧で取って文字列で絞る（GitHub MCP の `list_issues`（`state: OPEN`、`fields: ["number", "title", "body"]`、`perPage: 100`。`pageInfo.hasNextPage` が true の間は `after` に `endCursor` を渡して続ける）。`gh` なら `gh api "repos/{owner}/{repo}/issues?state=open&per_page=100" --jq '.[] | select(.pull_request == null) | select((.body // "") | contains("<書き方>")) | [.number, .title] | @tsv'`。一覧には PR も入るので、件数は同じ URL を `--jq 'length'` で取って見る。100 件ちょうどなら次のページがあるので、`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」のループで回す）。当たった Issue は手順 2 の提示に載せる。その本文の書き換えは GitHub 上の操作なので、起票とは別に、新旧の差分を示して確認を得てから行う（`phases/01-no-repo-change.md`「GitHub 上の操作だけで終わる Issue」手順 2）。1 か所だけで起票すると、残りの箇所は次にそのファイルを触ったセッションが見つけるたびに、別の Issue に分かれていく。まとめると粒度（`.claude/rules/git-conventions.md`「粒度」）を超えるなら、箇所で分けて起票し、互いを「## 関連Issue」に書く
2. **ユーザー確認**: 以下のフォーマットで提示する

   ```
   【候補N】
   タイトル案: <ラベル名>: <簡潔な説明>
   ラベル: bug / feature / refactor / docs のいずれか
   概要: 何が問題か（1〜3行）
   コード箇所: path/to/file.ts:L10-20（バグの場合）
   再現手順: 箇条書き（バグの場合のみ）
   完了条件: <1〜2 行。何が確認できれば直ったと言えるか>
   依存: なし / #<親番号>（親 Issue のまだマージされていない変更を前提にするとき。手順 3）
   既存Issue重複チェック: なし / 候補 #NN
   同じ書き方が残る Open Issue: なし / #NN（書き方のパターンが原因のときだけ。本文の書き換えは別に確認する）

   起票しますか？
    [Y] そのまま起票
    [E] タイトル/本文を編集して起票
    [A] 既存 Issue #NN にコメントで追記する（重複候補があるときだけ）
    [N] 起票しない（口頭報告のみ）
   ```

   [A] のときは起票せず、その既存 Issue に、見つけた内容（概要・箇所・再現手順）をコメントで追記する
3. **起票**: 承認（Y/E）後、`issue_write`（method: `create`、`parent_issue_number` に親 Issue 番号）で **sub-issue として** 作成する。本文は `.claude/rules/git-conventions.md` の「Issue のタイトルと本文」の構成と「粒度」に揃える。sub-issue にできない場合（`gh` フォールバック等）は本文末尾に `親Issue: #<親番号>` と書く。sub-issue の階層の上限（7 段。`You can’t add more than 7 layers of sub-issues`）で失敗したときは、同じタイトルの Issue が作られていないかを見てから（`issue_write` では作られないことを確かめてあるが、ほかの経路では確かめていない）、親を外して作り直し、同じく本文末尾に書く。子 Issue の完了条件が、作業中の親 Issue のまだマージされていない変更を前提にする（親が足す API を使う別の機能など）なら、本文の「## 関連Issue」に `依存: #<親番号>` を書き、GitHub の依存関係（blocked by）にも付ける（`.claude/skills/issue-start/dependencies.md`「付け方」）。書かないと子の PR が親より先にマージされ得る。書いておけば、子を `/issue-start` したときの Phase 1 の依存チェック（依存先が未完了なら着手前に確認）がそのまま拾う。親の変更そのもので誤りになる記述（親が変える仕様を説明している利用者向けドキュメントなど）は、子 Issue にせず、不可避な副次変更として親の PR で直す（`.claude/rules/git-conventions.md`「スコープ原則（1 Issue = 1 PR）」、`phases/03-exploration.md`「スキップ条件」）
4. **親Issueへの記録**: Phase 8 で親 Issue に子 Issue の一覧をコメントする（`phases/08-issue-recording.md`）

無人起票はしない。スコープ外問題を自動修正もしない（口頭報告か起票のみ）。

## ワークフロー改善の知見ボード（Phase 8）

個別 Issue のスコープ外問題（コードのバグ等）とは別に、**ワークフロー自体（`/issue-start` の手順・`.claude/rules/*`・`CLAUDE.md`・hooks・agents・skills・MCP 運用）への気づき** を累積する常時 Open の Issue がある。

- **知見ボードIssue**: #195（`meta: ワークフロー改善の知見ボード`）
- **書き込み**: Phase 8 の最後にユーザー確認を挟んで `add_issue_comment` で追記する（運用規約は `.claude/rules/workflow-feedback.md`）
- **Phase 5/6/7 との連携**: 実装・レビュー・PR作成中に気づいた改善余地は短文メモとして控え、Phase 8 で棚卸しする。気づきが無ければスキップしてよい
- **還元先の判定**: 各気づきに `還元先: プロジェクト固有 / テンプレート汎用` を付ける（判定表は `workflow-feedback.md`「還元する / しないの判定」）
- **テンプレート元への還元**: 気づきが「テンプレート汎用」（別プロジェクトでも同じ問題が起きるもの）なら、プロジェクト固有情報を除いた上で、ローカル知見ボードへの承認とは別に改めて確認を取り、テンプレート元リポジトリ（`.claude/template-version` の `repo`）に Issue として起票する（Phase 8 手順 6。無人起票は禁止）。テンプレート側で反映・リリースされた改善は更新用 Issue で取り込む（`.claude/rules/workflow-feedback.md`「テンプレート更新の取り込み」。新しいリリースは SessionStart hook が検知し、Phase 1 手順 0.5 で起票を提案する）
- **棚卸し**: 溜まった知見の改善Issueへの昇格は `workflow-feedback.md`「棚卸し運用」に従う（日次ルーティン `daily-triage` が正、手動棚卸しも可）

## ガードレール（自動）

`.claude/settings.json` の PreToolUse hook が、`Bash` ツール経由の git 操作などを決定論的に検証する（git 操作の詳細は `.claude/rules/git-conventions.md`「自動検証」）：

- ブランチ作成コマンドのブランチ名 → `.claude/hooks/validate-branch-name.sh`
- `git commit` の件名 → `.claude/hooks/validate-commit-message.sh`
- `pkill -f` / `pgrep -f` のパターンが、そのコマンドの全文（= Bash ツール自身のシェルのコマンドライン）に一致しないか → `.claude/hooks/validate-pkill-pattern.sh`。`run_in_background` で起動したものは `TaskStop` で止める

違反は exit 2 でブロックされ、理由が返る。規約（`pkill` なら理由に出る止め方）に合わせて直し、`--no-verify` や hook の無効化で回避しない。

## 注意事項

- すべてのブランチは `main` から派生し、`main` にマージする
- 作業中の変更がある場合はユーザーに確認してからブランチを切り替える
- 過去の Issue や PR から関連情報を積極的に収集する
- 完了報告は検証結果（テスト・リント・動作確認）を添えて行う。検証できなかった項目は未検証と明記する
