---
name: issue-start
description: GitHub Issueを読み取り、ブランチ作成・実装・PR作成まで一連の開発を行うスキル。ユーザーが「Issue #Nをやって」「#N を実装して」「/issue-start #N」のようにIssue番号を指定して作業を依頼したときに使う。Issue駆動開発、ブランチ作成、PR作成、GitHub Issue対応といったキーワードでも発動すること。各Phaseの詳細は phases/ 配下の個別ファイルに分割されており、必要なPhaseだけ読めば動けるprogressive disclosure設計。code-explorer/code-architect/code-reviewer のサブエージェント定義は .claude/agents/ に配置済み。MCPサーバー（GitHub, Brave Search, context7, Playwright）も各Phaseで活用可能。
---

# Issue開発スキル

指定されたGitHub Issueに基づいて、ブランチ作成から実装、PR作成まで一連の開発を行う。

## 使い方

```
/issue-start #1
/issue-start 1
```

引数からIssue番号を取得する。`#` の有無は問わない。

---

## Phase一覧（Progressive Disclosure）

各 Phase の詳細手順は `phases/` 配下の個別ファイルに分割されている。**該当Phaseに入る直前にそのファイルを Read して内容に従うこと**。すべてを冒頭でまとめて読み込む必要はない。

| # | Phase | ファイル | スキップ可? |
|---|-------|---------|-------------|
| 1 | Issue分析・不足確認・自動補完 | `phases/01-issue-analysis.md` | × |
| 2 | ラベル付与・ブランチ作成 | `phases/02-branch-setup.md` | × |
| 3 | コード探索（code-explorer） | `phases/03-exploration.md` | bug/docs時可 |
| 4 | 設計（code-architect） | `phases/04-design.md` | 単純変更時可 |
| 5 | 実装 | `phases/05-implementation.md` | × |
| 6 | コードレビュー（code-reviewer） | `phases/06-review.md` | docs時可 |
| 7 | PR作成 | `phases/07-pr-creation.md` | × |
| 8 | Issueへの記録 | `phases/08-issue-recording.md` | × |

---

## サブエージェント

Phase 3/4/6 で呼ぶ専門エージェントは `.claude/agents/` に集約済み（`subagent_type` で直接指定するだけで使える）：

| subagent_type | 役割 | 定義 |
|---------------|------|------|
| `code-explorer` | コード探索・トレース | `.claude/agents/code-explorer.md` |
| `code-architect` | アーキテクチャ設計 | `.claude/agents/code-architect.md` |
| `code-reviewer` | レビュー（信頼度80以上のみ報告） | `.claude/agents/code-reviewer.md` |

各Phaseで2〜3個並列起動して観点を分散させる。

---

## MCPツール活用方針

プロジェクトに接続済みの MCP サーバーを各Phaseで活用し、情報収集の質を向上させる。MCP は**補助的な手段**であり、未接続・エラー時は従来手段（手動検索・ユーザーへの確認）にフォールバックしてフロー全体を止めない。

### 利用可能な MCP ツール

| MCPサーバー | ツール例 | 用途 |
|------------|---------|------|
| GitHub | `issue_read`, `issue_write`, `list_issues`, `search_pull_requests`, `create_pull_request`, `add_issue_comment`, `subscribe_pr_activity` | Issue/PR操作全般 |
| Brave Search | `brave_web_search` | FF14公式ジョブガイド・ゲーム仕様・外部技術情報の検索 |
| context7 | `resolve-library-id`, `query-docs` | ライブラリの最新ドキュメント参照 |
| Playwright | `browser_navigate`, `browser_snapshot` 等 | フロントエンド変更時のUI動作確認 |

### Phase別MCPツール対応表

| Phase | 主MCPツール | 活用場面 |
|-------|-------------|---------|
| 1 | GitHub, Brave Search | Issue/PR取得、FF14仕様の検索 |
| 1.5 | GitHub | Issue本文の更新、関連Issue取得 |
| 2 | GitHub | ラベル付与 |
| 3 | context7 | ライブラリAPIドキュメント参照 |
| 5 | context7 | ライブラリの正確なAPI仕様参照 |
| 6 | Playwright | UI動作確認 |
| 7 | GitHub | PR作成・PR購読 |
| 8 | GitHub | Issueコメント追加 |

---

## ガードレール（自動）

`.claude/settings.json` に登録された PreToolUse hook が以下を**決定論的に**検証する：

- `git checkout -b` / `git switch -c` のブランチ名規約 → `.claude/hooks/validate-branch-name.sh`
- `git commit -m` のメッセージ規約 → `.claude/hooks/validate-commit-message.sh`

規約違反は exit 2 でブロックされる。詳細は `.claude/rules/git-conventions.md`。

---

## 注意事項

- すべてのブランチは `main` から派生し、`main` にマージする
- 作業中の変更がある場合はユーザーに確認してからブランチを切り替える
- 過去のIssueやPRから関連情報を積極的に収集する
- 旧 `references/` ディレクトリは廃止。サブエージェント定義は `.claude/agents/` に移行済み
