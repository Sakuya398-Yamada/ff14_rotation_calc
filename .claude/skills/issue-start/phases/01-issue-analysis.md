# Phase 1: Issue分析 & 不足確認

Issue の内容を把握してから実装に入る。曖昧なまま進めると手戻りが大きいので、**ユーザーが決めるべきこと** はここで確認し、**調べれば分かること** は自分で調べて埋める。

## 0. 作業環境チェック

SessionStart hook の出力（`## Repository status` 以下）を確認する。`## ⚠ Ghost worktree detected` が含まれていたら、後述の **亡霊 worktree モード** で作業する。出力が無い場合は以下で判定できる：

```bash
pwd
git rev-parse --show-toplevel
git worktree list
```

| pwd の状態 | 扱い |
|---|---|
| `git rev-parse --show-toplevel` と一致 | **メインリポ作業**: 通常どおり |
| `git worktree list` に登録された worktree と一致 | **worktree 作業**（`claude --worktree` で起動した場合など）: Edit / Write の `file_path` はこの worktree のパスを使う。メインリポ側のパスを指定すると bash の pwd と乖離し「編集したはずなのに反映されない」無音失敗が起きる（PR #241 で実例）。PreToolUse hook `.claude/hooks/validate-edit-path.sh` が同条件を検知して警告（exit 1、ブロックなし）を出す。意図的にメインリポ側を触りたい場合は `CLAUDE_ALLOW_MAIN_REPO_EDIT=1` で抑制 |
| `.claude/worktrees/<name>/` 配下なのに **登録 worktree でない** | **亡霊 worktree モード**: 以降の Edit / Write / bash の相対パスをメインリポ絶対パス基準に切り替える |

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
- [Y] の場合: `search_issues`（`owner` / `repo` にこのプロジェクト）で同じ版の更新 Issue（`テンプレートを <最新版> に更新`）が無いか確認し、無ければ `issue_write`（method: `create`）で起票する。タイトル `refactor: テンプレートを <最新版> に更新`、ラベル `refactor`。本文は現在の版 → 最新版、Release notes URL、差分 URL（`https://github.com/<owner/repo>/compare/<ローカル版>...<最新版>`）、`template/` 配下の変更ファイル一覧（compare URL の Files changed、またはテンプレート元のクローンで `git diff --name-only <ローカル版> <最新版> -- template/`。Release notes は Issue 単位で `template/` 外の変更と混ざるので、手で起こさず機械的に得た一覧を貼る。取り込み時の DoD「変更ファイルをすべて確認した」の照合元になる）、完了条件（`.claude/skills/template-update/SKILL.md`「取り込み手順」のチェックリスト）
- **スケジュール実行の無人セッション**（`weekday-issue-start` 等）では質問も起票もせず、実行報告に「テンプレート更新あり（<ローカル版> → <最新版>）」と記載するだけに留める
- 起票した更新 Issue はあとで通常どおり `/issue-start` する。その Phase 5 の手順は `.claude/skills/template-update/SKILL.md`（`/template-update`）
- いま `/issue-start` している Issue 自体が更新用 Issue なら、このチェックは不要

## 手順

1. GitHub MCP の `issue_read`（method: `get`）で本文・ラベルを取得し、`issue_read`（method: `get_comments`）でコメントも取得する。`get` の結果には sub-issue の親子関係（`parent` / `sub_issues_summary`）と、この Issue をクローズする設定の PR（`closed_by_pull_requests`）も含まれる
2. **関連 PR の確認**: `closed_by_pull_requests` にマージ済み PR があるか、無ければ `search_pull_requests`（query に Issue 番号、`owner` / `repo` を指定）で関連 PR の状態を確認する
   - マージ済み PR があれば、ユーザーに通知して追加作業の要否を確認する。不要なら処理を終了する
   - Issue が `OPEN` でも PR がマージ済みのことがあるので、Issue の state だけで判断しない
   - **オープンな旧 PR（過去の試行の残り）があれば**、その PR とブランチを **再利用するか作り直すか** をユーザーに確認する。手順は後述「オープンな旧 PR／既存ブランチがある場合」
   - **PR が無くても、コメントに「## 着手」の印があれば**、別のセッションがクラウドの `claude/*` ブランチで作業中かもしれない（`phases/02-branch-setup.md`「クラウドセッションの場合」）。印のセッション URL がこのセッション自身のものなら無視する。それ以外は、`git ls-remote --heads origin <ブランチ名>` の結果とセッション URL を添えて、続けて着手してよいかユーザーに確認する（ブランチが無くても、まだ push 前の作業中のことがあるので必ず確認する）
