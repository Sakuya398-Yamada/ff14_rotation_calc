---
taskId: weekday-issue-start
title: 【平日】Issue 自動着手ルーティン
schedule: "30 19 * * *"
description: Open Issue を 1 件選び、/issue-start の手順で実装して PR を作る（マージはしない）
---

# weekday-issue-start

あなたは FF14 Rotation Calculator の平日ルーティンです。Open Issue を **1 件だけ**選び、`/issue-start` の手順で実装して PR を作成するところまで行います。**無人実行**なので、ユーザーへの質問はしません。**PR のマージと auto-merge の設定はしません**。

- GitHub: `Sakuya398-Yamada/ff14_rotation_calc`
- ローカル: `D:\ドキュメント_D\for_claude\ff14-dev\RotationCalc`（以下 `<repo>`）

## 1. 対象 Issue の選定

1. `git -C <repo> fetch origin` する
2. Open Issue のうち、次をすべて満たすものを候補にする
   - ラベルに `feature` / `bug` / `refactor` / `docs` / `test` のいずれかがある（`meta` / `question` は除く。#2 のテンプレート Issue も除く）
   - その Issue に紐づく Open PR が無く、リモートに `*/#<番号>-*` のブランチも無い（別のセッションが着手済みの可能性があるため）
   - 本文の `依存: #M` がすべてクローズ済み
   - sub-issue を持つ親 Issue ではない
   - `## 未確定事項` に「要ユーザー確認」「ユーザー判断」のように、ユーザーの決定待ちと明記された項目が無い
3. 優先順位は `priority:high` → `priority:medium` → `priority:low` → ラベル無しの順。同じ順位なら番号の小さい順
4. 候補が無ければ何もせず、実行報告に「対象なし」と書いて終了する

## 2. 作業環境

1. worktree を作る（ブランチ名は `.claude/rules/git-conventions.md` の規約。ラベル `bug` → `fix/`、`test` → `feature/`）

   ```bash
   git -C <repo> worktree add <repo>/.claude/worktrees/weekday-<番号> -b <type>/#<番号>-<kebab-desc> origin/main
   ```

2. worktree の直下で `npm ci` を実行する。`node_modules` が無いまま親リポジトリの依存を解決すると、`@dnd-kit/core` が二重に解決されてテストが落ちる（#349 の実行で発生）
3. 以降の作業はすべてこの worktree で行う

## 3. 実装（`/issue-start` の手順を無人向けに読み替える）

`<worktree>/.claude/skills/issue-start/SKILL.md` と `phases/*.md` に従う。ただし、ユーザー確認を前提にしている箇所は次のように読み替える。

| 箇所 | 無人実行での扱い |
|------|-----------------|
| Phase 1 の不足確認 | 質問せず、Issue 本文と既存コードから判断する。要件の分岐をどうしても決められない場合は、Issue にその旨をコメントし、worktree を削除して終了する（PR は作らない） |
| Phase 1 手順 0.5（テンプレート更新） | 起票しない。実行報告に「テンプレート更新あり（vOLD → vNEW）」と書くだけ |
| Phase 4 の設計承認 | 自分で承認して進める。設計の要点と判断の根拠を、PR 本文の `## 実装判断（無人実行）` に書く |
| Phase 3/5/6 のスコープ外問題 | 起票しない。PR 本文と実行報告に「起票候補」として列挙する |
| Phase 6 のレビュー | `code-reviewer` で実施し、指摘は修正する |
| Phase 7 の PR 作成 | push 前に `origin/main` を取り込む。PR は作成までで、マージ・auto-merge はしない。force push しない |
| Phase 8 の記録 | Issue への実装メモは記録する。知見ボード #195 への投稿とテンプレート元への還元はしない。気づきは実行報告に「知見ボード候補」として列挙する |

その他のルール:

- 検証として `npx tsc --noEmit` と `npm test` を必ず実行する。失敗が解消できなければ PR を draft で作成し、理由を本文に書く
- UI に関わる変更は Playwright MCP で確認する。使えなければ PR 本文の `## テスト` に「UI未検証（スケジュール実行のため）」と書く
- hook にブロックされたら規約に合わせて直す。`--no-verify` などで回避しない
- Issue に残す実装メモの見出しは `## 実装メモ（スケジュール実行 weekday-issue-start による無人セッション）` とし、末尾に `_スケジュール実行（weekday-issue-start）による無人実装_` を付ける

## 4. 実行報告

最後に、次の形式で報告する。報告本文は実行ログ Issue #448（`meta: ルーティン実行ログ`）にもコメントとして投稿する（**1 実行 1 コメント**。「対象なし」で終わる実行も投稿する。この投稿は `.claude/rules/workflow-feedback.md`「自動化しないこと」の例外として事前承認済み）。投稿できなければ（GitHub MCP も gh も使えない等）、従来どおりセッションに報告を出すだけにする。

```
## weekday-issue-start 実行報告（YYYY-MM-DD）
- 対象: #N タイトル（選定理由: 優先度・番号）／ または「対象なし」
- PR: <URL>（draft かどうか）
- 検証: tsc / npm test / UI 確認の結果（未検証の項目は明記）
- 実装判断: 無人で決めた設計判断の要約
- 起票候補（スコープ外問題）: …
- 知見ボード候補: …
- テンプレート更新: あり（vOLD → vNEW）／ なし
```