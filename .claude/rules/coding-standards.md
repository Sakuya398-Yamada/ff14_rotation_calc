# コーディング規約

`.claude/rules/` 配下のため起動時に自動で読み込まれる。

## 基本方針

- 言語は **TypeScript** で統一する（フロントエンド・バックエンド共通）
- `strict: true` で型安全性を確保する
- フロントエンドは **React + Vite** で構築する
- バックエンドは **Hono** で API 構築する
- DB操作は **Drizzle ORM** のクエリビルダー経由で行い、SQL 文字列を直接書かない（`sql` テンプレートは CHECK・DEFAULT・式インデックスなど、API で書けない箇所に限る）
- マイグレーションは `npm run db:generate` で生成し、生成物を手で編集しない（`wrangler d1 migrations create` も使わない。drizzle-kit の `migrations/meta/` とずれる）

## ディレクトリ構成

```
ff14_rotation_calc/
├── CLAUDE.md            # コア原則＋rules への索引
├── CONTRIBUTING.md
├── .mcp.json            # プロジェクト共通の MCP サーバー（Playwright / Brave Search / GitHub）
├── package.json
├── drizzle.config.ts    # drizzle-kit の設定
├── migrations/          # drizzle-kit が生成する D1 のマイグレーション（meta/ も含めてコミット）
├── scripts/             # 本番の運用で手や cron から呼ぶスクリプト（D1 のバックアップ。docs/d1-backup.md）
├── src/
│   ├── client/          # React フロントエンド
│   │   ├── assets/      # アイコン画像（icons/<ジョブ ID>/*.png）
│   │   ├── components/
│   │   ├── data/        # ジョブごとのスキル・バフ・リソースのデータ（<ジョブ ID>-skills.ts 等）と、ジョブ・コンテンツの一覧
│   │   ├── en/          # 英語版の HTML（/en/ で配信する index.html）
│   │   ├── locales/     # i18n の辞書（{ja,en}/<名前空間>.json。後述「多言語化（i18n）」）
│   │   ├── logic/       # 画面に依らない処理（タイムラインの解決・期待値の計算・保存・言語の判定など）
│   │   ├── styles/      # CSS（デザイントークンの tokens.css）
│   │   ├── types/       # スキル・バフ・リソースなどのデータの型（skill.ts）
│   │   ├── i18n.ts      # i18next の初期化
│   │   └── main.tsx
│   └── server/          # Hono バックエンド（Cloudflare Worker）
│       ├── db/          # Drizzle のスキーマ（schema.ts）
│       ├── routes/
│       ├── services/
│       └── index.ts
└── .claude/
    ├── agents/          # サブエージェント定義
    ├── rules/           # 自動読み込みされる規約集
    ├── routines/        # スケジュールタスク（定期ルーティン）の手順書。登録側の呼び出し文が実行のたびに読む（rules/routines.md）
    ├── hooks/           # PreToolUse / SessionStart で使うシェルスクリプト
    ├── scripts/         # 手で呼ぶ補助スクリプト（知見ボードの読み出し等）
    ├── settings.json    # 権限と hooks の登録
    └── skills/          # /issue-start, /issue-plan, /issue-priority, /template-update, /playwright-mcp
```

## 命名規約

| 対象 | 規約 | 例 |
|------|------|----|
| ファイル名 | `kebab-case` | `skill-data.ts` |
| Reactコンポーネント | `PascalCase` | `SkillList.tsx` |
| 変数・関数 | `camelCase` | `calculateDamage` |
| 定数 | `UPPER_SNAKE_CASE` | `MAX_BUFF_STACK` |
| 型・インターフェース | `PascalCase` | `SkillData` |

## 多言語化（i18n）

文言と名前は react-i18next の辞書に置く（方式は #836、土台は #844）。言語はパスだけで決める（`/en/` から始まれば `en`、それ以外は `ja`。`src/client/logic/language-path.ts`）。i18next の言語検出プラグインは入れない（既定の順番では localStorage がパスより先に効き、URL と表示が食い違う）。

