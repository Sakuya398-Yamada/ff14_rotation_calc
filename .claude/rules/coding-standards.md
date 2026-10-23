# コーディング規約

`.claude/rules/` 配下のため起動時に自動で読み込まれる。

## 基本方針

- 言語は **TypeScript** で統一する（フロントエンド・バックエンド共通）
- `strict: true` で型安全性を確保する
- フロントエンドは **React + Vite** で構築する
- バックエンドは **Hono** で API 構築する
- DB操作は **Drizzle ORM** のクエリビルダー経由で行い、SQL 文字列を直接書かない（`sql` テンプレートは CHECK・DEFAULT・式インデックスなど、API で書けない箇所に限る）
- マイグレーションは `npm run db:generate` で生成し、生成物を手で編集しない（`wrangler d1 migrations create` も使わない。drizzle-kit の `migrations/meta/` とずれる）

## ディレクトリ構成

```
ff14_rotation_calc/
├── CLAUDE.md            # コア原則＋rules への索引
├── CONTRIBUTING.md
├── .mcp.json            # プロジェクト共通の MCP サーバー（Playwright / Brave Search / GitHub）
├── package.json
├── drizzle.config.ts    # drizzle-kit の設定
├── migrations/          # drizzle-kit が生成する D1 のマイグレーション（meta/ も含めてコミット）
├── scripts/             # 本番の運用で手や cron から呼ぶスクリプト（D1 のバックアップ。docs/d1-backup.md）
├── src/
│   ├── client/          # React フロントエンド
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.tsx
│   └── server/          # Hono バックエンド（Cloudflare Worker）
│       ├── db/          # Drizzle のスキーマ（schema.ts）
│       ├── routes/
│       ├── services/
│       └── index.ts
└── .claude/
    ├── agents/          # サブエージェント定義
    ├── rules/           # 自動読み込みされる規約集
    ├── routines/        # スケジュールタスク（定期ルーティン）の手順書。登録側の呼び出し文が実行のたびに読む（rules/routines.md）
    ├── hooks/           # PreToolUse / SessionStart で使うシェルスクリプト
    ├── scripts/         # 手で呼ぶ補助スクリプト（知見ボードの読み出し等）
    ├── settings.json    # 権限と hooks の登録
    └── skills/          # /issue-start, /issue-plan, /issue-priority, /template-update, /playwright-mcp
```

## 命名規約

| 対象 | 規約 | 例 |
|------|------|----|
| ファイル名 | `kebab-case` | `skill-data.ts` |
| Reactコンポーネント | `PascalCase` | `SkillList.tsx` |
| 変数・関数 | `camelCase` | `calculateDamage` |
| 定数 | `UPPER_SNAKE_CASE` | `MAX_BUFF_STACK` |
| 型・インターフェース | `PascalCase` | `SkillData` |

## hooks / scripts 用 Node.js スクリプトの拡張子

- `.claude/hooks/` / `.claude/scripts/` に単独の Node.js スクリプトを追加する場合は **`.cjs` 拡張子を使う**
- 理由: ルート `package.json` に `"type": "module"` があるため、`.js` は ESM として読み込まれ `require('fs')` 等が `ReferenceError: require is not defined in ES module scope` で失敗する
- 前例: `.claude/scripts/knowledge-board.cjs`
- bash スクリプト内の `node -e "..."` インライン実行はこの制約の影響を受けない（ファイル拡張子による判定が働かないため）

## hooks 開発・検証時の注意

- **検証ペイロードはスクリプトファイル経由で間接実行する**: Bash ツールのコマンド文字列に `git checkout -b` / `git commit -m` 等のリテラルを含めると、自セッションの PreToolUse hook が文字列にマッチして発動・ブロックされる。ペイロード組み立てと hook 呼び出しは scratchpad 等のシェルスクリプトに書き出してから実行する（前例: #290。既存テストスイート `.claude/hooks/__tests__/*.test.sh` が間接実行構造なのも同じ理由）

## コメントとドキュメント

- 自明なコードにコメントは付けない
- ロジックが直感的でない場所のみ「なぜそうしたか」を書く
- 触っていないコードに後付けで型注釈・コメント・docstringを追加しない
