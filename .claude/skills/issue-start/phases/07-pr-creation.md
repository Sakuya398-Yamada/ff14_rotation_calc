# Phase 7: PR作成

1. リモートにブランチをプッシュする：

   ```bash
   git push -u origin <ブランチ名>
   ```

2. GitHub MCPの `create_pull_request` で main ブランチへのPRを作成する。`.claude/rules/git-conventions.md` のPR規約に従う：

   - `owner` / `repo`: リポジトリ情報
   - `title`: `<type>: <説明> #<issue番号>`
   - `head`: 作業ブランチ名
   - `base`: `main`
   - `body`:

     ```
     ## 概要
     ...

     ## 変更点
     ...

     ## テスト
     ...

     closes #<issue番号>
     ```

3. 作成されたPRのURLをユーザーに返す
4. ユーザーに「このPRを購読して、CIエラーやレビューコメントを自動対応しますか？」と尋ね、希望があれば `subscribe_pr_activity` を呼ぶ
