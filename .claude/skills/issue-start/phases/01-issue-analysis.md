# Phase 1: Issue分析 & 不足確認

Issue の内容を把握してから実装に入る。曖昧なまま進めると手戻りが大きいので、**ユーザーが決めるべきこと** はここで確認し、**調べれば分かること** は自分で調べて埋める。

## 0. 作業環境チェック

SessionStart hook の出力（`## Repository status` 以下）を確認する。`## ⚠ Ghost worktree detected` が含まれていたら、後述の **亡霊 worktree モード** で作業する。hook が見分けるのは亡霊 worktree だけなので、出力があっても Ghost が無ければ、出力が無いときと同じく以下で判定する：

```bash
pwd -P   # シンボリックリンクを解いた実パス。git が返すパスは実パスなので、pwd のままだとリンク経由で開いたときに一致しない
git rev-parse --show-toplevel
git rev-parse --git-dir --git-common-dir   # リポジトリのルートで打つ。2 行が同じならメインのチェックアウト、違えば linked worktree
git worktree list
```

| `pwd -P` の状態 | 扱い |
|---|---|
| `git rev-parse --show-toplevel` と一致し、`--git-dir` と `--git-common-dir` が同じ | **メインリポ作業**: 通常どおり |
| `git rev-parse --show-toplevel` と一致し、`--git-dir` と `--git-common-dir` が違う（linked worktree。`git worktree list` にも出る） | **worktree 作業**: Edit / Write の `file_path` は、起動形態に関わらずこの worktree のパスを使う（隔離が掛かるかを試して確かめる必要はない）。`claude --worktree`・`EnterWorktree`・Claude Desktop の worktree セッション（サブエージェントの `isolation: worktree` も）では、組み込みの worktree 隔離がメインリポ側のパスへの Edit / Write を拒否する（`This session is isolated in the worktree ...`）。手動の `git worktree add` で作った worktree の中で `claude` を起動した場合は隔離が掛からず、メインリポ側のパスを指定すると編集はメインリポに入って bash の pwd と乖離し、「編集したはずなのに反映されない」事故が起きる（PR #241 で実例。起動形態ごとの挙動は #550） |
| `.claude/worktrees/<name>/` 配下なのに **登録 worktree でない** | **亡霊 worktree モード**: 以降の Edit / Write / bash の相対パスをメインリポ絶対パス基準に切り替える |
| 上のどれでもない（リポジトリの外で `git rev-parse` が失敗する、またはリポジトリのサブディレクトリ） | **settings.json 未読み込み**: プロジェクトの `.claude/settings.json` は起動ディレクトリのものしか読まれないので、hooks（ブランチ名・コミット件名の検証、SessionStart）と permissions の deny が黙って無効になっている。CLAUDE.md と rules はリポジトリ内のファイルに触れた時点で読み込まれるので、挙動からは気付きにくい。`.claude/rules/git-conventions.md` の規約と deny にある操作（force push・`git reset --hard` 等）の回避は手で守り、ユーザーに起動ディレクトリ（クラウドセッションなら環境の作業ディレクトリ）をリポジトリ直下に直すよう伝える |

### 亡霊 worktree モード

`.claude/worktrees/<name>/` ディレクトリだけが残り `git worktree` には未登録の状態。`.gitignore` 配下なので、そこに書いた Edit / Write は `git status` に出ず **無音で消える**。bash の相対パスも亡霊側で解決される。

- `Edit` / `Write` の `file_path` はメインリポの絶対パスで指定する（`worktrees/<name>/` をパスに含めない）
  - 例: `D:\ドキュメント_D\for_claude\ff14-dev\RotationCalc\src\client\...`
- `Bash` では相対パスを避け、絶対パスを使う
  - 例: `gh ... --body-file "D:/ドキュメント_D/for_claude/ff14-dev/RotationCalc/.claude/tmp-foo.md"`
- git 操作は `git -C "<メインリポ絶対パス>" <subcommand>` で行う（pwd に依存した暗黙の解決を避ける）

## 0.5 テンプレート更新チェック（セッションで一度だけ）

更新の検知と更新用 Issue の起票の手順はこの節が正本（`.claude/rules/workflow-feedback.md`「テンプレート更新の取り込み」は判定だけ）。取り込み自体は `.claude/skills/template-update/SKILL.md`。

