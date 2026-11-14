# Phase 1: Issue分析 & 不足確認

## 0. 作業環境チェック

SessionStart hook の出力（`## Repository status` 以下）を確認する。`## ⚠ Ghost worktree detected` が含まれていたら、後述の亡霊 worktree モードで作業する。出力がコンテキストに無ければ、hooks が動いていない兆しなので、下の判定の結果に関わらず表の 4 行目と同じく規約と deny の回避を手で守り、バナーが出ていないことをユーザーに伝える（起動ディレクトリがリポジトリ直下でも hooks を読まない起動形態がある。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションにリポジトリを複数付けて開始すると、settings.json が読まれない」の「関連」）。出力があっても Ghost が無ければ、以下で判定する。コマンドは起動ディレクトリで打つ。リポジトリに `cd` してから打たない（`pwd -P` がリポジトリと一致して 4 行目をすり抜ける）。このセッションで既に `cd` していれば、システムプロンプトの環境情報にある作業ディレクトリ（Primary working directory）に `cd` で戻ってから打つ：

```bash
pwd -P   # シンボリックリンクを解いた実パス。git が返すパスは実パスなので、pwd のままだとリンク経由で開いたときに一致しない
git rev-parse --show-toplevel
git rev-parse --git-dir --git-common-dir   # pwd -P が --show-toplevel と一致するときだけ見る（サブディレクトリでは片方が相対パスになり、同じでも違って出る）
git worktree list
```

| `pwd -P` の状態 | 扱い |
|---|---|
| `git rev-parse --show-toplevel` と一致し、`--git-dir` と `--git-common-dir` が同じ | **メインリポ作業**: 通常どおり |
| `git rev-parse --show-toplevel` と一致し、`--git-dir` と `--git-common-dir` が違う（linked worktree。`git worktree list` にも出る） | **worktree 作業**: Edit / Write の `file_path` は、起動形態に関わらずこの worktree のパスを使う（隔離が掛かるかは試さなくてよい）。`claude --worktree`・`EnterWorktree`・Claude Desktop の worktree セッション（サブエージェントの `isolation: worktree` も）では、組み込みの worktree 隔離がメインリポ側のパスへの Edit / Write を拒否する（`This session is isolated in the worktree ...`）が、手動の `git worktree add` で作った worktree の中で `claude` を起動すると隔離が掛からず、メインリポ側のパスへの編集はメインリポに入って bash の pwd と乖離する（PR #241 で実例。起動形態ごとの挙動は #550） |
| `.claude/worktrees/<name>/` 配下なのに登録 worktree でない | **亡霊 worktree モード**: 以降の Edit / Write / bash の相対パスをメインリポ絶対パス基準に切り替える |
| 上のどれでもない（リポジトリの外で `git rev-parse` が失敗する、またはリポジトリのサブディレクトリ） | **settings.json 未読み込み**: プロジェクトの `.claude/settings.json` は起動ディレクトリのものしか読まれないので、hooks（`CLAUDE.md`「自動ガードレール」の検証と SessionStart）と permissions の deny が黙って無効になっている（CLAUDE.md と rules はリポジトリ内のファイルに触れると読まれるので、気付きにくい）。`.claude/rules/git-conventions.md` の規約と deny にある操作（force push・`git reset --hard` 等）の回避は手で守り、ユーザーに起動ディレクトリをリポジトリ直下に直すよう伝える。クラウドセッション（`CLAUDE_CODE_REMOTE=true`）で `pwd -P` がリポジトリの親なら、リポジトリを複数付けて開始したのが原因で、作業ディレクトリは設定では直せない。同じく手で守り、次からの開始の仕方として `.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションにリポジトリを複数付けて開始すると、settings.json が読まれない」の「回避」を伝える |

### 亡霊 worktree モード

`.claude/worktrees/<name>/` ディレクトリだけが残り `git worktree` には未登録の状態。`.gitignore` 配下なので、そこに書いた Edit / Write は `git status` に出ず無音で消える。bash の相対パスも亡霊側で解決される。

- `Edit` / `Write` の `file_path` はメインリポの絶対パスで指定する（`worktrees/<name>/` をパスに含めない）
  - 例: `D:\ドキュメント_D\for_claude\ff14-dev\RotationCalc\src\client\...`
- `Bash` では相対パスを避け、絶対パスを使う
  - 例: `gh ... --body-file "D:/ドキュメント_D/for_claude/ff14-dev/RotationCalc/.claude/tmp-foo.md"`
- git 操作は `git -C "<メインリポ絶対パス>" <subcommand>` で行う（pwd に依存した暗黙の解決を避ける）

## 0.5 テンプレート更新チェック（セッションで一度だけ）

SessionStart hook 出力の `## Template version` を確認する。`Latest` に `(cached …)` が付くか、`## Repository status` の `Checkout:` がこのセッションの作業ディレクトリと違うときは、表で判断する前に `phases/01-template-update-check.md`「バナーを信じる前の確認」を行う。