3. 本文中のリンクや関連ラベルから、関連する過去の Issue を参照する。親 Issue がある場合（`parent`）はその本文も読む
   - **兄弟 Issue との重なり（親 Issue がある場合）**: `issue_read`（method: `get_sub_issues`、`issue_number` に親の番号）で同じ親の sub-issue 一覧を取り、同じ型・関数・共通データ・共通ロジックに触れる兄弟 Issue が無いか本文を照合する。あれば `search_pull_requests`（query に兄弟 Issue の番号）と `git ls-remote --heads origin '*/#<兄弟の番号>-*'`、兄弟 Issue のコメントの「## 着手」の印（`claude/*` ブランチはブランチ名に番号が入らない）で、その兄弟に作業ブランチやオープン PR が既にあるかを見る。重なりがあるときは、共通部分をどの Issue で実装し、他方はそのマージ後に取り込むのかを **着手前に** ユーザーへ確認する。並行セッションが同じ仕組みを二重に実装してコンフリクトするのを防ぐためで、Issue 本文に重なりが書かれていなくても確認する
   - 外部リポジトリの **特定タグのファイル** が参照元に指定されている場合は、`get_file_contents`（`owner` / `repo` / `path` に加えて `ref` にタグを指定）で版固定で読む。`gh` なら `gh api "repos/<owner/repo>/contents/<path>?ref=<tag>" -H "Accept: application/vnd.github.raw"`（`?` を含むのでクォートする）
   - 2 つの版の間の差分や特定ファイルの patch が要るときは、compare API の JSON を jq で漉すより、`git clone --no-checkout` したクローンで `git diff --name-only vOLD vNEW` / `git show vNEW:<path>` を使う（`.claude/skills/template-update/SKILL.md`「3-way マージの定型手順」と同じ形）。`gh api --jq` で正規表現を書くときの注意は `.claude/skills/issue-start/pitfalls.md`「gojq が `\.` を拒否する」
