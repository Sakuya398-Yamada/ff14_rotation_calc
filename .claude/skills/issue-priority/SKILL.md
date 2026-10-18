---
name: issue-priority
description: Open な GitHub Issue の消化優先度を判定し、「進行中」「人がいるセッション向け」「ルーティン向け」に分けた順位表と priority:* ラベル案を出すスキル。「Issue の優先度を確認して」「次に何をやるべき？」「Issue の消化順を決めて」「priority ラベルを付けて」「/issue-priority」のように、Issue 全体の優先度・着手順の判断を依頼されたときに使う。ラベルはユーザー確認（Y/E/N）を経てから付ける。指定した Issue 群の実装順序（Wave 計画）と実装指示が欲しいときは /dev-plan を使う。
argument-hint: "[Issue番号...（省略時は Open Issue 全件）]"
---

# Issue 優先度スキル（/issue-priority）

入力: **$ARGUMENTS**

Open Issue の消化優先度を判定し、順位表と `priority:*` ラベル案を出す。ラベルはユーザーの承認を得てから付け替える。**このスキルでは実装・起票・Issue 本文の編集を行わない**。

## 使い方

```
/issue-priority
/issue-priority #475 #476
```

- 入力が無ければ、Open Issue 全件（`meta` / `question` ラベルの Issue と #2 のテンプレート Issue を除く）を対象にする
- Issue 番号を指定したら、順位表とラベル案はその Issue だけに絞る。後続を塞いでいるかは依存する側の本文でしか分からないので、手順 2 の読み込みは引数に関係なく全件で行う

## 手順

### 1. 集める

1. GitHub MCP の `list_issues`（`state: OPEN`、`fields: ["number", "title", "labels"]`）で Open Issue を一覧する
2. `list_pull_requests`（`state: open`、`fields: ["number", "title", "body", "draft", "head", "mergeable_state"]`）で Open PR を一覧し、タイトル末尾の `#N` と本文の `closes #N` で Issue に紐づける
3. リモートのブランチから `*/#<番号>-*` に当たるものを Issue に紐づける。ブランチは百本を超えるので、全件を出さずに対象の番号で絞る: `git ls-remote --heads origin | grep -E '/#(475|476|...)-'`

GitHub MCP が使えなければ、REST の `gh api` で同じ情報を取る。`gh issue` / `gh pr` などのサブコマンドは GraphQL を使うので、クラウドセッションでは 403 になる。使わない（`.claude/skills/issue-start/pitfalls.md`「クラウドセッションでは gh の GraphQL 系が使えない」）。

- Open Issue: `gh api "repos/{owner}/{repo}/issues?state=open&per_page=100" --jq '.[] | select(.pull_request | not) | [.number, .title, ([.labels[].name] | join(","))] | @tsv'`。issues API は PR も返すので、`pull_request` のあるものを除く
- Open PR: `gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100" --jq '.[] | {number, title, body, draft, head: .head.ref}'`。一覧には `mergeable` が無いので、紐づいた PR ごとに `gh api repos/{owner}/{repo}/pulls/<PR番号> --jq '{number, mergeable, mergeable_state}'` で読む
- どちらも 1 回で取れるのは 100 件まで。超えたら `--paginate` を使わずに `page=N` を進める（pitfalls.md「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」）

### 2. 要約する

本文とコメントは、引数に関係なく全 Open Issue（`meta` / `question` と #2 を除く）について読む（「依存: #N」は依存する側の本文に書かれるため）。**4 件以上** なら `general-purpose` エージェントに任せ、要約だけ受け取る（`code-explorer` は GitHub MCP を持たない）。3 件以下なら自分で `issue_read`（method: `get` / `get_comments`）を読む。委譲プロンプトの例：