SessionStart hook 出力の `## Template version` を確認する。

| バナーの状態 | 動作 |
|---|---|
| `up to date` | 何もしない（言及も不要） |
| `Latest: unknown` | オフライン等で取得失敗。スキップする |
| `⚠ Template update available` | **このセッションで一度だけ**、下記フォーマットで確認する |
| `up to date on the default branch` | 既定ブランチでは取り込み済みで、作業ブランチが遅れているだけ。起票しない。`git merge origin/main`（Phase 2「古い main 派生の検知」）で追従する |
| セクション自体が無い | `.claude/template-version` が無いか hook が動いていない。スキップする |

```
テンプレート元（<owner/repo>）に新しい版があります: <ローカル版> → <最新版>
Release notes: https://github.com/<owner/repo>/releases/tag/<最新版>

このプロジェクトに更新用 Issue を起票しますか？（今の Issue の作業はそのまま続けます）
 [Y] 起票する
 [N] 今回はスキップ（このセッション中は再度聞きません）
```

- 作業中の Issue のブランチでテンプレートを直接更新しない（1 Issue = 1 PR）。[Y] でも動作は「更新用 Issue の起票」までで、その後は手順 1 に進む
- バナーの `Latest` は、hook がセッション開始時にテンプレート元から取得した版。取得に失敗したときだけ前回取得した版（キャッシュ）を使い、`(cached Nh ago; fetch failed, ...)` と付く。この表示があるときは最新リリースを反映していないことがあるので、版を前提に判断・回答する前に `git ls-remote --tags --refs --sort=-v:refname https://github.com/<owner/repo>.git 'v*' | head -n 1` で直接確認し、新しい方の版を正とする
- バナーは hook が実行されたチェックアウトの状態で出る。`## Repository status` の `Checkout:` がこのセッションの作業ディレクトリ（`git rev-parse --show-toplevel`）と違えば、古いメインチェックアウトの hook と版で判定されている可能性がある。起票する前に、作業ツリーの `.claude/template-version` と既定ブランチの版（`MSYS_NO_PATHCONV=1 git show origin/main:.claude/template-version`。`MSYS_NO_PATHCONV=1` は Git Bash のパス変換を止めるためで他環境では無害）を見て、どちらかが最新版なら取り込み済みなので起票しない
- [Y] の場合: `search_issues`（`owner` / `repo` にこのプロジェクト）で同じ版の更新 Issue（`テンプレートを <最新版> に更新`）が無いか確認し、無ければ `issue_write`（method: `create`）で起票する。タイトル `refactor: テンプレートを <最新版> に更新`、ラベル `refactor`。本文は現在の版 → 最新版、Release notes URL、差分 URL（`https://github.com/<owner/repo>/compare/<ローカル版>...<最新版>`）、`template/` 配下の変更ファイル一覧（compare URL の Files changed、またはテンプレート元のクローンで `git diff --name-only <ローカル版> <最新版> -- template/`。Release notes は Issue 単位で `template/` 外の変更と混ざるので、手で起こさず機械的に得た一覧を貼る。取り込み時の DoD「変更ファイルをすべて確認した」の照合元になる）、完了条件（`.claude/skills/template-update/SKILL.md`「取り込み手順」のチェックリスト）。本文でテンプレート元の Issue や PR に触れるとき（Release notes から主な中身を書き起こすときなど）は `<owner/repo>#N` の形で書く。Release notes の `#N` をそのまま写すと、このプロジェクトの同じ番号の Issue へのリンクになる
- **スケジュール実行の無人セッション**（`weekday-issue-start` 等）では質問も起票もせず、実行報告に「テンプレート更新あり（<ローカル版> → <最新版>）」と記載するだけに留める
- 起票した更新 Issue はあとで通常どおり `/issue-start` する。その Phase 5 の手順は `.claude/skills/template-update/SKILL.md`（`/template-update`）
- いま `/issue-start` している Issue 自体が更新用 Issue なら、このチェックは不要

## 手順

