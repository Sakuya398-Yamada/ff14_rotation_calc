---
taskId: weekday-issue-start
title: 【平日】Issue 自動着手ルーティン
schedule: "30 19 * * *"
description: routine-ok の付いた Open Issue を 1 件選び、/issue-start の手順で実装して PR を作る（マージはしない）。任意の機能で、登録したプロジェクトでだけ動く
---

# weekday-issue-start

あなたはこのリポジトリの日次の無人実装ルーティンです。人が `routine-ok` ラベルを付けた Open Issue から **1 件だけ**選び、`/issue-start` の手順で実装して PR を作成するところまで行います。**無人実行**なので、ユーザーへの質問はしません。**PR のマージと auto-merge の設定はしません**。

- 実行環境: クラウドのスケジュールタスク。実行のたびにリポジトリを clone し、その直下から、`main` から切った作業ブランチ（`claude/*` など）で起動する。以降の作業はすべてこのリポジトリ直下（以下 `<work>`）で行い、git と `gh` は `-C` を付けずに打つ
- このリポジトリの名前は書かない。`gh api` の `{owner}/{repo}` は、`gh` がカレントの git リモートから埋める
- **push 先**: 手順 1-3 では自分の PR の head ブランチに、手順 3 以降は手順 3-1 で作る Issue ブランチ（`<type>/<番号>-<kebab-desc>`）に push する。起動時に割り当てられた作業ブランチには push しない（Issue 番号がブランチ名に入らず、手順 1-4 と `/issue-start` Phase 1 手順 2 で作業中と分からなくなるため）
- 自分（このルーティン）が作った PR と Issue コメントは、末尾のフッター `_スケジュール実行（weekday-issue-start）による無人実装_` で識別する
- GitHub 操作は GitHub MCP を使い、使えなければ REST の `gh api repos/{owner}/{repo}/...` にフォールバックする。`gh issue` / `gh pr` などのサブコマンドは GraphQL を使うので、クラウドセッションでは 403 になる。使わない（`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは gh の GraphQL 系が使えない」）
- 最初に `git fetch origin` し、`git show origin/main:.claude/rules/routines.md` を読む（`paths:` 付きなので、`git show` で読む手順書では自動で読み込まれない）。実行ログ Issue の番号は「管理用の Issue」に、このルーティンに承認した書き込みは「事前に承認した書き込み」にある。書き込みはその `weekday-issue-start` の分だけにする

## 1. 事前点検（安全弁）

Issue を選ぶ前に、過去の実行が残した PR とブランチを点検する。Open PR が上限に達していても、手順 1-2〜1-4 は行う（人がレビュー中の PR を古くしないため）。

1. `git rev-parse --is-shallow-repository` が `true` なら、`git fetch --unshallow origin` で履歴を取り切る（浅いままだと、手順 1-3 で古い PR の head と `origin/main` の merge-base が見つからず、merge が `refusing to merge unrelated histories` で止まる）
2. **自分の Open PR** を取る（draft も含める）。本文にフッター `_スケジュール実行（weekday-issue-start）による無人実装_` が **単独の行として** ある PR だけを、自分の PR とみなす（人の PR も変更点の説明にこの文字列を引用することがあるので、本文に含むかどうかだけでは絞れない）。Open PR は人の PR も含めて全件を、ページごとに次で取る。1 行に、番号・draft・head ブランチ・自分の PR か、が出る。100 行出たら次のページへ進む（`--paginate` は 2 ページ目で止まるので使わない）。手順 1-4 で人の Open PR とも突き合わせるので、全件の出力を残しておく

   ```bash
   gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100&page=<N>" \
     --jq '.[] | [(.number | tostring), (.draft | tostring), .head.ref, ((.body // "") | test("(?m)^_スケジュール実行（weekday-issue-start）による無人実装_[[:space:]]*$") | tostring)] | @tsv'
   ```

   一覧には `mergeable` が無いので、自分の PR ごとに `gh api repos/{owner}/{repo}/pulls/<PR番号> --jq '{number, mergeable}'` で読む。`gh api` が使えなければ、GitHub MCP の `list_pull_requests`（`state: open`、`perPage: 100`）で全件を取り、`body` に同じ行がある PR を自分の PR とし、`pull_request_read`（method: `get`）で `mergeable` を読む
3. **conflict の解消**: `mergeable` が `false` の自分の PR ごとに、そのブランチへ `origin/main` を取り込み、conflict を解消して push する（触るのは手順 1-2 で絞った自分の PR だけ）。force push はしない

   ```bash
   git fetch origin "<head ブランチ>:refs/remotes/origin/<head ブランチ>"   # clone が main だけを取る設定でも head を取る
   git checkout --detach origin/<head ブランチ>
   git merge origin/main            # conflict で止まる → 該当ファイルを解消して git add <file>
   git commit --no-edit             # 件名は git が用意した Merge ... のまま
   # <work> の直下で、依存を導入してから（手順 3-2 と同じ）、手順 4「検証と UI の確認」のコマンドを通す
   git push origin HEAD:<head ブランチ>
   ```

   - 解消の判断がつかない、または検証が通らないときは push せず（コミット前なら `git merge --abort`）、実行報告の「conflict 解消」に `conflict 未解消: PR #N（理由）` と書く（解消は人が行う）
   - `mergeable` が `null`（GitHub が計算中）なら 30 秒ほど待って取り直す。それでも `null` なら触らず、`mergeable 未判定: PR #N` と書く
   - detached HEAD で作業するのは、PR ごとにローカルブランチを作らずに済ませるため
