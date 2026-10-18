---
name: template-update
description: テンプレート元（.claude/template-version の repo）でリリースされた新しい版を、このプロジェクトのカスタマイズを壊さずに取り込む手順（3-way マージ → 残差確認 → template-version 更新 → バナー確認）。「refactor: テンプレートを vX.Y.Z に更新」Issue を /issue-start した Phase 5 で使う。更新の検知と更新用 Issue の起票は /issue-start Phase 1 手順 0.5 が行うので、ここでは行わない。
argument-hint: "[vNEW]"
---

# テンプレート更新の取り込み（/template-update）

更新用 Issue（`refactor: テンプレートを vX.Y.Z に更新`）を `/issue-start` したときの **Phase 5 の実装内容**。この手順の正本はこのファイルで、`.claude/rules/workflow-feedback.md`「テンプレート更新の取り込み」は判定とここへの参照だけを持つ。

## 前提

- `<repo>` は `.claude/template-version` の `repo`、`vOLD` は同ファイルの `version`、`vNEW` は更新用 Issue の版（引数で指定されていればそれ）
- テンプレートのファイルはこのプロジェクト側でカスタマイズ済みなので、**機械的に上書きしない**
- 作業は未コミットの変更が無い状態で始める（後述「3-way マージの定型手順」5 の理由）

## 取り込み手順

1. Release notes と差分（`git diff vOLD..vNEW -- template/` をテンプレート元のクローンで実行、または compare URL）を読み、変更ファイルの一覧を得る
2. 変更ファイルごとに、このプロジェクト側の対応ファイル（`template/` を除いたパス）へ **3-way マージ**（`git merge-file`）で反映する。差分を読んで手で当てるより取りこぼしが少なく、テンプレート側の変更は自動で当たり、プロジェクト固有の記述とぶつかる箇所だけがコンフリクトとして残る（後述「3-way マージの定型手順」）
   - コンフリクト箇所は、テンプレート側の変更を取り込みつつプロジェクト固有の記述を残す形に手で直す。とくにカスタマイズ済みファイル（`tech-stack.md` / `coding-standards.md` / `CLAUDE.md` のプロジェクト固有部分 / `settings.json` の許可リスト等）は固有の記述を壊さない
   - Release notes に「手動対応」が書かれていればそれに従う
3. `.claude/template-version` の `version` を新しい版に更新する
4. hooks を変更した場合は `.claude/hooks/__tests__/*.test.sh` を実行し、必要ならテストケースを追従する
5. SessionStart hook を直接実行してバナーが `up to date` になることを確認する（Claude Code の再起動は不要。hook は実行のたびにテンプレート元の最新版を取得する）:

   ```bash
   bash .claude/hooks/session-start-info.sh </dev/null | grep -A2 '## Template version'
   ```

6. 完了条件（更新用 Issue の DoD）:
   - [ ] Release notes の変更ファイルをすべて確認した
   - [ ] カスタマイズ済みファイルのプロジェクト固有記述が失われていない
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
  echo "conflicts=$?  $p"  # 0 ならそのまま使える
