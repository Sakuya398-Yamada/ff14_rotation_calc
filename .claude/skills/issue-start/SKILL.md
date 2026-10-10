---
name: issue-start
description: GitHub Issue を起点に、ブランチ作成・探索・設計・実装・レビュー・PR作成・Issueへの記録まで一連の開発を行うスキル。「Issue #N をやって」「#N を実装して」「/issue-start #N」のように Issue 番号を指定して作業を依頼されたときに使う。Issue の分割・起票だけなら /issue-plan を使う。各 Phase の詳細は phases/ 配下に分割してあり、該当 Phase に入る直前に読む（progressive disclosure）。
argument-hint: "#<Issue番号>"
---

# Issue開発スキル（/issue-start）

対象 Issue: **$ARGUMENTS**（`#` の有無は問わない。番号が読み取れなければ最初に質問する）

指定された GitHub Issue に基づいて、ブランチ作成から実装・レビュー・PR作成・Issue への記録までを一連で行う。

## Phase一覧（progressive disclosure）

各 Phase の手順は `phases/` 配下に分割してある。**該当 Phase に入る直前にそのファイルを読む**。冒頭でまとめて読み込まない。

| # | Phase | ファイル | スキップ |
|---|-------|---------|---------|
| 1 | Issue分析・不足確認・補完 | `phases/01-issue-analysis.md` | 不可 |
| 2 | ラベル付与・ブランチ作成 | `phases/02-branch-setup.md` | 不可 |
| 3 | コード探索（code-explorer） | `phases/03-exploration.md` | 修正箇所が明確な bug / docs は可 |
| 4 | 設計（code-architect）とユーザー承認 | `phases/04-design.md` | 差分を 1 文で説明できる変更は可 |
| 5 | 実装・検証・コミット | `phases/05-implementation.md` | 不可 |
| 6 | コードレビュー（code-reviewer） | `phases/06-review.md` | docs は可 |
| 7 | PR作成 | `phases/07-pr-creation.md` | 不可 |
| 8 | Issueへの記録（+ 知見ボード・テンプレート元への還元） | `phases/08-issue-recording.md` | 不可 |

## 全体ルール

- **確認ポイント**: Phase 1 の不足確認、Phase 4 の設計承認、スコープ外問題の起票、Phase 8 の知見ボード追記とテンプレート元への起票では、ユーザーの Y/E/N を得てから進む。それ以外の場面では進捗を 2〜3 行で共有しながら自律的に進める
- **判断の線引き**: 読み方が分かれて成果物が変わる曖昧さは質問する。調べれば分かること（コードの構造・ライブラリの使い方・既存の挙動）は自分で調べる。ツール呼び出しの回数を理由に止まらない
- **1 Issue = 1 PR**: スコープ外の変更を混ぜない（後述「スコープ外問題の起票提案」）
- **GitHub 操作**: `.mcp.json` の GitHub MCP（`github-mcp-server` バイナリ）を使う。未接続・エラー時は `gh` CLI（`/c/Program Files/GitHub CLI/gh.exe` のフルパス起動。`.claude/rules/mcp-setup.md`「利用不可時のフォールバック」）にフォールバックし、それも無ければ整形済みの本文を提示してユーザーに操作を依頼する。フロー全体は止めない
- **セッション**: 1 セッション 1 Issue。別の Issue に移るときは `/clear` してから始める

## サブエージェント

Phase 3/4/6 で使う専門エージェントは `.claude/agents/` に定義済み（`Agent` ツールの `subagent_type` で指定する）：

| subagent_type | 役割 | 定義 |
|---------------|------|------|
| `code-explorer` | コード探索・トレース。生の探索ログを主会話に入れず要約だけ受け取る | `.claude/agents/code-explorer.md` |
| `code-architect` | 実装ブループリント（1 案に絞って提案） | `.claude/agents/code-architect.md` |
| `code-reviewer` | 実装者とは別の新しいコンテキストでの批判的レビュー（信頼度80以上のみ報告） | `.claude/agents/code-reviewer.md` |

起動数はタスクの複雑さに合わせる（`.claude/rules/context-efficiency.md`「起動数の目安」）。単純な変更は 1 個、観点が複数あるときだけ 2〜3 個を並列に起動する。サブエージェントはチャット 1 往復の十数倍のトークンを使うので、Grep 1 回で済むことには使わない。プロンプトには目的・スコープ・返却フォーマットと上限・除外事項を含める。

## MCP ツール

接続設定・API キー管理は `.claude/rules/mcp-setup.md` を参照。MCP は補助手段であり、未接続時は下表のフォールバックで進めてフロー全体を止めない。

| 用途 | 使うもの | 未接続時のフォールバック |
|------|---------|------------------------|
| Issue / PR 操作 | GitHub MCP（`github-mcp-server` バイナリ）: `issue_read` / `issue_write` / `search_issues` / `sub_issue_write` / `add_issue_comment` / `update_issue_comment` / `pull_request_read` / `search_pull_requests` / `create_pull_request` / `subscribe_pr_activity` | `/c/Program Files/GitHub CLI/gh.exe` のフルパス起動で `gh issue ...` / `gh pr ...` |
| 外部仕様・技術情報（FF14 公式ジョブガイド・ゲーム仕様等） | Brave Search MCP: `brave_web_search` | 組み込みの `WebSearch` / `WebFetch`、またはユーザーに確認 |
| ライブラリの最新ドキュメント | context7 MCP（`resolve-library-id` → `query-docs`）※本リポジトリでは未登録。必要時に `.mcp.json` へ追加 | 公式ドキュメントを `WebFetch` |
| UI 動作確認 | Playwright MCP（`browser_navigate` / `browser_snapshot` 等、`--browser msedge`。`.claude/rules/playwright-mcp.md`） | ユーザーに手動確認を依頼し、未検証と明記する |