- **置き場所**: `src/client/locales/{ja,en}/<名前空間>.json`。名前空間を足したら、`src/client/i18n.ts` の `resources` に両方の言語を登録する。型（`src/client/i18next.d.ts`）は `ja` の辞書から作り、`en` の辞書が `ja` のキーをすべて持つことを `satisfies` で確かめる。`en` にしか無い `_one` の抜けは型では見つからないので、`src/client/__tests__/i18n-resources.test.ts` が確かめる
- **名前空間とキー**:

  | 名前空間 | 中身 | キー |
  |---|---|---|
  | `common`（既定） | UI の文言（見出し・ボタン・`aria-label`・`title` 属性・確認ダイアログ・エラー文） | 1 段目は、辞書に移す前にその文言を定義していたファイルの名前を lowerCamelCase にしたもの（ディレクトリ名は付けない。`SummaryBar.tsx` → `summaryBar`、`logic/shared-timeline.ts` → `sharedTimeline`）。表示するのが別のファイルでも、定義していたファイルで決める。単独では表示しない部品で、複数のファイルで使うもの（名前の並びの区切りなど）は `shared` に置く（「閉じる」のように同じ語のラベルは、ファイルごとに別のキーにする）。2 段目からは文言の役割を lowerCamelCase で付ける（`summaryBar.totalExpectedPotency`。略語も 1 語として扱い `dotExpectedPotency`） |
  | `catalog` | ジョブ・ロール・コンテンツとそのカテゴリの名前 | `<種類>.<データの ID>.name`（`jobs.blm.name`。種類は `jobs`・`roles`・`contents`・`contentCategories`） |
  | `job-<ジョブ ID>` | そのジョブのスキル・バフ・リソースの名前 | `<種類>.<データの ID>.name`、略称は `.shortName`（`skills.fire.name`。種類は `skills`・`buffs`・`resources`）。ロールアクションのように別のジョブにも同じ ID があるものも、ジョブごとに書く。状態違いの派生名（`ファイガ (AF 中)`）も、ID ごとに丸ごと書く |

