---
name: template-update
description: テンプレート元（.claude/template-version の repo）でリリースされた新しい版を、このプロジェクトのカスタマイズを壊さずに取り込む手順（3-way マージ → 残差確認 → テンプレート外の参照確認 → template-version 更新 → バナー確認）。「refactor: テンプレートを vX.Y.Z に更新」Issue を /issue-start した Phase 5 で使う。更新の検知と更新用 Issue の起票の手順は /issue-start Phase 1 手順 0.5 が正本。更新用 Issue の外から呼ばれたら取り込まず、その手順で更新用 Issue に誘導する。
argument-hint: "[vNEW]"
---

# テンプレート更新の取り込み（/template-update）

更新用 Issue（`refactor: テンプレートを vX.Y.Z に更新`）を `/issue-start` したときの **Phase 5 の実装内容**。この手順の正本はこのファイルで、`.claude/rules/workflow-feedback.md`「テンプレート更新の取り込み」は判定とここへの参照だけを持つ。

## 前提

- `<repo>` は `.claude/template-version` の `repo`、`vOLD` は同ファイルの `version`、`vNEW` は更新用 Issue の版（引数で指定されていればそれ）
- テンプレートのファイルはこのプロジェクト側でカスタマイズ済みなので、**機械的に上書きしない**
- 作業は未コミットの変更が無い状態で始める（後述「3-way マージの定型手順」5 の理由）
- 更新用 Issue の `/issue-start` の外から直接呼ばれたら、取り込みに入らない。版は引数、無ければ `.claude/skills/issue-start/phases/01-issue-analysis.md` 手順 0.5 の表と `.claude/skills/issue-start/phases/01-template-update-check.md`「バナーを信じる前の確認」に沿って SessionStart バナーから決める（バナーが `⚠ Template update available` でなければ、表の動作に従い、取り込まずにその旨を伝えて終える）。そのうえで同ファイル「更新があるときの確認と起票」の [Y] と同じ手順で同じ版の更新用 Issue を探し、無ければ起票を提案する（確認の形式は同じものを使うが、`/issue-start` の途中ではないので「（今の Issue の作業はそのまま続けます）」は省き、[Y] ならこの流れのまま `/issue-start` に進むと添える。断られたら、同じセッションの手順 0.5 でも聞き直さない）。見つけた Issue か起票した Issue は、この流れのまま `/issue-start <番号>` を呼んで進める（その Phase 5 でこの手順に戻る）。起票を断られたら取り込まない（1 Issue = 1 PR）

## 取り込み手順

1. Release notes と差分（`git diff vOLD..vNEW -- template/` をテンプレート元のクローンで実行、または compare URL）を読み、変更ファイルの一覧を得る
2. 変更ファイルごとに、このプロジェクト側の対応ファイル（`template/` を除いたパス）へ **3-way マージ**（`git merge-file`）で反映する。差分を読んで手で当てるより取りこぼしが少なく、テンプレート側の変更は自動で当たり、プロジェクト固有の記述とぶつかる箇所だけがコンフリクトとして残る（後述「3-way マージの定型手順」）
   - コンフリクト箇所は、テンプレート側の変更を取り込みつつプロジェクト固有の記述を残す形に手で直す。とくにカスタマイズ済みファイル（`tech-stack.md` / `coding-standards.md` / `CLAUDE.md` のプロジェクト固有部分 / `settings.json` の許可リスト等）は固有の記述を壊さない
   - Release notes に「手動対応」が書かれていればそれに従う
3. **テンプレート外の参照を確かめる**: 3-way マージはテンプレートで変わったファイルしか触らないので、テンプレートが持ち込んだ新しい印・規約を、プロジェクト独自のファイルや固有の記述が判定に使っていても追従されない。書き戻しが終わったら、後述「テンプレート外の参照の確認」で探す。Issue コメントに残った旧形式の印も同じ節で探す
4. `.claude/template-version` の `version` を新しい版に更新する
5. hooks を変更した場合は `.claude/hooks/__tests__/*.test.sh` を実行し、必要ならテストケースを追従する
6. SessionStart hook を直接実行してバナーが `up to date` になることを確認する（Claude Code の再起動は不要。hook は実行のたびにテンプレート元の最新版を取得する）:

   ```bash
   bash .claude/hooks/session-start-info.sh </dev/null | grep -A2 '## Template version'
   ```