```
目的: Open Issue の消化優先度の判定材料を集める。読み取りのみ（コメント・ラベル・本文の書き込みはしない）。
対象: #A, #B, ...（ToolSearch で select:mcp__github__issue_read をロードし、method=get。コメントがあれば get_comments、親子関係があれば get_parent / get_sub_issues）
GitHub MCP が使えなければ REST の gh api repos/{owner}/{repo}/issues/N（コメントは .../issues/N/comments、子は .../issues/N/sub_issues）で読む。gh issue / gh pr などの GraphQL 系サブコマンドはクラウドセッションで 403 になるので使わない。
各 Issue について 7 行以内で返す:
- 目的（1 行）
- 依存: 本文の「依存: #N」、親 Issue / sub-issue、他 Issue の成果物を前提にしているか（明示と暗黙を区別）
- 規模: DoD の項目数
- 変更内容: 変更箇所（ファイル・値）と方針が本文で決まっているか（決まっている／方式・設計の選択が残る）
- ## 未確定事項: ユーザーの決定待ちと書かれた項目（「要ユーザー確認」「ユーザー判断」）があれば、その言い回しを原文のまま。「要ユーザー確認」の付かない「[要確認]」だけの項目は調べれば分かる確認なので返さない
- 着手の印: コメントに「## 着手」の印があれば、ブランチ名・セッション URL・日時と、取り下げ済み（見出しが「## 着手（取り下げ）」に書き換わっている）かどうか
- 期限・リスク（データ欠損・セキュリティ・無料枠・パッチ追従など）の記述があれば原文の引用
最後に依存グラフ（「#A → #B（B は A に依存）」）と、同じファイルを触りそうな組み合わせを列挙する。合計 150 行以内。
除外: 本文の全文引用、コードブロックの転載、ユーザー情報・URL などのメタデータ。
```

### 3. 3 つに分ける

上から順に判定し、最初に当たった区分に入れる。

| 区分 | 条件 | 扱い |
|------|------|------|
| **進行中** | 紐づく Open PR、`*/#<番号>-*` のリモートブランチ、コメントの「## 着手」の印のいずれかがある（このセッション自身の印も含む。「## 着手（取り下げ）」に書き換わった印は、ブランチがもう別の Issue に移っているので含めない） | ラベル案を出さない（変えない）。PR がマージできる状態なら「マージ」を次の行動として挙げる |
| **ルーティン向け** | `.claude/routines/weekday-issue-start.md`「2. 対象 Issue の選定」手順 1 の候補条件をすべて満たす（条件の正本はルーティン側。ここに書き写さない） | 日次の無人実装（`weekday-issue-start`）に任せられる |
| **人がいるセッション向け** | 上のどちらでもない | 理由（要判断・依存待ち #N・親 Issue・`routine-ok` 無し）を書く。依存待ちだけが理由なら「依存が閉じればルーティン向け」と、下の「無人向き」に当たるなら「無人向き候補（`routine-ok` を付ければルーティン向け）」と注記する |

依存先が閉じているかは、手順 1 の Open Issue 一覧に無ければ閉じていると判定してよい。

**無人向き**: `weekday-issue-start.md`「2. 対象 Issue の選定」手順 1 の候補条件のうち `routine-ok` 以外をすべて満たし（条件の正本はルーティン側。ここに書き写さない）、かつ変更内容が本文で決まっている（公式の値に合わせるデータ修正、変更箇所と方針が書かれた bug / docs / refactor など）。設計判断の重い feature（新しい UI・データモデル・ジョブの追加など）は当たらない。`routine-ok` を付けるかは人が決める

### 4. 優先度を判定する

| ラベル | 条件 |
|--------|------|
| `priority:high` | 着手できる（依存がすべて閉じている）うえで、① 後続の Open Issue を塞いでいる、または ② その Issue を放置すると出る損害（データ欠損・セキュリティ・無料枠の超過・現行パッチとの値のずれ）が本文に書かれている |
| `priority:medium` | bug（計算結果や表示が実際とずれる）。または、依存待ちのため high にできないが、high の ① か ② に当たるもの |
| `priority:low` | 上のどれにも当たらない（独立した機能追加、依存の末端） |

