---
name: issue-start
description: 指定したIssue番号からIssue内容を読み取り、不足があれば聞き返した上で、ブランチ作成・実装・PR作成まで行う。
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

### Phase 1: Issue分析 & 不足確認

1. `gh issue view <番号> --comments` でIssueの本文・ラベル・コメントをすべて取得する
2. 関連する過去のIssue（本文中のリンクや関連ラベル）があれば参照する
3. 以下の**チェックリスト**でIssueの記載内容を検証する

#### 必須チェックリスト

| 項目 | 確認内容 |
|------|---------|
| 背景・目的 | なぜこの作業が必要か明記されているか |
| 要件 | やること／やらないことが明確か |
| 完了条件 | 何をもって完了とするか定義されているか |
| 技術的な情報 | 実装に必要な設計・定義が十分か |

#### 不足時の対応

チェックリストに不足がある場合、**実装に着手せず**ユーザーに聞き返す。

聞き返す際は：
- 何が不足しているか具体的に伝える
- 可能であれば選択肢や提案を添える
- ユーザーの回答を得てから次のPhaseに進む

例：
```
Issue #3 の内容を確認しました。以下の点が不足しています：

1. **完了条件が未定義です**
   - 例: 「計算結果が±0.1%以内の誤差であること」のような基準はありますか？

2. **バフの重複適用ルールが不明です**
   - 同種バフは上書き？加算？乗算？
```

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

- **不足があれば必ず聞き返す**: 曖昧なまま実装に入らない
- developブランチが存在しない場合は作成する
- 作業中の変更がある場合はユーザーに確認してからブランチを切り替える
- 過去のIssueやPRから関連情報を積極的に収集する