7. 完了条件（更新用 Issue の DoD）:
   - [ ] Release notes の変更ファイルをすべて確認した
   - [ ] カスタマイズ済みファイルのプロジェクト固有記述が失われていない
   - [ ] テンプレートが持ち込んだ印・規約を、テンプレート外のファイルやプロジェクト固有の記述が参照していないか、旧形式の印が Issue コメントに残っていないかを確かめた（後述「テンプレート外の参照の確認」）
   - [ ] skill のファイルがどれも 30,000 バイト未満（`find .claude/skills -name '*.md' -size +29999c` が何も出さない）。プロジェクト固有の追記とテンプレートの追記が合わさって超えることがある。超えたら、切り出す Issue を起票する（`.claude/skills/issue-start/pitfalls.md`「Bash の出力上限は、文字数ではなくバイト数で効く」）
   - [ ] `.claude/template-version` の `version` を更新した
   - [ ] hooks テストが通る
   - [ ] SessionStart バナーが `up to date` になる（上記の直接実行で確認）

## 3-way マージの定型手順

作業ファイルはプロジェクトの外（scratchpad 等）に置く。テンプレート元の clone は `--no-checkout` で作業ツリーを作らず、`-c core.longpaths=true` を付ける。以下の手順は `git show` / `git diff` しか使わないので作業ツリーは不要。Windows では scratchpad の深いパスとテンプレート元の深いパスが合わさって MAX_PATH を超え、チェックアウトが `Filename too long` で止まるが、`--no-checkout` で避けられるのは作業ツリーだけで、clone が `.git/objects/pack/pack-*.keep` を書く時点でも同じ `Filename too long`（`cannot write keep file`）で失敗する。`git clone -c` の設定は fetch の前から効き、クローンの config にも残るので、以降の `git show` / `git diff` も長いパスを扱える（Windows 以外では無視される）。

```bash
SRC=<scratchpad>/template-src   # テンプレート元のクローン（作業ツリー無し）
W=<scratchpad>/template-merge   # 作業ディレクトリ
git clone -q --no-checkout -c core.longpaths=true https://github.com/<repo>.git "$SRC"

git -C "$SRC" diff --name-only vOLD vNEW -- template/ | while read -r t; do
  p=${t#template/}  # プロジェクト側のパス
  mkdir -p "$W/$(dirname "$p")"
  git show "HEAD:$p"               >"$W/$p.ours"   2>/dev/null || { echo "project にない:  $p"; continue; }
  git -C "$SRC" show "vOLD:$t"     >"$W/$p.base"   2>/dev/null || { echo "vNEW で追加:    $p"; continue; }
  git -C "$SRC" show "vNEW:$t"     >"$W/$p.theirs" 2>/dev/null || { echo "vNEW で削除:    $p"; continue; }
  git merge-file -p -L ours -L vOLD -L vNEW "$W/$p.ours" "$W/$p.base" "$W/$p.theirs" >"$W/$p.merged"
  echo "conflicts=$?  bytes=$(wc -c <"$W/$p.merged" | tr -d ' ')  $p"  # conflicts は 0 ならそのまま使える
done
```

`bytes` は書き戻したときの大きさ（コンフリクトがあれば印の分も入る）。`.claude/skills/` の md で 30,000 以上のものは、テンプレート版では上限内でもプロジェクト固有の節と合わさって超えている。書き戻す前に、切り出す Issue を起票するかをユーザーに聞く（Phase 5 の末尾のスコープ外の提案にまとめず、ここで聞く。断られたら、完了条件の大きさの項目は満たせないので、その旨を PR 本文に書く。`.claude/skills/issue-start/pitfalls.md`「Bash の出力上限は、文字数ではなくバイト数で効く」）。完了条件の大きさの確認で後から気付くと、取り込みの途中で確認が増える

