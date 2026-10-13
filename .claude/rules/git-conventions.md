# Git 規約

`.claude/rules/` 配下のため起動時に自動で読み込まれる。

## ブランチ命名

```
<type>/#<issue番号>-<kebab-case説明>
```

| type | 対応する Issue ラベル | 用途 |
|------|---------------------|------|
| `feature` | `feature` | 新機能開発 |
| `fix` | `bug` | バグ修正 |
| `refactor` | `refactor` | リファクタリング |
| `docs` | `docs` | ドキュメント |

すべて `main` から派生し、`main` にマージする。例: `feature/#1-add-skill-data-model` / `fix/#5-fix-damage-calculation`

- `<kebab-case説明>` は **小文字英数字とハイフンのみ**（`add-user-model`）。大文字・アンダースコア・連続ハイフンは不可
- `#<issue番号>` は対象 Issue の番号。ブランチは必ず Issue に紐づく

> **例外**: エージェントのセッションブランチ **`claude/*`**（Claude Code on the web / GitHub Actions）と **`copilot/*`**（Copilot cloud agent、旧 coding agent）は、ツール側が自動命名するためこの規約の対象外。`main` / `master` / `develop` もそのまま使う。

## コミットメッセージ

```
<type>: <subject> #<issue番号>
```

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) 互換。任意で **scope** と **破壊的変更マーカー `!`** を付けられる（`<type>(<scope>)!: <subject> #<issue番号>`）。`!` を付けたコミットはリリース時に major 版を上げる扱いになるので、後方互換を壊す変更にだけ使う。

| type | 説明 |
|------|------|
| `feat` | 新機能追加 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング |
| `test` | テスト追加・修正 |
| `docs` | ドキュメント |
| `chore` | ビルド・設定変更 |
| `style` | コードスタイル修正（動作に影響なし） |

例: `feat: スキルデータモデルを追加 #1` / `fix: ダメージ計算のバフ適用順序を修正 #5` / `feat(api)!: レスポンス形式を v2 に変更 #12`

> **例外**: セッションブランチ（`claude/*` / `copilot/*`）上のコミットは Issue番号を省略可。typeプレフィックスは必須。git 自身が生成する件名（`Merge ...` / `Revert ...` / `fixup! ...` / `squash! ...`）は検証対象外。

## Pull Request

### スコープ原則（1 Issue = 1 PR）

- 1つのPRは**1つのIssueの完了条件（DoD）のみ**を満たす変更に限定する。スコープ外の問題は同じブランチ／PRで修正せず、`/issue-start` の提案フロー（Phase 3/5/6 末尾）に従って**別Issueとして起票**し、独立した PR で対応する
- 例外: 作業中のIssueを満たすために不可避な副次変更（例: 同ファイル内で参照先が変わる / 型定義の追従）はこの限りではないが、PR本文の「## 変更点」に明示する

### タイトルと本文

- タイトル: `<type>: <簡潔な説明> #<issue番号>`
- `## 概要`: 変更内容の要約（1〜3行）
- `## 変更点`: 具体的な変更のリスト
- `## テスト`: テスト方法・結果
- `closes #<issue番号>`: マージ時にIssueを自動クローズ

## Issue

### タイトルと本文

- タイトル: `<ラベル名>: <簡潔な説明>`（例: `feature: スキル詳細パネルを追加` / `bug: MPコストの無いファイア系スキルがAF中にUHを誤消費する` / `meta: ワークフロー改善の知見ボード`）
- **背景・目的**: なぜこの作業が必要か
- **要件**: やること／やらないこと
- **完了条件（DoD）**: チェックリスト形式
- **未確定事項**: 要確認な仕様（あれば）

### 粒度

1 Issue = 1 PR なので、Issue の粒度がそのまま PR の粒度と `/issue-start` 1 回分の作業量になる。粒度が揺れるとレビュー負荷と手戻りも揺れるため、以下を既定とする。

