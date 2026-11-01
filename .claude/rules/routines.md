---
paths:
  - ".claude/routines/**"
---

# 定期ルーティン（`.claude/routines/`）

frontmatter の `paths:` により、`.claude/routines/` 配下を Read / Edit / Write したときだけ読み込まれる。ルーティンの実行（呼び出し文が `git show` で手順書を読む）ではこのファイルは読み込まれないので、手順書は要る節をここから読むように書く。

Claude Code のクラウドのスケジュールタスク（claude.ai/code の Routines）で回すルーティンの一覧・呼び出し文・実行ログと、ルーティンに事前に承認した書き込みをまとめる。人が行うセットアップの手順は、テンプレート元の `routines-guide.md` にある。スケジュールタスクは research preview の機能で、仕様が変わり得る。

## ルーティンの一覧

| taskId | スケジュールタスク ID | タイトル | 実行 | 定義 |
|--------|---------------------|---------|------|------|
| `daily-triage` | `trig_01WDcE3373n9xzeVmxezPkGT` | 【毎日】Issue トリアージルーティン | 毎日 19:00（`CRON_TZ=Asia/Tokyo 0 19 * * *`） | `.claude/routines/daily-triage.md` |
| `weekly` | `trig_01UGYMPDENKPMarxxPoNaJUy` | 【毎週日曜】Issue 起票ルーティン | 毎週日曜 22:00（`CRON_TZ=Asia/Tokyo 0 22 * * 0`） | `.claude/routines/weekly.md` |
| `weekday-issue-start`（任意） | `trig_01NZxoPENhC3YpRXu2dojgpc` | 【平日】Issue 自動着手ルーティン | 毎日 19:30（`CRON_TZ=Asia/Tokyo 30 19 * * *`。`daily-triage` より後に走らせ、付けた priority をその日の選定に効かせる。名前に反して土日も実行する） | `.claude/routines/weekday-issue-start.md` |

- 動くのは、スケジュールタスクに登録したものだけ。手順書を置いてあっても、登録していないルーティンは動かない
- `weekday-issue-start` は任意の機能。使うのは、人が `routine-ok` ラベルを付けた Issue を無人で PR まで進めたいプロジェクトだけ（ラベル `routine-ok` / `needs-decision` を作ってから登録する。テンプレート元の `routines-guide.md`「`weekday-issue-start` を使う場合」）

## 管理用の Issue

- **実行ログ**: #448（`meta: ルーティン実行ログ`）。各ルーティンが 1 実行 1 コメントで実行報告を残す。起票候補・要追記・要還元・取り込み待ちのように人が動く項目はここで追い、人が読んで対応する。常時 Open（クローズしない。ログのコメントも自動では整理しない）
- **メモ inbox**: #305（`meta: メモ inbox`）。人が思いついたことを 1 件 1 コメントで書き、`daily-triage` が Issue に整えて起票する。常時 Open
- 知見ボードの番号は `.claude/rules/workflow-feedback.md`「知見ボードIssue」にある

## 運用

- **リポジトリ側（`.claude/routines/<taskId>.md`）が正**。登録側のプロンプトはリポジトリの外にあり、版管理されない。そのため登録側には手順を書かず、実行のたびに `origin/main` の手順書を読ませる（後述「呼び出し文」）
- 登録先との対応
  - スケジュールタスクの名前: frontmatter の `title`
  - プロンプト: 「呼び出し文」の `<taskId>` を埋めたもの
  - cron: 一覧の `CRON_TZ=Asia/Tokyo <schedule>`（frontmatter の `schedule` にはタイムゾーンを書かない）
  - `description`: 登録側に欄が無いので、リポジトリ内の説明として持つだけ
- **手順を変えるときは PR だけで直し、登録側は触らない**。手順書の変更は、マージした次の実行から効く（ブランチにあるうちは効かない）。次の実行で困らない状態にしてからマージする
- **登録側を直すのは、名前・スケジュール・呼び出し文を変えるときだけ**
  - リポジトリ側（frontmatter・一覧・「呼び出し文」）を PR で直し、登録側は Web UI のスケジュールタスクの編集（`https://claude.ai/code/routines/<一覧の ID>`）で、人が同じ内容に直す。直したら「呼び出し文のままかを確かめる」で照合する
  - クラウドセッションの `update_trigger` は、エージェントが `create_trigger` で作ったスケジュールタスクにしか使えない（Web UI で作ったものは拒否される）。一覧の 3 件は Web UI で作ったもの（作り直したものも同じ）なので、`this routine was created via "http_api"` で拒否される
- ルーティンの手順書は `.claude/rules/` に置かない（起動時に読み込まれ、常駐が増えるため）

## 事前に承認した書き込み

`.claude/rules/workflow-feedback.md`「自動化しないこと」と、CLAUDE.md の確認ポイント（ユーザーの回答を得てから書き込む）の例外。ルーティンをスケジュールタスクに登録したことで、人が承認したものとして扱う。ここに無い書き込みは、ルーティンでもしない。