1. GitHub MCP の `issue_read`（method: `get`）で本文・ラベルを取得し、`issue_read`（method: `get_comments`）でコメントも取得する。`get` の結果には sub-issue の親子関係（`parent` / `sub_issues_summary`）と、この Issue をクローズする設定の PR（`closed_by_pull_requests`）も含まれる
2. **関連 PR の確認**: `closed_by_pull_requests` にマージ済み PR があるか、無ければ `search_pull_requests`（query に Issue 番号、`owner` / `repo` を指定）で関連 PR の状態を確認する
   - マージ済み PR があれば、ユーザーに通知して追加作業の要否を確認する。不要なら処理を終了する
   - Issue が `OPEN` でも PR がマージ済みのことがあるので、Issue の state だけで判断しない
   - **オープンな旧 PR（過去の試行の残り）があれば**、その PR とブランチを **再利用するか作り直すか** をユーザーに確認する。手順は後述「オープンな旧 PR／既存ブランチがある場合」
   - **PR が無くても、コメントに「## 着手」の印があれば**、別のセッションがクラウドの割り当てブランチ（`claude/*` 等）で作業中かもしれない（`phases/02-branch-setup.md`「クラウドセッションの場合」）。印のセッション URL がこのセッション自身のものなら無視する。「## 着手（取り下げ）」に書き換わった印も、そのブランチはもう別の Issue に移っているので無視する。それ以外は、`git ls-remote --heads origin <ブランチ名>` の結果とセッション URL を添えて、続けて着手してよいかユーザーに確認する（ブランチが無くても、まだ push 前の作業中のことがあるので必ず確認する）
   - **PR が無くても、リモートに `*/#<番号>-*` のブランチがあれば**（`git ls-remote --heads origin '*/#<番号>-*'`。今いるブランチ（`git branch --show-current`）と同じ名前のものは、このセッションが切ったブランチなので除く）、日次の `weekday-issue-start` が実装中（毎日 19:30 の実行から PR を作るまで。同ルーティンは Phase 1 を終えた後、Phase 2 のブランチ作成で Issue ブランチを push する。`.claude/routines/weekday-issue-start.md`「4. 実装」の表「Phase 2 のブランチ作成」）か、途中で落ちた実行・過去の試行の残り。ブランチ名を添えて、続けて着手してよいかユーザーに確認する（ルーティンの実行中なら、続けると同じ Issue に PR が 2 本できることも添える）。続けるなら、そのブランチは再利用せず、後述「オープンな旧 PR／既存ブランチがある場合」の作り直しと同じく別名（`-v2` 等）で切る。ルーティンの実行中かどうかはこちらから見分けられず、再利用すると同じブランチに 2 つのセッションが push することがあるため