- **要ユーザー判断が残ることは優先度を下げる理由にしない**（区分で扱う）
- high は着手できるものに限る。依存の鎖では先頭だけが high になり、それが閉じたら次が繰り上がる。鎖が進んだら回し直す
- 人がいるセッション向けの表は、同じラベルの中を塞いでいる後続の数が多い順、次に番号の小さい順に並べる。ルーティン向けの表は、ルーティンが選ぶ順（`weekday-issue-start.md`「2. 対象 Issue の選定」手順 2 の順位を案のラベルで当てはめた順）に並べる
- ② の損害は、Issue をやらないと起きることに限る。データの出典の版の注記（「Patch 7.5 表記」）や、方式の選択肢ごとのトレードオフは当たらない
- 依存の順番とリスクの順番が食い違うとき（例: 公開前に入れたい対策が、依存の上では後ろにある）は、順位を崩さず注記に書く

### 5. 提示して確認する

```
## Issue の消化優先度（YYYY-MM-DD 時点）

### 進行中
| Issue | 状態 | 次の行動 |
|-------|------|---------|
| #N タイトル | PR #M（マージ可能）／作業中（着手の印: <ブランチ>） | マージ／待つ |

### 人がいるセッション向け
| 順 | Issue | 現在 → 案 | 理由 | 備考 |
|----|-------|-----------|------|------|
| 1 | #N タイトル | なし → high | 後続 N 件の起点、依存は解消済み | 要判断: ... ／ 無人向き候補（`routine-ok` を付ければルーティン向け） |

### ルーティン向け
| 順 | Issue | 現在 → 案 | 理由 |
|----|-------|-----------|------|

### 注記
- 案のとおり付けたとき、次の `weekday-issue-start` が選ぶ Issue（ルーティン向けの 1 番目。空なら「なし（`routine-ok` の付いた候補なし）」）
- ファイルが重なる組み合わせ（マージ順の注意）、依存とリスクの食い違い

priority ラベルを案のとおり付け替えますか？
 [Y] すべて付け替える
 [E] 一部を変える（Issue 番号と優先度を指定。「#N は変えない」も可）
 [N] 付け替えない（順位表の確認だけ）
```

- [E] の場合は修正を反映して再提示し、改めて Y/E/N を取る
- ルーティン向け（`routine-ok` 付き）の Issue は、priority に関係なく次以降の `weekday-issue-start` で無人実装される。priority が決めるのは選ぶ順だけで、無人実装してよいかは `routine-ok` が決める。priority を見送った Issue には、日次ルーティン `daily-triage`（`.claude/routines/daily-triage.md`）が次の実行で手順 4 の判定どおりに付ける
- 人がいるセッションでやりたい Issue に `routine-ok` が付いていれば、外すことをユーザーに提案する。無人向き候補に `routine-ok` を付けるかはユーザーが決める（どちらもこのスキルの手順の外で行う）

### 6. ラベルを付け替える

承認された Issue のうち、現在のラベルと案が違うものだけを更新する。

- `issue_write`（method: `update`）の `labels` は **ラベル全体を置き換える**。現在のラベルから `priority:*` を除き、新しい `priority:*` を 1 つ足した配列を渡す（種別ラベルや `needs-decision` / `routine-ok` を落とさない）
- `gh` なら REST でラベルを 1 つずつ足し引きする（他のラベルには触れない）。`gh api repos/{owner}/{repo}/issues/<N>/labels -f "labels[]=priority:<新>"` で足し、旧い `priority:*` があれば `gh api -X DELETE repos/{owner}/{repo}/issues/<N>/labels/priority:<旧>` で外す。`gh issue edit` は GraphQL を使うので、クラウドセッションでは 403 になる
- 付け替えた Issue の一覧（番号・旧 → 新）を最後に示す

## 自動化しないこと

- **無人でラベルを付け替えない**。手順 5 の確認を挟む。例外は日次ルーティン `daily-triage` だけで、`priority:*` の無い Open Issue（進行中を除く）に手順 1〜4 の判定で付けるのは事前承認済み（#501）。付いている priority はルーティンでも変えない（週次 `weekly` の系統5 は付け直しの案を出すだけ）
- **Issue 本文・コメントを書き換えない、起票しない**（分割や新規起票が要るなら `/issue-plan` を案内する）
- **進行中の Issue のラベルは変えない**
- **`routine-ok` を付けない・外さない**（判断するのは人。日次の `daily-triage` も候補を出すだけ）
