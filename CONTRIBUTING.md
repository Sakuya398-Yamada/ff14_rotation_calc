# 開発ガイド

## 開発方式

本プロジェクトはIssue駆動開発を採用しています。

- **ユーザー**がGitHub Issueを作成し、要件や仕様を定義する
- **Claude Code**がIssueの内容に基づいてコーディングを行う
- 設計書・定義書などのドキュメントはIssueに紐づけて管理する
- Claude Codeは必要に応じてIssueに情報を記載し、過去のIssueから情報を参照する

## 開発フロー

```
1. Issue作成（ユーザー）
2. Claude Code起動 & Issue指定（ユーザー）
3. ブランチ作成 & 実装（Claude Code）
4. PR作成（Claude Code）
5. 最終確認 & マージ（ユーザー）→ Issue自動クローズ
```

### 1. Issue作成（ユーザー）

ユーザーがGitHub上でIssueを作成します。Issueには以下を含めてください。

- **背景・目的**: なぜこの作業が必要か
- **要件**: やること／やらないこと
- **完了条件（DoD）**: チェックリスト形式

設計書や定義書は、Issueの本文・コメントに直接記載するか、別ドキュメントへのリンクを貼り付けてください。

### 2. Claude Code起動 & Issue指定（ユーザー）

ユーザーがClaude Codeを起動し、作業対象のIssueを指定します。

```
/issue-start #<番号>
```

### 3. ブランチ作成 & 実装（Claude Code）

Claude CodeがIssueの内容を読み取り、以下を行います。

1. Issueの要件・設計・定義、および関連する過去のIssueを確認
2. 規約に沿ったブランチを作成
3. 実装を進める
4. 必要に応じてIssueにコメントで進捗や技術的な情報を記載

### 4. PR作成（Claude Code）

実装完了後、Issueに紐づいたPRを作成します。PRの本文に `closes #<issue番号>` が含まれます。

### 5. 最終確認 & マージ（ユーザー）

ユーザーがPRの内容を確認し、承認・マージします。マージによりIssueが自動クローズされます。

---

## 規約

### ブランチ命名規則

```
<type>/#<issue番号>-<説明>
```

| type | 用途 | 派生元 | マージ先 |
|------|------|--------|---------|
| `feature` | 新機能開発 | develop | develop |
| `fix` | バグ修正 | develop | develop |
| `hotfix` | 緊急修正 | main | main, develop |
| `refactor` | リファクタリング | develop | develop |
| `docs` | ドキュメント | develop | develop |

### コミットメッセージ

```
<type>: <内容> #<issue番号>
```

| type | 説明 |
|------|------|
| `feat` | 新機能追加 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング |
| `test` | テスト追加・修正 |
| `docs` | ドキュメント |
| `chore` | ビルド・設定変更 |

### Issueラベル

| ラベル | 説明 |
|--------|------|
| `feature` | 新機能 |
| `bug` | バグ |
| `refactor` | リファクタリング |
| `docs` | ドキュメント |
| `question` | 要確認・議論 |
| `priority:high` / `medium` / `low` | 優先度 |
