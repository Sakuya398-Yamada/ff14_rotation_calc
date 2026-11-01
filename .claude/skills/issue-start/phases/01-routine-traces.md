# Phase 1 補助: 日次ルーティン（`weekday-issue-start`）が残したものの扱い

`phases/01-issue-analysis.md` から読む。手順 2 でリモートに `*/#<番号>-*` のブランチが見つかったときと、「不足時の対応」で `needs-decision` の Issue の決定を得たときに使う。どちらもテンプレートには無いプロジェクト固有の手順で、Phase 1 の本体が Bash の出力上限を超えないよう分けてある。

## リモートに Issue ブランチがあるとき

日次の `weekday-issue-start` が実装中（毎日 19:30 の実行から PR を作るまで。同ルーティンは Phase 1 を終えた後、Phase 2 のブランチ作成で Issue ブランチを push する。`.claude/routines/weekday-issue-start.md`「4. 実装」の表「Phase 2 のブランチ作成」）か、途中で落ちた実行・過去の試行の残り。ブランチ名を添えて、続けて着手してよいかユーザーに確認する（ルーティンの実行中なら、続けると同じ Issue に PR が 2 本できることも添える）。続けるなら、そのブランチは再利用せず、`phases/01-existing-pr-branch.md`「オープンな旧 PR／既存ブランチがある場合」の作り直しと同じく別名（`-v2` 等）で切る。ルーティンの実行中かどうかはこちらから見分けられず、再利用すると同じブランチに 2 つのセッションが push することがあるため

## `needs-decision` の Issue で決定を得たとき

ラベル `needs-decision` は、日次の `weekday-issue-start` が要件の分岐を決められずに付けたもの（決められなかった点は Issue のコメントにある）。付いている間はルーティンの選定から外れ続けるので、このセッションで質問して決定を得たら、このセッションで次を行う:

1. 決定と根拠を Issue にコメントする（`add_issue_comment`。どの問いに何を決めたか、その理由）
2. `needs-decision` を外す。GitHub MCP の `issue_write`（method: `update`）の `labels` はラベル全体を置き換えるので、送る直前に取り直したラベルから `needs-decision` だけを除いた配列を渡す。`gh` なら `gh api -X DELETE repos/{owner}/{repo}/issues/<番号>/labels/needs-decision`
3. 本文の `## 未確定事項` に `[要確認]` の行が残っていれば、`[要確認]` を外して決定を書き、手順 1 のコメントへのリンクを添える書き換え案を、Phase 1.5「補完結果の確認」に含めて聞く（本文の更新はユーザーの確認を得てから）。行が残ると、ラベルを外してもルーティンは決定待ちとして選ばない
