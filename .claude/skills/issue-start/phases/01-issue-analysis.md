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

SessionStart hook 出力の `## Template version` を確認する。

| バナーの状態 | 動作 |
|---|---|
| `up to date` | 何もしない（言及も不要） |
| `Latest: unknown` | オフライン等で取得失敗。スキップする |
| `⚠ Template update available` | **このセッションで一度だけ**、下記フォーマットで確認する |
| セクション自体が無い | `.claude/template-version` が無いか hook が動いていない。スキップする |

```
テンプレート元（<owner/repo>）に新しい版があります: <ローカル版> → <最新版>
Release notes: https://github.com/<owner/repo>/releases/tag/<最新版>

このプロジェクトに更新用 Issue を起票しますか？（今の Issue の作業はそのまま続けます）
 [Y] 起票する
 [N] 今回はスキップ（このセッション中は再度聞きません）
```

- 作業中の Issue のブランチでテンプレートを直接更新しない（1 Issue = 1 PR）。[Y] でも動作は「更新用 Issue の起票」までで、その後は手順 1 に進む
- [Y] の場合: `search_issues`（`owner` / `repo` にこのプロジェクト）で同じ版の更新 Issue（`テンプレートを <最新版> に更新`）が無いか確認し、無ければ `issue_write`（method: `create`）で起票する。タイトル `refactor: テンプレートを <最新版> に更新`、ラベル `refactor`。本文は現在の版 → 最新版、Release notes URL、差分 URL（`https://github.com/<owner/repo>/compare/<ローカル版>...<最新版>`）、完了条件（`.claude/rules/workflow-feedback.md`「取り込み手順」のチェックリスト）
- **スケジュール実行の無人セッション**（`weekday-issue-start` 等）では質問も起票もせず、実行報告に「テンプレート更新あり（<ローカル版> → <最新版>）」と記載するだけに留める
- 起票した更新 Issue はあとで通常どおり `/issue-start` する。その Phase 5 の手順は `.claude/rules/workflow-feedback.md`「テンプレート更新の取り込み」
- いま `/issue-start` している Issue 自体が更新用 Issue なら、このチェックは不要

## 手順

1. GitHub MCP の `issue_read`（method: `get`）で本文・ラベルを取得し、`issue_read`（method: `get_comments`）でコメントも取得する。`get` の結果には sub-issue の親子関係（`parent` / `sub_issues_summary`）と、この Issue をクローズする設定の PR（`closed_by_pull_requests`）も含まれる
2. **マージ済み PR の確認**: `closed_by_pull_requests` にマージ済み PR があるか、無ければ `search_pull_requests`（query に Issue 番号、`owner` / `repo` を指定）で関連 PR の状態を確認する
   - マージ済み PR があれば、ユーザーに通知して追加作業の要否を確認する。不要なら処理を終了する
   - Issue が `OPEN` でも PR がマージ済みのことがあるので、Issue の state だけで判断しない
3. 本文中のリンクや関連ラベルから、関連する過去の Issue を参照する。親 Issue がある場合（`parent`）はその本文も読む
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
5. 以下のチェックリストで記載内容を検証する

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
