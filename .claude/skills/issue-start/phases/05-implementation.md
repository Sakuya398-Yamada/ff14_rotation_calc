# Phase 5: 実装

1. `CLAUDE.md` および `.claude/rules/coding-standards.md` のコーディング規約に従って実装する
2. Phase 4で合意した設計方針に沿って実装する（設計フェーズを実行した場合）
3. **【MCP: context7】** ライブラリのAPI仕様が不明な場合、`resolve-library-id` → `query-docs` で最新ドキュメントを参照してから実装する
   - 特に Prisma、Hono、React 等の API変更が頻繁なライブラリで有効
   - MCP未接続時は既存コードのパターンに倣い、不明点はユーザーに確認する
4. コミットメッセージは `<type>: <subject> #<issue番号>` 形式で、Issue番号を必ず含める
   - 詳細は `.claude/rules/git-conventions.md`
   - **PreToolUse hook が `git commit` を検証する**ため、規約違反はブロックされる

## コミット粒度

- 論理的に独立した変更単位ごとにコミットする
- 1コミット = 1テーマを目安に、レビューしやすく分割する
- WIPコミットは避け、各コミットがビルド可能・テスト通過する状態を保つ