4. **取り残しブランチの報告**: リモートの Issue ブランチのうち、**Issue が Open で、そのブランチを head にした Open PR が無い**ものを、実行報告に挙げる（削除はしない。削除は人が判断する）。途中で落ちた実行の残りで（手順 4 の表「Phase 2 のブランチ作成」で先に push するので、PR を作る前に落ちた実行も残る）、その Issue は候補条件（リモートに `*/<番号>-*` のブランチが無い）により黙って選ばれなくなっている。クローズ済み Issue のブランチは多いので挙げない

   ```bash
   git ls-remote --heads origin | sed 's#.*refs/heads/##' | grep -E '^(feature|fix|refactor|docs)/[0-9]+-'
   ```

   番号ごとに Issue の状態（`gh api repos/{owner}/{repo}/issues/<番号> --jq .state`）を見て、Open PR の有無は手順 1-2 の全件の出力の head ブランチと突き合わせる（自分の PR に絞ったあとの一覧だけと突き合わせると、人が作った Open PR を見落とす）
5. **Open PR の上限**: 手順 1-2 の自分の PR の件数（draft 含む）が **5 件以上**（既定値。人がさばける PR の本数に合わせて変えてよい）なら、Issue の選定に進まず、実行報告の「対象」に `対象なし（Open PR 上限 5 件に到達）` と書いて終える

## 2. 対象 Issue の選定

1. 候補条件と確かめ方は、`origin/main` の `.claude/skills/issue-priority/routine-candidates.md`（`git show` で読む）の「候補条件」と「確かめ方」に従う（正本はそちら。ここに書き写さない）。`routine-ok` の付いた Issue が 0 件なら、手順 2-3 へ進む
2. **完了せずに閉じた依存先**: 依存先に `open` が無く、`completed` 以外（`not_planned` / `duplicate`、理由の無いもの）で閉じた依存先がある Issue は、ほかの候補条件をすべて満たしていれば、候補から外したうえで、Issue にコメントしてラベル `needs-decision` を付ける（対話セッションなら、着手してよいかをユーザーに確かめる場面。`.claude/skills/issue-start/dependencies.md`「読み方」）。ほかの条件で外れる Issue には付けない（外れているあいだは、付けても選定は変わらない）。選定は残りの候補で続ける
   - コメントは GitHub MCP の `add_issue_comment`（使えなければ、本文を scratchpad に書いて `gh api repos/{owner}/{repo}/issues/<番号>/comments -F body=@- < <scratchpad>/needs-decision.md`）で付ける。ラベルは `gh api repos/{owner}/{repo}/issues/<番号>/labels -f "labels[]=needs-decision"` で付ける（追加だけなので、ほかのラベルを落とさない）
   - コメントの本文（`<依存先>` は、本文の `依存: #M` から来た依存先なら `#<M>`、blocked by から来た依存先なら `routine-candidates.md`「確かめ方」手順 4 の出力の 1 列目をそのまま書く。別のリポジトリの依存先を `#<M>` だけで書くと、このリポジトリの別の Issue へのリンクになるため。依存先が複数あれば、最初の箇条書きを依存先ごとに書き、2 つ目の箇条書きの `<依存先>` には、当てはまるものをすべて「、」でつないで書く）:

     ```
     ## 無人実行で判断できない点（weekday-issue-start）
     - 依存先 <依存先> が `<state_reason。無ければ「理由なし」>` で閉じていて、依存した変更が入っていない。この Issue に着手してよいかは人が決める
     - 着手してよければ、本文の `依存: <依存先>` と blocked by から <依存先> を外すか、代わりの Issue に差し替えてから `needs-decision` を外す。依存を残したままラベルだけ外すと、次の実行でまた付く

     _スケジュール実行（weekday-issue-start）による無人実装_
     ```

3. 選ぶのは 1 件だけで、順は `routine-candidates.md`「選ぶ順」に従う。候補が無ければ（`routine-ok` の付いた Issue が無い日も含む）何もせず、実行報告に「対象なし」と書いて終える

