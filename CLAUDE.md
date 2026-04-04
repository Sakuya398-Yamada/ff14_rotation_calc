# FF14 Rotation Calculator - CLAUDE.md

## プロジェクト概要

FF14（ファイナルファンタジー14）のスキル回し（ローテーション）の威力計算を行うツール。

## 開発方針

- **Issue駆動開発**: すべての作業はGitHub Issueから始める
- **推測しない**: 不明な仕様はユーザーに確認する

## Git ブランチ規約

### ブランチ構成

| ブランチ | 役割 | 派生元 | マージ先 |
|---------|------|--------|---------|
| `main` | メインブランチ | - | - |
| `feature/#<issue番号>-<説明>` | 新機能開発 | main | main |
| `fix/#<issue番号>-<説明>` | バグ修正 | main | main |
| `refactor/#<issue番号>-<説明>` | リファクタリング | main | main |
| `docs/#<issue番号>-<説明>` | ドキュメント | main | main |

### ブランチ名の例

```
feature/#1-add-skill-data-model
fix/#5-fix-damage-calculation
refactor/#10-refactor-rotation-engine
```

## コミットメッセージ規約

### フォーマット

```
<type>: <subject> #<issue番号>
```

### type 一覧

| type | 説明 |
|------|------|
| `feat` | 新機能追加 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング |
| `docs` | ドキュメント |
| `test` | テスト追加・修正 |
| `chore` | ビルド・設定変更 |
| `style` | コードスタイル修正（動作に影響なし） |

### コミットメッセージの例

```
feat: スキルデータモデルを追加 #1
fix: ダメージ計算のバフ適用順序を修正 #5
test: ローテーションエンジンのユニットテスト追加 #8
```

## Pull Request 規約

### タイトル

```
<type>: <簡潔な説明> #<issue番号>
```

### 本文に含める内容

- `## 概要`: 変更内容の要約（1〜3行）
- `## 変更点`: 具体的な変更のリスト
- `## テスト`: テスト方法・結果
- `closes #<issue番号>`: マージ時にIssueを自動クローズ

## Issue 規約

### Issueに含める内容

- **背景・目的**: なぜこの作業が必要か
- **要件**: やること／やらないこと
- **完了条件（DoD）**: チェックリスト形式
- **未確定事項**: 要確認な仕様（あれば）

### ラベル

| ラベル | 説明 | 色 |
|--------|------|----|
| `feature` | 新機能 | `#0E8A16` |
| `bug` | バグ | `#D73A4A` |
| `refactor` | リファクタリング | `#F9D0C4` |
| `docs` | ドキュメント | `#0075CA` |
| `question` | 要確認・議論 | `#D876E3` |
| `priority:high` | 優先度高 | `#B60205` |
| `priority:medium` | 優先度中 | `#FBCA04` |
| `priority:low` | 優先度低 | `#C2E0C6` |

## 開発フロー

1. **Issue作成（ユーザー）**: ユーザーがGitHub上でIssueを作成し、要件・設計・定義を記載する
2. **Issue指定（ユーザー）**: ユーザーがClaude Codeを起動し `/issue-start #<番号>` で作業対象を指定する
3. **ブランチ作成＆実装（Claude Code）**: Issueと関連する過去Issueを読み取り、ブランチ作成・実装する
4. **PR作成（Claude Code）**: `closes #<issue番号>` を含めたPRを作成する
5. **最終確認＆マージ（ユーザー）**: ユーザーがPRを承認・マージし、Issueが自動クローズされる

### 重要な原則

- **Issueが唯一の情報源**: 実装に必要な仕様はすべてIssueに集約されている前提で動く
- **推測しない**: Issueに記載のない仕様はユーザーに確認する
- **Issueへの記録**: 実装中に判明した技術情報や判断はIssueにコメントとして残す
- **過去Issueの参照**: 関連する過去のIssueから情報を収集し、実装に活かす

## ドキュメントの自動更新

実装の過程で規約・フロー・技術スタックなどに変更が生じた場合、以下のドキュメントを適宜更新すること。

- **CLAUDE.md**: 開発方針・規約・コーディング規約など、Claude Codeが参照するルール
- **CONTRIBUTING.md**: 開発フロー・規約など、人間の開発者が参照するガイド

更新が必要になるケース例:
- 技術スタックが決定・変更されたとき
- コーディング規約が追加されたとき
- 開発フローや規約が変わったとき
- 新しいツールやライブラリが導入されたとき

## 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| 言語 | TypeScript | フロント・バックエンド統一 |
| フロントエンド | React + Vite | SPA構成 |
| バックエンド | Hono (Node.js) | 軽量・Web標準準拠 |
| DB | SQLite | Prismaで抽象化（クラウド移行時にPostgreSQL等に切替可） |
| ORM | Prisma | 型安全なDB操作 |
| デプロイ | pm2 or systemd + Nginx | オンプレUbuntu + Cloudflare |

## 開発環境

- WSL（Windows Subsystem for Linux）上に**開発コンテナ（Dev Container）**を作成して開発する
- コンテナ内にNode.js、SQLite等の依存をすべて閉じ込め、環境差異を排除する

## インフラ構成（本番）

```
[Cloudflare] → [Nginx (リバースプロキシ)] → [Node.js (Hono API + Vite静的配信)]
                                                    ↓
                                              [SQLite ファイル]
```

- ホスティング: オンプレミスUbuntuサーバー
- 外部公開: Cloudflare経由
- クラウド移行: PrismaのDB設定変更で対応可能

## コーディング規約

### 基本方針

- 言語は**TypeScript**で統一する（フロントエンド・バックエンド共通）
- `strict: true` で型安全性を確保する
- フロントエンドは**React + Vite**で構築する
- バックエンドは**Hono**でAPI構築する
- DB操作は**Prisma**経由で行い、直接SQLは書かない

### ディレクトリ構成（予定）

```
ff14_rotation_calc/
├── CLAUDE.md
├── CONTRIBUTING.md
├── package.json
├── prisma/
│   └── schema.prisma
├── src/
│   ├── client/          # React フロントエンド
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.tsx
│   └── server/          # Hono バックエンド
│       ├── routes/
│       ├── services/
│       └── index.ts
└── .claude/
    └── skills/
```

### 命名規約

- ファイル名: `kebab-case`（例: `skill-data.ts`）
- コンポーネント: `PascalCase`（例: `SkillList.tsx`）
- 変数・関数: `camelCase`（例: `calculateDamage`）
- 定数: `UPPER_SNAKE_CASE`（例: `MAX_BUFF_STACK`）
- 型・インターフェース: `PascalCase`（例: `SkillData`）
