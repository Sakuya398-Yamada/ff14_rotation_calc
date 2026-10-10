# FF14 Rotation Calculator

FF14（ファイナルファンタジー14）のスキル回し（ローテーション）の威力計算を行うツール。

## 開発方針

- **Issue駆動開発**: すべての作業はGitHub Issueから始める。Issueが唯一の情報源
- **1 Issue = 1 PR**: 作業中のIssueスコープ外の変更を同じPRに混ぜない
- **スコープ外問題は起票提案**: 作業中に当該Issueのスコープ外の問題（別バグ・改善余地・技術負債）を見つけたら、その場で修正せずユーザーに Issue起票を提案する。承認後に子Issueを作成し、親Issueへ記録する
- **応答言語**: ユーザーへのチャット応答・報告は常に日本語で書く（コード・コミットメッセージ等は既存規約に従う）
- **推測しない、ただし調べられることは自分で調べる**: 仕様・要件・設計の分岐のように「ユーザーが決めること」は質問する。コードの構造やライブラリの使い方のように「調べれば分かること」はツールで確認してから進む。ツール呼び出しの回数を理由に手を止めない
- **確認ポイントで止まる**: 設計承認（Phase 4）・スコープ外問題の起票・知見ボードや外部リポジトリへの投稿は、必ずユーザーの Y/E/N を得てから行う。それ以外の場面では進捗を 2〜3 行で共有しつつ作業を続ける
- **検証してから完了と言う**: テスト・リント・動作確認で結果を確かめてから報告する。検証できなかった項目はその旨を明記する
- **過剰設計しない**: Issue の完了条件を満たす最小の変更にとどめる。頼まれていない抽象化・設定項目・将来対応は入れない
- **コンテキストは必要な分だけ**: 全文理解を目的にファイルを丸読みしない。検索で当たりを付けて局所的に読み、横断調査はサブエージェントに委譲して要約だけ受け取る（詳細は `.claude/rules/context-efficiency.md`）
- **Issueへの記録**: 実装中に判明した技術情報や判断はIssueにコメントとして残す
- **過去Issueの参照**: 関連する過去のIssueから情報を収集し、実装に活かす

## 詳細規約（`.claude/rules/`）

具体的な規約は `.claude/rules/*.md` に分割してある。Claude Code は `.claude/rules/` 配下の Markdown を起動時に自動で読み込む（この CLAUDE.md と同じ優先度。`@import` は不要）。**この CLAUDE.md は索引・コア原則のみに保ち、詳細規約は rules 側に書く**（運用方針は `.claude/rules/documentation-policy.md`）。

| ファイル | 内容 |
|---------|------|
| `git-conventions.md` | ブランチ・コミット・PR・Issue・ラベル規約 |
| `coding-standards.md` | 言語規約・命名・ディレクトリ構成・コメント方針 |
| `testing-conventions.md` | テスト記述の既知の罠と回避パターン |
| `tech-stack.md` | 技術スタック・開発環境・コマンド |
| `context-efficiency.md` | コンテキスト効率・ファイル読解・サブエージェント委譲 |
| `mcp-setup.md` | MCP サーバー設定・API キー管理 |
| `playwright-mcp.md` | Playwright MCP による UI 検証手順 |
| `workflow-feedback.md` | 知見ボード運用、テンプレート元への還元・更新取り込み |
| `documentation-policy.md` | CLAUDE.md と rules の書き分け方針 |

## 開発フロー

1. **Issue作成（ユーザー）**: GitHub上でIssueを作成し、背景・要件・完了条件を記載。要望からの分割・起票は `/issue-plan` に任せてもよい（粒度の基準は `.claude/rules/git-conventions.md`「粒度」）
2. **Issue指定（ユーザー）**: Claude Code で `/issue-start #<番号>` を実行
3. **ブランチ作成＆実装（Claude Code）**: Issueと関連する過去Issueを読み取り、ブランチ作成・設計・実装・レビュー
4. **PR作成（Claude Code）**: `closes #<issue番号>` を含めたPRを作成し、Issueに実装メモを記録
5. **最終確認＆マージ（ユーザー）**: PRを承認・マージ。Issueが自動クローズされる

`/issue-start` の各Phase詳細は `.claude/skills/issue-start/SKILL.md`、Issue の分割・起票（`/issue-plan`）は `.claude/skills/issue-plan/SKILL.md` を参照。1 セッションで扱う Issue は 1 件を基本とし、別の Issue に移るときは `/clear` してから始める。

精度向上のためのチェック項目（Issue 本文乖離検出 / スコープ乖離判定 / 系統スキル網羅性 / 系統横断ユニットテスト）は対応する `.claude/skills/issue-start/phases/*.md` 内のチェック節を参照（Issue #231 で導入）。

### スコープ外問題の取り扱い

`/issue-start` 実行中（Phase 3/5/6）にスコープ外の問題を検出した場合は、以下のいずれかに当てはまるものだけを起票候補として扱う：

- **起票する**: 機能不具合・仕様乖離・データ誤り・ユーザー体験を損なう振る舞い・複数ジョブ横断の類似問題
- **起票しない**: コードスタイルの好み・影響の無いリファクタ案・当該Issueの DoD に含まれる範囲・既存Issueの重複

起票前に GitHub MCP の `search_issues`（または `gh issue list --search`）で重複を確認し、ユーザー確認（Y=そのまま起票 / E=編集して起票 / N=起票しない）を挟んでから起票する。子Issue は GitHub の sub-issue として親に紐づけ、Phase 8 で親Issueにも一覧をコメントする。

## 自動ガードレール

`.claude/settings.json` の PreToolUse hook が、Claude Code の `Bash` ツール呼び出しに対して以下を機械的に検証する（exit 2 でブロックし、理由を Claude に返す）：

- ブランチ名規約: `<feature|fix|refactor|docs>/#<issue>-<kebab-case-desc>`（`claude/*` / `copilot/*` は除外）
- コミットメッセージ規約: `<type>[(scope)][!]: <subject> #<issue>`（`claude/*` / `copilot/*` 上はissue番号省略可）

規約は CLAUDE.md への記述だけでは長いセッションで守られなくなるため、機械判定できるものは hook で強制する。ブロックされたら規約に合わせて直す。`--no-verify` や hook の無効化で回避しない。

## ドキュメントの更新

実装の過程で規約・フロー・技術スタックに変更が生じたら、該当するドキュメントを同じ PR で更新する：

- 技術スタックが決定・変更されたとき → `.claude/rules/tech-stack.md`
- コーディング規約が追加されたとき → `.claude/rules/coding-standards.md`
- Git/PR/Issue規約が変わったとき → `.claude/rules/git-conventions.md`（hooks の正規表現も揃える）
- 開発フロー全体が変わったとき → このファイル + `CONTRIBUTING.md`（人間の開発者向けガイド）
