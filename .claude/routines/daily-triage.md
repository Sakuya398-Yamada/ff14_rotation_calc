---
taskId: daily-triage
title: 【毎日】Issue トリアージルーティン
schedule: "0 19 * * *"
description: priority:* の無い Open Issue に優先度を付け、着手順のおすすめを実行ログに出す（実装・起票はしない）
---

# daily-triage

あなたは FF14 Rotation Calculator の日次 Issue トリアージルーティンです。**無人実行**なので、ユーザーへの質問はせず、判断できないものはラベルを付けずに実行報告へ回してください。

- GitHub: `Sakuya398-Yamada/ff14_rotation_calc`
- ローカル: `D:\ドキュメント_D\for_claude\ff14-dev\RotationCalc`（以下 `<repo>`）

## 共通ルール

1. `<repo>` の `CLAUDE.md` と `.claude/rules/*.md` に従う
2. 最初に `git -C <repo> fetch origin` する。区分と優先度の判定基準は `origin/main` の `/issue-priority` skill を読んで使う（`git -C <repo> show origin/main:.claude/skills/issue-priority/SKILL.md`。`<repo>` の作業ツリーは `origin/main` より古いことがある）。skill が参照する `.claude/routines/weekday-issue-start.md`（区分「ルーティン向け」の条件）も同じく `git -C <repo> show origin/main:<path>` で読み、skill 手順 1-3 の `git ls-remote` はカレントディレクトリを `<repo>` にして実行する。**作業ツリーの変更・ブランチ作成・コミット・PR はしない**
3. GitHub 操作は GitHub MCP を使い、使えなければ gh（`/c/Program Files/GitHub CLI/gh.exe`）にフォールバックする。ただし手順 3 のラベル付与は gh を先に使う（理由は手順 3-5）
4. 書き込みは次の 2 つだけ。どちらも `.claude/rules/workflow-feedback.md`「自動化しないこと」の例外として事前承認済み（#501 / #447）
   - 手順 3 の `priority:*` の付与
   - 手順 5 の実行ログ Issue #448 への実行報告

   起票、Issue 本文・コメントの編集、`priority:*` 以外のラベルの追加・削除はしない

## 1. 集めて要約する

`/issue-priority` の手順 1・2 を、引数なし（Open Issue 全件）として行う。本文とコメントは手順 2 の委譲プロンプトのまま `general-purpose` エージェントに任せ、要約だけ受け取る（自分で丸読みしない）。

## 2. 区分と優先度を判定する

- 全件に `/issue-priority` 手順 3 の区分（進行中／ルーティン向け／人がいるセッション向け）を付ける
- `priority:*` が無い Issue だけ、手順 4 で優先度の案を出す。付いている Issue は今のラベルをそのまま使う（付け直しの案は週次 `weekly` の系統5 が出す）

## 3. priority を付ける（新着のみ）

1. 対象（ここでいう「新着」）は、次をすべて満たす Issue
   - `priority:*` が付いていない
   - `meta` / `question` ラベルの Issue と #2 のテンプレート Issue ではない
   - 手順 2 の区分が「進行中」ではない
2. **`priority:*` が付いている Issue と、進行中（Open PR・作業ブランチ・「## 着手」の印がある）の Issue のラベルは変えない**
3. 1 回の実行で付けるのは **10 件まで**。案が high → medium → low の順、同じ優先度なら番号の小さい順に付け、超えた分は実行報告の「見送り」に案を添えて書く（次の実行で付ける）
4. 付ける直前に `gh issue view <N> -R Sakuya398-Yamada/ff14_rotation_calc --json state,labels` で取り直し、Closed になっていたり `priority:*` が付いていたりしたら触らない
5. `gh issue edit <N> -R Sakuya398-Yamada/ff14_rotation_calc --add-label priority:<high|medium|low>` で付ける（追加だけなので他のラベルを落とさない）。GitHub MCP の `issue_write`（method: `update`）を使うときは、`labels` がラベル全体を置き換えるので、手順 3-4 で取り直したラベルに新しい `priority:*` を 1 つ足した配列を渡す

## 4. 着手順のおすすめを選ぶ

1. 手順 3 で付けたあとのラベルで、進行中を除く Issue を `priority:high` → `priority:medium` → `priority:low` → ラベル無し（見送り分）の順に並べる。同じ優先度の中は、塞いでいる後続の Open Issue が多い順、次に番号の小さい順
2. 依存先が Open の Issue（依存待ち）は今は着手できないので除き、上から **3 件** をおすすめにする。区分（ルーティン向け／人がいるセッション向け）は問わず、表の列に書く
3. 理由は `/issue-priority` 手順 4・5 の言い回しで書く（後続 N 件の起点、依存は解消済み、要判断: …、など）

## 5. 実行報告

最後に、次の形式で報告する。報告本文は実行ログ Issue #448（`meta: ルーティン実行ログ`）にもコメントとして投稿する（**1 実行 1 コメント**。付与が 0 件の実行も投稿する）。投稿できなければ（GitHub MCP も gh も使えない等）、セッションに報告を出すだけにする。

```
## daily-triage 実行報告（YYYY-MM-DD）
### 付与した priority（新着 N 件中 M 件）
| Issue | 付与 | 区分 | 理由 |
|-------|------|------|------|
| #N タイトル | priority:high | 人がいるセッション向け | 後続 #M を塞いでいる、依存は解消済み |
- 付けなかった新着: #N（理由: 手順 3-4 で Closed／付与済み、判断できず: …）… ／ なし
- 見送り（1 回 10 件の上限超過）: #N（案: medium）… ／ なし
### 着手順のおすすめ（上位 3 件）
| 順 | Issue | priority | 区分 | 理由 |
|----|-------|----------|------|------|
| 1 | #N タイトル | high | 人がいるセッション向け | 後続 N 件の起点／要判断: … |
### 注記
- weekday-issue-start が動いていれば次に選ぶ見込み: #N タイトル（ルーティン向けの 1 番目）／ 候補なし
- 進行中: #N（PR #M、マージ可能）… ／ なし
- ファイルが重なる組み合わせ・依存とリスクの食い違い: … ／ なし
- テンプレート更新: SessionStart のバナーに更新ありと出ていれば「あり（vOLD → vNEW）」と記載するだけで、起票はしない
```
