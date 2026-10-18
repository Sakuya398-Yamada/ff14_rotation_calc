---
paths:
  - ".claude/routines/**"
---

# 定期ルーティン（`.claude/routines/`）

frontmatter の `paths:` により、`.claude/routines/` 配下を Read / Edit / Write したときだけ読み込まれる。

Claude Desktop のスケジュールタスクとして、次の 3 つのルーティンを登録している。

| taskId | タイトル | 実行 | 定義 | 実行ログ |
|--------|---------|------|------|---------|
| `weekly` | 【毎週日曜】Issue 起票ルーティン | 毎週日曜 22:00（`0 22 * * 0`） | `.claude/routines/weekly.md` | #448 |
| `daily-triage` | 【毎日】Issue トリアージルーティン | 毎日 19:00（`0 19 * * *`。`weekday-issue-start` より前に走らせ、付けた priority をその日の選定に反映させる） | `.claude/routines/daily-triage.md` | #448 |
| `weekday-issue-start` | 【平日】Issue 自動着手ルーティン | 毎日 19:30（`30 19 * * *`。名前に反して土日も実行する） | `.claude/routines/weekday-issue-start.md` | #448 |

- **リポジトリ側（`.claude/routines/<taskId>.md`）が正**。登録先のプロンプト（`C:\Users\Sakuya\.claude\scheduled-tasks\<taskId>\SKILL.md`）はリポジトリの外にあり、OS の再インストール等で失われる（#442）
- **プロンプトやスケジュールを変えたら両方を更新する**: リポジトリ側を PR で直し、登録側は `update_scheduled_task`（`prompt` / `cronExpression` / `description`）で同じ内容にする
  - 同期したら、本文が一致したかをリポジトリ直下の Git Bash で確かめる。frontmatter は両側で形式が違う（リポジトリ側は `taskId` / `title` / `schedule` / `description`、登録側は `name` / `description`）ので、frontmatter・CRLF・先頭の空行を除いた本文同士を比べる。差分が無ければ `<taskId>: 一致` と出る（どちらかのファイルが無ければ `ls` のエラーで止まる）。`description` とスケジュールは比べないので、別に目で確かめる

    ```bash
    t=<taskId>
    body() { sed 's/\r$//' "$1" | awk 'fm < 2 { if ($0 == "---") fm++; next } !s && $0 == "" { next } { s = 1; print }'; }
    ls ".claude/routines/$t.md" "$HOME/.claude/scheduled-tasks/$t/SKILL.md" >/dev/null &&
      diff <(body ".claude/routines/$t.md") <(body "$HOME/.claude/scheduled-tasks/$t/SKILL.md") && echo "$t: 一致"
    ```

  - PR のマージ前に同期した場合、レビューで本文が変わったら登録側を同期し直し、上のコマンドでもう一度確かめる
- **消えたら再登録する**: `create_scheduled_task` に、ファイルの frontmatter の `taskId` / `title` / `description`、`schedule` を `cronExpression`、frontmatter を除いた本文を `prompt` として渡す
- **実行報告は実行ログ Issue #448（`meta: ルーティン実行ログ`）にコメントで残す**（1 実行 1 コメント。#447 で事前承認済み）。「起票候補」「知見ボード候補」「要追記」「要還元（ユーザー）」「取り込み待ち」「テンプレート更新あり」「優先度の付け直し案」「routine-ok を付ける候補」のように人が動く項目はここで追う。人は読んで対応し、必要なら ✅ を付ける。投稿できなかった実行はセッションにだけ報告が残る
- ルーティンの定義（`.claude/routines/<taskId>.md`）は `.claude/rules/` には置かない（起動時に自動で読み込まれ、常駐コンテキストが増えるため）
- `weekly` の本文の見出しと実行報告の見出しにある `weekly-issue-intake` は、taskId `weekly` の旧名。登録済みのプロンプトと揃えるため、そのまま残している
