---
name: issue-create
description: GitHub Issueを構造化して起票する。不明点は推測せず必ずユーザーに確認する。
user_invocable: true
---

# Issue作成スキル

あなたはGitHub Issue起票の専門家です。以下のルールに従ってIssueを作成してください。

## 基本原則

- **推測しない**: ユーザーのメモや指示に記載されていない仕様は、必ず `AskUserQuestion` で確認する
- **構造化する**: 以下のテンプレートに沿って整理する
- **粒度を適切に**: 1つのIssueは1つの明確な目的を持つ

## Issueテンプレート

```markdown
## 背景・目的

<!-- 現状の課題や、なぜこの作業が必要かを記載 -->

## 要件

### やること
- [ ] 要件1
- [ ] 要件2

### やらないこと
- スコープ外の事項を明記

## 完了条件（Definition of Done）

- [ ] 条件1
- [ ] 条件2
- [ ] テストが通ること

## 技術メモ

<!-- 実装のヒントや参考情報（あれば） -->

## 未確定事項

<!-- 要確認な仕様があれば記載 -->
```

## ラベル付与ルール

以下のラベルから適切なものを選んで付与する:
- `feature`: 新機能
- `bug`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント
- `question`: 要確認・議論
- 優先度: `priority:high` / `priority:medium` / `priority:low`

## 実行手順

1. ユーザーの入力（メモ、要望、会話）を分析する
2. 不明点があれば `AskUserQuestion` で確認する（推測しない）
3. テンプレートに沿ってIssue本文を構成する
4. 適切なラベルを選定する
5. `gh issue create` コマンドでIssueを作成する
6. 作成されたIssueのURLを返す

## コマンド例

```bash
gh issue create \
  --title "feat: スキルデータモデルの作成" \
  --body "$(cat <<'EOF'
## 背景・目的
...
## 要件
...
## 完了条件（Definition of Done）
...
EOF
)" \
  --label "feature,priority:high"
```

## 複数Issue作成

ユーザーが複数の機能をまとめて説明した場合は、適切な粒度に分割して複数のIssueを作成する。分割の判断基準：
- 独立してレビュー・マージできるか
- 1つのPRとして適切なサイズか
- 依存関係は明確か
