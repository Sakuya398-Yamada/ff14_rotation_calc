# 新規ジョブ追加ガイド

FF14 Rotation Calculator に新しいジョブを追加するときの手順書。
初実装者はこのガイドの順番どおりに作業すれば、最小限の触り漏れで新ジョブを動かせる。

実例として **WHM（白魔道士）** と **SAM（侍）** を引用する：

- **WHM**: スキル 19・バフ 3・リソース 2。コンボなし、`autoTransform` なし。**最小テンプレ**として参考になる。
- **SAM**: スキル ~30・バフ 12・リソース 5。WSコンボ・`autoTransform`・共有CD・排他バフ等を網羅。**ほぼ全機能の参照実装**。

---

## 全体像

新規ジョブを追加するために触る場所は **5 ファイル新規作成（データ 3・名前の辞書 2）+ 5 ファイル追記（登録 2・既存テスト 1・README 2）+ アイコン配置** に集約されている。ジョブによっては、ほかの既存テストにも追記する（表の「条件付き」の行）。

| 区分 | パス | 操作 |
|------|------|------|
| データ | `src/client/data/<job>-skills.ts` | 新規作成（攻撃スキル定義） |
| データ | `src/client/data/<job>-buffs.ts` | 新規作成（バフ定義） |
| データ | `src/client/data/<job>-resources.ts` | 新規作成（リソース／ゲージ定義） |
| 名前の辞書 | `src/client/locales/{ja,en}/job-<job>.json` | 新規作成（スキル・バフ・リソースの日英の名前） |
| 登録 | `src/client/i18n.ts` | 名前の辞書を `resources` に追記 |
| 登録 | `src/client/data/job-registry.ts` | `JobId` Union と `JOB_DATA` レコードに追記 |
| 既存テスト | `src/client/components/__tests__/job-picker.test.tsx` | 選べるジョブの固定配列に表示名を追記（ステップ 6） |
| README | `README.md`・`README.en.md` | 対応ジョブの表と FAQ のジョブ一覧・ジョブ数に追記（チェックリスト） |
| 既存テスト（条件付き） | `src/client/logic/__tests__/ws-combo-keeps-combo.test.ts` | WS コンボ（`comboFrom`）を持つジョブなら、対象ジョブの集合にジョブ ID を追記（ステップ 4） |
| 既存テスト（条件付き） | `src/client/logic/__tests__/recent-jobs.test.ts` | 未実装 ID の例に使っているジョブを足すなら、例を差し替え（ステップ 6） |
| アイコン | `src/client/assets/icons/<job>/*.png` | スキルアイコン配置 |
| テスト（推奨） | `src/client/logic/__tests__/<job>-*.test.ts` | 新規作成 |

> 型は `src/client/types/skill.ts` に単一ソースとして集約されているので、データを書きながら適宜参照する。名前（`name` / `shortName`）はデータに持たず、ステップ 5 の辞書に書く。

---

## ステップ 1: アイコン配置

`src/client/assets/icons/<job>/` を作成し、PNG を置く。

### 命名規約（既存ジョブから抽出）

- 基本形: `PascalCase_With_Underscores.png` 例: `Tenka_Goken.png`, `Midare_Setsugekka.png`
- ハイフン許容: 英語表記が含む場合 例: `Tsubame-gaeshi.png`
- ローマ数字: `_II` / `_III` / `_IV` 例: `Blizzard_III.png`, `Fire_IV.png`
- 状態違い: `_1`, `_2` 等
- ロールアクション: サブディレクトリ `role_actions/` に格納 例: `sam/role_actions/True_North.png`

実例: `src/client/assets/icons/whm/`, `src/client/assets/icons/sam/`

> Vite はバンドル時にハッシュ付きファイル名へ変換するため、`import` 経由でのみ参照可能（文字列パス直書きは不可）。

---

## ステップ 2: `<job>-resources.ts` を書く

リソースは ID をスキル／バフから参照されるため、**最初に書く**。

### 必須フィールド

`id`, `maxStacks`, `color`（名前はステップ 5 の辞書に書く）

### 主要な任意フィールド

