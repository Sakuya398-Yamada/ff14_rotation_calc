# Phase 1 補助: FF14 の外部情報の裏取りとパッチ追従の検証

`phases/01-issue-analysis.md` 手順 4 から読む。Issue が FF14 のスキルデータやゲーム仕様に関わるとき（パッチ追従の検証を含む）に使う。

## 手順 4 の詳細（外部情報の収集と裏取り）

- 検索例: `"FF14 竜騎士 ジョブガイド スキル一覧"`, `"FFXIV dragoon job guide skill potency"`
- **利用前の準備**: `ToolSearch query: "select:brave_web_search"` でスキーマをロード
- **未接続・未設定時のフォールバック**:
  1. `ToolSearch` で `No matching deferred tools found` が返る → stdio 起動失敗。ツールは見つかるが呼ぶと `422 SUBSCRIPTION_TOKEN_INVALID` になる → `BRAVE_API_KEY` が未設定（`${BRAVE_API_KEY}` の文字列のまま渡る）か無効。どちらも `.claude/rules/mcp-setup.md`「利用不可時のフォールバック」で続け、ユーザーに `CONTRIBUTING.md`「MCP サーバーのトラブルシューティング」を案内する
  2. 組み込みの `WebSearch` ツールで代替検索を試みる（スキーマは `ToolSearch query: "select:WebSearch"` でロード）
  3. それでも必要な情報が得られない場合、実装に必要な数値・仕様をユーザーに直接確認する
- フロー全体を止めず、情報源を明示した上で次フェーズに進む
- **外部情報のクロスチェック（必須）**: スキル名・バフ名・威力等の数値を扱う Issue では、WebFetch の LLM 要約を鵜呑みにしない。要約は固有名詞（例:「ハイファイラ」→「ハイファイア」）や数値を誤って返すことがあるため、**第2情報源（Brave Search / 別の公式系サイト）でクロスチェック**してから実装に進む（実績: #200 で triangulation により誤記を検出・修正）
- WebFetch を使う場合、プロンプトに「ページに記載のとおり原文を引用」「推測しない」を明示的に指定する
- **ジョブガイド数値の裏取りは生 HTML 抽出を標準手順とする（#326）**: 公式ジョブガイドは同一ページに PvE 欄と PvP 欄が同居しており、WebFetch の LLM 要約が両欄を混同・補完した数値を返すことが既知の失敗モード（実績: #273 で「ハイファイラ 2体目以降25%減」「威力13500」等、実行のたびに変わる誤答が発生。#272 でも情報源間の食い違いあり）。威力・減衰率などの数値を確定させる際は WebFetch 要約に依存せず、**生 HTML を取得 → タグ除去 → スキル名周辺の原文を直接抽出** して確認する。WebFetch はページの概要把握・URL 特定用途では引き続き使ってよい

  定型スニペット（curl + node。#273 セッションで使用した手順の定型化）:

  ```bash
  # 1. ジョブガイドの生 HTML を取得（URL は WebFetch / 検索で特定済みのもの）
  curl -sL "https://jp.finalfantasyxiv.com/jobguide/blackmage/" -o "${TMPDIR:-/tmp}/jobguide.html"

  # 2. タグ除去してスキル名の前後220字の原文を抽出
  node -e '
  const fs = require("fs");
  const text = fs.readFileSync(process.argv[1], "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const name = process.argv[2];
  let i = -1;
  while ((i = text.indexOf(name, i + 1)) !== -1) {
    console.log("--- match at " + i + " ---");
    console.log(text.slice(Math.max(0, i - 220), i + 220));
    console.log();
  }
  ' "${TMPDIR:-/tmp}/jobguide.html" "ハイファイラ"
  ```

  運用上の注意:

  - 出力ファイルはセッションの scratchpad ディレクトリ等の一時領域に置く（リポジトリ直下に残さない）
  - **同一スキル名は PvE 欄と PvP 欄の両方にマッチする**。抽出結果ごとに周辺原文を読み、どちらの欄の記述かを必ず判別する（PvP 欄は威力の桁が大きい・「PvP」見出しが近傍に出る等で見分けられる）
  - 減衰・条件付き効果は「対象数に応じて威力が減少」等の**原文の有無**で判定する。原文に記載がなければ減衰なしと確定してよい（#273 で PvE 欄原文により「減衰記載があるのはフレア/フレアスター/ファウルのみ」と確定した実績）