1. `conflicts=0` のファイルは `$W/<path>.merged` の内容をそのままプロジェクト側に書き戻す。書き戻しは Edit ツールで、`diff "$W/<path>.ours" "$W/<path>.merged"` に出た変更箇所を当てる（ほとんどの行が変わるなら、Read してから Write で置き換える）。`cp` やリダイレクトでまとめて上書きしない。書き戻し先の `CLAUDE.md` と `.claude/` 配下は、auto mode の分類器が `[Self-Modification]` の対象にするエージェント自身の設定・指示ファイルで、シェルからの上書きは書き込む中身が分類器に見えないので止められる。当てたら `cmp "$W/<path>.merged" <(tr -d '\r' < <path>)` で一致を確かめる（`tr` は作業ツリーが CRLF のときの改行コードの差を除くため。手順 5。macOS の `sed` は `\r` を CR として扱わないので使わない）
   - `settings.json` の `allow` や hooks の登録、`.claude/hooks/` のスクリプトのように権限やガードを変える差分は、Edit で当てても止められることがある（この分類器の規則は、ユーザーが明示的に求めていない権限・ガードの変更を対象にしている）。止められたら差分をユーザーに示し、その変更を取り込むことをユーザー自身のメッセージで伝えてもらってから当て直す
   - `settings.json` の hooks に、`vNEW` で追加された hook のスクリプト（ループが「project にない」と出した `.claude/hooks/` のファイル。新しいファイルはプロジェクトに無いので、「vNEW で追加」ではなくこう出る）の登録が入るときは、先に手順 4 でそのスクリプトを置いてから `settings.json` を書き戻す。hooks の変更は実行中のセッションにもすぐ効くので、登録だけが先に入ると、`"onFailure": "block"` の hook が起動に失敗して Bash の呼び出しがすべて止まる（`... failed; blocking because onFailure is "block"`）。止まったら、Edit で登録を外し、Write でスクリプトを置いてから登録し直す（Edit / Write は Bash を通らないので、Bash が止まっていても戻せる）
2. `conflicts=N`（N > 0）のファイルは、`$W/<path>.merged` の `<<<<<<< ours` 〜 `>>>>>>> vNEW` の箇所だけを上記の方針で解消し、マーカーが残っていないことを `grep -n '^<<<<<<<\|^>>>>>>>' "$W/<path>.merged"` で確かめてから、手順 1 と同じ方法で書き戻す
3. **書き戻したら、テンプレート版との残差を確認する**: `diff <(git -C "$SRC" show "vNEW:template/<path>") <path>`。残ってよいのは意図したプロジェクト固有の記述だけで、到達不能な分岐・重複した関数定義・同じ内容の二重の箇条書きが出ていたら手で除く。`merge-file` は両側が同じ領域を別の文面で変えていても、変更行が重ならなければコンフリクトにせず隣接する追記として黙って合成する。**プロジェクト側で先行修正したファイル（テンプレートへ還元した知見を自前でも直していた場合など）は `conflicts=0` でも必須**
   固有記述の多いファイルでは、取り込み後の残差だけ見ると今回の変化が従来の固有記述に埋もれる。取り込み前（`vOLD` 対 `HEAD`）の残差も作って突き合わせると、取り込みで変わった残差だけが出る。両者が一致すれば固有記述は失われていない:

   ```bash
   p=<path>
   diff <(git -C "$SRC" show "vOLD:template/$p") <(git show "HEAD:$p")  >"$W/$p.before"
   diff <(git -C "$SRC" show "vNEW:template/$p") <(tr -d '\r' < "$p") >"$W/$p.after"
   diff <(grep -v '^[0-9]' "$W/$p.before") <(grep -v '^[0-9]' "$W/$p.after")   # 行番号行を除いて比較
   ```

   `< >` で始まる行は、取り込み前は固有の残差だったのに取り込み後は消えた行（`< <` の行は、プロジェクトが消した・書き換えたテンプレート行の残差が変わっただけ、`< ---` は区切りなので、どちらも無視してよい）。1 行ずつ、まず同じファイルの `vNEW`（`git -C "$SRC" show "vNEW:template/$p"`）に同じ記述があるかを見る。あればテンプレートに吸収済みなので対応は要らない。無ければテンプレート側の移動先ファイルを探し、そこにも無ければ移動先へ移す。移動先が新規ファイルなら、手順 4 を先に済ませてから書き足す（「project にない」なら `vNEW` の内容を置き、「vNEW で追加」なら手順 4 の確認で決めた形にする）。手順を別ファイルへ移すリリース（rules → skill / phases など）では、`merge-file` はファイル単位なので、移動元の固有記述はテンプレート側の削除として黙って消え、移動先の新規ファイルには届かない。ファイルが大きく縮んだ・削除された・新規ファイルが増えたリリースでは、この突き合わせを省略しない（削除されたファイルは手順 4）。移動先が大きく組み変わったファイルは、merge 結果を直すより、`vNEW` の内容を骨格にして固有の節を差し込んで組み直す方が速いことがある