| フィールド | 用途 | 実例 |
|---|---|---|
| `initialStacks` | 戦闘開始時の保有量 | `whm-resources.ts` の `healing-lily`（H.リリー = 3 で開始） |
| `autoGenerateInterval` + `autoGenerateAmount` | 時間経過で自動生成 | `whm-resources.ts` の `healing-lily`（20 秒ごと +1） |
| `autoGenerateWhileBuff` | 特定バフ中のみ自動生成 | （PCT 等） |
| `acquiredLevel` | 解放レベル | `whm-resources.ts` の `blood-lily` |
| `displayGroup` + `groupMaxStacks` + `displayGroupPriority` | 複数リソースを 1 レーンに統合表示・合計キャップ | `sam-resources.ts` の `setsu`・`getsu`・`ka`（雪/月/花 → `"sen"` レーン統合、合計 3 まで） |
| `stacksPerRow` | ドット表示の折り返し | |
| `displayAsGauge` | ドットではなく塗り＋数字のゲージで描く。上限の大きいリソース（100 等）は必ず付ける（無いとドットが上限の数だけ並ぶ） | `brd-resources.ts`（ソウルボイス・詩心） |

### 最小例（WHM ヒーリングリリー風）

```ts
// src/client/data/<job>-resources.ts
import type { ResourceDefinition } from "../types/skill";

export const XXX_RESOURCES: ResourceDefinition[] = [
  {
    id: "xxx-gauge",
    maxStacks: 100,
    color: "#7AC0FF",
    displayAsGauge: true,
    acquiredLevel: 60,
  },
];
```

### 複数リソースを 1 レーンに統合（SAM の閃方式）

`displayGroup` を同じ値にし、`groupMaxStacks` で合計上限を、`displayGroupPriority` で先頭埋め順を指定する。実装は `src/client/data/sam-resources.ts` の `setsu`・`getsu`・`ka` を参照。

---

## ステップ 3: `<job>-buffs.ts` を書く

### 必須フィールド

`id`, `icon`, `duration`（秒、または `null` = 永続/消費まで）, `effects: BuffEffect[]`, `color`（名前とレーン用の略称はステップ 5 の辞書に書く）

### `BuffEffect.type` の代表パターン

| `type` | `value` の意味 | 実例 |
|---|---|---|
| `speed` | GCD 乗算（0.8 = 20% 短縮） | `whm-buffs.ts` の `presence-of-mind`（神速魔）、`sam-buffs.ts` の `fuka`（風花） |
| `potency` | 威力乗算（1.13 = +13%） | `sam-buffs.ts` の `fugetsu`（風月） |
| `potencyAdd` | 威力に足す値（20 = 威力 +20。倍率を掛ける前に足す）。`appliesToSkillIds` で対象スキルを限る | `mch-buffs.ts` の `overheated`（オーバーヒート） |
| `instantCast` | 詠唱 0 化、GCD 使用時に自動消費 | `whm-buffs.ts` の `swiftcast`（迅速魔） |
| `critRate` / `dhRate` | クリ率／DH 率の加算 | |
| `guaranteedCrit` / `guaranteedDh` | 次の WS で確定クリ／DH | |
| `consumeOnGcd` | 対象 GCD で 1 スタック自動消費 | `sam-buffs.ts` の `meikyo-shisui` |
| `bypassCombo` | `appliesToSkillIds` の WS をコンボ成立扱い（`comboFrom` / `comboFromBuff` のどちらも） | `sam-buffs.ts` の `meikyo-shisui`（明鏡止水）、`mnk-buffs.ts` の `perfect-balance`・`formless-fist`（踏鳴・零の型） |
| `applyBuffOnSkill` | 対象スキル使用時に `appliedBuffId` を追加付与 | `sam-buffs.ts` の `meikyo-shisui`（明鏡止水中の月光→風月等） |
| `resourceCostMultiplier` | 指定リソース消費の倍率 | BLM AF/UI |
| `resourceGainOnSkill` | スキル使用時に追加リソース獲得 | |
| 効果なしフラグ | `effects: []`（条件分岐のシグナル用） | `whm-buffs.ts` の `sacred-sight`、`sam-buffs.ts` の `tendo` |

### 主要な任意フィールド