| 観点 | 既定 |
|------|------|
| 目的 | 1 Issue に目的は 1 つ。「背景・目的」が 1〜2 文で書ける |
| 作業量 | `/issue-start` 1 セッションで Phase 1〜8 を完走できる量。目安: 変更ファイル 10 個以内・差分 300 行以内 |
| 完了条件 | 単独で検証可能（テスト・動作確認・目視のいずれかで「できた／できていない」を判定できる） |
| 独立性 | 他 Issue の完了を待たずに着手できる。待つ必要があるなら本文に `依存: #N` を明記する |

分ける／分けないの判定表、親Issue・sub-issue の扱い、要望からの分割・起票は `/issue-plan`（`.claude/skills/issue-plan/SKILL.md`「粒度の判定」）が正本。迷ったら **「このIssueのPRだけをマージしても、壊れず・単独で説明できるか」** で判定する。Yes なら粒度は適切。

- 先に別 Issue の完了が必要な場合は、本文の「## 関連Issue」に `依存: #N` と書く。`/issue-start` Phase 1 で依存先が未完了なら、着手前にユーザーに確認する

### ラベル

| ラベル | 説明 | 色 |
|--------|------|----|
| `feature` | 新機能 | `#0E8A16` |
| `bug` | バグ | `#D73A4A` |
| `refactor` | リファクタリング | `#F9D0C4` |
| `docs` | ドキュメント | `#0075CA` |
| `meta` | ワークフロー改善の知見ボード等、メタ情報用 | `#6B5B95` |
| `question` | 要確認・議論 | `#D876E3` |
| `needs-decision` | 無人実行（日次ルーティン）が判断できず人の決定待ち。人が決めてラベルを外すと再び選定対象になる | `#D4C5F9` |
| `priority:high` | 優先度高 | `#B60205` |
| `priority:medium` | 優先度中 | `#FBCA04` |
| `priority:low` | 優先度低 | `#C2E0C6` |

作業ラベルとブランチ type の対応は「ブランチ命名」の表。`test` ラベルに専用 prefix は設けず `feature/` を使う（hook `validate-branch-name.sh` は `feature|fix|refactor|docs` の 4 種のみ許可。テスト追加はテスト基盤・カバレッジの新規追加とみなす。前例: #281）。

## 自動検証

`.claude/settings.json` に登録された PreToolUse hook（`Bash` ツール実行前）が規約違反を exit 2 でブロックし、理由を Claude に返す。人間が端末で直接打つ git コマンドには効かない。

| hook | 検証対象 |
|------|---------|
| `.claude/hooks/validate-branch-name.sh` | `git checkout -b/-B/--orphan`、`git switch -c/-C/--create`、`git branch <name>`、`git worktree add -b` で作る新ブランチ名 |
| `.claude/hooks/validate-commit-message.sh` | `git commit` の `-m` / `-am` / `--message` / heredoc（`-m "$(cat <<'EOF' ...)"`、`-F -`）で渡す件名 |

件名は、その `git commit` 自身のオプション（次の改行・`;`・`&`・`|` まで）と、同じ行で開いた heredoc の先頭行からだけ取り出す。`git add ... && git commit -F - <<'MSG'` のように他コマンドと連結してよく、heredoc 本文や後続コマンド中の `-m "..."` は件名として扱われない。`-F <file>` や `--amend --no-edit` のように件名を取り出せない形は誤検知を避けるため通す（git 自身が空メッセージを拒否する）。

加えて `.claude/hooks/validate-edit-path.sh` が `Edit` / `Write` の PreToolUse hook として、登録済み worktree で作業中に `file_path` がメインリポ側絶対パスを指し（かつ同じ相対パスのファイルが worktree 側にも存在する）場合に **警告のみ（exit 1、ブロックなし）** を出す。検出ロジックは `.claude/hooks/validate-edit-path.cjs` に実装。意図的にメインリポ側を編集したい場合は環境変数 `CLAUDE_ALLOW_MAIN_REPO_EDIT=1` で抑制できる。

> **警告の受け手は人間**: Claude Code の hook 仕様では exit 1 の stderr は **人間のターミナルにだけ** 表示され、アシスタント（Claude）には届かない（届くのは exit 2 の場合）。Claude は Edit が成功したと思って続行するため、警告に気付くのは人間側。気付いたら手動で介入する（パス取り違えを Claude に伝え直す等）。将来、ブロック方式に切り替えたい場合は exit 2 へ変更する。
