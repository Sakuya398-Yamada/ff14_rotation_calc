# Phase 7: PR作成

## push 前チェック

1 つでも該当すれば対応してから進む：

- [ ] `git status --short` に一時ファイル・生成物・ログ・個人設定（`.claude/settings.local.json` 等）が含まれていない
  - 含まれていれば `.gitignore` を確認・修正し、`git rm --cached <path>` で追跡から外す
- [ ] `git log origin/main..HEAD --stat` にこの Issue と無関係な変更（他 Issue の修正・無関係なリファクタ）が混ざっていない
  - 混ざっていれば `git reset --soft <正しい基点>` で巻き戻して staging を整理し直す
- [ ] テスト・リントが最新のコミットで通っている（Phase 6 の手順 1 以降に変更があれば再実行）

## 手順

1. リモートにブランチをプッシュする：

   ```bash
   git push -u origin <ブランチ名>
   ```

2. GitHub MCP の `create_pull_request` で `main` への PR を作成する（`.claude/rules/git-conventions.md`「Pull Request」）。`gh pr create --title ... --body-file <tmp>` でも可

   - `owner` / `repo`: リポジトリ情報
   - `title`: `<type>: <説明> #<issue番号>`
   - `head`: 作業ブランチ名 / `base`: `main`
   - `body`:

     ```
     ## 概要
     （1〜3 行）

     ## 変更点
     - ...

     ## テスト
     - 実行したコマンドと結果（例: `npm test` 42 passed）
     - 手動確認した内容 / 未検証の項目

     closes #<issue番号>
     ```

   - レビューを待たせずに先に見せたい場合は `draft: true` で作成し、Phase 8 の記録が終わったら ready にする

3. 作成された PR の URL をユーザーに返す
4. PR購読の可否は **ツールの存在確認をしてから** 提案する（環境によっては `subscribe_pr_activity` が GitHub MCP に存在しない。`github/github-mcp-server` v1.x には無い）：
   1. まず `ToolSearch query: "select:mcp__github__subscribe_pr_activity"` でスキーマロードを試みる
   2. **見つかった場合のみ**「このPRを購読して、CIエラーやレビューコメントを自動対応しますか？」と尋ね、Y なら `subscribe_pr_activity` を呼ぶ
   3. **見つからない場合**（`No matching deferred tools found`）は購読の提案自体を省略し、Phase 7 の完了報告に「CI/レビュー結果は手動で確認してください」と明記する

## ワークフロー改善余地のメモ（Phase 8 向け）

PR 作成フロー自体への気づき（`closes #N` の付け忘れ誘因、push 周りのハマりどころ、本文テンプレートに足したい項目など）があれば短文メモで控え、Phase 8 で知見ボード（#195）に書く（ユーザー確認を挟む。詳細は `phases/08-issue-recording.md`）。