| フィールド | 用途 | 実例 |
|---|---|---|
| `maxStacks` | スタック付きバフ | `whm-buffs.ts` の `sacred-sight`, `sam-buffs.ts` の `meikyo-shisui` |
| `acquiredLevel` | 解放レベル | |
| `exclusiveGroup` | 同グループは 1 つだけ。新規付与で旧バフを解除 | `sam-buffs.ts`（燕返し系 5 種） |
| `appliesToSkillIds`（`BuffEffect` 内） | 対象スキル限定 | AF3 のファイア系/ブリザド系で異なる倍率 等 |

### 最小例

```ts
// src/client/data/<job>-buffs.ts
import type { BuffDefinition } from "../types/skill";
import xxxIcon from "../assets/icons/<job>/XXX_Buff.png";

export const XXX_BUFFS: BuffDefinition[] = [
  {
    id: "xxx-power",
    icon: xxxIcon,
    duration: 20,
    effects: [{ type: "potency", value: 1.15 }],
    color: "#FFD37A",
    acquiredLevel: 50,
  },
];
```

---

## ステップ 4: `<job>-skills.ts` を書く

### 必須フィールド（全スキル共通）

`id`, `potency`, `type`（`"gcd"` or `"ogcd"`）, `target`（`"enemy"` / `"party"` / `"self"`）, `icon`, `recastTime`, `animationLock`, `acquiredLevel`

- GCD は `recastTime: 2.5`
- oGCD は `recastTime: DEFAULT_ANIMATION_LOCK`（`const DEFAULT_ANIMATION_LOCK = 0.65` をファイル冒頭に定義）で全ジョブ統一する。oGCD の `recastTime` は計算に使われず、タイムライン上のブロック表示幅（`Timeline.tsx` の `getRecastTime`）にのみ使われるため、ジョブ固有値にするとアビリティの見た目がジョブ間で揃わなくなる（#350。`ogcd-recast-time.test.ts` が検証）。実際の再使用間隔は `cooldown` で表し、**必ず**指定する（`whm-skills.ts` の `assize`・`presence-of-mind`）
- 命名規則: ファイル名は `kebab-case`、エクスポートは `<JOB>_ATTACK_SKILLS`

### よく使う任意フィールド

