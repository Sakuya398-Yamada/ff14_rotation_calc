# ドキュメント運用方針

`.claude/rules/` 配下のファイルは Claude Code が起動時に自動で読み込む（CLAUDE.md からの `@import` は不要）。

## 基本方針

- **`CLAUDE.md` は索引・コア原則のみに保つ**: プロジェクトの中核となる開発方針（Issue駆動開発、1 Issue = 1 PR、確認ポイント、検証してから完了など）と、詳細規約ファイルへの索引だけを置く。1 行ごとに「この行を消すと Claude が間違えるか」を自問し、そうでなければ書かない
- **詳細規約は `.claude/rules/*.md` に分離する**: 個別領域ごとの具体的な規約・運用手順・リファレンスは `.claude/rules/` 配下に置く。`.claude/rules/` の Markdown はサブディレクトリも含めて再帰的に読み込まれ、CLAUDE.md と同じ優先度で効く
- **ファイル範囲を限定できる規約は `paths` で絞る**: frontmatter に `paths:` を書いた rules ファイルは、該当パスのファイルを Read / Edit / Write したときだけ読み込まれる。言語固有の規約などはこれで常駐コンテキストから外せる

  ```markdown
  ---
  paths:
    - "src/api/**/*.ts"
  ---
  # API 層の規約
  ...
  ```

- **強調語は本当に効かせたい 1 行だけに使う**: 「必ず」「禁止」を多用すると、どれも目立たなくなる。機械判定できる規約は文章で念押しせず hook で強制する（`git-conventions.md`「自動検証」）
- **CLAUDE.md 本文を膨らませない**: 新しい規約はコア原則の再定義でない限り、対応する rules ファイル（既存 or 新規）に書く。CLAUDE.md 側の更新は索引テーブルへの 1 行追加で済むのが理想

## 既存 rules ファイルとスコープ

| ファイル | スコープ |
|---------|---------|
| `git-conventions.md` | ブランチ・コミット・PR・Issue 規約 |
| `coding-standards.md` | TypeScript・命名・ディレクトリ構成・hooks 用スクリプト・コメント方針 |
| `testing-conventions.md` | テスト記述の既知の罠と回避パターン（プロジェクト固有） |
| `tech-stack.md` | 技術スタック・開発環境・コマンド |
| `context-efficiency.md` | コンテキスト効率・ファイル読解・サブエージェント委譲 |
| `mcp-setup.md` | MCP サーバー設定・API キー管理（プロジェクト固有） |
| `playwright-mcp.md` | Playwright MCP 利用ガイド（プロジェクト固有） |
| `workflow-feedback.md` | 知見ボード（#195）運用、テンプレート元への還元・更新取り込み |
| `documentation-policy.md` | ドキュメント運用方針（このファイル） |

## 新規 rules ファイル追加時のチェック

1. スコープが既存 rules と重複しないか確認する（重複するなら既存ファイルへの追記を選ぶ）
2. `.claude/rules/<name>.md` に置く。特定のファイル群にだけ効かせたいなら frontmatter に `paths:` を書く
3. CLAUDE.md の「## 詳細規約」テーブルに 1 行追加する（`@import` は書かない。二重に読み込まれる）
4. 大きく変えたら `/context` で読み込まれているファイルと消費量を確認し、`/doctor prompt-audit` で冗長・矛盾した指示が無いか点検する

## 「CLAUDE.md にも追記」と書きたくなったら

実装中・Issue 本文で「CLAUDE.md にも追記する」のような表現が出てきたら、まず「索引・コア原則として CLAUDE.md に置くべき内容か」を自問する。次のいずれかに該当しなければ、対応する `.claude/rules/*.md` 側に書く：

- プロジェクトのコア原則そのもの（既存「## 開発方針」と同等のレイヤー）
- 全 Phase / 全領域に横断的に効く絶対ルール
- 詳細規約ファイルが分かれていない領域への新規索引追加
