---
paths:
  - ".claude/routines/**"
---

# 定期ルーティン（`.claude/routines/`）

frontmatter の `paths:` により、`.claude/routines/` 配下を Read / Edit / Write したときだけ読み込まれる。

Claude Desktop のスケジュールタスクとして、次の 2 つのルーティンを登録している。

| taskId | タイトル | 実行 | 定義 | 実行ログ |
|--------|---------|------|------|---------|
| `weekly` | 【毎週日曜】Issue 起票ルーティン | 毎週日曜 22:00（`0 22 * * 0`） | `.claude/routines/weekly.md` | #448 |
| `weekday-issue-start` | 【平日】Issue 自動着手ルーティン | 毎日 19:30（`30 19 * * *`。名前に反して土日も実行する） | `.claude/routines/weekday-issue-start.md` | #448 |

- **リポジトリ側（`.claude/routines/<taskId>.md`）が正**。登録先のプロンプト（`C:\Users\Sakuya\.claude\scheduled-tasks\<taskId>\SKILL.md`）はリポジトリの外にあり、OS の再インストール等で失われる（#442）
- **プロンプトやスケジュールを変えたら両方を更新する**: リポジトリ側を PR で直し、登録側は `update_scheduled_task`（`prompt` / `cronExpression` / `description`）で同じ内容にする
- **消えたら再登録する**: `create_scheduled_task` に、ファイルの frontmatter の `taskId` / `title` / `description`、`schedule` を `cronExpression`、frontmatter を除いた本文を `prompt` として渡す
- **実行報告は実行ログ Issue #448（`meta: ルーティン実行ログ`）にコメントで残す**（1 実行 1 コメント。#447 で事前承認済み）。「起票候補」「知見ボード候補」「要追記」「要還元（ユーザー）」「取り込み待ち」「テンプレート更新あり」のように人が動く項目はここで追う。人は読んで対応し、必要なら ✅ を付ける。投稿できなかった実行はセッションにだけ報告が残る
- ルーティンの定義（`.claude/routines/<taskId>.md`）は `.claude/rules/` には置かない（起動時に自動で読み込まれ、常駐コンテキストが増えるため）
- `weekly` の本文の見出しと実行報告の見出しにある `weekly-issue-intake` は、taskId `weekly` の旧名。登録済みのプロンプトと揃えるため、そのまま残している