| バナーの状態 | 動作 |
|---|---|
| `up to date` | 何もしない（言及も不要） |
| `Latest: unknown` | オフライン等で取得失敗。スキップする |
| `⚠ Template update available` | **このセッションで一度だけ**（同じセッションで `/template-update` から聞いて断られていれば聞かない）、`phases/01-template-update-check.md`「更新があるときの確認と起票」の手順で確認する |
| `up to date on the default branch` | 既定ブランチでは取り込み済みで、作業ブランチが遅れているだけ。起票しない。`git merge origin/main`（Phase 2「古い main 派生の検知」）で追従する |
| セクション自体が無い | `.claude/template-version` が無いか hook が動いていない。スキップする |

- **スケジュール実行の無人セッション**（`weekday-issue-start` 等）では質問も起票もせず、実行報告に「テンプレート更新あり（<ローカル版> → <最新版>）」と記載するだけに留める
- いま `/issue-start` している Issue 自体が更新用 Issue なら、このチェックは不要

## 手順

1. GitHub MCP の `issue_read`（method: `get`）で本文・ラベルを取得し、`issue_read`（method: `get_comments`）でコメントも取得する。`get` の結果には sub-issue の親子関係（`parent` / `sub_issues_summary`）と、この Issue をクローズする設定の PR（`closed_by_pull_requests`）も含まれる
   - **モデルの確認**: ラベルに `model:*` があるか、リポジトリにラベル `model:opus` があれば（GitHub MCP の `get_label`。無ければ not found）、先へ進む前に `.claude/skills/issue-priority/model-assignment.md`「着手時の確認」を行う（別モデルのセッションに引き継いだら、ここで終える）
2. **関連 PR の確認**: `closed_by_pull_requests` にマージ済み PR があるか、無ければ `search_pull_requests`（query は `"#<番号>" in:title`、`owner` / `repo` を指定、`perPage: 100`）で関連 PR の状態を確認する。この Issue の PR と数えるのは、`closed_by_pull_requests` の PR と、タイトル末尾の ` #N` の並びに `#<番号>` がある PR（`.claude/rules/git-conventions.md`「PR のタイトルと本文」。`refs` の PR もここで拾う）だけで、本文で触れただけの PR（スコープ外の起票の報告など）は数えない。検索は `#` を無視するので、タイトル中の同じ数字（版番号の一部など）にも当たる
   - マージ済み PR があれば、ユーザーに通知して追加作業の要否を確認する。不要なら処理を終了する
   - Issue が `OPEN` でも PR がマージ済みのことがあるので、Issue の state だけで判断しない
   - **オープンな旧 PR（過去の試行の残り）があれば**、その PR とブランチを再利用するか作り直すかをユーザーに確認する。手順は `phases/01-existing-pr-branch.md`「オープンな旧 PR／既存ブランチがある場合」
   - **PR が無くても、コメントに「## 着手」の印があれば**、別のセッションが作業中かもしれない（`phases/02-branch-setup.md`「ブランチ作成」）。印のセッション URL がこのセッション自身のもの、または印のブランチがこのチェックアウトにある（今いるブランチか、`git branch` に `+` 無しで出る。`+` は別の worktree で使用中で、並行セッションかもしれない）自分の印と、「## 着手（取り下げ）」に書き換わった印は無視する。それ以外は、`git ls-remote --heads origin <ブランチ名>` の結果とセッション URL を添えて、続けて着手してよいかユーザーに確認する（ブランチが無くても、まだ push 前の作業中のことがあるので必ず確認する）
   - **PR が無くても、リモートに `*/<番号>-*` のブランチがあれば**（`git ls-remote --heads origin '*/<番号>-*'`。今いるブランチ（`git branch --show-current`）と同じ名前のものは、このセッションが切ったブランチなので除く）、続けて着手してよいかユーザーに確認する。確認に添えることと、続けるときのブランチの切り方は `phases/01-routine-traces.md`「リモートに Issue ブランチがあるとき」に従う