- **特性習得前の値（Lv100 未満で使う値）の出典**: ジョブガイドは Lv100 時点の値しか載せないので、新規ジョブの追加や既存ジョブへの特性の反映で特性習得前の値が要るときは、次の順で取る（#498 で確定した手順）
  1. 各版のパッチノートの PvE 欄から「修得時の威力」の履歴（「アクション威力アップIII修得時の威力が 640 → 680 に変更されます」のような行。特性名の I〜III はジョブ・版で変わる）を抜き出す。上のスニペットに検索語 `修得時の威力` を渡せば取れる。各版の URL は後述「パッチ追従の検証（定型）」① のパッチノート一覧から取る
  2. consolegameswiki（`https://ffxiv.consolegameswiki.com/wiki/<英語のアクション名。空白は _>`）の「Potency is N prior to learning the ... trait」「The potency of this action is N until ... is learned」の行で裏取りする。パッチノートに出るのは変更のあった値だけなので、変更の無い値はここで取る。ジョブ間で名前が被るアクションは `Ruin_II_(scholar)` のように、小文字のジョブ名が付いたページを見る
  3. 1・2 段で決まらないとき（パッチノートの「威力が A → B」に「修得時」が付かず、wiki の Notes にも特性前の値が無いとき）は、consolegameswiki の特性ページの改訂履歴を見て、そのパッチ時点の版の説明文（ゲーム内説明文の写し）にそのアクションが入っていたかを確かめる。入っていなければ「A → B」は基本値の変更、入っていれば特性値の変更と読める（#500 では、`Magick_Mastery_(Sage)` の 7.2 時点の版（842742。7.1 当日の版）には E.ドシスIII が無く、7.4 版から入っていたので、7.2 の 75 → 80 を基本値の変更と決めた）
     - 版の一覧: `https://ffxiv.consolegameswiki.com/mediawiki/api.php?action=query&prop=revisions&titles=<特性名>_(<Job>)&rvlimit=50&rvprop=ids|timestamp&format=json`。各版の `timestamp` をパッチの公開日と並べ、そのパッチの公開日以前で最新の版を、そのパッチ時点の版とする（パッチ当日に書き換わることが多い。当日の版が無いのは、そのパッチで説明文が変わらなかったか、反映が遅れたかなので、公開日の数日後に版があればその差分も見る）。公開日は同じ wiki の `Patch_<X.Y>` ページの `releasedate-1` の行にある（`Patch_7.3` なら `7.3 - 5 August 2025`）
     - 各版の本文: `https://ffxiv.consolegameswiki.com/mediawiki/api.php?action=query&prop=revisions&revids=<版 ID>&rvprop=content&rvslots=main&format=json`。本文は wikitext で、説明文は `description =` の行
     - ジョブ間で名前が被る特性は、ページ名に大文字始まりのジョブ名が付く（`Magick_Mastery_(Sage)`・`Melee_Mastery_(Dark_Knight)`）。2 段目のアクションページ（小文字の `Ruin_II_(scholar)`）と違い、大文字と小文字を取り違えると `missing` が返る。ジョブ名を付けないページは、存在しない（`missing`）か曖昧さ回避ページ（`{{disambig}}`）で、説明文は無い
     - 3 段目で分かるのは、そのパッチ時点でアクションが特性の対象だったかまでで、特性前の値そのものは出ない。どの段でも決まらないときは推定値を使い、PR 本文とデータのコメントに推定と書く（#607 の照破）
  4. XIVAPI v2（`ActionTransient` の `Description`）は出典に使わない。`@as(raw)` を付けても、レベル条件分岐を評価済みの Lv100 の文面しか返さない。過去版のジョブガイドを見る Wayback Machine（`web.archive.org`）も、クラウドセッションからは届かない（curl は agent proxy で接続が切れ、WebFetch は `unable to fetch from web.archive.org`。#500）
- **パッチ追従の検証**（「パッチ X.Y の調整をデータに反映済みか確かめる」等）は、個別スキルの裏取りではなくジョブ全体の照合になる。後述「パッチ追従の検証（定型）」に従う。ジョブガイドの生 HTML の取得とタグ除去には上のスニペットをそのまま使い、パッチノートは ① のスニペット（PvE 欄の判定込み）を使う

## パッチ追従の検証（定型）

パッチ追従の検証は **① パッチノートの PvE ジョブ調整抽出** と **② ジョブガイドとデータの全件照合** の両方を行う。パッチノートは差分しか分からないため、① だけではデータがもともとずれているケースを見逃す（#304 では BLM のパッチ変更がゼロだったが、② で 13 件の不一致が見つかった）。