4. ループが `continue` で飛ばしたファイルは手で判断する
   - **project にない**: テンプレートが新しく足したファイル（プロジェクトには無い）。新規ファイルとして `vNEW` の内容を Write ツールで置き、`cmp <(git -C "$SRC" show "vNEW:template/<path>") <(tr -d '\r' < <path>)` で一致を確かめる（`cp` で置かない理由と `tr` の理由は手順 1。プロジェクトで意図的に削除していたなら置かない）
   - **vNEW で追加**: プロジェクトの同じパスに自前のファイルがあり、テンプレートがそのパスにファイルを新しく足した。`vNEW` の内容で上書きしない（上書きすると自前のファイルが黙って失われ、`cmp` も一致するのでどこでも止まらない）。`diff <(git show "HEAD:<path>") <(git -C "$SRC" show "vNEW:template/<path>")` を示し、自前のものを残すか（テンプレートのものは別名で置くか、取り込まない。別名で置くなら、テンプレート側でそのパスを指している登録・参照も合わせる）、統合するか、置き換えるかをユーザーに確認してから当てる。hook のスクリプトなら、`vNEW` の settings.json がそのパスを登録しているかも一緒に示す（自前のスクリプトが、テンプレートの登録の呼び方で呼ばれることになるため）。置き換える・統合するときの書き込みは上と同じく Write / Edit で行う
   - **vNEW で削除**: プロジェクト側でも削除してよいか確認してから削除する。削除する前に取り込み前の残差（`diff <(git -C "$SRC" show "vOLD:template/<path>") <(git show "HEAD:<path>")`）を見て、`>` の行（プロジェクト固有の記述）があれば、手順 3 と同じく移動先へ移す
5. **「現プロジェクト版」は作業ツリーではなく `git show HEAD:<path>` から取る**。Windows で `core.autocrlf=true` だと作業ツリーのファイルは CRLF になっていて、LF のテンプレート側と全行が衝突する。`HEAD` の内容（リポジトリ内の LF）を使えば改行コードの差は出ない。このため取り込み作業は未コミットの変更が無い状態で始める

## テンプレート外の参照の確認

`merge-file` のループはテンプレートで変わったファイルしか対象にせず、定型手順 3 の残差の突き合わせも同じファイルしか見ない。テンプレートが新しい印・見出し・規約を持ち込んでも、それを判定に使うプロジェクト独自の記述（独自の skill・定期実行のプロンプト・テンプレートのファイルに書き足した固有の節）は追従されず、取り込みはコンフリクト 0 件・残差の変化なしのまま通る。例: 着手の印「## 着手」を取り下げに書き換える運用（「## 着手（取り下げ）」）が入ったリリースで、独自のトリアージ用プロンプトが「## 着手」を含むコメントを進行中と判定したままになり、取り下げた Issue も進行中と読む。