4. **【MCP: Brave Search】** IssueがFF14のスキルデータやゲーム仕様に関わる場合、`brave_web_search` で公式ジョブガイドや関連情報を検索し、実装に必要な数値・仕様を収集する
   - 検索例: `"FF14 竜騎士 ジョブガイド スキル一覧"`, `"FFXIV dragoon job guide skill potency"`
   - **利用前の準備**: `ToolSearch query: "select:brave_web_search"` でスキーマをロード
   - **未接続・未設定時のフォールバック**:
     1. `ToolSearch` で `No matching deferred tools found` が返る → `BRAVE_API_KEY` 未設定または stdio 起動失敗。詳細は `.claude/rules/mcp-setup.md` 参照
     2. 組み込みの `WebSearch` ツールで代替検索を試みる（スキーマは `ToolSearch query: "select:WebSearch"` でロード）
     3. それでも必要な情報が得られない場合、実装に必要な数値・仕様をユーザーに直接確認する
   - フロー全体を止めず、情報源を明示した上で次フェーズに進む
   - **外部情報のクロスチェック（必須）**: スキル名・バフ名・威力等の数値を扱う Issue では、WebFetch の LLM 要約を鵜呑みにしない。要約は固有名詞（例:「ハイファイラ」→「ハイファイア」）や数値を誤って返すことがあるため、**第2情報源（Brave Search / 別の公式系サイト）でクロスチェック**してから実装に進む（実績: #200 で triangulation により誤記を検出・修正）
   - WebFetch を使う場合、プロンプトに「ページに記載のとおり原文を引用」「推測しない」を明示的に指定する
   - **ジョブガイド数値の裏取りは生 HTML 抽出を標準手順とする（#326）**: 公式ジョブガイドは同一ページに PvE 欄と PvP 欄が同居しており、WebFetch の LLM 要約が両欄を混同・補完した数値を返すことが既知の失敗モード（実績: #273 で「ハイファイラ 2体目以降25%減」「威力13500」等、実行のたびに変わる誤答が発生。#272 でも情報源間の食い違いあり）。威力・減衰率などの数値を確定させる際は WebFetch 要約に依存せず、**生 HTML を取得 → タグ除去 → スキル名周辺の原文を直接抽出** して確認する。WebFetch はページの概要把握・URL 特定用途では引き続き使ってよい

     定型スニペット（curl + node。#273 セッションで使用した手順の定型化）:

     ```bash
     # 1. ジョブガイドの生 HTML を取得（URL は WebFetch / 検索で特定済みのもの）
     curl -sL "https://jp.finalfantasyxiv.com/jobguide/blackmage/" -o "$TMPDIR/jobguide.html"

     # 2. タグ除去してスキル名の前後220字の原文を抽出
     node -e '
     const fs = require("fs");
     const text = fs.readFileSync(process.argv[1], "utf8")
       .replace(/<script[\s\S]*?<\/script>/g, " ")
       .replace(/<style[\s\S]*?<\/style>/g, " ")
       .replace(/<[^>]+>/g, " ")
       .replace(/\s+/g, " ");
     const name = process.argv[2];
     let i = -1;
     while ((i = text.indexOf(name, i + 1)) !== -1) {
       console.log("--- match at " + i + " ---");
       console.log(text.slice(Math.max(0, i - 220), i + 220));
       console.log();
     }
     ' "$TMPDIR/jobguide.html" "ハイファイラ"
     ```

     運用上の注意:

     - 出力ファイルはセッションの scratchpad ディレクトリ等の一時領域に置く（リポジトリ直下に残さない）
     - **同一スキル名は PvE 欄と PvP 欄の両方にマッチする**。抽出結果ごとに周辺原文を読み、どちらの欄の記述かを必ず判別する（PvP 欄は威力の桁が大きい・「PvP」見出しが近傍に出る等で見分けられる）
     - 減衰・条件付き効果は「対象数に応じて威力が減少」等の**原文の有無**で判定する。原文に記載がなければ減衰なしと確定してよい（#273 で PvE 欄原文により「減衰記載があるのはフレア/フレアスター/ファウルのみ」と確定した実績）
   - **パッチ追従の検証**（「パッチ X.Y の調整をデータに反映済みか確かめる」等）は、個別スキルの裏取りではなくジョブ全体の照合になる。後述「パッチ追従の検証（定型）」に従う。生 HTML の取得とタグ除去には上のスニペットをそのまま使う
5. 以下のチェックリストで記載内容を検証する

### パッチ追従の検証（定型）

パッチ追従の検証は **① パッチノートの PvE ジョブ調整抽出** と **② ジョブガイドとデータの全件照合** の両方を行う。パッチノートは差分しか分からないため、① だけではデータがもともとずれているケースを見逃す（#304 では BLM のパッチ変更がゼロだったが、② で 13 件の不一致が見つかった）。

1. **① パッチノートの PvE ジョブ調整抽出**: 対象範囲の各版のパッチノートから、実装済みジョブの PvE 調整を抜き出し、データに反映済みかを確かめる
   - 各版の URL はパッチノート一覧（`https://jp.finalfantasyxiv.com/lodestone/special/patchnote_log/`）の生 HTML から取る。Issue 作成後に公開された版があれば対象に含めてよいかユーザーに確認する
   - 結果は「版／ジョブ／変更／データへの反映」の表にまとめ、PvE 変更が無かった版・ジョブも明記する