| 書き込み | ルーティン | 手順の正本 |
|---------|-----------|----------|
| 実行ログ Issue への実行報告（新規コメント。1 実行 1 コメント） | すべて | 各手順書の「実行報告」 |
| メモ inbox・知見ボードからの起票（重複を確かめ、件数の上限を守る。メモを分けて起票した Issue の間の依存は、本文の `依存: #N` と GitHub の依存関係（blocked by）の両方に付ける） | `daily-triage` | `.claude/routines/daily-triage.md`「共通ルール」5、「2.」 |
| コードスキャンとプロジェクト固有の系統からの起票（重複を確かめ、件数の上限を守る。コードスキャンの Issue には人のゲートの行を入れる。`priority:*` は付けない） | `weekly` | `.claude/routines/weekly.md`「共通ルール」6、「系統1」「系統2」 |
| メモ inbox・知見ボードのコメントの末尾への ✅ の印の追記（起票した元のコメントと、テンプレート更新の取り込みで回収した還元済みの知見） | `daily-triage` | `.claude/routines/daily-triage.md`「2.」「3.」 |
| `routine-ok` の付いた Issue 1 件の実装（Issue ブランチの作成と push、PR の作成。マージ・auto-merge・force push はしない）と、自分の PR への `origin/main` の取り込みの push | `weekday-issue-start` | `.claude/routines/weekday-issue-start.md`「1.」「3.」「4.」 |
| 候補の Issue への新規コメント（`needs-decision` を付けるときの理由と、Phase 8 の実装メモ）と、ラベル `needs-decision` の付与 | `weekday-issue-start` | `.claude/routines/weekday-issue-start.md`「2.」「4.」 |
| `priority:*` の無い Open Issue への `priority:*` の付与（進行中の Issue と、付いている priority は変えない） | `daily-triage` | `.claude/routines/daily-triage.md`「6. priority を付ける」 |

- テンプレート元への起票・コメント（還元）は、ルーティンではしない。還元が要る知見は実行報告の「要還元」に挙げ、人が `/issue-start` Phase 8 手順 6 の形で行う
- 既存の Issue には、`priority:*` と `needs-decision`（`weekday-issue-start` が付ける）以外のラベル（`routine-ok` を含む）を付けない・外さない（起票する Issue に種別のラベルを付けるのは、起票の一部）

## 呼び出し文

登録側のプロンプトの正本。ルーティンで共通の文面で、違うのは taskId だけ（下の `<taskId>` の 3 か所）。

```text
# <taskId>

あなたは FF14 Rotation Calculator の定期ルーティン `<taskId>` です。手順の正本はリポジトリ側にあり、この登録プロンプトには書きません。

1. 作業ディレクトリのリポジトリ（`Sakuya398-Yamada/ff14_rotation_calc`）で `git fetch origin main` を実行する
2. `git show origin/main:.claude/routines/<taskId>.md` で手順書を読む。先頭の frontmatter（最初の 2 つの `---` 行で囲まれた部分）を除いた本文を、このルーティンの手順として最後まで実行する
3. 手順書を読めなかったときは、ほかの作業はせず、読めなかった理由を実行ログ Issue #448 にコメントして終了する
```

## 呼び出し文のままかを確かめる

登録側を直したとき・作り直したとき、または書き換わりを疑うときに、登録側のプロンプトが呼び出し文と一致するかを確かめる。登録側のプロンプトをファイルに書き出す手段は無いので、JSON 文字列のまま写してからデコードして比べる。

1. 登録側のプロンプトを scratchpad の `cloud-<taskId>.json` に `{"p": "<文字列>"}` の形で置く
   - クラウドセッションで、このセッションから読めるスケジュールタスクなら: `get_trigger`（`trigger_id` に一覧の ID）の `derived_state.prompt` の JSON 文字列を、エスケープ（`\n` 等）を戻さずにそのまま `{"p": "<文字列>"}` の形で Write する
   - それ以外: Web UI の編集画面のプロンプトを人がコピーして `cloud-<taskId>.txt` に貼り、`sed 's/\r$//' "<scratchpad>/cloud-<taskId>.txt" | jq -Rs '{p: .}' > "<scratchpad>/cloud-<taskId>.json"` で同じ形にする
2. リポジトリ直下で次を実行する。`expected` は上の「呼び出し文」の節からフェンスの中身を抜き出し、`<taskId>` を埋める。差分が無ければ `<taskId>: 一致` と出る（ファイルが無ければ `ls` のエラーで止まる）。末尾の改行の有無は比べない

   ```bash
   t=<taskId>; c="<scratchpad>/cloud-$t.json"
   expected() { sed 's/\r$//' .claude/rules/routines.md | awk '/^```text$/ { f = 1; next } f && /^```$/ { exit } f' | sed "s/<taskId>/$1/g"; }
   ls "$c" >/dev/null &&
     diff <(printf '%s\n' "$(expected "$t")") <(printf '%s\n' "$(jq -j .p "$c")") && echo "$t: 一致"
   ```

3. 名前と cron は比べないので、登録側の名前と時刻を、frontmatter の `title` と一覧の `CRON_TZ=Asia/Tokyo <schedule>` と目で照らす

## 消えたら作り直す

Web UI（claude.ai/code の Routines の新規作成）で、名前・プロンプト・時刻を「登録先との対応」どおりに入れ、リポジトリに `Sakuya398-Yamada/ff14_rotation_calc` を選ぶ（クラウドセッションの `create_trigger` にはリポジトリを指定する引数が無い）。プロンプトに貼る呼び出し文は、上の手順 2 の `expected` を定義してから `expected <taskId> > "<scratchpad>/paste-<taskId>.md"` で書き出し、人に渡す。作り直したら一覧のスケジュールタスク ID を書き換え、「呼び出し文のままかを確かめる」で一致を確かめる