| 用途 | フィールド | 実例 |
|---|---|---|
| レベル進化でアイコン置換 | `replacesSkillId` | `whm-skills.ts` の `stone2`・`stone3`・`stone4`・`glare`・`glare3` |
| 特性による威力上書き | `traitPotencyOverrides` | `whm-skills.ts` の `glare3`・`dia` |
| 詠唱 | `castTime` | `whm-skills.ts` の `stone`, `sam-skills.ts` の `iaijutsu` |
| DoT | `dotPotency` + `dotDuration` | `whm-skills.ts` の `aero`, `sam-skills.ts` の `higanbana` |
| 時間差の攻撃（ペット・分身。使用から決まった遅れで入る攻撃） | `delayedHits[]`（攻撃ごとに `delay`（使用時刻から着弾までの秒数。詠唱があれば詠唱完了から数える）と `potency`）。スキル自体に威力が無ければ `potency: 0`。威力のバフ・クリ/DH・敵の数は着弾時刻の状態で判定し、確定クリ/DH は乗らず、バフも消費しない。特性で攻撃が変わるなら `traitPotencyOverrides` の `delayedHits`（配列ごと置き換える） | `drk-skills.ts` の `living-shadow`（影身具現。`livingShadowHits` で 5 回の攻撃を組み立てる） |
| 時間差の攻撃 1 回ごとの範囲・威力 | `delayedHits` の各要素の項目。範囲は `maxTargets` + `falloffRate` + `falloffStartTarget`（攻撃が `maxTargets` を持てば 3 つともその攻撃の値を、持たなければ使ったスキルの値を使う）。威力は `potencyScaling`（リソース量に比例。量は消費の前に読む）か `potencyPerWeaponskill: { potency, maxCount }`（使ってから着弾までに当てた WS の回数（`maxCount` 回まで）× この `potency`）で決め、どちらかを持つ攻撃の `potency` には最大の威力を書く（パレットの表示用）。`snapshotAtUse: true` で威力のバフを使用時の状態で判定し（DoT と同じ）、`noCritDh: true` でクリティカル・ダイレクトヒットを出さない | `drk-skills.ts` の `living-shadow`（範囲。`shadowAoe`・`shadowAoeFalloff`）、`mch-skills.ts` の `automaton-queen`（オートマトン・クイーン。`potencyScaling` を `petHit` で組み立てる）・`wildfire`（ワイルドファイア。`potencyPerWeaponskill`・`snapshotAtUse`・`noCritDh`。`wildfireHit`） |
| リソース増減 | `resourceChanges[]` | `whm-skills.ts` の `heart-of-solace`, `sam-skills.ts` の `hakaze` |
| リソース量に応じた威力 | `potencyScaling`（`resourceId` の量を `minAmount`〜`maxAmount` に収め、`minPotency`〜`maxPotency` を線形補間する。量は消費の前に読む）。リソースを全部使うなら `consumeAllOfResource` と併せる | `brd-skills.ts` の `apex-arrow`（エイペックスアロー。ソウルボイス 20〜100 で威力 140〜700） |
| バフ付与 | `buffApplications[]` | `whm-skills.ts` の `presence-of-mind`・`swiftcast` |
| バフ消費 | `buffConsumptions[]` | `whm-skills.ts` の `glare4` |
| 確率で付くバフ・確率で得るリソース（期待値） | バフは `buffApplicationProcRates`（`buffApplications`・`comboBuffApplications` の付与確率）と、消費する側の `buffConsumptionAnyOf` の `fallbackPotency`（出なかったときの威力）・`fallbackSkillId`（出なかったときに撃つスキル）。リソースは `resourceChanges` の `procRate`（消費するスキルの威力が、消費する量以上ある確率を掛けた期待値になる）。タイムライン上はどちらも出た扱いで数える | `brd-skills.ts` の `burst-shot`・`refulgent-arrow`、`dnc-skills.ts` の `cascade`・`reverse-cascade`・`fan-dance` |
| WS コンボ | `comboFrom` + `nonComboPotency` + `comboBuffApplications` + `comboResourceChanges`。コンボの起点・継続でない GCD には `keepsCombo: true` を付ける（付けないと、その GCD を挟んだときにコンボが途切れる。`ws-combo-keeps-combo.test.ts` が付け忘れを検出する）。同じテストの「対象のジョブがある」は対象ジョブを固定の集合で持つので、`comboFrom` を持つジョブを足したら集合にジョブ ID を足す（足さないと赤になる） | `sam-skills.ts` の `jinpu`・`shifu`、`sam-skills.ts` の `enpi`（燕飛。`keepsCombo`） |
| 付与バフで表すコンボ（型など。直前の GCD ではなく、前の段が付けたバフでつながる） | 前の段の `buffApplications` で次の段のバフを付け、次の段は `comboFromBuff`（発動条件なら `required: true`）。段のバフに同じ `exclusiveGroup` と `duration` を付ける。成立時の効果は WS コンボと同じ `nonComboPotency` / `comboResourceChanges`。次の段を付けない最終段は `removesBuffs` で段のバフを外す | `mnk-skills.ts` の `FROM_RAPTOR_FORM` などの定数と `twin-snakes`（双掌打）、`mnk-buffs.ts` の `opo-form`・`raptor-form`・`coeurl-form`（型のバフ）、`pct-skills.ts` の `water-in-blue`（ブルーウォータ。最終段） |
| 全消費＋集計獲得 | `consumeAllResources` + `resourceGainByConsumedCount` | `sam-skills.ts` の `hagakure`（葉隠 = 雪/月/花を全消費し剣気獲得） |
| チャージ式・共有CD | `maxCharges` + `cooldownGroup` | `brd-skills.ts` の `bloodletter`・`rain-of-death`・`heartbreak-shot` |
| バフ必須スキル | `requiredBuff` | `sam-skills.ts` の `kaeshi-goken`・`kaeshi-setsugekka`・`ogi-namikiri` |
| 確定クリ | `guaranteedCrit: true` | `sam-skills.ts` の `midare-setsugekka`・`kaeshi-setsugekka`・`tendo-kaeshi-setsugekka` |
| 自動変化 | `autoTransform: AutoTransformEntry[]` + `hidden: true` | `sam-skills.ts` の `iaijutsu`（居合術 → 5 種に変化）／変化先は `hidden: true` |
| AoE 威力減衰 | `maxTargets` + `falloffRate` + `falloffStartTarget` | `src/client/types/skill.ts` の `Skill`（同名のフィールドのコメント） |
| Mint Leaf への書き出し | `gameActionId`（ゲームのアクション ID）。XIVAPI v2 の `Action` シートを日本語名で引き、PvP 版（`IsPvP`）と NPC 用の行を除いて決める。同じアクションの状態違いを表す隠しスキル（黒魔の AF/UB の段階など）は元のアクションの ID に、別のアクションに変わる変化先（居合術 → 彼岸花など）はそのアクションの ID にする。無いスキルは書き出されない | `blm-skills.ts` の `fire`（141）・`fire-up-af2`（隠しスキル。141）・`paradox`（25797） |

