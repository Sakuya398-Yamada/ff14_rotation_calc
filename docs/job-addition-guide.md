# 新規ジョブ追加ガイド

FF14 Rotation Calculator に新しいジョブを追加するときの手順書。
初実装者はこのガイドの順番どおりに作業すれば、最小限の触り漏れで新ジョブを動かせる。

実例として **WHM（白魔道士）** と **SAM（侍）** を引用する：

- **WHM**: スキル 19・バフ 3・リソース 2。コンボなし、`autoTransform` なし。**最小テンプレ**として参考になる。
- **SAM**: スキル ~30・バフ 12・リソース 5。WSコンボ・`autoTransform`・共有CD・排他バフ等を網羅。**ほぼ全機能の参照実装**。

---

## 全体像

新規ジョブを追加するために触る場所は **3 ファイル新規作成 + 1 ファイル追記 + アイコン配置** に集約されている。

| 区分 | パス | 操作 |
|------|------|------|
| データ | `src/client/data/<job>-skills.ts` | 新規作成（攻撃スキル定義） |
| データ | `src/client/data/<job>-buffs.ts` | 新規作成（バフ定義） |
| データ | `src/client/data/<job>-resources.ts` | 新規作成（リソース／ゲージ定義） |
| 登録 | `src/client/data/job-registry.ts` | `JobId` Union と `JOB_DATA` レコードに追記 |
| アイコン | `src/client/assets/icons/<job>/*.png` | スキルアイコン配置 |
| テスト（推奨） | `src/client/logic/__tests__/<job>-*.test.ts` | 新規作成 |

> 型は `src/client/types/skill.ts` に単一ソースとして集約されているので、データを書きながら適宜参照する。

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

`id`, `name`, `shortName`, `maxStacks`, `color`

### 主要な任意フィールド

| フィールド | 用途 | 実例 |
|---|---|---|
| `initialStacks` | 戦闘開始時の保有量 | `whm-resources.ts:16`（H.リリー = 3 で開始） |
| `autoGenerateInterval` + `autoGenerateAmount` | 時間経過で自動生成 | `whm-resources.ts:17`（20 秒ごと +1） |
| `autoGenerateWhileBuff` | 特定バフ中のみ自動生成 | （PCT 等） |
| `acquiredLevel` | 解放レベル | `whm-resources.ts:26` |
| `displayGroup` + `groupMaxStacks` + `displayGroupPriority` | 複数リソースを 1 レーンに統合表示・合計キャップ | `sam-resources.ts:34-36, 45-47, 56-58`（雪/月/花 → `"sen"` レーン統合、合計 3 まで） |
| `stacksPerRow` | ドット表示の折り返し | |

### 最小例（WHM ヒーリングリリー風）

```ts
// src/client/data/<job>-resources.ts
import type { ResourceDefinition } from "../types/skill";

export const XXX_RESOURCES: ResourceDefinition[] = [
  {
    id: "xxx-gauge",
    name: "○○ゲージ",
    shortName: "○ゲ",
    maxStacks: 100,
    color: "#7AC0FF",
    acquiredLevel: 60,
  },
];
```

### 複数リソースを 1 レーンに統合（SAM の閃方式）

`displayGroup` を同じ値にし、`groupMaxStacks` で合計上限を、`displayGroupPriority` で先頭埋め順を指定する。実装は `src/client/data/sam-resources.ts:34-58` を参照。

---

## ステップ 3: `<job>-buffs.ts` を書く

### 必須フィールド

`id`, `name`, `shortName`（レーン用、`\n` 改行可）, `icon`, `duration`（秒、または `null` = 永続/消費まで）, `effects: BuffEffect[]`, `color`

### `BuffEffect.type` の代表パターン

| `type` | `value` の意味 | 実例 |
|---|---|---|
| `speed` | GCD 乗算（0.8 = 20% 短縮） | `whm-buffs.ts:18-21`（神速魔）、`sam-buffs.ts:65-68`（風花） |
| `potency` | 威力乗算（1.13 = +13%） | `sam-buffs.ts:49-52`（風月） |
| `instantCast` | 詠唱 0 化、GCD 使用時に自動消費 | `whm-buffs.ts:42`（迅速魔） |
| `critRate` / `dhRate` | クリ率／DH 率の加算 | |
| `guaranteedCrit` / `guaranteedDh` | 次の WS で確定クリ／DH | |
| `consumeOnGcd` | 対象 GCD で 1 スタック自動消費 | `sam-buffs.ts:88-91` |
| `bypassCombo` | `appliesToSkillIds` の WS をコンボ成立扱い | `sam-buffs.ts:83-87`（明鏡止水） |
| `applyBuffOnSkill` | 対象スキル使用時に `appliedBuffId` を追加付与 | `sam-buffs.ts:94-99`（明鏡止水中の月光→風月等） |
| `resourceCostMultiplier` | 指定リソース消費の倍率 | BLM AF/UI |
| `resourceGainOnSkill` | スキル使用時に追加リソース獲得 | |
| 効果なしフラグ | `effects: []`（条件分岐のシグナル用） | `whm-buffs.ts:31`（sacred-sight）、`sam-buffs.ts:122`（tendo） |

### 主要な任意フィールド

| フィールド | 用途 | 実例 |
|---|---|---|
| `maxStacks` | スタック付きバフ | `whm-buffs.ts:33`, `sam-buffs.ts:109` |
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
    name: "○○の力",
    shortName: "○力",
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