3. 本文中のリンクや関連ラベルから、関連する過去の Issue を参照する。親 Issue がある場合（`parent`。無ければ本文末尾の `親Issue: #N`）はその本文も読む
   - **この Issue を参照している Issue・PR（申し送り）**: 本文のリンクと Phase 1.5 の意味検索では拾えないことがあるので、timeline の `cross-referenced` イベントで、この Issue に触れた Issue・PR を一覧する:

     ```bash
     gh api "repos/{owner}/{repo}/issues/<番号>/timeline?per_page=100" --jq '.[] | select(.event == "cross-referenced") | [.source.issue.html_url, .source.issue.state, .source.issue.title] | @tsv'
     ```

     別のリポジトリからの参照も混ざるので、番号ではなく `html_url` を出す。件数は絞った出力からは分からないので同じ URL を `--jq 'length'` で取って見て、100 件ちょうどなら次のページがあるので `.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」のループで回す。参照元（別のリポジトリのものも）の本文やコメントにある申し送り（「〜で扱う」「実装するときは〜」）を読む。要件を足すことになる申し送りは、この Issue に含めるか別 Issue にするかを、Phase 1.5 の「補完結果の確認」で一緒に聞く。別のリポジトリの Issue を本文に書くときは `owner/repo#N` の形にする（`#N` だけだとこのリポジトリの番号として読まれる）
   - **作業中の別の Issue との重なり**: 親 Issue があるか、「## 関連Issue」に Open Issue があるか、本文に触るファイルのパス（「補足」の該当箇所など）があれば、`phases/01-overlap-check.md` を読み、同じ箇所を触る Issue（兄弟・親・同じファイルを触る Issue）が作業中でないかを見て、重なりがあれば、共通部分をどの Issue で実装し、他方はそのマージ後に取り込むのかを着手前にユーザーへ確認する（本文に重なりが書かれていなくても）
   - 外部リポジトリの特定タグのファイルが参照元に指定されている場合は、`get_file_contents`（`owner` / `repo` / `path` に加えて `ref` にタグを指定）で版固定で読む。`gh` なら `gh api "repos/<owner/repo>/contents/<path>?ref=<tag>" -H "Accept: application/vnd.github.raw"`。クラウドセッションでセッションに付いていないリポジトリは、どちらも拒まれる（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは、セッションに付いていないリポジトリの Release やファイルを API で読めない」）
   - 2 つの版の間の差分や特定ファイルの patch が要るときは、compare API の JSON を jq で漉すより、`git clone --no-checkout` したクローンで `git diff --name-only vOLD vNEW` / `git show vNEW:<path>` を使う（`.claude/skills/template-update/SKILL.md`「3-way マージの定型手順」と同じ形）。`gh api --jq` で正規表現を書くときの注意は `.claude/skills/issue-start/pitfalls.md`「`gh --jq` の正規表現にバックスラッシュが通らない」