## 3. 作業環境

1. `<work>` で、Issue のブランチを `origin/main` から作る（ブランチ名は `.claude/rules/git-conventions.md`「ブランチ命名」。ラベル `bug` → `fix/`、`test` → `feature/`、それ以外はラベル名と同じ type）

   ```bash
   git checkout -b <type>/<番号>-<kebab-desc> --no-track origin/main
   ```

   - `--no-track` は、upstream が `origin/main` になって素の `git pull` が main を取り込むのを防ぐため（`/issue-start` Phase 2 と同じ）
   - ここでは push しない。push は Phase 1 を終えてから行う（手順 4 の表「Phase 2 のブランチ作成」）
2. 依存の導入が要るプロジェクトなら、`<work>` の直下で `.claude/rules/tech-stack.md`「開発環境」「よく使うコマンド」のとおりに導入する。手順 1-3 で PR の head に切り替えて導入していたら、ブランチを作ったあとに導入し直す
3. 以降の作業はすべてこのブランチで行う

## 4. 実装（`/issue-start` の手順を無人向けに読み替える）

`<work>/.claude/skills/issue-start/SKILL.md` と `phases/*.md` に従う。ただし、ユーザー確認を前提にしている箇所は、次のように読み替える。

| 箇所 | 無人実行での扱い |
|------|-----------------|
| Phase 1 の不足確認 | 質問せず、Issue 本文と既存コードから判断する。要件の分岐をどうしても決められない場合は、Issue にその旨をコメントし、ラベル `needs-decision` を付けて（手順 2-2 と同じコマンド）終える（PR は作らない）。ラベルが付いている間は選ばれないので、翌日以降に同じ Issue へ同じコメントを積まない。同じく Phase 1 の終わりに、この Issue の変更が手順書・規約（`.claude/` の skills・rules・agents・routines と `CLAUDE.md`）から人の確認を外す・弱めるものかを、Issue 本文と本文が挙げるファイルから判断し、当たれば同じく `needs-decision` を付けて終える（Phase 4 で自分で承認できないため。Phase 2 で push する前に決めるのは、ブランチが残ると、ラベルを外しても候補条件で選ばれなくなるため） |
| Phase 1.5 の補完 | Issue 本文は書き換えない（承認できないため）。生成した完了条件・紐づけた関連 Issue・本文と現状コードの乖離は、PR 本文の `## 実装判断（無人実行）` に書く。Phase 5 でスコープが変わりそうなときも、聞かずに、Issue の範囲で実装し、同じ節に書く |
| Phase 1 手順 0.5（テンプレート更新） | 起票しない。実行報告に「テンプレート更新あり（vOLD → vNEW）」と書くだけ |
| Phase 1「リポジトリへの変更が出ない Issue」（`phases/01-no-repo-change.md`） | 調査と dry-run の作成までを行い、適用もクローズもしない。調査だけの Issue では結論（調べ方・結果・判断とその根拠）を、GitHub 上の操作だけで終わる Issue では dry-run（対象と変更内容。Issue 本文なら新旧の差分）を、表の下のコメントで Issue に書き、ラベル `needs-decision` を付けて終える（PR は作らない）。Phase 8 の結論・操作の記録は、このコメントで代える。別の Issue で直すべき問題が見つかったら、起票せずに、コメントと実行報告に「起票候補」として書く。適用とクローズは、通常の Issue で人が PR をマージするのと同じく、人の最終判断に残す。調べた結果、リポジトリへの変更が要ると分かったら、通常どおり Phase 2 から進める |
| Phase 2 のブランチ作成 | 手順 3 で作った Issue ブランチを使い、ここで `git push -u origin HEAD` で先に push する。対話の `/issue-start` は Phase 1 手順 2 でリモートの `*/<番号>-*` ブランチを見て作業中と判定するので、Phase 7 まで push しないと、PR を作るまでのあいだに人が同じ Issue に着手することがある。手順 3 で push しないのは、Phase 1 で `needs-decision` を付けて終える実行でブランチを残さないため（残ると候補条件により、ラベルを外しても選ばれなくなる）。Phase 2 の「クラウドセッションの場合」の割り当てブランチでの作業と「## 着手」の印は行わない（ブランチ名に Issue 番号が入り、ここで push するので、検知はそれで足りる） |
| Phase 4 の設計承認 | 自分で承認して進める。設計の要点と判断の根拠を、PR 本文の `## 実装判断（無人実行）` に書く。人の確認を外す・弱める変更かは Phase 1 の終わりに判断済み（上の行）。設計を進めて初めてそうだと分かったときは、`needs-decision` は付けず（ブランチは push 済みで、付けると選ばれなくなる）、PR を draft で作り、その点を `## 実装判断（無人実行）` の先頭に書く |
| Phase 1/3/5/6 のスコープ外問題 | 起票しない。PR 本文と実行報告に「起票候補」として挙げる |
| Phase 6 のレビュー | `code-reviewer` で行い、スコープ内の指摘は直す。対話なら人に聞く指摘（DoD・スコープが変わるもの、判断が分かれるもの、人の確認を外す・弱める修正）は直さず、PR 本文の `## 実装判断（無人実行）` に挙げる |
| Phase 7 の PR 作成 | push の前に `origin/main` を取り込む。PR 本文の末尾にフッター `_スケジュール実行（weekday-issue-start）による無人実装_` を付ける（手順 1-2 で自分の PR を見分けるため）。PR は作成までで、マージ・auto-merge はしない。force push しない |
| Phase 8 の記録 | Issue への実装メモは記録する。知見ボードへの投稿とテンプレート元への還元はしない。気づきは実行報告に「知見ボード候補」として挙げる。ツール・hook・ハーネスに拒否された・エラーで止められた気づきは、メッセージの原文（先頭 1〜2 行と、期待される形式や許可される値を示す行）と、止められた呼び出し（コマンド・関数と渡した引数）も添える |

