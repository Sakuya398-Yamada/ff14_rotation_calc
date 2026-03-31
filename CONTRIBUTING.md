# 開発ガイド

## 開発方式

本プロジェクトはIssue駆動開発を採用しています。

- **ユーザー**がGitHub Issueを作成し、要件や仕様を定義する
- **Claude Code**がIssueの内容に基づいてコーディングを行う
- 設計書・定義書などのドキュメントはIssueに紐づけて管理する

## 開発フロー

```
1. Issue作成（ユーザー）
2. 設計・定義をIssueに記載（ユーザー）
3. Claude CodeがIssueを読み取り、ブランチ作成・実装
4. PR作成 → レビュー → マージ（Issue自動クローズ）
```

### 1. Issue作成（ユーザー）

ユーザーがGitHub上でIssueを作成します。Issueには以下を含めてください。

- **背景・目的**: なぜこの作業が必要か
- **要件**: やること／やらないこと
- **完了条件（DoD）**: チェックリスト形式

### 2. 設計・定義の紐づけ（ユーザー）

実装に必要な設計書や定義書は、Issueのコメントまたは本文に直接記載するか、
別ドキュメントへのリンクをIssueに貼り付けて紐づけます。

Claude Codeはこの情報を読み取って実装するため、必要な仕様は漏れなくIssueに集約してください。

### 3. 実装開始

実装の開始方法は2つあります。

#### 方法A: 自動実行（GitHub Actions）

Issueに `ready-for-implementation` ラベルを付与すると、GitHub Actions経由でClaude Codeが自動的に起動し、実装からPR作成まで行います。

#### 方法B: 手動実行（ローカルClaude Code）

ローカルでClaude Codeを使い `/issue-start #<番号>` を実行すると、Issueを読み取りブランチ作成・実装を行います。

### 4. @claudeメンション

IssueやPRのコメントで `@claude` とメンションすると、Claude Codeが応答します。追加の修正依頼や質問に使えます。

### 5. PR作成・マージ

実装完了後、PRが作成されます（自動実行の場合は自動作成）。PRの本文に `closes #<issue番号>` が含まれるため、マージ時にIssueが自動クローズされます。

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
| `ready-for-implementation` | Claude Code自動実装トリガー |