1. **① パッチノートの PvE ジョブ調整抽出**: 対象範囲の各版のパッチノートから、実装済みジョブの PvE 調整を抜き出し、データに反映済みかを確かめる
   - 各版の URL はパッチノート一覧（`https://jp.finalfantasyxiv.com/lodestone/special/patchnote_log/`）の生 HTML から取る。Issue 作成後に公開された版があれば対象に含めてよいかユーザーに確認する
   - PvE 欄の抜き出しは次のスニペットで行う（後述の境界の判定込み。#499 で使った方法）

     ```bash
     # 1. パッチノートの生 HTML を取得（URL はパッチノート一覧から取ったもの。例は 7.2）
     curl -sL "https://jp.finalfantasyxiv.com/lodestone/topics/detail/272e3ae76b2663ef84b4d5833441597813e29d75/" -o "${TMPDIR:-/tmp}/patchnote.html"

     # 2. タグ除去して、PvE 欄に出た検索語の前後220字の原文だけを抽出
     node -e '
     const fs = require("fs");
     const text = fs.readFileSync(process.argv[1], "utf8")
       .replace(/<script[\s\S]*?<\/script>/g, " ")
       .replace(/<style[\s\S]*?<\/style>/g, " ")
       .replace(/<[^>]+>/g, " ")
       .replace(/\s+/g, " ");
     const name = process.argv[2];
     let i = -1;
     while ((i = text.indexOf(name, i + 1)) !== -1) {
       // 見出しは冒頭の目次にも並ぶので、最初の出現では切らない。直前にある最後の「バトル関連」が、直前にある最後の「PvP全般」より後ろなら PvE 欄
       if (text.lastIndexOf("バトル関連", i) <= text.lastIndexOf("PvP全般", i)) continue;
       console.log("--- PvE match at " + i + " ---");
       console.log(text.slice(Math.max(0, i - 220), i + 220));
       console.log();
     }
     ' "${TMPDIR:-/tmp}/patchnote.html" "竜騎士"
     ```

     - ジョブの調整は「<ジョブ名> 名称 変更点」の表で始まる。表が 220 字に収まらないときは、表に出たアクション名で引き直す
     - 「PvP全般」の節が無い版（7.01・7.05・7.21 など）では、「バトル関連」より後ろの節（不具合修正・新規アイテム追加など）に出た語も PvE 欄と判定される。周辺原文で見分ける（「〜の不具合」、「マムーナイト」のように別の語の一部に当たったもの）
   - 結果は「版／ジョブ／変更／データへの反映」の表にまとめ、PvE 変更が無かった版・ジョブも明記する
2. **② ジョブガイドとデータの全件照合**: 実装済みジョブごとに、公式ジョブガイド（`https://jp.finalfantasyxiv.com/jobguide/<job>/`）の PvE 欄と `src/client/data/<job>-skills.ts`（関係する `*-buffs.ts` / `*-resources.ts` も）を **全スキル** 照合する。威力だけでなく、リキャスト・効果時間・範囲の減衰率など、データが持つ項目はすべて比べる
   - 結果はジョブごとに「一致 N / 全 M 件」と不一致の一覧（スキル名・データ値・ジョブガイド原文の値）で返す
   - 不一致はジョブ単位で子 Issue に起票する（スコープ外問題の起票フロー。#304 → #407〜#412）

**PvE / PvP 欄の境界**（タグ除去後のテキストで判定する。境界の外の数値は使わない）:

| 情報源 | PvE 欄の範囲 |
|-------|-------------|
| パッチノート | 「バトル関連」の見出しから「PvP全般」の見出しの手前まで。見出しは冒頭の目次にも出るので、最初の出現で切らない（① のスニペットの判定を使う） |
| ジョブガイド | 「PatchX.Y…のPvP全般のアップデート内容は」の行より前 |

**照合時の判定基準**:

- **Lv100 の実効値で比べる**。ジョブガイドは特性習得後（Lv100 時点）の値を使う
- **データ側は `traitPotencyOverrides` を適用してから比べる**。基本の `potency` 等に、`traitLevel` が 100 以下の上書きを `traitLevel` の昇順で重ねた値が実効値（`src/client/logic/skill-level.ts` の `applyTraitOverrides` と同じ規則）。基本値だけを見て不一致にしない
- **データ側コメントに書かれた方針どおりの差は不一致にしない**。例: DRG の「コンボ時威力を基本 potency に採用」、「方向指定ボーナスは全ジョブ成功前提で内包（#522）」、BLM エノキアンの「Lv96 未満では近似値」。方針自体が誤っていると判断したら、不一致ではなく別の指摘として報告する

**サブエージェントの分担の目安**（#304 の実績: 6 ジョブで計 4 体を並列）:

- ① パッチノート抽出に 1 体（全ジョブ・全版をまとめて担当）
- ② ジョブガイド照合に、2 ジョブずつ 1 体
- 委譲プロンプトには上の境界と判定基準をそのまま渡し、返却は表形式（ジョブごとの一致数と不一致の一覧）に絞る。主な不一致はジョブガイド原文で抜き打ちに再確認してから起票する

**記録**: 検証を終えたら、各ジョブの `*-skills.ts` 冒頭コメントに「パッチノートの PvE ジョブ調整は X.Y まで反映済み（#N で照合）」と、ジョブガイドとの既知の差分の子 Issue 番号を書く（#304 の形式）