### 共有リキャストグループ（`cooldownGroup`）の注意

同一 `cooldownGroup` のスキル間で `cooldown` と `maxCharges` は揃える前提。
不一致時は「最後に使用したスキルの値」が採用されるため、グループ全体で一意にする
（`src/client/types/skill.ts` の `Skill` の `cooldownGroup` のコメント参照）。

### 最小例

```ts
// src/client/data/<job>-skills.ts
import type { Skill } from "../types/skill";
import skillAIcon from "../assets/icons/<job>/Skill_A.png";

const GCD_RECAST = 2.5;
const DEFAULT_ANIMATION_LOCK = 0.65;

export const XXX_ATTACK_SKILLS: Skill[] = [
  {
    id: "skill-a",
    potency: 200,
    type: "gcd",
    target: "enemy",
    icon: skillAIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
  },
];
```

### 推奨される並び順

基本 WS → コンボ分岐 → リソース消費 oGCD → `autoTransform` 系 → 共有 CD（`cooldownGroup`）の順に並べると、レビュー時の追跡が楽になる。

### ID 命名

`Skill.id` / `BuffDefinition.id` / `ResourceDefinition.id` は**グローバルな文字列**として扱われる。ジョブ間衝突を避けるため、原則ジョブ名をプレフィックスに付ける（例: `sam-hakaze`）か、ジョブ固有名で衝突しないことを確認する。ID は名前の辞書のキーにもなるので、`.` と `:` を使わない（キーと名前空間の区切りとぶつかる）。

---

## ステップ 5: 名前の辞書（`locales/{ja,en}/job-<job>.json`）を書く

スキル・バフ・リソースの名前はデータに持たず、i18n の辞書に日英で置く（#846。規約は `.claude/rules/coding-standards.md`「多言語化（i18n）」）。表示する側は `src/client/logic/display-names.ts` の関数で ID から引く。

1. `src/client/locales/ja/job-<job>.json` と `src/client/locales/en/job-<job>.json` を作る。キーはデータの ID で、並びはデータの定義順にする

   ```json
   {
     "skills": {
       "skill-a": { "name": "スキルA" }
     },
     "buffs": {
       "xxx-power": { "name": "○○の力", "shortName": "○力" }
     },
     "resources": {
       "xxx-gauge": { "name": "○○ゲージ", "shortName": "○ゲ" }
     }
   }
   ```

   - `skills` には全スキル（`hidden: true` の変化先・状態違いの定義も含む）を書く。`buffs` と `resources` には `name`（ツールチップ・詳細パネル）と `shortName`（レーンのラベル）の両方を書く
   - `shortName` は `\n` で 2 行に分けられる。レーンのラベルは幅 52px（文字の幅は 44px）・11px で、はみ出した分は黙って切れるので、画面で確かめる
   - ロールアクション（迅速魔・トゥルーノースなど）も、ジョブごとに書く
   - en の値を空にしない（空文字は ja に戻らず空欄で出る）