- **キーの決まり**: 日本語の文言そのものや表示の順番をキーにしない。`common` では、同じ語でも定義するファイルや役割が違えば別のキーにする（言語ごとに訳し分けられるように。同じものを指す見えるラベル・`title`・`aria-label` が同じ文言なら 1 つでよい）。コードの値（エラーコードの `too_large`・データの ID）から引くキーは、その値をそのままキーの段にし（変換の表を作らない。表示の順番の配列は残してよい）、テンプレートリテラルに `as const` を付けて型を効かせる（`` t(`sharedTimeline.saveErrors.${error}` as const) ``。値の型がユニオンなら、全部のキーがあるかを型チェックで確かめられる）。データの ID のように型が `string` のときは、そのままでは型エラーになるので、`ParseKeys`（`import type { ParseKeys } from "i18next"`）に寄せて通す（`` t(`jobs.${id}.name` as ParseKeys<"catalog">, { ns: "catalog" }) ``）。この形と、名前空間をユニオンにしたとき（`` `job-${JobId}` ``）は、型ではキーの有無を確かめられない。キーを組み立てる処理を、`t` を引数で受け取る関数として 1 か所に置き、全 ID に `ja` と `en` の名前があることをテストで確かめる（`resources` の中身か `i18next.getResource` を見る。`i18next.exists` や `t(…, { lng: "en" })` は `ja` に戻るので、`en` の抜けを見逃す）。データの ID には `.` と `:` を使わない（キーと名前空間の区切りとぶつかる）
- **ほかの名前空間**: `useTranslation()` の `t` は `common` を引く。ほかの名前空間は `t("<キー>", { ns: "<名前空間>" })` で引く（`t("jobs.blm.name", { ns: "catalog" })`。この形なら型が効く）
- **描画の外**: コンポーネントの中（イベントハンドラを含む）では `useTranslation()` の `t` で引く（言語を変えると描き直される）。描画中に呼ぶ `components/` の補助関数には、その `t` を引数で渡す。`logic/` と effect の中では、`import i18next from "i18next"` の `i18next.t` を関数の中で呼ぶ。モジュールの最上位の定数や、計算結果（保存・共有するデータを含む）に訳した文字列を入れない（その時点の言語で固まる）。ID を持たせ、表示するときに引く
- **補間**: 数値や名前を埋め込む文は、文の途中で切って連結せず、1 つのキーに `{{名前}}` で書く（英語で語順が変わるため）。その文の単位（`秒`・`体`）も辞書の文に含める。名前と同じく、訳した語を補間に渡してよい。言語で変わらない単位（`s`・`%`・`×`）だけを数値に付けた表示（`12.3s`・`+10.0%`・`×1.20`）と、言語で変わらない記号（`▼`・`▶`・`⚠`・`/`）は、コードで組んでよい。言語で変わる単位（`体`・`秒`・`体目`）は、数値と単位だけの表示でも辞書に置く。入力欄などの部品を挟む表示は、部品の前後で別のキーにしてよい（ラベルのコロンはキーの値に含める。`開始:` と `<input>` と `s`）。名前の並びは、`shared.listSeparator`（`ja` は `・`、`en` は `, `）でつなぐ
- **数値と日時の書式**: 桁区切りが要る数値と日時は、書式を付けた文字列にして補間に渡す。書式は `toLocaleString(lang)` か `Intl.*Format(lang)` で付ける（コンポーネントでは `lang` を `useLanguage()` で取り、`logic/` の関数は引数で受け取る。`"ja-JP"` のように固定しない）。小数の桁を揃えるだけなら `toFixed` でよい。辞書に移すときは、今の表示（桁区切りの有無）を変えない。i18next の組み込みの formatter（`{{value, number}}`）は使わない（呼び出し側の書式と二通りになるため）
- **単数・複数**: 英語で単数と複数で形が変わる文は、`count` に数値を渡して `<キー>_one` / `<キー>_other` を書く（`ja` は `<キー>_other` だけ）。`count` は複数形を引くときだけに使い、形が変わらない数は別の名前で渡す。`{{count}}` は書式を付けずに出るので、桁区切りが要るなら書式を付けた文字列を別の名前でも渡して、そちらを文に書く
- **型で見つからない誤り**: 複数形のキーを `count` 無しや文字列の `count` で呼ぶとキーの文字列が、補間の値を渡し忘れると `{{名前}}` が、そのまま出る。補間の値が `null` / `undefined` だと空で出る。値が空文字のキーは `ja` に戻らず空欄で出る（`en` の訳が決まらないときも空にしない）
- **英訳**: 固有名詞（ジョブ・ロール・スキル・バフ・コンテンツの名前）とゲーム用語は、英語版のクライアントと公式の英語版ジョブガイドの表記に揃える（威力 → potency、リキャスト → recast。日本語の略語の CRT・DH は critical hit・direct hit）。それ以外の見出し・ラベル・ボタンは、先頭の語だけを大文字にする（`Total expected potency`）。英語でも使う略語（DoT・PPS・URL）はそのまま
- **テスト**: `vite.config.ts` の `setupFiles`（`src/client/test-setup.ts`）が `ja` で初期化するので、日本語の文字列で書いたテストはそのまま通る。英語の表示を確かめるテストは、`beforeEach` で `i18next.changeLanguage("en")`、`afterEach` で `"ja"` に戻す

## hooks / scripts 用 Node.js スクリプトの拡張子

- `.claude/hooks/` / `.claude/scripts/` に単独の Node.js スクリプトを追加する場合は **`.cjs` 拡張子を使う**
- 理由: ルート `package.json` に `"type": "module"` があるため、`.js` は ESM として読み込まれ `require('fs')` 等が `ReferenceError: require is not defined in ES module scope` で失敗する
- bash スクリプト内の `node -e "..."` インライン実行はこの制約の影響を受けない（ファイル拡張子による判定が働かないため）

## hooks 開発・検証時の注意

- **検証ペイロードはスクリプトファイル経由で間接実行する**: Bash ツールのコマンド文字列に `git checkout -b` / `git commit -m` 等のリテラルを含めると、自セッションの PreToolUse hook が文字列にマッチして発動・ブロックされる。ペイロード組み立てと hook 呼び出しは scratchpad 等のシェルスクリプトに書き出してから実行する（前例: #290。既存テストスイート `.claude/hooks/__tests__/*.test.sh` が間接実行構造なのも同じ理由）

## コメントとドキュメント

- 自明なコードにコメントは付けない
- ロジックが直感的でない場所のみ「なぜそうしたか」を書く
- 触っていないコードに後付けで型注釈・コメント・docstringを追加しない