done
```

1. `conflicts=0` のファイルは `$W/<path>.merged` の内容をそのままプロジェクト側に書き戻す。書き戻しは Edit ツールで、`diff "$W/<path>.ours" "$W/<path>.merged"` に出た変更箇所を当てる（ほとんどの行が変わるなら、Read してから Write で置き換える）。`cp` やリダイレクトでまとめて上書きしない。書き戻し先の `CLAUDE.md` と `.claude/` 配下は、auto mode の分類器が `[Self-Modification]` の対象にするエージェント自身の設定・指示ファイルで、シェルからの上書きは書き込む中身が分類器に見えないので止められる。当てたら `cmp "$W/<path>.merged" <(tr -d '\r' < <path>)` で一致を確かめる（`tr` は作業ツリーが CRLF のときの改行コードの差を除くため。手順 5。macOS の `sed` は `\r` を CR として扱わないので使わない）
   - `settings.json` の `allow` や hooks の登録、`.claude/hooks/` のスクリプトのように権限やガードを変える差分は、Edit で当てても止められることがある（この分類器の規則は、ユーザーが明示的に求めていない権限・ガードの変更を対象にしている）。止められたら差分をユーザーに示し、その変更を取り込むことをユーザー自身のメッセージで伝えてもらってから当て直す
2. `conflicts=N`（N > 0）のファイルは、`$W/<path>.merged` の `<<<<<<< ours` 〜 `>>>>>>> vNEW` の箇所だけを上記の方針で解消し、マーカーが残っていないことを `grep -n '^<<<<<<<\|^>>>>>>>' "$W/<path>.merged"` で確かめてから、手順 1 と同じ方法で書き戻す
3. **書き戻したら、テンプレート版との残差を確認する**: `diff <(git -C "$SRC" show "vNEW:template/<path>") <path>`。残ってよいのは意図したプロジェクト固有の記述だけで、到達不能な分岐・重複した関数定義・同じ内容の二重の箇条書きが出ていたら手で除く。`merge-file` は両側が同じ領域を別の文面で変えていても、変更行が重ならなければコンフリクトにせず隣接する追記として黙って合成する。**プロジェクト側で先行修正したファイル（テンプレートへ還元した知見を自前でも直していた場合など）は `conflicts=0` でも必須**
   固有記述の多いファイルでは、取り込み後の残差だけ見ると今回の変化が従来の固有記述に埋もれる。取り込み前（`vOLD` 対 `HEAD`）の残差も作って突き合わせると、取り込みで変わった残差だけが出る。両者が一致すれば固有記述は失われていない:

   ```bash
   p=<path>
   diff <(git -C "$SRC" show "vOLD:template/$p") <(git show "HEAD:$p")  >"$W/$p.before"
   diff <(git -C "$SRC" show "vNEW:template/$p") <(tr -d '\r' < "$p") >"$W/$p.after"
   diff <(grep -v '^[0-9]' "$W/$p.before") <(grep -v '^[0-9]' "$W/$p.after")   # 行番号行を除いて比較
   ```

   `< >` で始まる行は、取り込み前は固有の残差だったのに取り込み後は消えた行（`< <` の行は、プロジェクトが消した・書き換えたテンプレート行の残差が変わっただけ、`< ---` は区切りなので、どちらも無視してよい）。1 行ずつ、まず同じファイルの `vNEW`（`git -C "$SRC" show "vNEW:template/$p"`）に同じ記述があるかを見る。あればテンプレートに吸収済みなので対応は要らない。無ければテンプレート側の移動先ファイルを探し、そこにも無ければ移動先へ移す。移動先が新規ファイル（手順 4 の「vNEW で追加」）なら、先に手順 4 で `vNEW` の内容を置いてから書き足す。手順を別ファイルへ移すリリース（rules → skill / phases など）では、`merge-file` はファイル単位なので、移動元の固有記述はテンプレート側の削除として黙って消え、移動先の新規ファイルには届かない。ファイルが大きく縮んだ・削除された・新規ファイルが増えたリリースでは、この突き合わせを省略しない（削除されたファイルは手順 4）。移動先が大きく組み変わったファイルは、merge 結果を直すより、`vNEW` の内容を骨格にして固有の節を差し込んで組み直す方が速いことがある

4. ループが `continue` で飛ばしたファイルは手で判断する
   - **project にない / vNEW で追加**: 新規ファイルとして `vNEW` の内容を Write ツールで置き、`cmp <(git -C "$SRC" show "vNEW:template/<path>") <(tr -d '\r' < <path>)` で一致を確かめる（`cp` で置かない理由と `tr` の理由は手順 1。プロジェクトで意図的に削除していたなら置かない）
   - **vNEW で削除**: プロジェクト側でも削除してよいか確認してから削除する。削除する前に取り込み前の残差（`diff <(git -C "$SRC" show "vOLD:template/<path>") <(git show "HEAD:<path>")`）を見て、`>` の行（プロジェクト固有の記述）があれば、手順 3 と同じく移動先へ移す
5. **「現プロジェクト版」は作業ツリーではなく `git show HEAD:<path>` から取る**。Windows で `core.autocrlf=true` だと作業ツリーのファイルは CRLF になっていて、LF のテンプレート側と全行が衝突する。`HEAD` の内容（リポジトリ内の LF）を使えば改行コードの差は出ない。このため取り込み作業は未コミットの変更が無い状態で始める