3. 本文中のリンクや関連ラベルから、関連する過去の Issue を参照する。親 Issue がある場合（`parent`）はその本文も読む
   - **この Issue を参照している Issue・PR（申し送り）**: 本文のリンクと Phase 1.5 の意味検索だけでは、別の Issue が「この Issue を実装するときは〜も必要」と申し送っていても拾えないことがある。timeline の `cross-referenced` イベントで、この Issue に触れた Issue・PR を一覧する:

     ```bash
     gh api "repos/{owner}/{repo}/issues/<番号>/timeline?per_page=100" --jq '.[] | select(.event == "cross-referenced") | [.source.issue.html_url, .source.issue.state, .source.issue.title] | @tsv'
     ```

     番号ではなく `html_url` を出すのは、別のリポジトリからの参照も混ざり、番号だけではどのリポジトリの Issue か PR かが分からないため。`--jq` で絞った出力からは元のイベントの件数が分からないので、件数は同じ URL を `--jq 'length'` で取って見る（100 件ちょうどなら次のページがある）。100 件を超える Issue では、`.claude/skills/issue-start/pitfalls.md`「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」のループで回す。参照元（別のリポジトリのものも）の本文やコメントにある申し送り（「〜で扱う」「実装するときは〜」）を読む。要件を足すことになる申し送りは、この Issue に含めるか別 Issue にするかを、Phase 1.5 の「補完結果の確認」で一緒に聞く。別のリポジトリの Issue を本文に書くときは `owner/repo#N` の形にする（`#N` だけだとこのリポジトリの番号として読まれる）
   - **兄弟 Issue との重なり（親 Issue がある場合）**: 同じ親の sub-issue を、まず番号・タイトル・状態だけで一覧する（`gh api "repos/{owner}/{repo}/issues/<親番号>/sub_issues?per_page=100" --jq '.[] | [.number, .title, .state] | @tsv'`。sub-issue は親 1 件あたり 100 件までなので 1 回で全件取れる。`--paginate` はクラウドセッションで 2 ページ目に止まるので使わない。`.claude/skills/issue-start/pitfalls.md`「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」）。`issue_read`（method: `get_sub_issues`）は sub-issue ごとに本文とメタデータを全部返すので、sub-issue の多い親ではツール出力の上限を超える。`gh` が無くて `get_sub_issues` を使うなら、出力が退避されたファイルを丸読みせず、番号・タイトル・状態だけを抜き出す。そのうえで、同じ型・関数・共通データ・共通ロジックに触れそうな兄弟 Issue だけを `issue_read`（method: `get`）で個別に読み、本文を照合する。重なる兄弟があれば `search_pull_requests`（query に兄弟 Issue の番号）と `git ls-remote --heads origin '*/#<兄弟の番号>-*'`、兄弟 Issue のコメントの「## 着手」の印（クラウドの割り当てブランチはブランチ名に番号が入らない。「## 着手（取り下げ）」と、セッション URL がこのセッション自身の印は除く。後者は前の Issue を中断して移ってきた残りで、`phases/02-branch-setup.md`「クラウドセッションの場合」手順 4 で取り下げる）で、その兄弟に作業ブランチやオープン PR が既にあるかを見る。重なりがあるときは、共通部分をどの Issue で実装し、他方はそのマージ後に取り込むのかを **着手前に** ユーザーへ確認する。並行セッションが同じ仕組みを二重に実装してコンフリクトするのを防ぐためで、Issue 本文に重なりが書かれていなくても確認する
   - 外部リポジトリの **特定タグのファイル** が参照元に指定されている場合は、`get_file_contents`（`owner` / `repo` / `path` に加えて `ref` にタグを指定）で版固定で読む。`gh` なら `gh api "repos/<owner/repo>/contents/<path>?ref=<tag>" -H "Accept: application/vnd.github.raw"`（`?` を含むのでクォートする）
   - 2 つの版の間の差分や特定ファイルの patch が要るときは、compare API の JSON を jq で漉すより、`git clone --no-checkout` したクローンで `git diff --name-only vOLD vNEW` / `git show vNEW:<path>` を使う（`.claude/skills/template-update/SKILL.md`「3-way マージの定型手順」と同じ形）。`gh api --jq` で正規表現を書くときの注意は `.claude/skills/issue-start/pitfalls.md`「`gh --jq` の正規表現にバックスラッシュが通らない」
4. **【MCP: Brave Search】** IssueがFF14のスキルデータやゲーム仕様に関わる場合、`brave_web_search` で公式ジョブガイドや関連情報を検索し、実装に必要な数値・仕様を収集する。検索例・利用前の準備・未接続時のフォールバック・外部情報のクロスチェック・ジョブガイド数値の生 HTML 抽出・特性習得前の値（Lv100 未満で使う値）の出典と、パッチ追従の検証（定型）は `phases/01-external-data.md` に従う
5. 以下のチェックリストで記載内容を検証する

### オープンな旧 PR／既存ブランチがある場合

同じ Issue に対して、過去の試行で作られたブランチやオープンな PR が残っていることがある。黙って同名ブランチを作ると衝突し、旧 PR への force-push は拒否されることもある（ブランチ保護・他人のブランチ）。**既定は作り直し**で、以下をユーザーに確認してから進める：

```
Issue #N には過去の PR #M（ブランチ `<type>/#N-xxx`、オープン）が残っています。
 [R] 旧ブランチを再利用する（チェックアウトして main を取り込み、PR #M を更新）
 [N] 作り直す（最新 main から `<type>/#N-xxx-v2` を切って新 PR、PR #M は置き換え先リンク付きでクローズ）