4. **【MCP: Brave Search】** IssueがFF14のスキルデータやゲーム仕様に関わる場合、`brave_web_search` で公式ジョブガイドや関連情報を検索し、実装に必要な数値・仕様を収集する。検索例・利用前の準備・未接続時のフォールバック・外部情報のクロスチェック・ジョブガイド数値の生 HTML 抽出・特性習得前の値（Lv100 未満で使う値）の出典と、パッチ追従の検証（定型）は `phases/01-external-data.md` に従う
5. 以下のチェックリストで記載内容を検証する

## チェックリスト

| 項目 | 確認内容 |
|------|---------|
| 背景・目的 | なぜこの作業が必要か明記されているか。起票した後に入った変更が、目的の前提（何が分からない・何ができないから要るのか）を満たしていないか。見るのは、起票後に入った変更（`git fetch origin main` のあとで `git log origin/main --since=<Issue の created_at> --format='%h %ad %s' --date=short`。`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションの clone は shallow のことがあり、履歴を遡る git がエラー無しで途中で止まる」）、手順 3 で読んだ関連 Issue・依存先・参照元のうち起票後に完了したもの、ユーザーが依頼で挙げた変更。前提の一部でも満たしていそうなら、下の「不足時の対応」の質問より先に、別の質問で、進める／クローズ／保留をユーザーに聞く（クローズなら、ほかの質問が要らなくなるため）。クローズなら、どの変更で前提が満たされたかをコメントしてから `not_planned` で閉じる（`completed` にしない。依存する Issue は、完了せずに閉じた依存先として確認に回る）。保留なら、その旨をコメントして作業を止める |
| 要件 | やること／やらないことが明確か |
| 完了条件 | 検証可能な形（テスト・動作確認・目視）で定義されているか。数値目標には現状値が添えてあり、スコープ内で届くか。空か「やること」のコピーなら、何をもって完了とするか自体が要望から読めないときを除き、下の「不足時の対応」で聞かず Phase 1.5「完了条件の生成」で作って確認する |
| 技術的な情報 | 実装に必要な設計・定義が十分か（不足していても、コードを読めば分かることは Phase 3 で埋める） |
| 未確定事項 | 「## 未確定事項」の `[要確認]` の項目は、下の「不足時の対応」で質問する。状態や条件で決まる仕様（「〜になったときの扱い」）を聞くときは、その状態に至る経路をコードで列挙し（Grep で状態を変える箇所を探す）、本文に挙がっていない経路も同じ質問に入れる。決めた仕様の完了条件への反映は Phase 1.5「完了条件の生成」。「`/issue-start` の探索で調べる」と書かれた項目（`/issue-plan` が回した調査）は質問せず、Phase 3 で調べる対象として引き継ぐ。Phase 3 を省く Issue と、`[要確認]` の選択肢がその調査の結果で決まる Issue（方式を決める調査だけの Issue も）では、Phase 1 の中で不足確認の質問より前に調べ、分かった分岐と選択肢ごとの変更量の見積もりを同じ質問に入れる |
| 粒度・依存 | `.claude/rules/git-conventions.md`「粒度」に収まっているか。「## 関連Issue」の `依存: #N` と GitHub の依存関係（blocked by）の両方を見て（`.claude/skills/issue-start/dependencies.md`「読み方」）、未完了の依存があれば着手してよいかを、両者が食い違っていれば揃えるかをユーザーに確認する |

**粒度が大きすぎる場合**（目的が複数ある／設計承認 1 回で判断しきれない／一部だけ先にマージしたい・戻したくなる塊がある。判定は `.claude/skills/issue-plan/SKILL.md`「粒度の判定」）は、実装に着手せず `/issue-plan #<番号>` での分割を提案して停止する。完了条件の個数・ラベルの数・変更の大きさだけでは止めない。分割後は最初の子 Issue で `/issue-start` をやり直す。ユーザーが「このまま進める」と判断した場合はそれに従う。

