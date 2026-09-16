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

## hooks 用 Node.js スクリプトの拡張子

- `.claude/hooks/` に単独の Node.js スクリプトを追加する場合は **`.cjs` 拡張子を使う**
- 理由: ルート `package.json` に `"type": "module"` があるため、`.js` は ESM として読み込まれ `require('fs')` 等が `ReferenceError: require is not defined in ES module scope` で失敗する
- 前例: `.claude/hooks/validate-edit-path.cjs`
- bash スクリプト内の `node -e "..."` インライン実行はこの制約の影響を受けない（ファイル拡張子による判定が働かないため）

## hooks 開発・検証時の注意

- **検証ペイロードはスクリプトファイル経由で間接実行する**: Bash ツールのコマンド文字列に `git checkout -b` / `git commit -m` 等のリテラルを含めると、自セッションの PreToolUse hook が文字列にマッチして発動・ブロックされる。ペイロード組み立てと hook 呼び出しは scratchpad 等のシェルスクリプトに書き出してから実行する（前例: #290。既存テストスイート `.claude/hooks/__tests__/*.test.sh` が間接実行構造なのも同じ理由）

## コメントとドキュメント

- 自明なコードにコメントは付けない
- ロジックが直感的でない場所のみ「なぜそうしたか」を書く
- 触っていないコードに後付けで型注釈・コメント・docstringを追加しない
