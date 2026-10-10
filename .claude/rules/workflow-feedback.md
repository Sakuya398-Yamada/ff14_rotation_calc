# ワークフロー改善の知見ボード

`.claude/rules/` 配下のため起動時に自動で読み込まれる。
`/issue-start` セッションで得た **ワークフロー改善の気づき** を累積する専用Issueの運用規約と、テンプレート元との双方向のやり取り（**知見の還元** と **テンプレート更新の取り込み**）の規約。

## 知見ボードIssue

- **Issue番号**: #195
- **タイトル**: `meta: ワークフロー改善の知見ボード`
- **ラベル**: `meta`
- **運用**: 常時Open（クローズしない）
- **URL**: https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues/195

## テンプレート元の情報

本プロジェクトのワークフロー（`CLAUDE.md` / `.claude/`）のノウハウは、汎用テンプレート [issue-driven-dev-starter](https://github.com/Sakuya398-Yamada/issue-driven-dev-starter) として切り出されている。本プロジェクトはテンプレートの**出自側**だが、以降はテンプレート側を正として知見を還元し、改善を取り込む運用にする。テンプレート元との接点は `.claude/template-version` に集約してある。

- **`.claude/template-version`**: `repo=<owner/repo>`（テンプレート元）と `version=vX.Y.Z`（本プロジェクトが整合しているテンプレートの版。テンプレート元の Release タグと同一書式）
- **使用テンプレート**: Claude Code 版（テンプレート元の `template/` 配下）
- `version` は「還元・更新の基準としてこの版と整合している」ことを示す。テンプレート更新を取り込んだら更新する
- テンプレート → 本プロジェクト方向は、SessionStart hook が新しいリリースを検知してバナーで通知し、`/issue-start` Phase 1 手順 0.5 で更新用 Issue の起票を提案する。詳細は後述「テンプレート更新の取り込み」

## 何を書くか

ワークフロー全体（`/issue-start` / `/issue-plan` の手順、`.claude/rules/*`、`CLAUDE.md`、hooks、skills、MCP 運用等）への気づきを集約する。

| 集約対象 | 集約対象外 |
|---------|-----------|
| ワークフローの冗長・曖昧さ | 個別Issueの実装メモ（→ 当該Issueのコメント） |
| スキル定義の改善余地 | FF14 仕様そのもの（→ 該当Issueや新規Issue） |
| 規約・ガードレール追加候補 | コード上の個別バグ（→ 別Issueとして起票） |
| MCP ツール運用のハマりどころ | コードスタイルの好み |

## いつ書くか

`/issue-start` **Phase 8 の最後**（個別Issueへの実装メモ記録が終わった後）に、その回のセッションで見つけた気づきがあれば書き込む。

- **気づきが無い場合はスキップしてよい**（「特になし」と明示コメントしなくてよい）
- **ユーザー確認を挟んでから書き込む**（無人書き込みはしない）

## 記入フォーマット

コメント本文は以下のテンプレートに従う。

```markdown
## ワークフロー改善余地 [#<作業Issue番号>]
**セッション**: セッションの URL か ID（分かれば。Claude Code on the web なら `https://claude.ai/code/session_...`）
**発生Phase**: Phase N（例: Phase 5 実装中）

**気づき**: 何が非効率だった／躓いた／改善の余地があったか

**現状の動作**: 現在のワークフローではどう進んだか

**改善案**: どう変えると良いか（SKILL.md / phases / rules / hooks のどこを変える想定か）

**重要度**: Low / Medium / High

**還元先**: プロジェクト固有 / テンプレート汎用（未還元）
```

`**還元先**` は後述「テンプレート元への還元」の判定結果を書く。テンプレート元へ Issue として還元したら `テンプレート汎用（↗ 還元済み: <テンプレート元Issue URL>）` に編集する。

## 重要度の判定基準

| 重要度 | 目安 |
|--------|------|
| **High** | 毎セッション再発する／セッション失敗の直接原因／ガードレール追加で即座に解消できる |
| **Medium** | 数回に一度発生する／手順が冗長・曖昧で毎回判断コストが掛かる |
| **Low** | 1回限りの気づき／将来あると便利レベル／ユーザー影響が軽微 |

## セッション中の気づきの控え方

Phase 5（実装）〜 Phase 7（PR作成）で「これは後で知見ボードに書くべきかも」と思った事柄は、**その場で直さず短文メモに留める**。Phase 8 で棚卸しし、ユーザー確認を挟んで書き込む。

メモ項目の例：
- どのPhaseで発生したか
- 何が非効率／躓き／改善余地だったか
- 一次情報として残しておきたい再現条件（ツール名、プロンプト文、エラー文等）

## テンプレート元への還元（upstream feedback）

知見ボードに書いた気づきのうち **テンプレート汎用のもの** は、本プロジェクト内で閉じさせず、**テンプレート元リポジトリの Issue として起票**する。テンプレート側はその Issue を通常の `/issue-start` フローで精査・反映し、リリースを切る。リリースされた改善は後述の更新チェック経由で本プロジェクトにも戻ってくる。

### 還元する / しないの判定

| テンプレート汎用（還元する） | プロジェクト固有（還元しない） |
|---------------------------|----------------------------|
| `/issue-start` の手順・Phase 構成・ユーザー確認の粒度 | `tech-stack.md` / `coding-standards.md` / `testing-conventions.md` / `playwright-mcp.md` の中身 |
| `git-conventions.md` / `context-efficiency.md` / `workflow-feedback.md` / `documentation-policy.md` の規約そのもの | 本プロジェクト固有の MCP 構成・`settings.json` の権限 |
| hooks / agents / skills の挙動・判定ロジック・出力上限 | FF14 仕様・React / Vite / Prisma 等に閉じたハマりどころ（「言語別の例が欲しい」のように一般化できる要望は汎用） |
| Issueテンプレート・セットアップ手順・プレースホルダーの不備 | `weekly-issue-intake` 等、本プロジェクトの運用都合による独自ルール |

迷ったら「**テンプレートを新規に使う別プロジェクトでも同じ問題が起きるか**」で判定する。起きるなら汎用。

### 還元フロー

1. **タイミング**: Phase 8 で知見ボードへの追記が承認・投稿された直後（`phases/08-issue-recording.md` 手順 6）
2. **抽象化**: プロジェクト固有情報を取り除き、ワークフロー手順のレベルに書き直す（後述「還元 Issue に含めないもの」）
3. **重複チェック**: GitHub MCP の `search_issues` を `owner` / `repo` に **テンプレート元リポジトリ** を指定して呼び、既存 Issue を検索する（query は自然文でよい）。近いものがあればリンクを提示し、新規起票ではなくそこへのコメント追記を提案する。MCP が使えない場合は `gh issue list -R <owner/repo> --search "<キーワード>" --state all` で代替する
4. **ユーザー確認**: 抽象化後の本文を提示し Y/E/N を得る。**無人還元はしない**（ローカル知見ボードへの承認とは別に取る）
5. **起票**: GitHub MCP の `issue_write`（method: `create`）を、`owner` / `repo` を **テンプレート元** にして呼ぶ。タイトルは `feedback: <要約>`、ラベルは `feedback`（権限が無くて付けられない場合は省略してよい）。MCP が使えない場合は `gh issue create -R <owner/repo> --title "feedback: ..." --label feedback --body-file <tmp>` にフォールバックする。本文に `#N` を書くと GitHub がテンプレート元リポジトリの Issue として解釈して誤リンクになるため、本プロジェクトの Issue 番号（知見ボード #195 等）は書かないか `owner/repo#N` 形式にする
6. **起票に失敗した場合**（権限無し・ネットワーク等）: 整形済み本文をユーザーに提示し、テンプレート元の Issue テンプレート「テンプレートへの知見還元」からの手動起票を案内する。フロー全体は止めない
7. **ローカル側への印**: 起票後、本プロジェクトの知見ボード（#195）の元コメントの `**還元先**` を `テンプレート汎用（↗ 還元済み: <テンプレート元Issue URL>）` に編集する（`update_issue_comment`、または `gh api -X PATCH repos/<owner/repo>/issues/comments/<id> -f body=...` / 手動）

### 還元 Issue のフォーマット

テンプレート元の Issue テンプレート `.github/ISSUE_TEMPLATE/template-feedback.md` と同じ構成にする。

```markdown
## 還元元

- **プロジェクト**: Sakuya398-Yamada/ff14_rotation_calc
- **使用テンプレート**: Claude Code 版（`template/`）
- **テンプレート版**: vX.Y.Z（`.claude/template-version` の `version`）

## 気づき

何が非効率だった／躓いた／改善の余地があったか（プロジェクト固有情報を除いた形で）

## 現状のテンプレートの動作

テンプレートの現在の手順・規約ではどう進むか

## 改善案

- 対象ファイル: `template/.claude/skills/issue-start/phases/05-implementation.md` 等
- 変更内容: どう変えるか

## 重要度

Low / Medium / High（判定基準は上記と同じ）
```

### 還元 Issue に含めないもの

テンプレート元は **公開リポジトリ** である。以下は書かず、ワークフロー手順のレベルに抽象化する：

- 本プロジェクトのコード断片・ファイルパス・内部識別子・URL（FF14 のスキル名・ジョブ名等のドメイン固有語も含む）
- 顧客名・社内システム名・人名
- 認証情報・環境変数の値
- `#N` 形式の Issue / PR 番号（テンプレート元の番号として誤リンクされる。必要なら `owner/repo#N` 形式にする）

## テンプレート更新の取り込み

テンプレート元の新しいリリースは、更新用 Issue として起票してから取り込む。

テンプレート元で改善がリリースされると、SessionStart hook（`.claude/hooks/session-start-info.sh`）が `.claude/template-version` の `version` と最新リリースタグ（`git ls-remote` で取得）を比較し、差があれば `## Template version` バナーに `⚠ Template update available` を出す。結果は `$(git rev-parse --git-common-dir)/template-version-check` に 24 時間キャッシュされ（worktree 共有）、オフライン時は `Latest: unknown` でスキップする。

### 通知されたときの動き（`/issue-start` Phase 1 手順 0.5）

1. バナーに更新ありが出ていたら、**そのセッションで一度だけ** ユーザーに「更新用 Issue を起票するか」を聞く。一致していれば何も言わない。`Latest: unknown`（オフライン等）ならスキップする
2. **作業中の Issue のブランチでテンプレートを直接更新しない**（1 Issue = 1 PR）。承認された場合の動作は「このプロジェクトに更新用 Issue を起票する」までで、現在の Issue の作業はそのまま続ける
3. 起票前に `search_issues`（`owner` / `repo` にこのプロジェクトを指定）で同じ版の更新 Issue が既に無いか確認する（あればリンクを示して起票しない）。既存の更新 Issue の版とバナーの版が食い違う場合は hook のキャッシュ（24 時間）が原因なので、`git ls-remote --tags --refs --sort=-v:refname https://github.com/<repo>.git 'v*' | head -n 1` で直接確認し、新しい方の版を正とする
4. 更新用 Issue の内容：
   - タイトル: `refactor: テンプレートを vX.Y.Z に更新`
   - ラベル: `refactor`
   - 本文: 現在の版 → 最新版、Release notes の URL（`https://github.com/<repo>/releases/tag/vX.Y.Z`）、差分の URL（`https://github.com/<repo>/compare/vOLD...vNEW`）、完了条件（下記「取り込み手順」のチェックリスト）
5. ユーザーが「今回はスキップ」を選んだら、そのセッション中は再度聞かない（次のセッションでバナーが出れば改めて聞く）
6. スケジュール実行の無人セッション（`weekday-issue-start` 等）では質問も起票もせず、実行報告に「テンプレート更新あり」と記載するだけに留める

### 取り込み手順（更新用 Issue を `/issue-start` したとき）

Phase 5 の実装内容は以下。テンプレートのファイルはこのプロジェクト側でカスタマイズ済みなので、**機械的に上書きしない**。

1. Release notes と差分（`git diff vOLD..vNEW -- template/` をテンプレート元のクローンで実行、または compare URL）を読み、変更ファイルの一覧を得る
2. 変更ファイルごとに、このプロジェクト側の対応ファイル（`template/` を除いたパス）へ **3-way マージ**（`git merge-file`）で反映する。差分を読んで手で当てるより取りこぼしが少なく、テンプレート側の変更は自動で当たり、プロジェクト固有の記述とぶつかる箇所だけがコンフリクトとして残る（後述「3-way マージの定型手順」）
   - コンフリクト箇所は、テンプレート側の変更を取り込みつつプロジェクト固有の記述を残す形に手で直す。とくにカスタマイズ済みファイル（`tech-stack.md` / `coding-standards.md` / `CLAUDE.md` のプロジェクト固有部分 / `settings.json` の許可リスト等）は固有の記述を壊さない
   - Release notes に「手動対応」が書かれていればそれに従う
3. `.claude/template-version` の `version` を新しい版に更新する
4. hooks を変更した場合は `.claude/hooks/__tests__/*.test.sh` を実行し、必要ならテストケースを追従する
5. 完了条件（更新用 Issue の DoD）:
   - [ ] Release notes の変更ファイルをすべて確認した
   - [ ] カスタマイズ済みファイルのプロジェクト固有記述が失われていない
   - [ ] `.claude/template-version` の `version` を更新した
   - [ ] hooks テストが通る

### 3-way マージの定型手順

`<repo>` は `.claude/template-version` の `repo`、`vOLD` / `vNEW` は取り込み前後の版。作業ファイルはプロジェクトの外（scratchpad 等）に置く。テンプレート元の clone は `--no-checkout` で作業ツリーを作らない（以下の手順は `git show` / `git diff` しか使わないので作業ツリーは不要。Windows では scratchpad の深いパスとテンプレート元の深いパスが合わさって MAX_PATH を超え、チェックアウトが `Filename too long` で止まる）。

```bash
SRC=<scratchpad>/template-src   # テンプレート元のクローン（作業ツリー無し）
W=<scratchpad>/template-merge   # 作業ディレクトリ
git clone -q --no-checkout https://github.com/<repo>.git "$SRC"

git -C "$SRC" diff --name-only vOLD vNEW -- template/ | while read -r t; do
  p=${t#template/}  # プロジェクト側のパス
  mkdir -p "$W/$(dirname "$p")"
  git show "HEAD:$p"               >"$W/$p.ours"   2>/dev/null || { echo "project にない:  $p"; continue; }
  git -C "$SRC" show "vOLD:$t"     >"$W/$p.base"   2>/dev/null || { echo "vNEW で追加:    $p"; continue; }
  git -C "$SRC" show "vNEW:$t"     >"$W/$p.theirs" 2>/dev/null || { echo "vNEW で削除:    $p"; continue; }
  git merge-file -p -L ours -L vOLD -L vNEW "$W/$p.ours" "$W/$p.base" "$W/$p.theirs" >"$W/$p.merged"
  echo "conflicts=$?  $p"  # 0 ならそのまま使える
done
```

1. `conflicts=0` のファイルは `$W/<path>.merged` をそのままプロジェクト側に書き戻す
2. `conflicts=N`（N > 0）のファイルは `<<<<<<< ours` 〜 `>>>>>>> vNEW` の箇所だけを上記の方針で解消してから書き戻す。マーカーが残っていないことを `grep -n '^<<<<<<<\|^>>>>>>>' <file>` で確かめる
3. ループが `continue` で飛ばしたファイルは手で判断する
   - **project にない / vNEW で追加**: 新規ファイルとして `vNEW` の内容を置く（プロジェクトで意図的に削除していたなら置かない）
   - **vNEW で削除**: プロジェクト側でも削除してよいか確認してから削除する
4. **「現プロジェクト版」は作業ツリーではなく `git show HEAD:<path>` から取る**。Windows で `core.autocrlf=true` だと作業ツリーのファイルは CRLF になっていて、LF のテンプレート側と全行が衝突する。`HEAD` の内容（リポジトリ内の LF）を使えば改行コードの差は出ない。このため取り込み作業は未コミットの変更が無い状態で始める

## 棚卸し運用（週次ルーティンが正）

棚卸しはスケジュールタスク **`weekly-issue-intake`（毎週日曜 10時実行）の系統2** が自動で行う。これを正の運用とする。

### 週次ルーティン（系統2）の挙動

1. #195 の全コメントを読み、末尾に ✅ マーカーが無い（=未回収の）知見を**重要度を問わず**（Low 含む）独立Issueへ昇格起票する（ラベルは内容に応じて `feature` / `refactor` / `docs` 等を付与）
2. 起票後、元コメントを編集して末尾に以下を追記する（この無人マーカー追記編集は事前承認済み）
   ```
   ✅ Issue #<昇格先Issue番号> で対応
   ```
3. #195 への新規コメント投稿は行わない（既存コメントへのマーカー追記編集のみ）
4. **テンプレート元への還元は行わない**（無人還元禁止）。ルーティンで昇格した知見が `還元先: テンプレート汎用（未還元）` の場合は、下記「手動棚卸し」手順 4 としてユーザーが還元する

### 手動棚卸し

ユーザーによる手動棚卸し（随時）も引き続き認める。手順は週次ルーティンと同じ：

1. 独立した改善Issue として昇格起票する
2. 元コメントへ ✅ マーカーを追記する
3. 昇格後Issueは通常の `/issue-start` フローで実装する
4. 実装した改善が **テンプレート汎用** で、まだ還元していなければ（元コメントの `還元先` が `テンプレート汎用（未還元）`、または `還元先` 未記入で汎用と判断できる）、上記「還元フロー」でテンプレート元にも Issue を起票する（Phase 8 で還元済みなら不要）

## 回収済み判定の正

- **機械可読な正は「✅ Issue #<番号>」マーカー**とする。ルーティン・手動どちらの棚卸しでも、昇格したら元コメントに必ず付ける
- **Hidden as resolved（コメントの minimize）は任意の視覚整理**という位置づけ。REST API 経由ではコメントの minimize 状態は見えないため、**マーカー無しで Hidden だけされた知見はルーティンから未回収に見え、再昇格候補になり得る**（重複チェックで大半は弾かれるが、判定基準としては使わない）

## 自動化しないこと

- **無人コメント投稿はしない**: Phase 8 での知見ボードへの新規コメント投稿はユーザー確認（Y/E/N）を挟む
  - **例外**: `weekly-issue-intake` による既存コメントへの ✅ マーカー**追記編集**は事前承認済みで、無人実行してよい
- **テンプレート元への無人起票はしない**: ローカル知見ボードへの承認とは別に、還元用に抽象化した本文で改めて確認（Y/E/N）を取る。`weekly-issue-intake` ルーティンにも還元処理は組み込まない
- **テンプレートの無人更新はしない**: 更新チェックは「通知して更新用 Issue の起票を提案する」までで、ファイルの書き換えは更新用 Issue の `/issue-start` で行う
- **知見ボードIssueを自動クローズしない**: 常時Open運用
- **過去セッションからの遡及集約は行わない**: 未来のセッションから運用する
