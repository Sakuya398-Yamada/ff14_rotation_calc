---
paths:
  - ".claude/routines/**"
---

# 定期ルーティン（`.claude/routines/`）

frontmatter の `paths:` により、`.claude/routines/` 配下を Read / Edit / Write したときだけ読み込まれる。

クラウドのスケジュールタスク（claude.ai/code/routines）として、次の 3 つのルーティンを登録している。書き換えは Web UI で人が行う。読み出しは、クラウドセッションなら claude-code-remote の `get_trigger` でもできる。

| taskId | スケジュールタスク ID | タイトル | 実行 | 定義 | 実行ログ |
|--------|---------------------|---------|------|------|---------|
| `weekly` | `trig_01UGYMPDENKPMarxxPoNaJUy` | 【毎週日曜】Issue 起票ルーティン | 毎週日曜 22:00（`0 22 * * 0`） | `.claude/routines/weekly.md` | #448 |
| `daily-triage` | `trig_01WDcE3373n9xzeVmxezPkGT` | 【毎日】Issue トリアージルーティン | 毎日 19:00（`0 19 * * *`。`weekday-issue-start` より前に走らせ、付けた priority をその日の選定に反映させる） | `.claude/routines/daily-triage.md` | #448 |
| `weekday-issue-start` | `trig_01NZxoPENhC3YpRXu2dojgpc` | 【平日】Issue 自動着手ルーティン | 毎日 19:30（`30 19 * * *`。名前に反して土日も実行する） | `.claude/routines/weekday-issue-start.md` | #448 |

- **リポジトリ側（`.claude/routines/<taskId>.md`）が正**。登録先のプロンプトはリポジトリの外にあり、版管理されない（#442）
- 登録先との対応: スケジュールタスクの名前は frontmatter の `title`、プロンプトは frontmatter を除いた本文、cron は `schedule` の前に `CRON_TZ=Asia/Tokyo ` を付けた形（`schedule` は日本時間の値で、TZ を書かない）。`description` はクラウド側に欄が無いので、リポジトリ内の説明として持つだけ
- **プロンプトやスケジュールを変えたら両方を更新する**: リポジトリ側を PR で直し、登録側は Web UI のスケジュールタスクの Edit（`https://claude.ai/code/routines/<表の ID>`）で人が同じ内容に貼り替える（スケジュールを変えたら時刻も）。クラウドセッションの `update_trigger` は、エージェントが `create_trigger` で作ったスケジュールタスクにしか使えない。表の 3 件は Web UI で作ったもの（作り直したものも同じ）なので、`this routine was created via "http_api"` で拒否される
  - 貼り替え用の本文は、下の手順 2 の `body()` を定義してから `body .claude/routines/<taskId>.md > "<scratchpad>/paste-<taskId>.md"` で frontmatter を除いて書き出し、人に渡す
  - 同期したら、本文が一致したかを確かめる。クラウド側のプロンプトをファイルに書き出す手段は無い（CLI にも公開 API にも無い）ので、書き写してから diff する
    1. `get_trigger`（`trigger_id` に表の ID）で読んだら、**リポジトリ側のファイルを開く前に**、`derived_state.prompt` の文字列を scratchpad の `cloud-<taskId>.md` に Write でそのまま書き写す（JSON のエスケープは戻す）。書き写しの誤りは次の diff に出るが、リポジトリ側を先に読むとその文面に寄った写し方になり、違いを見逃しうる。同じセッションでルーティンを直した直後は、リポジトリ側の文面がもう会話にあるのでこの防ぎ方は効きにくい。気になるなら新しいセッションで確かめ直す。ローカルのセッションでは、Web UI の Edit 画面のプロンプトを人がコピーしてこのファイルに貼る
    2. リポジトリ直下で次を実行する。frontmatter・CRLF・先頭の空行を除いた本文同士を比べ、差分が無ければ `<taskId>: 一致` と出る（どちらかのファイルが無ければ `ls` のエラーで止まる）。frontmatter を外すのはリポジトリ側だけ。クラウド側には frontmatter が無く、`body()` に通すと 2 つ目の `---` の行を待って全行を捨て、空になる

       ```bash
       t=<taskId>; c="<scratchpad>/cloud-$t.md"
       body() { sed 's/\r$//' "$1" | awk 'fm < 2 { if ($0 == "---") fm++; next } !s && $0 == "" { next } { s = 1; print }'; }
       cloud() { awk '{ sub(/\r$/, "") } !s && $0 == "" { next } { s = 1; print }' "$1"; }
       ls ".claude/routines/$t.md" "$c" >/dev/null &&
         diff <(body ".claude/routines/$t.md") <(cloud "$c") && echo "$t: 一致"
       ```

    3. 名前と cron は比べないので、`get_trigger` の `name` / `cron_expression`（ローカルのセッションでは Web UI の詳細画面の名前と時刻）を、表のタイトルと `CRON_TZ=Asia/Tokyo <schedule>` と目で照らす
  - PR のマージ前に同期した場合、レビューで本文が変わったら登録側を同期し直し、上の手順でもう一度確かめる
- **消えたら作り直す**: Web UI（claude.ai/code/routines の New routine）で、名前・プロンプト・時刻（日本時間）を上の対応どおりに入れ、リポジトリに `Sakuya398-Yamada/ff14_rotation_calc` を選ぶ（クラウドセッションの `create_trigger` にはリポジトリを指定する引数が無い）。作り直したら表のスケジュールタスク ID を書き換え、上の手順で一致を確かめる
- **実行報告は実行ログ Issue #448（`meta: ルーティン実行ログ`）にコメントで残す**（1 実行 1 コメント。#447 で事前承認済み）。「起票候補」「知見ボード候補」「要追記」「要還元（ユーザー）」「取り込み待ち」「テンプレート更新あり」「優先度の付け直し案」「routine-ok を付ける候補」のように人が動く項目はここで追う。人は読んで対応し、必要なら ✅ を付ける。投稿できなかった実行はセッションにだけ報告が残る
- ルーティンの定義（`.claude/routines/<taskId>.md`）は `.claude/rules/` には置かない（起動時に自動で読み込まれ、常駐コンテキストが増えるため）
- `weekly` の本文の見出しと実行報告の見出しにある `weekly-issue-intake` は、taskId `weekly` の旧名。登録済みのプロンプトと揃えるため、そのまま残している