2. 英語名は次の出典から取る
   - スキル: 公式英語版ジョブガイド（`https://na.finalfantasyxiv.com/jobguide/<job>/`）。日本語版（`https://jp.finalfantasyxiv.com/jobguide/<job>/`）と同じアンカー ID（`pve_action__NN`。ロールアクションはロールの欄の `mrange_action__NN` など）とアイコンの URL を使っているので、それで対応付ける。ジョブガイドの表に無いスキル（居合術・燕返しの変化先など）は、XIVAPI v2 の `Action` シートで日本語名から引く
   - バフ: ジョブガイドに欄が無いので、XIVAPI v2 の `Status` シート（`https://v2.xivapi.com/api/search?sheets=Status&query=Name="<日本語名>"&language=ja&fields=Name,Name@lang(en)`。`query` は URL エンコードする）で引く。同じ名前の行が複数返ることがあるので、英語版ジョブガイドの説明文に出てくる名前と照らす。データ独自の名前（「〜実行可」「〜レディ」など）は、英語名を `language=en` で `Name` に入れて引き、実在を確かめる
   - データ独自の派生名（「ファイガ (AF 中)」のような状態違いの定義）: 元のスキルの英語名に、同じ括弧書きを英語にして付ける（`Fire III (in AF)`）
   - 英語の `shortName`: 2 行に収まる英語名はそのまま改行して入れ、収まらないものだけ英語圏で通じる略語にする（`LotD`・`PoM` など）
3. `src/client/i18n.ts` で 2 つの JSON を import し、`resources` の `ja` と `en` に `"job-<job>"` として登録する（en には `satisfies typeof jaJob<Job>` を付ける。ja のキーが en に欠けていると型エラーになる。en にしか無いキーは検出しない）

抜けは `src/client/logic/__tests__/display-names.test.ts` が検出する（全ジョブのデータにある ID のすべてに、ja と en の空でない名前があるか）。

---

## ステップ 6: `job-registry.ts` に登録

`src/client/data/job-registry.ts` の冒頭で 3 ファイルを import し、`JobId` Union と `JOB_DATA` レコードに追記する。

```ts
// 1. import 追加
import { XXX_ATTACK_SKILLS } from "./<job>-skills";
import { XXX_RESOURCES } from "./<job>-resources";
import { XXX_BUFFS } from "./<job>-buffs";

// 2. JobId Union に追加
export type JobId = "whm" | "drg" | "brd" | "pct" | "blm" | "sam" | "mnk" | "sch" | "ast" | "sge" | "pld" | "war" | "gnb" | "<job>";

// 3. JOB_DATA に追加
export const JOB_DATA: Record<JobId, JobData> = {
  // ...
  "<job>": { abbreviation: "XXX", skills: XXX_ATTACK_SKILLS, buffs: XXX_BUFFS, resources: XXX_RESOURCES },
};
```

> `JOB_DATA` は `Record<JobId, JobData>` 型のため、`JobId` に追加したジョブをここに登録し忘れると **コンパイル時に検出される**。

ジョブピッカーの表示順とロールは `src/client/data/job-catalog.ts` の `JOB_CATALOG` で決まる（`JOB_DATA` のキー順は表示に使われない）。`JOB_CATALOG` には未実装ジョブも含めて全 23 ジョブ（8.0 の新ジョブのバスティオン・ゼファーを含む）が載っているので、追加時に書き換える必要は無い。ただし 8.0 の新ジョブは、公式の略称が出るまで `abbreviation` を持たない（ID の `bastion`・`zephyr` も仮の名前）ので、実装するときに略称を足す（ID も公式の略称に揃えるなら、辞書のキーも一緒に変える）。`JobId` には `JOB_CATALOG` の `id`（例: 占星術師なら `ast`）を使い、`JOB_DATA` の `abbreviation` を `JOB_CATALOG` の値と揃える。食い違うと `src/client/data/__tests__/job-catalog.test.ts` が赤になる。ジョブ名は辞書の catalog（`src/client/locales/{ja,en}/catalog.json` の `jobs.<id>.name`）に 23 ジョブとも登録済みなので、足す必要は無い。`JobPicker.tsx` 側への追記は不要（`JOB_DATA` にあるジョブが選べるようになる）。

`src/client/components/__tests__/job-picker.test.tsx` の「実装済みNジョブは選べ、未実装ジョブは「未対応」で選べない」は、選べることを確かめるジョブの表示名を**固定配列で列挙している**ため、新ジョブの表示名を配列に追記し、テスト名の N も合わせて更新する。このテストは列挙したジョブだけを確かめるので、追記を忘れても `npm test` は赤にならない（チェックリストで確かめる）。未実装ジョブの例（日本語と英語の 2 か所）にはまだ実装していないジョブを使っているので、そのジョブを追加するときは別の未実装ジョブに差し替える。`src/client/logic/__tests__/recent-jobs.test.ts` の「未実装・不正な ID と重複を捨てる」も未実装の ID の例に同じジョブを使っているので、一緒に差し替える。