## スコープ外問題の起票提案（Phase横断）

当該 Issue のスコープ外の問題を見つけたら **その場で直さず、別 Issue としての起票を提案する**（1 Issue = 1 PR）。

### 検出タイミング

| Phase | 検出場面 | 扱い |
|-------|---------|------|
| 3（コード探索） | 既存コードの別バグ・設計上の違和感 | Phase 末尾で一覧化して提示 |
| 5（実装） | 実装中に周辺コードのバグに遭遇 | 即時は記録のみ、Phase 末尾でまとめて提示 |
| 6（レビュー） | レビュアーの指摘が当該 Issue の DoD 外 | スコープ内（即修正）／外（起票候補）に仕分け |

### 起票判定基準

- **起票する**: 機能不具合／仕様乖離／データ誤り／ユーザー体験を損なう振る舞い／複数ジョブ横断の類似問題
- **起票しない**: コードスタイルの好み／影響の無いリファクタ案／当該 Issue の DoD 内／既存 Issue の重複

### 起票フロー（共通）

1. **重複チェック**: GitHub MCP の `search_issues`（`owner` / `repo` を指定、query は自然文）で近い Issue を探す。候補があればリンクを提示して判断を仰ぐ
2. **ユーザー確認**: 以下のフォーマットで提示する

   ```
   【候補N】
   タイトル案: <ラベル名>: <簡潔な説明>
   ラベル: bug / feature / refactor / docs のいずれか
   概要: 何が問題か（1〜3行）
   コード箇所: path/to/file.ts:L10-20（バグの場合）
   再現手順: 箇条書き（バグの場合のみ）
   既存Issue重複チェック: なし / 候補 #NN

   起票しますか？
    [Y] そのまま起票
    [E] タイトル/本文を編集して起票
    [N] 起票しない（口頭報告のみ）
   ```

3. **起票**: 承認（Y/E）後、`issue_write`（method: `create`、`parent_issue_number` に親 Issue 番号）で **sub-issue として** 作成する。本文は `.claude/rules/git-conventions.md` の「Issueに含める内容」の構成と「粒度」に揃える。sub-issue にできない場合（`gh` フォールバック等）は本文末尾に `親Issue: #<親番号>` と書く
4. **親Issueへの記録**: Phase 8 で親 Issue に子 Issue の一覧をコメントする（`phases/08-issue-recording.md`）

無人起票はしない。スコープ外問題を自動修正もしない（口頭報告か起票のみ）。

## ワークフロー改善の知見ボード（Phase 8）

個別 Issue のスコープ外問題（コードのバグ等）とは別に、**ワークフロー自体（`/issue-start` の手順・`.claude/rules/*`・`CLAUDE.md`・hooks・agents・skills・MCP 運用）への気づき** を累積する常時 Open の Issue がある。

- **知見ボードIssue**: #195（`meta: ワークフロー改善の知見ボード`）
- **書き込み**: Phase 8 の最後にユーザー確認を挟んで `add_issue_comment` で追記する（運用規約は `.claude/rules/workflow-feedback.md`）
- **Phase 5/6/7 との連携**: 実装・レビュー・PR作成中に気づいた改善余地は短文メモとして控え、Phase 8 で棚卸しする。気づきが無ければスキップしてよい
- **還元先の判定**: 各気づきに `還元先: プロジェクト固有 / テンプレート汎用` を付ける（判定表は `workflow-feedback.md`「還元する / しないの判定」）
- **テンプレート元への還元**: 気づきが「テンプレート汎用」（別プロジェクトでも同じ問題が起きるもの）なら、プロジェクト固有情報を除いた上で、ローカル知見ボードへの承認とは別に改めて確認を取り、テンプレート元リポジトリ（`.claude/template-version` の `repo`）に Issue として起票する（Phase 8 手順 6。無人起票は禁止）。テンプレート側で反映・リリースされた改善は更新用 Issue で取り込む（`.claude/rules/workflow-feedback.md`「テンプレート更新の取り込み」。新しいリリースは SessionStart hook が検知し、Phase 1 手順 0.5 で起票を提案する）
- **棚卸し**: 溜まった知見の改善Issueへの昇格は `workflow-feedback.md`「棚卸し運用」に従う（週次ルーティン `weekly-issue-intake` が正、手動棚卸しも可）

## ガードレール（自動）

`.claude/settings.json` の PreToolUse hook が、`Bash` ツール経由の git 操作を決定論的に検証する（詳細は `.claude/rules/git-conventions.md`「自動検証」）：

- ブランチ作成コマンドのブランチ名 → `.claude/hooks/validate-branch-name.sh`
- `git commit` の件名 → `.claude/hooks/validate-commit-message.sh`

違反は exit 2 でブロックされ、理由が返る。規約に合わせて直し、`--no-verify` や hook の無効化で回避しない。

## 注意事項

- すべてのブランチは `main` から派生し、`main` にマージする
- 作業中の変更がある場合はユーザーに確認してからブランチを切り替える
- 過去の Issue や PR から関連情報を積極的に収集する
- 完了報告は検証結果（テスト・リント・動作確認）を添えて行う。検証できなかった項目は未検証と明記する