2. **② ジョブガイドとデータの全件照合**: 実装済みジョブごとに、公式ジョブガイド（`https://jp.finalfantasyxiv.com/jobguide/<job>/`）の PvE 欄と `src/client/data/<job>-skills.ts`（関係する `*-buffs.ts` / `*-resources.ts` も）を **全スキル** 照合する。威力だけでなく、リキャスト・効果時間・範囲の減衰率など、データが持つ項目はすべて比べる
   - 結果はジョブごとに「一致 N / 全 M 件」と不一致の一覧（スキル名・データ値・ジョブガイド原文の値）で返す
   - 不一致はジョブ単位で子 Issue に起票する（スコープ外問題の起票フロー。#304 → #407〜#412）

**PvE / PvP 欄の境界**（タグ除去後のテキストで判定する。境界の外の数値は使わない）:

| 情報源 | PvE 欄の範囲 |
|-------|-------------|
| パッチノート | 「バトル関連」の見出しから「PvP全般」の見出しの手前まで |
| ジョブガイド | 「PatchX.Y…のPvP全般のアップデート内容は」の行より前 |

**照合時の判定基準**:

- **Lv100 の実効値で比べる**。ジョブガイドは特性習得後（Lv100 時点）の値を使う
- **データ側は `traitPotencyOverrides` を適用してから比べる**。基本の `potency` 等に、`traitLevel` が 100 以下の上書きを `traitLevel` の昇順で重ねた値が実効値（`src/client/logic/skill-level.ts` の `applyTraitOverrides` と同じ規則）。基本値だけを見て不一致にしない
- **データ側コメントに書かれた方針どおりの差は不一致にしない**。例: DRG の「コンボ時威力を基本 potency に採用、方向指定ボーナスなし」、BLM エノキアンの「Lv96 未満では近似値」。方針自体が誤っていると判断したら、不一致ではなく別の指摘として報告する

**サブエージェントの分担の目安**（#304 の実績: 6 ジョブで計 4 体を並列）:

- ① パッチノート抽出に 1 体（全ジョブ・全版をまとめて担当）
- ② ジョブガイド照合に、2 ジョブずつ 1 体
- 委譲プロンプトには上の境界と判定基準をそのまま渡し、返却は表形式（ジョブごとの一致数と不一致の一覧）に絞る。主な不一致はジョブガイド原文で抜き打ちに再確認してから起票する

**記録**: 検証を終えたら、各ジョブの `*-skills.ts` 冒頭コメントに「パッチノートの PvE ジョブ調整は X.Y まで反映済み（#N で照合）」と、ジョブガイドとの既知の差分の子 Issue 番号を書く（#304 の形式）

### オープンな旧 PR／既存ブランチがある場合

同じ Issue に対して、過去の試行で作られたブランチやオープンな PR が残っていることがある。黙って同名ブランチを作ると衝突し、旧 PR への force-push は拒否されることもある（ブランチ保護・他人のブランチ）。**既定は作り直し**で、以下をユーザーに確認してから進める：

```
Issue #N には過去の PR #M（ブランチ `<type>/#N-xxx`、オープン）が残っています。
 [R] 旧ブランチを再利用する（チェックアウトして main を取り込み、PR #M を更新）
 [N] 作り直す（最新 main から `<type>/#N-xxx-v2` を切って新 PR、PR #M は置き換え先リンク付きでクローズ）