---

## ステップ 7: テストを書く（推奨）

`src/client/logic/__tests__/<job>-*.test.ts` を新規作成し、ジョブ固有のロジックを検証する。

SAM の以下が雛形として参考になる：

| ファイル | 検証対象 |
|---|---|
| `sam-combo.test.ts` | WS コンボの成立/不成立分岐 |
| `sam-iaijutsu-transform.test.ts` | `autoTransform` の優先評価 |
| `sam-meikyo.test.ts` | `exclusiveGroup` / `bypassCombo` / `applyBuffOnSkill` |
| `sam-resources.test.ts` | `displayGroup` での合計キャップ |
| `sam-shared-cooldown.test.ts` | `cooldownGroup` でのチャージ共有 |
| `sam-tsubame-gaeshi.test.ts` | `exclusiveGroup` バフによる派生スキル |

`npm test` で既存全件と合わせて GREEN を確認する。

---

## チェックリスト（追加完了の判定）

実装完了の最終確認用：

- [ ] `src/client/data/<job>-skills.ts` が存在し、`<JOB>_ATTACK_SKILLS` を export している
- [ ] `src/client/data/<job>-buffs.ts` が存在し、`<JOB>_BUFFS` を export している
- [ ] `src/client/data/<job>-resources.ts` が存在し、`<JOB>_RESOURCES` を export している
- [ ] `src/client/assets/icons/<job>/` 配下に全スキル分のアイコンがある
- [ ] `src/client/locales/{ja,en}/job-<job>.json` に全スキル・バフ・リソースの名前があり、`src/client/i18n.ts` の `resources` に登録されている（`display-names.test.ts` が抜けを検出する）。英語の `shortName` がレーンのラベルに収まることを `/en/` の画面で確かめた
- [ ] `job-registry.ts` の `JobId` Union と `JOB_DATA` レコードに新ジョブが追加されている（`JobId` は `JOB_CATALOG` の `id`、略称は `JOB_CATALOG` と一致。ピッカーの表示順は `JOB_CATALOG` で決まる）
- [ ] `job-picker.test.tsx` の「実装済みNジョブは選べ、未実装ジョブは「未対応」で選べない」の期待値（固定配列）に新ジョブの表示名が追記され、テスト名の N が更新されている
- [ ] `README.md` の「対応ジョブ」表と FAQ「使いたいジョブが未対応」、`README.en.md` の「Supported jobs」表と FAQ「The job I want to use is not supported」のジョブ一覧・ジョブ数に新ジョブが追記されている（並び順は `JOB_DATA` のキー順。英語のジョブ名は `locales/en/catalog.json`）
- [ ] `npm run build` / `npm test` が GREEN
- [ ] 画面上部のジョブピッカーで新ジョブを選べ（「未対応」にならない）、パレットからスキルをタイムラインに配置して期待威力が計算できる

---

## WHM / SAM の差分まとめ（実装複雑度の見取り図）

| 観点 | WHM | SAM |
|---|---|---|
| スキル数 | 19 | ~30 |
| バフ数 | 3 | 12 |
| リソース数 | 2 | 5（うち閃 3 は `displayGroup` 統合） |
| WS コンボ | なし | あり（`comboFrom` 系） |
| `autoTransform` | なし | あり（居合術 → 5 種） |
| 共有CD（`cooldownGroup`） | なし | あり |
| 排他バフ（`exclusiveGroup`） | なし | あり |
| `requiredBuff` / `guaranteedCrit` | なし | あり |
| `applyBuffOnSkill`/`bypassCombo` | なし | あり（明鏡止水） |

**シンプルなジョブを足すなら WHM の構造を真似る** → 機能が増えるごとに SAM の該当箇所を参照、という流れが効率的。

---

## 関連リファレンス

- 型定義の単一ソース: `src/client/types/skill.ts`（JSDoc に各フィールドの意味が網羅されている）
- 評価ロジック: `src/client/logic/resolve-timeline.ts`（新メカニクスを足す際の拡張ポイント）
- 既存ジョブ追加コミット例: SAM = #255（`db7fb6d` 型/評価機構の事前拡張 → `71bbaf5` ジョブ本体 → `5905659` マージ）
