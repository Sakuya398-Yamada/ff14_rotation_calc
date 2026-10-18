---
paths:
  - ".claude/routines/**"
---

# 定期ルーティン（`.claude/routines/`）

frontmatter の `paths:` により、`.claude/routines/` 配下を Read / Edit / Write したときだけ読み込まれる。

クラウドのスケジュールタスク（claude.ai/code/routines）として、次の 3 つのルーティンを登録している。登録側のプロンプトは、リポジトリの手順書を読んで実行するだけの呼び出し文（後述「呼び出し文」）で、手順そのものは持たない。読み出しは、クラウドセッションなら claude-code-remote の `get_trigger` でもできる。

| taskId | スケジュールタスク ID | タイトル | 実行 | 定義 | 実行ログ |
|--------|---------------------|---------|------|------|---------|
| `weekly` | `trig_01UGYMPDENKPMarxxPoNaJUy` | 【毎週日曜】Issue 起票ルーティン | 毎週日曜 22:00（`0 22 * * 0`） | `.claude/routines/weekly.md` | #448 |
| `daily-triage` | `trig_01WDcE3373n9xzeVmxezPkGT` | 【毎日】Issue トリアージルーティン | 毎日 19:00（`0 19 * * *`。`weekday-issue-start` より前に走らせ、付けた priority をその日の選定に反映させる） | `.claude/routines/daily-triage.md` | #448 |
| `weekday-issue-start` | `trig_01NZxoPENhC3YpRXu2dojgpc` | 【平日】Issue 自動着手ルーティン | 毎日 19:30（`30 19 * * *`。名前に反して土日も実行する） | `.claude/routines/weekday-issue-start.md` | #448 |

- **リポジトリ側（`.claude/routines/<taskId>.md`）が正**。登録先のプロンプトはリポジトリの外にあり、版管理されない（#442）。そのため登録側には手順を書かず、実行のたびに `origin/main` の手順書を読ませる（#567）
- 登録先との対応: スケジュールタスクの名前は frontmatter の `title`、プロンプトは「呼び出し文」の `<taskId>` を埋めたもの、cron は `schedule` の前に `CRON_TZ=Asia/Tokyo ` を付けた形（`schedule` は日本時間の値で、TZ を書かない）。`description` はクラウド側に欄が無いので、リポジトリ内の説明として持つだけ
- **手順を変えるときは PR だけで直し、登録側は触らない**。呼び出し文が実行のたびに `origin/main` の手順書を読むので、マージした次の実行から効く
  - 注意: 本文の PR は、マージした時点で次の無人実行に効く（ブランチにあるうちは効かない）。次の実行で困らない状態にしてからマージする
- **登録側を直すのは、名前・スケジュール・呼び出し文を変えるときだけ**: リポジトリ側（frontmatter の `title` / `schedule`、「呼び出し文」の節）を PR で直し、登録側は Web UI のスケジュールタスクの Edit（`https://claude.ai/code/routines/<表の ID>`）で人が同じ内容に直す。直したら「呼び出し文のままかを確かめる」で照合する。クラウドセッションの `update_trigger` は、エージェントが `create_trigger` で作ったスケジュールタスクにしか使えない。表の 3 件は Web UI で作ったもの（作り直したものも同じ）なので、`this routine was created via "http_api"` で拒否される
- **実行報告は実行ログ Issue #448（`meta: ルーティン実行ログ`）にコメントで残す**（1 実行 1 コメント。#447 で事前承認済み）。「起票候補」「知見ボード候補」「要追記」「要還元（ユーザー）」「取り込み待ち」「テンプレート更新あり」「優先度の付け直し案」「routine-ok を付ける候補」のように人が動く項目はここで追う。人は読んで対応し、必要なら ✅ を付ける。投稿できなかった実行はセッションにだけ報告が残る
- ルーティンの定義（`.claude/routines/<taskId>.md`）は `.claude/rules/` には置かない（起動時に自動で読み込まれ、常駐コンテキストが増えるため）

## 呼び出し文

登録側のプロンプトの正本。3 本で共通の文面で、違うのは taskId だけ（下の `<taskId>` の 3 か所）。

```text
# <taskId>

あなたは FF14 Rotation Calculator の定期ルーティン `<taskId>` です。手順の正本はリポジトリ側にあり、この登録プロンプトには書きません。

1. 作業ディレクトリのリポジトリ（`Sakuya398-Yamada/ff14_rotation_calc`）で `git fetch origin main` を実行する
2. `git show origin/main:.claude/routines/<taskId>.md` で手順書を読む。先頭の frontmatter（最初の 2 つの `---` 行で囲まれた部分）を除いた本文を、このルーティンの手順として最後まで実行する
3. 手順書を読めなかったときは、ほかの作業はせず、読めなかった理由を実行ログ Issue #448 にコメントして終了する
```

## 呼び出し文のままかを確かめる

登録側を直したとき・作り直したとき、または書き換わりを疑うときに、登録側のプロンプトが呼び出し文と一致するかを確かめる。クラウド側のプロンプトをファイルに書き出す手段は無い（CLI にも公開 API にも無い）ので、JSON 文字列のまま写してからデコードして比べる。

1. `get_trigger`（`trigger_id` に表の ID）で読み、`derived_state.prompt` の JSON 文字列を、エスケープ（`\n` 等）を戻さずにそのまま `{"p": "<文字列>"}` の形で scratchpad の `cloud-<taskId>.json` に Write する。ローカルのセッションでは、Web UI の Edit 画面のプロンプトを人がコピーして `cloud-<taskId>.txt` に貼り、`sed 's/\r$//' "<scratchpad>/cloud-<taskId>.txt" | jq -Rs '{p: .}' > "<scratchpad>/cloud-<taskId>.json"` で同じ形にする
2. リポジトリ直下で次を実行する。`expected` は上の「呼び出し文」の節からフェンスの中身を抜き出し、`<taskId>` を埋める。差分が無ければ `<taskId>: 一致` と出る（ファイルが無ければ `ls` のエラーで止まる）。末尾の改行の有無は比べない（登録側には付いているものと無いものがある）

   ```bash
   t=<taskId>; c="<scratchpad>/cloud-$t.json"
   expected() { sed 's/\r$//' .claude/rules/routines.md | awk '/^```text$/ { f = 1; next } f && /^```$/ { exit } f' | sed "s/<taskId>/$1/g"; }
   ls "$c" >/dev/null &&
     diff <(printf '%s\n' "$(expected "$t")") <(printf '%s\n' "$(jq -j .p "$c")") && echo "$t: 一致"
   ```

3. 名前と cron は比べないので、`get_trigger` の `name` / `cron_expression`（ローカルのセッションでは Web UI の詳細画面の名前と時刻）を、表のタイトルと `CRON_TZ=Asia/Tokyo <schedule>` と目で照らす

## 消えたら作り直す

Web UI（claude.ai/code/routines の New routine）で、名前・プロンプト・時刻（日本時間）を「登録先との対応」どおりに入れ、リポジトリに `Sakuya398-Yamada/ff14_rotation_calc` を選ぶ（クラウドセッションの `create_trigger` にはリポジトリを指定する引数が無い）。プロンプトに貼る呼び出し文は、上の手順 2 の `expected` を定義してから `expected <taskId> > "<scratchpad>/paste-<taskId>.md"` で書き出し、人に渡す。作り直したら表のスケジュールタスク ID を書き換え、「呼び出し文のままかを確かめる」で一致を確かめる
