# FF14 Rotation Calculator

FF14（ファイナルファンタジー14）のスキル回し（ローテーション）の威力計算を行うツール。

## 開発方針

- **Issue駆動開発**: すべての作業はGitHub Issueから始める。Issueが唯一の情報源
- **推測しない**: 不明な仕様はユーザーに確認する
- **Issueへの記録**: 実装中に判明した技術情報や判断はIssueにコメントとして残す
- **過去Issueの参照**: 関連する過去のIssueから情報を収集し、実装に活かす

## 詳細規約（Memory Imports）

具体的な規約は以下のファイルにモジュール分割している。Claude Code は起動時にこれらを自動的に読み込む。

@.claude/rules/git-conventions.md
@.claude/rules/coding-standards.md
@.claude/rules/tech-stack.md

## 開発フロー

1. **Issue作成（ユーザー）**: GitHub上でIssueを作成し、要件・設計・定義を記載
2. **Issue指定（ユーザー）**: Claude Code を起動し `/issue-start #<番号>` で作業対象を指定
3. **ブランチ作成＆実装（Claude Code）**: Issueと関連する過去Issueを読み取り、ブランチ作成・実装
4. **PR作成（Claude Code）**: `closes #<issue番号>` を含めたPRを作成
5. **最終確認＆マージ（ユーザー）**: PRを承認・マージ。Issueが自動クローズされる

`/issue-start` の各Phase詳細は `.claude/skills/issue-start/SKILL.md` 参照。

## 自動ガードレール

`.claude/settings.json` の PreToolUse hook が以下を強制する：

- ブランチ名規約: `<feature|fix|refactor|docs>/#<issue>-<desc>`（`claude/*` は除外）
- コミットメッセージ規約: `<type>: <subject> #<issue>`（`claude/*` 上はissue番号省略可）

違反は exit 2 でブロックされる。意図的にバイパスしない。

## ドキュメントの自動更新

実装の過程で規約・フロー・技術スタックなどに変更が生じた場合、以下のドキュメントを適宜更新する：

- **CLAUDE.md**: コア原則（このファイル）
- **`.claude/rules/*.md`**: 個別の詳細規約
- **CONTRIBUTING.md**: 人間の開発者が参照する開発ガイド

更新が必要になるケース例：
- 技術スタックが決定・変更されたとき → `.claude/rules/tech-stack.md`
- コーディング規約が追加されたとき → `.claude/rules/coding-standards.md`
- Git/PR/Issue規約が変わったとき → `.claude/rules/git-conventions.md`
- 開発フロー全体が変わったとき → このファイル + CONTRIBUTING.md