リポジトリへの変更が出ない Issue に書くコメントの本文（`<A／B>` は、調査だけの Issue なら A、GitHub 上の操作だけで終わる Issue なら B を書く）:

```
## 無人実行で判断できない点（weekday-issue-start）
- リポジトリへの変更が出ない Issue なので、<クローズ／適用とクローズ>をするかは人が決める
- <結論（調べ方・結果・判断とその根拠）／dry-run（対象と変更内容）>
- 起票候補: <別の Issue で直すべき問題。無ければこの行を省く>
- 同意するなら、人が<クローズ／適用してクローズ>する。対話セッションで `/issue-start` し直すと、対象の取り直しから確認つきで進む。直すところがあれば Issue に書いてから `needs-decision` を外す。ラベルだけ外すと、次の実行で同じ<調査／dry-run>をやり直してまた止まる

_スケジュール実行（weekday-issue-start）による無人実装_
```

### 検証と UI の確認

- **UI の確認の手段**: Playwright MCP で確認する（`.claude/skills/playwright-mcp/SKILL.md`）

1. 検証は、`.claude/rules/tech-stack.md`「よく使うコマンド」のテスト・リント・型チェックのコマンドで行い、必ず実行する。失敗を解消できなければ、PR を draft で作り、理由を本文に書く。コマンドが書かれていない・`<...>` のプレースホルダーのままなら、変更に応じた確かめ（Markdown なら参照先が実在するか、など）だけを行い、PR 本文の `## テスト` に「検証のコマンドが未記入」と書く
2. UI に関わる変更は、上の手段で確かめる。手段が `<...>` のままか、使えなければ、PR 本文の `## テスト` に「UI未検証（スケジュール実行のため）」と書く
3. hook にブロックされたら、規約に合わせて直す。`--no-verify` などで回避しない
4. Issue に残す実装メモの見出しは `## 実装メモ（スケジュール実行 weekday-issue-start による無人セッション）` とし、末尾にフッター `_スケジュール実行（weekday-issue-start）による無人実装_` を付ける。PR 本文の末尾にも同じフッターを付ける

## 5. 実行報告

最後に、次の形式で報告する。報告の本文は、実行ログ Issue にもコメントとして投稿する（**1 実行 1 コメント**。「対象なし」で終わる実行も投稿する）。投稿できなければ（GitHub MCP も gh も使えない等）、セッションに報告を出すだけにする。

```
## weekday-issue-start 実行報告（YYYY-MM-DD）
- Open PR 数: K 件（上限 5、draft 含む）
- conflict 解消: PR #N を origin/main と同期（検証通過）／ conflict 未解消: PR #M（理由）／ mergeable 未判定: PR #L ／ なし
- 取り残しブランチ: <ブランチ名>（#N、Open PR 無し）… ／ なし
- 完了せずに閉じた依存先: #N に needs-decision を付けた（依存先 #M（別のリポジトリなら owner/repo#M）が not_planned）… ／ なし
- 対象: #N タイトル（選定理由: 優先度・番号）／ または「対象なし」「対象なし（Open PR 上限 5 件に到達）」
- PR: <URL>（draft かどうか）／ なし（needs-decision を付けた: <理由>）
- 検証: テスト・リント・UI 確認の結果（未検証の項目は明記）
- 実装判断: 無人で決めた設計判断の要約
- 起票候補（スコープ外問題）: … ／ なし
- 知見ボード候補: … ／ なし
- テンプレート更新: あり（vOLD → vNEW）／ なし
```
