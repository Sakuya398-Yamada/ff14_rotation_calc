# コーディング規約

このファイルは CLAUDE.md から `@.claude/rules/coding-standards.md` でインポートされる。

## 基本方針

- 言語は **TypeScript** で統一する（フロントエンド・バックエンド共通）
- `strict: true` で型安全性を確保する
- フロントエンドは **React + Vite** で構築する
- バックエンドは **Hono** で API 構築する
- DB操作は **Prisma** 経由で行い、直接SQLは書かない

## ディレクトリ構成

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
    ├── agents/          # サブエージェント定義
    ├── rules/           # @import される規約集
    ├── hooks/           # PreToolUse 等で使うシェルスクリプト
    ├── settings.json    # フック設定
    └── skills/          # スラッシュ起動可能なスキル
```

## 命名規約

| 対象 | 規約 | 例 |
|------|------|----|
| ファイル名 | `kebab-case` | `skill-data.ts` |
| Reactコンポーネント | `PascalCase` | `SkillList.tsx` |
| 変数・関数 | `camelCase` | `calculateDamage` |
| 定数 | `UPPER_SNAKE_CASE` | `MAX_BUFF_STACK` |
| 型・インターフェース | `PascalCase` | `SkillData` |

## コメントとドキュメント

- 自明なコードにコメントは付けない
- ロジックが直感的でない場所のみ「なぜそうしたか」を書く
- 触っていないコードに後付けで型注釈・コメント・docstringを追加しない