```

- **作り直す（既定）**: 最新 `main` から別名ブランチ（元の名前に `-v2`, `-v3` … を付ける）を切って Phase 2 以降を進める。Phase 7 で新 PR を作ったあと、旧 PR に「#<新 PR> で置き換え」とコメントしてクローズする（`update_pull_request`（`state: closed`）と `add_issue_comment`）。旧ブランチの削除はユーザーに任せる
- **再利用する**: 旧ブランチをチェックアウトし `git merge origin/main` で最新化してから Phase 3 以降を進める。旧 PR はそのまま更新される
- **force-push での上書きは既定にしない**。旧ブランチの履歴を捨ててよいとユーザーが明示した場合だけ行う
- **クラウドセッション（`phases/02-branch-setup.md`「クラウドセッションの場合」に当たるとき）で、旧 PR のブランチが割り当てられた `claude/*` 以外の場合**（命名は問わない）: 割り当てられたブランチ以外には push できないことが多いので、[R] は提示せず、作り直す旨を伝えて、割り当てられたブランチで進める（`-v2` は付けない）。旧 PR のクローズは同じ

## チェックリスト

| 項目 | 確認内容 |
|------|---------|
| 背景・目的 | なぜこの作業が必要か明記されているか |
| 要件 | やること／やらないことが明確か |
| 完了条件 | 検証可能な形（テスト・動作確認・目視）で定義されているか |
| 技術的な情報 | 実装に必要な設計・定義が十分か（不足していても、コードを読めば分かることは Phase 3 で埋める） |
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

1. **完了条件が未定義です**
   - 例: 「計算結果が ±0.1% 以内の誤差であること」のような基準はありますか？

2. **バフの重複適用ルールが不明です**
   - 同種バフは (a) 上書き / (b) 加算 / (c) 乗算 のどれにしますか？
```

## Phase 1.5: Issue の補完（関連 Issue & 完了条件）

ユーザーが毎回手書きする負担を減らすため、「関連 Issue」と「完了条件」を補完する。**Issue 本文の更新はユーザーの確認を得てから行う**。

### 関連 Issue の紐づけ

1. `search_issues`（`owner` / `repo` を指定）に Issue のタイトルと要件の要点を自然文で渡し、関連しそうな Issue を上位 10 件程度取得する（全件取得して照合はしない）
2. 同じ機能領域・依存関係（前提機能、後続の拡張）・同じコンポーネントを変更するものを関連と判定する
3. 見つかったら、`issue_write`（method: `update`）で本文の「## 関連Issue」を更新する案を作る

### 完了条件の生成

「完了条件」が空、または「やること」のコピーになっている場合：

1. 「やること」の各項目から、実装・動作確認の観点で **検証可能な** 条件を作る（「〜を追加する」ではなく「〜したとき〜になる」「`npm test` が通る」）
2. 本文の「## 完了条件（DoD）」を更新する案を作る

### 補完結果の確認

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

### Issue 本文と現状コードの乖離チェック

本文に「○○の追加が必要」「△△機構を新規実装する」のような **技術前提** が書かれている場合、着手前に実在を確認する。本文が古いまま放置されていると、想定スコープと現状実装が乖離していることがある（過去事例: #186）。

1. 本文の技術前提キーワード（型名・関数名・データキー・設定値等）を 2〜3 個抽出する
2. `Grep -n "<keyword>"`（`type` / `glob` で対象を絞る）で実在を確認する
3. **既に存在する** 場合: スコープが「データ追加のみ」等に縮小し得るので、「Issue スコープを再確認したい」とユーザーに提示する
4. **未実装が確認できた** 場合: 通常どおり Phase 2 以降に進む

「やること」がデータ追加のみで技術前提を含まない場合は省略してよい。

## 調査だけの Issue

Issue の目的が調査そのもの（裏取り・原因調査・要否の判断）で、結論しだいではリポジトリへの変更が出ない場合の分岐。Phase 2〜7 はコードの変更と PR を前提にしているので、変更が出ないのに空のブランチを切ったり、根拠無く Phase を飛ばしたりしない。

1. Phase 1 のあと、ブランチを切らずに調査する。読む範囲が広ければ Phase 3 と同じくサブエージェント（`code-explorer`）に任せてよい
2. 結論に応じて進め方を決める

   | 結論 | 進め方 |
   |------|--------|
   | このリポジトリへの変更が要る | 通常フローに戻り、Phase 2 からブランチを切って進める |
   | 別の Issue で直すべき問題が見つかった | `SKILL.md`「スコープ外問題の起票提案」の起票フローで sub-issue として起票し、Phase 2〜7 を省略して Phase 8 へ |
   | 変更も起票も要らない | Phase 2〜7 を省略して Phase 8 へ |

3. Phase 8 では、通常の記録に代えて **結論**（調べ方・結果・判断とその根拠）を Issue にコメントする。起票した Issue があれば同じコメントに一覧を書く
4. 結論をユーザーに示し、確認を得てから Issue をクローズする（GitHub MCP の `issue_write`（method: `update`、`state: closed`、`state_reason: completed`）。`gh issue close <N> --reason completed` でも可）。PR が無いので `closes #N` での自動クローズは起きない