```

- **作り直す（既定）**: 最新 `main` から別名ブランチ（元の名前に `-v2`, `-v3` … を付ける）を切って Phase 2 以降を進める。Phase 7 で新 PR を作ったあと、旧 PR に「#<新 PR> で置き換え」とコメントしてクローズする（`update_pull_request`（`state: closed`）と `add_issue_comment`）。旧ブランチの削除はユーザーに任せる
- **再利用する**: 旧ブランチをチェックアウトし `git merge origin/main` で最新化してから（止まったときは `phases/02-branch-setup.md`「遅れていた場合」）Phase 3 以降を進める。旧 PR はそのまま更新される
- **force-push での上書きは既定にしない**。旧ブランチの履歴を捨ててよいとユーザーが明示した場合だけ行う
- **クラウドセッション（`phases/02-branch-setup.md`「クラウドセッションの場合」に当たるとき）で、旧 PR のブランチが割り当てられたブランチ以外の場合**（命名は問わない）: セッションの指示で割り当てられたブランチ以外への push が止められていることが多いので（git のプロキシ自体は通す。`.claude/skills/issue-start/pitfalls.md`「クラウドセッションの git プロキシは、別ブランチへの push を通し、ブランチの削除を通さない」）、[R] は提示せず、作り直す旨を伝えて、割り当てられたブランチで進める（`-v2` は付けない）。旧 PR のクローズは同じ

## チェックリスト

| 項目 | 確認内容 |
|------|---------|
| 背景・目的 | なぜこの作業が必要か明記されているか |
| 要件 | やること／やらないことが明確か |
| 完了条件 | 検証可能な形（テスト・動作確認・目視）で定義されているか。数値目標には現状値が添えてあり、スコープ内で届くか。空、または「やること」のコピーなら、下の「不足時の対応」で聞かず、Phase 1.5「完了条件の生成」で作って確認する。何をもって完了とするか自体が要望から読めないときだけ「不足時の対応」で聞く |
| 技術的な情報 | 実装に必要な設計・定義が十分か（不足していても、コードを読めば分かることは Phase 3 で埋める） |
| 未確定事項 | 「## 未確定事項」の `[要確認]` の項目は、ユーザーが決めることなので、下の「不足時の対応」で質問する。「`/issue-start` の探索で調べる」と書かれた項目（`/issue-plan` が回した調査）は質問せず、Phase 3 で調べる対象として引き継ぐ。Phase 3 を省く Issue では、Phase 1 の中で不足確認の質問より前に調べ、分かった分岐は同じ質問に入れる |
| 粒度・依存 | `.claude/rules/git-conventions.md`「粒度」に収まっているか（1 セッションで完走できる量・目的が 1 つ・DoD が単独で検証可能）。「## 関連Issue」の `依存: #N` が未完了なら着手してよいかユーザーに確認する |

**粒度が大きすぎる場合**（目的が複数ある／完了条件が 7 個超／複数ラベルにまたがる等）は、実装に着手せず **`/issue-plan #<番号>` での分割を提案して停止する**。分割後は最初の子 Issue で `/issue-start` をやり直す。ユーザーが「このまま進める」と判断した場合はそれに従う。

## 本文と後追いコメントでスコープが乖離している場合

| コメントの性質 | 扱い |
|--------------|------|
| **本文の補足／不足分の補完**（仕様確認・抜けていた条件・参照データ等） | 本文スコープに **統合して** 進める |
| **本文と直交する別問題の報告**（別バグ／類似機能の別問題／追加要望） | **別 Issue 化を提案** し、本文スコープのみで進める |
| **本文の前提を覆す変更**（仕様変更・要件再定義） | 「本文側を更新して進めるか／別 Issue に切るか」をユーザーに確認する |

迷ったらユーザーに確認する。無理に統合して PR が肥大すると 1 Issue = 1 PR が崩れる。

## 不足時の対応

チェックリストに不足があれば、**実装に着手せず** 聞き返す。質問は 1 回にまとめ、何が不足しているかを具体的に示し、可能なら選択肢を添える（`AskUserQuestion` が使えるなら選択式で）。回答を得てから次の Phase に進む。

```
Issue #3 の内容を確認しました。以下の点を決めてください：

1. **完了条件の基準が決められません**（完了条件が空なだけなら、ここで聞かず Phase 1.5 で作る。これは基準の値をユーザーが決める例）
   - 例: 「計算結果が ±0.1% 以内の誤差であること」のような基準はありますか？

2. **バフの重複適用ルールが不明です**
   - 同種バフは (a) 上書き / (b) 加算 / (c) 乗算 のどれにしますか？
```

### `needs-decision` の Issue で決定を得たとき

ラベル `needs-decision` は、日次の `weekday-issue-start` が要件の分岐を決められずに付けたもの（決められなかった点は Issue のコメントにある）。付いている間はルーティンの選定から外れ続けるので、このセッションで質問して決定を得たら、このセッションで次を行う:

1. 決定と根拠を Issue にコメントする（`add_issue_comment`。どの問いに何を決めたか、その理由）
2. `needs-decision` を外す。GitHub MCP の `issue_write`（method: `update`）の `labels` はラベル全体を置き換えるので、送る直前に取り直したラベルから `needs-decision` だけを除いた配列を渡す。`gh` なら `gh api -X DELETE repos/{owner}/{repo}/issues/<番号>/labels/needs-decision`
3. 本文の `## 未確定事項` に `[要確認]` の行が残っていれば、`[要確認]` を外して決定を書き、手順 1 のコメントへのリンクを添える書き換え案を、Phase 1.5「補完結果の確認」に含めて聞く（本文の更新はユーザーの確認を得てから）。行が残ると、ラベルを外してもルーティンは決定待ちとして選ばない

## Phase 1.5: Issue の補完（関連 Issue & 完了条件）

ユーザーが毎回手書きする負担を減らすため、「関連 Issue」と「完了条件」を補完する。**Issue 本文の更新はユーザーの確認を得てから行う**。

### 関連 Issue の紐づけ

1. `search_issues`（`owner` / `repo` を指定）に Issue のタイトルと要件の要点を自然文で渡し、関連しそうな Issue を上位 10 件程度取得する（全件取得して照合はしない）
2. 同じ機能領域・依存関係（前提機能、後続の拡張）・同じコンポーネントを変更するものを関連と判定する
3. 見つかったら、`issue_write`（method: `update`）で本文の「## 関連Issue」を更新する案を作る

### 完了条件の生成

「完了条件」が空、または「やること」のコピーになっている場合：

1. 「やること」の各項目から、実装・動作確認の観点で **検証可能な** 条件を作る（「〜を追加する」ではなく「〜したとき〜になる」「`npm test` が通る」）。数値目標を置くなら、現状値を測って添え、スコープ内で届くかを確かめる
2. 本文の「## 完了条件（DoD）」を更新する案を作る

### Issue 本文と現状コードの乖離チェック

本文に「○○の追加が必要」「△△機構を新規実装する」のような **技術前提** が書かれている場合、着手前に実在を確認する。本文が古いまま放置されていると、想定スコープと現状実装が乖離していることがある（過去事例: #186）。

1. 本文の技術前提キーワード（型名・関数名・データキー・設定値等）を 2〜3 個抽出する
2. `Grep -n "<keyword>"`（`type` / `glob` で対象を絞る）で実在を確認する
3. **既に存在する** 場合: スコープが「データ追加のみ」等に縮小し得るので、「Issue スコープを再確認したい」とユーザーに提示する
4. **未実装が確認できた** 場合: そのまま次の「補完結果の確認」に進む（補完案もスコープ外の問題も無ければ Phase 2）

「やること」がデータ追加のみで技術前提を含まない場合は省略してよい。

### 補完結果の確認

Phase 1 でスコープ外の問題を見つけていれば、この確認と一緒に起票も聞く。ただし、本文に子の番号を書くなら起票を先に聞く（聞き方と、本文の更新との順序は `SKILL.md`「スコープ外問題の起票提案」の検出タイミング表）。

「不足時の対応」で `needs-decision` の Issue の決定を得ていれば、本文の `[要確認]` 行の書き換え案もこの確認に含める。

```
Issue #10 の補完案です：

**関連Issue:**
- #11 リキャスト概念の追加（同じタイムライン機能に関連）
- #24 バフ・デバフの実装（ダメージ計算の前提機能）

**完了条件（生成）:**
- [ ] 設定画面で保存すると再読込後も値が保持される
- [ ] 既存のテストと `npm test` が通る

この内容で Issue を更新してよいですか？ [Y/E/N]
```

## リポジトリへの変更が出ない Issue（調査・GitHub 上の操作だけ）

リポジトリのファイルを変えずに終わる Issue（目的が調査そのものの Issue と、Issue 本文の書き換えやマージ済みブランチの削除のような GitHub 上の操作だけで終わる Issue）は、`phases/01-no-repo-change.md` に従う。この節の本文はテンプレート元では本ファイルにあるので、`/template-update` でこの節にテンプレート側の変更が来たら、移動先のファイルに当てる
