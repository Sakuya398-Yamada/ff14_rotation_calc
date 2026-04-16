# Phase 2: ラベル自動付与 & ブランチ作成

## ラベル自動付与

Issueにラベルが付いていない場合、Issue本文の内容から適切なラベルを判定して自動付与する。

判定基準：
- 新しい機能やデータモデルの追加 → `feature`
- 既存機能の不具合修正 → `bug`
- 動作を変えないコード改善 → `refactor`
- ドキュメントのみの変更 → `docs`
- 判断がつかない場合 → ユーザーに確認

GitHub MCPの `issue_write`（method: `update`、`labels` パラメータ）でラベルを付与する。

## ラベル → ブランチ prefix 対応表

| Issueラベル | ブランチprefix |
|-------------|---------------|
| `feature` | `feature/` |
| `bug` | `fix/` |
| `refactor` | `refactor/` |
| `docs` | `docs/` |

## ブランチ作成手順

```bash
git checkout main
git pull origin main
git checkout -b <type>/#<issue番号>-<kebab-case説明>
```

> **Hooks による自動検証**: `.claude/hooks/validate-branch-name.sh` がブランチ名を PreToolUse で検証する。規約違反だとブロックされるので、上記フォーマットに必ず従うこと。