## 本文と後追いコメントでスコープが乖離している場合

| コメントの性質 | 扱い |
|--------------|------|
| **本文の補足／不足分の補完**（仕様確認・抜けていた条件・参照データ等） | 本文スコープに統合して進める |
| **本文と直交する別問題の報告**（別バグ／類似機能の別問題／追加要望） | **別 Issue 化を提案** し、本文スコープのみで進める |
| **本文の前提を覆す変更**（仕様変更・要件再定義） | 「本文側を更新して進めるか／別 Issue に切るか」をユーザーに確認する |

迷ったらユーザーに確認する。

## 不足時の対応

チェックリストに不足があれば、実装に着手せず聞き返す。質問は 1 回にまとめ、何が不足しているかを具体的に示し、可能なら選択肢を添える（聞き方は `SKILL.md`「確認の聞き方」）。回答を得てから次の Phase に進む。

```
Issue #3 の内容を確認しました。以下の点を決めてください：

1. **完了条件の基準が決められません**（これは基準の値をユーザーが決める例）
   - 例: 「計算結果が ±0.1% 以内の誤差であること」のような基準はありますか？

2. **バフの重複適用ルールが不明です**
   - 同種バフは (a) 上書き / (b) 加算 / (c) 乗算 のどれにしますか？
```

### `needs-decision` の Issue で決定を得たとき

ラベル `needs-decision` の付いた Issue で、このセッションで質問して決定を得たら、`phases/01-routine-traces.md`「`needs-decision` の Issue で決定を得たとき」の手順で、決定を記録してラベルを外す

## Phase 1.5: Issue の補完（関連 Issue & 完了条件）

「関連 Issue」と「完了条件」を補完する。Issue 本文の更新はユーザーの確認を得てから行う。

### 関連 Issue の紐づけ