1. テンプレートの差分（`git -C "$SRC" diff vOLD vNEW -- template/`）と Release notes から、新しく入った、または意味や書式が変わった印・見出し・コマンド・ファイル名・用語を拾う。新しいものが既存のものを文字列として含むとき（上の例の「## 着手（取り下げ）」と「## 着手」）は、含まれる側の既存のものも拾う。名前が変わった・無くなったものは古い名前を拾う。節が別ファイルへ移ったもの（見出しはそのままで、置き場所だけが変わったもの）は、移った見出しに加えて、移動元のファイル名も単独で拾う。ファイル名だけで節を指す参照（「<移動元のファイル名> の節にある〜」という文や、スクリプトのコメント中の移動元のパス）は、見出しや「ファイル名＋見出し」の組では当たらないため。移動元のファイル名で当たった行は、移った節を指しているものだけを移動先のファイル名に付け替え、移動元に残った節を指すものはそのままにする
2. プロジェクトのルートで、拾った語をプロジェクト全体から探し、テンプレートの記述と同じ行を除いて出す。`vNEW` のテンプレートの同じパスに同じ行があれば、テンプレート側で揃えてあるので見なくてよい（`${line%$'\r'}` は作業ツリーが CRLF のときの行末の CR を除くため。定型手順 1・5）:

   ```bash
   SRC=<scratchpad>/template-src   # 定型手順のクローン
   if git -C "$SRC" rev-parse -q --verify 'vNEW^{commit}' >/dev/null; then
     git -c core.quotePath=false grep --untracked -I -n -F -e '<語1>' -e '<語2>' | while IFS= read -r r; do
       f=${r%%:*}; rest=${r#*:}; line=${rest#*:}
       git -C "$SRC" show "vNEW:template/$f" 2>/dev/null | grep -qxF -- "${line%$'\r'}" || printf '%s\n' "$r"
     done
   else
     echo "SRC に vNEW が無い: $SRC"
   fi
   ```

   残った行は、テンプレートに無いファイル（独自の skill・ルーティン等）か、テンプレートのファイルにプロジェクトが書き足した記述にある。当たりが多すぎるときは `git grep` の末尾に `-- '*.md'` のようにパスを足して絞る。`SRC` はシェルの呼び出しをまたいで残らないので、ここで設定し直す。`SRC` や版を取り違えたまま回すと、絞り込みがエラー無しで効かなくなり、すべての当たりが出るので、先に `rev-parse` で確かめている。`--untracked` は定型手順 4 で置いた、まだ未追跡の新規ファイルも探すため
3. 残った行ごとに、新しい印・規約のもとでも意図どおりに判定・動作するかを読む。直すなら、取り込みに不可避な副次変更として同じ PR で直し、PR 本文の「## 変更点」に書く。独自の仕組みの作り直しが要るほど大きければ別 Issue にする
4. **Issue コメントに残った旧形式の印**: 書式や意味が変わった印は、ファイルだけでなく既存の Issue コメント（データ）にも旧形式で残っていることがある（例: 規約が変わる前に、印を書き換えずに取り下げを別のコメントで足したもの）。判定側を新しい規約に揃えても、その Issue は旧形式のまま読まれる。旧形式の印を含むコメントを、新しい順にまず 100 件から探す:

   ```bash
   gh api "repos/{owner}/{repo}/issues/comments?sort=created&direction=desc&per_page=100" --jq '.[] | select(.body | contains("<旧形式の印>")) | [.id, .html_url] | @tsv'
   ```

   取り込み時点の既存コメントはすべて古い規約のもとで書かれているので、直近 100 件で打ち切らない。100 件ちょうど返ったら、空のページが返るまで、または返ったコメントの最も古い `created_at` がその印を使い始めた時期より前になるまでページを進める。クラウドセッションでは `--paginate` が 2 ページ目で止まるので、`.claude/skills/issue-start/pitfalls-cloud.md`「クラウドセッションでは `gh api --paginate` が 2 ページ目で止まる」のループで回す（URL を上のものに替え、中身は `jq -s 'add | .[] | ...'` で漉す）。クラウドセッション以外なら `--paginate` でよい。見つかったら一覧をユーザーに示し、確認を得てから新形式に書き換える（`gh api -X PATCH repos/{owner}/{repo}/issues/comments/<id> -F body=@<file>`）