`id`, `name`, `potency`, `type`（`"gcd"` or `"ogcd"`）, `target`（`"enemy"` / `"party"` / `"self"`）, `icon`, `recastTime`, `animationLock`, `acquiredLevel`

- GCD は `recastTime: 2.5`
- oGCD は短い値（`DEFAULT_ANIMATION_LOCK = 0.65` あるいはジョブ固有値）。`cooldown` を**必ず**指定する（`whm-skills.ts:265, 277`）
- 命名規則: ファイル名は `kebab-case`、エクスポートは `<JOB>_ATTACK_SKILLS`

### よく使う任意フィールド

| 用途 | フィールド | 実例 |
|---|---|---|
| レベル進化でアイコン置換 | `replacesSkillId` | `whm-skills.ts:59, 72, 85, 98, 111` |
| 特性による威力上書き | `traitPotencyOverrides` | `whm-skills.ts:112-114, 158-160` |
| 詠唱 | `castTime` | `whm-skills.ts:44`, `sam-skills.ts:254` |
| DoT | `dotPotency` + `dotDuration` | `whm-skills.ts:127-128`, `sam-skills.ts:342-343` |
| リソース増減 | `resourceChanges[]` | `whm-skills.ts:217-220`, `sam-skills.ts:72` |
| バフ付与 | `buffApplications[]` | `whm-skills.ts:279, 292` |
| バフ消費 | `buffConsumptions[]` | `whm-skills.ts:201-203` |
| WS コンボ | `comboFrom` + `nonComboPotency` + `comboBuffApplications` + `comboResourceChanges` | `sam-skills.ts:98-101, 113-115` |
| 全消費＋集計獲得 | `consumeAllResources` + `resourceGainByConsumedCount` | `sam-skills.ts:647-652`（葉隠 = 雪/月/花を全消費し剣気獲得） |
| チャージ式・共有CD | `maxCharges` + `cooldownGroup` | `sam-skills.ts:584-586, 599-601` |
| バフ必須スキル | `requiredBuff` | `sam-skills.ts:447, 462, 633` |
| 確定クリ | `guaranteedCrit: true` | `sam-skills.ts:373, 461, 490` |
| 自動変化 | `autoTransform: AutoTransformEntry[]` + `hidden: true` | `sam-skills.ts:244-328`（居合術 → 6 種に変化）／変化先は `hidden: true` |
| AoE 威力減衰 | `maxTargets` + `falloffRate` + `falloffStartTarget` | `src/client/types/skill.ts:176-191` |

### 共有リキャストグループ（`cooldownGroup`）の注意

同一 `cooldownGroup` のスキル間で `cooldown` と `maxCharges` は揃える前提。
不一致時は「最後に使用したスキルの値」が採用されるため、グループ全体で一意にする
（`src/client/types/skill.ts:100-107` のコメント参照）。

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
    name: "スキルA",
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

`Skill.id` / `BuffDefinition.id` / `ResourceDefinition.id` は**グローバルな文字列**として扱われる。ジョブ間衝突を避けるため、原則ジョブ名をプレフィックスに付ける（例: `sam-hakaze`）か、ジョブ固有名で衝突しないことを確認する。

---

## ステップ 5: `job-registry.ts` に登録

`src/client/data/job-registry.ts` の冒頭で 3 ファイルを import し、`JobId` Union と `JOB_DATA` レコードに追記する。

```ts
// 1. import 追加
import { XXX_ATTACK_SKILLS } from "./<job>-skills";
import { XXX_RESOURCES } from "./<job>-resources";
import { XXX_BUFFS } from "./<job>-buffs";

// 2. JobId Union に追加
export type JobId = "whm" | "drg" | "brd" | "pct" | "blm" | "sam" | "<job>";

// 3. JOB_DATA に追加
export const JOB_DATA: Record<JobId, JobData> = {
  // ...
  "<job>": { name: "○○○", abbreviation: "XXX", skills: XXX_ATTACK_SKILLS, buffs: XXX_BUFFS, resources: XXX_RESOURCES },
};
```

> `JOB_DATA` は `Record<JobId, JobData>` 型のため、`JobId` に追加したジョブをここに登録し忘れると **コンパイル時に検出される**。

ジョブセレクタの選択肢（`JOB_OPTIONS`）は `JOB_DATA` のキー順から自動派生するため、**表示順は `JOB_DATA` レコードのキーの記述順で制御する**。`SkillPalette.tsx` 側への追記は不要。

---

## ステップ 6: テストを書く（推奨）

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
- [ ] `job-registry.ts` の `JobId` Union と `JOB_DATA` レコードに新ジョブが追加されている（セレクタ表示順は `JOB_DATA` のキー順）
- [ ] `npm run build` / `npm test` が GREEN
- [ ] パレットから新ジョブを選択でき、スキルをタイムラインに配置して期待威力が計算できる

---

## WHM / SAM の差分まとめ（実装複雑度の見取り図）

| 観点 | WHM | SAM |
|---|---|---|
| スキル数 | 19 | ~30 |
| バフ数 | 3 | 12 |
| リソース数 | 2 | 5（うち閃 3 は `displayGroup` 統合） |
| WS コンボ | なし | あり（`comboFrom` 系） |
| `autoTransform` | なし | あり（居合術 → 6 種） |
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