1. `search_issues`（`owner` / `repo` を指定）に Issue のタイトルと要件の要点を自然文で渡し、関連しそうな Issue を上位 10 件程度取得する（全件取得して照合はしない）。`search_issues` がツール一覧に無いか拒まれたら、`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」の重複検索で代える
2. 同じ機能領域・依存関係（前提機能、後続の拡張）・同じコンポーネントを変更するものを関連と判定する
3. 見つかったら、`issue_write`（method: `update`）で本文の「## 関連Issue」を更新する案を作る

### 完了条件の生成

次のどれかに当たる場合：

- 「完了条件」が空、または「やること」のコピーになっている
- Phase 1 の「不足時の対応」で未確定事項を決めたが、決めた仕様を確かめる条件が完了条件に無い（足すのは、その仕様の分だけ）
- Phase 1 で未確定事項を決めたら、既存の完了条件に、決めなかった選択肢を前提にした行（「〜のとき既定値になる」のような答えの先取り）や決定待ちの形の行（「〜の扱いが、未確定事項で決めたとおりになる」）が無いかも見る。あれば、決めた仕様の具体的な条件に合わせた書き換え案を同じ補完案に入れる

1. 「やること」の各項目（未確定事項を決めた分は、決めた仕様）から、実装・動作確認の観点で検証可能な条件を作る（「〜を追加する」ではなく「〜したとき〜になる」「`npm test` が通る」）。数値目標を置くなら、現状値を測って添え、スコープ内で届くかを確かめる。応答ヘッダーの有無を確かめる条件は、確かめる場所を `.claude/skills/issue-start/pitfalls-project.md`「Workers Builds の PR プレビュー URL は、全パスの応答に `X-Robots-Tag: noindex` が付く」に合わせて書く
2. 本文の「## 完了条件（DoD）」を更新する案を作る

### Issue 本文と現状コードの乖離チェック

本文に「○○の追加が必要」「△△機構を新規実装する」のような技術前提が書かれている場合、着手前に実在を確認する（過去事例: #186）。

1. 本文の技術前提キーワード（型名・関数名・データキー・設定値等）を 2〜3 個抽出する
2. `Grep -n "<keyword>"`（`type` / `glob` で対象を絞る）で実在を確認する
3. **既に存在する** 場合: スコープが「データ追加のみ」等に縮小し得るので、「Issue スコープを再確認したい」とユーザーに提示する
4. **未実装が確認できた** 場合: そのまま次の「補完結果の確認」に進む（補完案もスコープ外の問題も無ければ Phase 2）

「やること」がデータ追加のみで技術前提を含まない場合は省略してよい。

上の省略とは別に、本文が、手順書・スクリプトに載せるコマンドそのもの（プロセスの止め方・データの取り方など）を指定していたら、着手前に一度実行して、本文が言う結果になるかを確かめる。実行する前にコマンドを読んで何をするかを確かめ、削除や本番・外部への書き込みのような副作用のあるものは、手元の使い捨ての環境かスタブで回す（Phase 5「md に載せたコード・コマンドは、md から抜き出して実行する」）。本文が言う結果にならなければ、本文の前提を覆す変更として扱い（「本文と後追いコメントでスコープが乖離している場合」の表の 3 行目）、本文を直して進めるか別 Issue に切るかをユーザーに確認する

外部サービス（CI・配信基盤など）で起きている失敗を、そのサービスの設定・コマンドを変えて直す方針なら、方針を決める前に、既存の失敗がどの段階で起きているかを確かめる（ツールのオプションやソースを読むだけでは分からない）。見るのは、失敗するまでの時間（`gh api repos/{owner}/{repo}/commits/<sha>/check-runs --jq '.check_runs[] | [.name, .conclusion, .started_at, .completed_at] | @tsv'` の `started_at` から `completed_at` までを、成功した実行と比べる。成功が数分かかるのに数秒で落ちていれば、ビルドより前の段階）と、エラー文がどのツールの出力か（前置き・書式）。変える設定がその段階より前に効かなければ、別の方針を探す

### 補完結果の確認

Phase 1 で見つけたスコープ外の問題の起票も聞く（聞き方と、本文の更新との順序は `SKILL.md`「スコープ外問題の起票提案」の検出タイミング表）。補完が起票後に入った変更による不足なら、`phases/01-overlap-check.md` で一覧した兄弟 Issue の本文にも同じ不足が残っていないかを同じ文字列で探し、残っていれば書き換え案（新旧の差分）も同じ確認で聞く。

「不足時の対応」で `needs-decision` の Issue の決定を得ていれば、本文の `[要確認]` 行の書き換え案もこの確認に含める。

```
Issue #10 の補完案です：

**関連Issue:**
- #11 リキャスト概念の追加（同じタイムライン機能に関連）
- #24 バフ・デバフの実装（ダメージ計算の前提機能）

**完了条件（生成）:**
- [ ] 設定画面で保存すると再読込後も値が保持される
- [ ] 既存のテストと `npm test` が通る

Issue #10 の関連 Issue と完了条件を、上の案で更新してよいですか？ [Y/E/N]
```

## リポジトリへの変更が出ない Issue（調査・GitHub 上の操作だけ）

リポジトリのファイルを変えずに終わる Issue の分岐。次の 2 種類がある。Phase 2〜7 はコードの変更と PR を前提にしているので、変更が出ないのに空のブランチを切ったり、根拠無く Phase を飛ばしたりしない。

- **調査だけの Issue**: 目的が調査そのもの（裏取り・原因調査・要否の判断）で、結論しだいでは変更が出ない
- **GitHub 上の操作だけで終わる Issue**: Issue 本文の書き換え・ラベルの付け替え・マージ済みブランチの削除のような GitHub 上の操作そのものが成果物で、最初から PR を作らない

どちらかに当たるなら、Phase 2 に進む代わりに `phases/01-no-repo-change.md` の同じ名前の節を読み、その手順で進める。
