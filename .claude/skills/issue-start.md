---
name: issue-start
description: 指定したIssue番号からIssue内容を読み取り、ブランチ作成・実装・PR作成まで行う。
user_invocable: true
---

# Issue開発スキル

指定されたGitHub Issueに基づいて、ブランチ作成から実装、PR作成まで一連の開発を行います。

## 使い方

```
/issue-start #1
/issue-start 1
```

## 実行手順

### Phase 1: Issue分析

1. `gh issue view <番号>` でIssueの本文・ラベル・コメントをすべて取得する
2. 関連する過去のIssue（本文中のリンクや関連ラベル）があれば参照する
3. 要件・設計・定義・完了条件を整理する
4. 不明点があれば `AskUserQuestion` でユーザーに確認する（推測しない）

### Phase 2: ブランチ作成

1. Issueのラベルからブランチのtype prefixを決定する
   - `feature` → `feature/`
   - `bug` → `fix/`
   - `refactor` → `refactor/`
   - `docs` → `docs/`
   - ラベルなし → ユーザーに確認
2. ブランチ名を生成: `<type>/#<issue番号>-<kebab-case説明>`
3. developブランチから分岐する:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b <ブランチ名>
   ```

### Phase 3: 実装

1. CLAUDE.mdのコーディング規約に従って実装する
2. コミットメッセージにIssue番号を含める（例: `feat: 〜 #1`）
3. 実装中に判明した技術情報や設計判断は、Issueにコメントとして記録する:
   ```bash
   gh issue comment <番号> --body "実装メモ: ..."
   ```

### Phase 4: PR作成

1. リモートにブランチをプッシュする
2. developブランチへのPRを作成する:
   ```bash
   gh pr create \
     --base develop \
     --title "<type>: <説明> #<issue番号>" \
     --body "$(cat <<'EOF'
   ## 概要
   ...
   ## 変更点
   ...
   ## テスト
   ...
   closes #<issue番号>
   EOF
   )"
   ```
3. 作成されたPRのURLをユーザーに返す

## ブランチtype判定表

| Issueラベル | ブランチprefix |
|-------------|---------------|
| `feature` | `feature/` |
| `bug` | `fix/` |
| `refactor` | `refactor/` |
| `docs` | `docs/` |

## 注意事項

- developブランチが存在しない場合は作成する
- 作業中の変更がある場合はユーザーに確認してからブランチを切り替える
- Issueに記載のない仕様は推測せず、ユーザーに確認する
- 過去のIssueやPRから関連情報を積極的に収集する
