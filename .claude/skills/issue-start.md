---
name: issue-start
description: 指定したIssue番号から開発用ブランチを作成し、開発を開始する。
user_invocable: true
---

# Issue開発開始スキル

指定されたGitHub IssueのブランチをCLAUDE.mdの規約に従って作成し、開発を開始します。

## 使い方

```
/issue-start #1
/issue-start 1
```

## 実行手順

1. **Issue取得**: `gh issue view <番号>` でIssueの内容を取得する
2. **ラベル確認**: Issueのラベルからブランチのtype prefix を決定する
   - `feature` → `feature/`
   - `bug` → `fix/`
   - `refactor` → `refactor/`
   - `docs` → `docs/`
   - ラベルなし → ユーザーに確認
3. **ブランチ名生成**: `<type>/#<issue番号>-<kebab-case説明>` 形式
   - Issueタイトルから簡潔な英語の説明を生成
   - 例: `feature/#1-add-skill-data-model`
4. **developブランチから分岐**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/#<番号>-<説明>
   ```
5. **開発開始の確認**: Issueの要件と完了条件を表示し、実装方針をユーザーと確認する

## ブランチtype判定表

| Issueラベル | ブランチprefix |
|-------------|---------------|
| `feature` | `feature/` |
| `bug` | `fix/` |
| `refactor` | `refactor/` |
| `docs` | `docs/` |
| `hotfix`（mainから分岐） | `hotfix/` |

## 注意事項

- developブランチが存在しない場合は作成する
- 作業中の変更がある場合はユーザーに確認してからブランチを切り替える
- Issueの完了条件を確認し、実装計画を立ててから着手する
