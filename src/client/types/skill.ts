/** スキルの種別 */
export type SkillType = "gcd" | "ogcd";

/** スキルの実行対象 */
export type SkillTarget = "enemy" | "party" | "self";

/** リソースの変動（スキル使用時） */
export interface ResourceChange {
  /** リソースID */
  resourceId: string;
  /** 変動量（正で獲得、負で消費） */
  amount: number;
  /**
   * 残量が不足する場合に「エラー化せず、この変動自体をスキップする」フラグ。
   * 1スキル内に複数のフラグ付き変動がある場合はアトミックに連動し、
   * そのうち 1 つでも負変動の残量不足が検知されれば、フラグ付きの全変動（正負問わず）を一括スキップする。
   * 例: サブトラクティブパレットの WP-1 / BP+1 — WP が 0 なら両方とも適用されない。
   */
  skipIfInsufficient?: boolean;
  /**
   * 指定バフのいずれかがアクティブなときだけこの変動を適用する（未アクティブ時はエラーにせず変動しない）。
   * 例: エンピリアルアローの詩心付与 — 歌の実行中のみ。
   */
  requiredBuffAnyOf?: string[];
}

/** バフスタック消費（スキル使用時） */
export interface BuffConsumption {
  /** 消費するバフのID */
  buffId: string;
  /** 消費スタック数 */
  stacks: number;
}

/** 特性による威力変動 */
export interface TraitPotencyOverride {
  /** この特性が適用されるレベル */
  traitLevel: number;
  /** 変更後の威力（undefinedの場合は変更なし） */
  potency?: number;
  /** 変更後の非コンボ時威力（undefinedの場合は変更なし） */
  nonComboPotency?: number;
  /** 変更後のDoT威力（undefinedの場合は変更なし） */
  dotPotency?: number;
  /** 変更後の最大チャージ数（undefinedの場合は変更なし） */
  maxCharges?: number;
  /** 変更後の個別リキャストタイム（秒）（undefinedの場合は変更なし） */
  cooldown?: number;
  /** 変更後のリキャストタイム（秒）。GCD の基礎リキャストに使う（undefinedの場合は変更なし） */
  recastTime?: number;
  /** 変更後の、GCD を発生させるアビリティの GCD の基礎リキャスト（秒）（undefinedの場合は変更なし） */
  gcdRecastTime?: number;
  /** 変更後のリソース量に応じた威力スケーリング（undefinedの場合は変更なし） */
  potencyScaling?: Skill["potencyScaling"];
  /** 変更後の付与バフIDリスト（undefinedの場合は変更なし） */
  buffApplications?: string[];
  /** 変更後のコンボ成立時の付与バフIDリスト（undefinedの場合は変更なし。例: プロミネンスの神聖魔法効果アップは Lv72 から） */
  comboBuffApplications?: string[];
  /** 変更後のコンボ成立時のリソース変動（配列ごと置き換える。undefinedの場合は変更なし） */
  comboResourceChanges?: Skill["comboResourceChanges"];
  /** 変更後のリソース変動（配列ごと置き換える。undefinedの場合は変更なし。例: ブラッドソイルのソイル獲得は Lv88 で 2 → 3） */
  resourceChanges?: Skill["resourceChanges"];
  /** 変更後のバフ消費のOR条件（配列ごと置き換える。undefinedの場合は変更なし） */
  buffConsumptionAnyOf?: Skill["buffConsumptionAnyOf"];
  /** 変更後のバフ有効時の威力上書き（配列ごと置き換える。undefinedの場合は変更なし） */
  conditionalPotencyBuffs?: Skill["conditionalPotencyBuffs"];
  /** 変更後の時間差の攻撃（配列ごと置き換える。undefinedの場合は変更なし。例: 影身具現の分身の攻撃は Lv88 で 340 → 420） */
  delayedHits?: DelayedHit[];
}

/**
 * 時間差の攻撃の範囲（意味は Skill の同名の項目と同じ。#977）。攻撃が maxTargets を持てば 3 つともその攻撃の値を使い、
 * 持たなければ使ったスキルの 3 つを使う（項目ごとには混ぜない）
 */
export type DelayedHitArea = Pick<Skill, "maxTargets" | "falloffRate" | "falloffStartTarget">;

/** 使用から決まった遅れで入る攻撃（ペット・分身。#957） */
export interface DelayedHit extends DelayedHitArea {
  /** 使用時刻（詠唱があれば詠唱完了）から着弾までの秒数。スキルに設定した着弾までの遅れ（hitDelays）は足さない */
  delay: number;
  /** 威力。potencyScaling / potencyPerWeaponskill を持つ攻撃は最大の威力（パレットの表示に使う） */
  potency: number;
  /**
   * 使用前のリソース量に応じた威力（意味は Skill の同名の項目と同じ線形補間。機工士のオートマトン・クイーンは消費したバッテリーで変わる。#958）。
   * 量は使用時の消費の前に読む
   */
  potencyScaling?: Skill["potencyScaling"];
  /**
   * 使ってから着弾までに当てた WS の回数で威力を決める（機工士のワイルドファイア。#958）。威力 = potency × min(回数, maxCount)。
   * 数えるのは、このスキルより後に使った、エラーの無い GCD のうち、着弾（着弾までの遅れがあれば着弾時刻）が [使用時刻, この攻撃の着弾時刻) に入るもの
   */
  potencyPerWeaponskill?: { potency: number; maxCount: number };
  /** 威力のバフ（buffMultiplier）を、着弾時刻ではなく使用時の状態で判定する（DoT と同じ扱い。ワイルドファイア） */
  snapshotAtUse?: boolean;
  /** クリティカル・ダイレクトヒットが発生しない（期待値は DET の倍率だけ。ワイルドファイア） */
  noCritDh?: boolean;
}

/** 時間差の攻撃 1 回分の計算結果。威力のバフ・クリ/DH・敵の数は、着弾時刻の状態で判定する（#957）。範囲は攻撃の定義から写す（#977） */
export interface ResolvedDelayedHit extends DelayedHitArea {
  /** 着弾時刻（秒） */
  time: number;
  /** 威力 */
  potency: number;
  /** 着弾時刻の威力倍率（使ったスキルの ID で appliesToSkillIds を引く） */
  buffMultiplier: number;
  /** 着弾時刻のクリティカル発生率ボーナス */
  critRateBonus: number;
  /** 着弾時刻のダイレクトヒット発生率ボーナス */
  dhRateBonus: number;
  /** 着弾時刻の敵の数。合計威力は攻撃の範囲（DelayedHitArea。無ければ使ったスキルの範囲）で決まる */
  targetCount: number;
  /** クリティカル・ダイレクトヒットが発生しない（DelayedHit.noCritDh を写す） */
  noCritDh?: boolean;
}

/** サポートするプレイヤーレベル */
export type PlayerLevel = 70 | 80 | 90 | 100;

/**
 * autoTransform 配列要素の型。
 * `buffId` または `resourceConditions` の少なくとも一方が必須。
 * 両方指定時は AND 評価（バフアクティブ かつ 全リソース閾値以上）。
 */
export type AutoTransformEntry =
  | {
      buffId: string;
      resourceConditions?: { resourceId: string; minAmount: number }[];
      skillId: string;
    }
  | {
      buffId?: string;
      resourceConditions: { resourceId: string; minAmount: number }[];
      skillId: string;
    };

/** スキルの定義データ */
export interface Skill {
  /** スキルの一意識別子。名前は辞書の job-<ジョブ ID> の `skills.<id>.name` にある（#846） */
  id: string;
  /**
   * ゲームのアクション ID（XIVAPI の Action シートの行 ID）。Mint Leaf への書き出しに使い、無いスキルは書き出さない（#834）。
   * 同じアクションの状態違いを表す隠しスキル（黒魔の AF/UB の段階など）は元のアクションの ID に、
   * 別のアクションに変わる変化先（侍の居合術 → 彼岸花など）はそのアクションの ID にする
   */
  gameActionId?: number;
  /** 威力（基本値。特性適用前） */
  potency: number;
  /** GCD or oGCD */
  type: SkillType;
  /** スキルの実行対象（enemy: 敵, party: 味方, self: 自分） */
  target: SkillTarget;
  /** スキルアイコン画像のパス */
  icon: string;
  /** リキャストタイム（秒）。GCDスキルは2.5s、oGCDはスキル固有値 */
  recastTime: number;
  /** アニメーションロック（秒）。デフォルト0.65s */
  animationLock: number;
  /** 習得レベル */
  acquiredLevel: number;
  /** このスキルが置き換える元スキルのID */
  replacesSkillId?: string;
  /** 特性による威力変動テーブル */
  traitPotencyOverrides?: TraitPotencyOverride[];
  /** リソース変動（未設定の場合はリソースに影響なし） */
  resourceChanges?: ResourceChange[];
  /** 使用時に付与するバフのIDリスト */
  buffApplications?: string[];
  /**
   * buffApplications で付与するバフの付与確率（0〜1。キーの無いバフは確定付与）。
   * タイムライン上は確定で付き、1 未満の確率だけで付いたバフを自動消費すると ResolvedTimelineEntry.unconfirmedProcBuffs で警告する。
   * 確定扱いに戻すのは buffApplications の確定付与だけ（comboBuffApplications 等の付与経路は見ない）
   */
  buffApplicationProcRates?: Record<string, number>;
  /** 使用時に消費するバフスタック */
  buffConsumptions?: BuffConsumption[];
  /** 使用時にアクティブなら解除するバフID（未アクティブでもエラーにしない。例: UB 中のファイアは UB を解除するだけ） */
  removesBuffs?: string[];
  /** 詠唱時間（秒）。詠唱中はoGCDスキルを使用できない。未設定の場合はインスタント（詠唱なし） */
  castTime?: number;
  /** 個別リキャストタイム（秒）。oGCDスキル等の固有クールダウン。未設定の場合はリキャスト制約なし */
  cooldown?: number;
  /** 最大チャージ数。未設定の場合は1（従来通り1回使用でクールダウン） */
  maxCharges?: number;
  /**
   * 共有リキャストグループ識別子。同一グループのスキル間でチャージ・クールダウンを共有する。
   * 例: 必殺剣・紅蓮（Lv70）と必殺剣・閃影（Lv72）は同じ "hissatsu-senei-guren" を持ち、
   * どちらを使ってもリキャストが共有される。
   * 未設定の場合は従来通りスキル個別のチャージ管理（後方互換）。
   * 注: 同一グループ内では `cooldown` / `maxCharges` を揃える前提。
   * 不一致時は「最後に使用したスキルの値」が採用されるため、グループ全体で一意になるように設定すること。
   */
  cooldownGroup?: string;
  /**
   * 使ったときに、列挙したリキャストを seconds 秒短縮する（戦士のフェルクリーヴ等でウォークライを 5 秒）。
   * chargeKey は短縮対象スキルの cooldownGroup（未設定ならスキル ID）。未使用・チャージ満タンなら何もしない
   */
  cooldownReductionsOnUse?: { chargeKey: string; seconds: number }[];
  /**
   * 使ったときに、効果中のバフだけを seconds 秒延長する（戦士の原初の解放で戦嵐を 10 秒）。
   * 効果中でなければ何もしない。上限はそのバフの BuffDefinition.maxDuration（付与時刻から数える。未設定なら上限なし）
   */
  buffExtensions?: { buffId: string; seconds: number }[];
  /**
   * 使用から決まった遅れで入る攻撃（ペット・分身。#957）。各攻撃は着弾時刻で PPS 区間・集計に入り、威力のバフ・クリ/DH・
   * 敵の数も着弾時刻の状態で判定する。確定クリ/DH は乗らず、バフも消費しない。potency（使ったときの威力）とは別に数える
   */
  delayedHits?: DelayedHit[];
  /** DoT威力（1ティックあたり。基本値。特性適用前） */
  dotPotency?: number;
  /** DoT持続時間（秒）。dotPotency設定時は必須 */
  dotDuration?: number;
  /** 使用時にDoT効果時間をリセットする対象スキルIDリスト（バフスナップショットも再取得） */
  refreshesDots?: string[];
  /** このスキルの DoT 付与時に、列挙した他スキルの DoT をその時点で打ち切る（同時に1種類だけの DoT 用。自スキルIDは無視） */
  replacesDots?: string[];
  /** コンボ元スキルIDリスト（直前に使ったコンボ対象の GCD がいずれかならコンボ成立。keepsCombo の GCD は挟んでもよい） */
  comboFrom?: string[];
  /** 実行してもコンボ状態を更新しない GCD（挟んでも WS コンボが途切れない）。comboFrom を使うジョブで、コンボの起点・継続でない GCD に付ける */
  keepsCombo?: boolean;
  /**
   * 付与バフで表すコンボ（comboFrom の代わりに使い、併用しない）。直前の GCD とコンボタイマーは見ず、
   * buffId のバフが効果中か、bypassCombo バフ（appliesToSkillIds にこのスキル）が効果中ならコンボ成立。
   * - 成立: comboFrom と同じく nonComboPotency を使わず、comboResourceChanges / comboBuffApplications / DoT を適用する
   * - 不成立で required: true: 発動条件エラー（comboErrors の missing。威力を計上しない）
   * - 不成立で required: false: 実行するが wsComboError（警告）にし、nonComboPotency を使い combo* は適用しない
   * 書き方: 前の段のスキルが buffApplications で次の段のバフを付ける（成否を問わず付く）。
   * 段のバフに同じ exclusiveGroup を付けると前の段のバフが外れ、持続はバフの duration で決まる。
   * 次の段を付けない最終段は removesBuffs で段のバフを外す（例: PCT のブルーウォータ）。
   * autoTransform の変化先は変化先の定義で判定するので、変化先にも同じように書く。
   * 例: モンクの型 — 双掌打は comboFromBuff: { buffId: "raptor-form", required: true } と buffApplications: ["coeurl-form"]
   */
  comboFromBuff?: { buffId: string; required: boolean };
  /** 非コンボ時の威力（コンボ不成立時に適用。未設定の場合はpotencyを使用） */
  nonComboPotency?: number;
  /** コンボ成立時のみ付与するバフのIDリスト */
  comboBuffApplications?: string[];
  /** コンボ成立時のみ適用するリソース変動 */
  comboResourceChanges?: ResourceChange[];
  /** 全消費リソースIDリスト（リストされたリソースを全て消費、1つ以上あれば実行可） */
  consumeAllResources?: string[];
  /** 指定リソースを全消費する（resourceChangesの消費量を上書きし全量消費） */
  consumeAllOfResource?: string;
  /** リソース量が閾値以上の場合のみ付与するバフ */
  buffApplicationIfResource?: { resourceId: string; minAmount: number; buffIds: string[] };
  /**
   * buffId の効果中に使うと、使用前の resourceId の量 n に応じて buffIds[n - 1] を付与する（n = 0 なら付与しない）。
   * 例: 軍神のパイオン中の賢人のバラード／旅神のメヌエット — 詩心 1〜4 で軍神の加護（詩心1〜4）。
   */
  buffApplicationByResourceWhileBuff?: { buffId: string; resourceId: string; buffIds: string[] };
  /** リソース消費量に応じた威力スケーリング（線形補間） */
  potencyScaling?: {
    resourceId: string;
    minAmount: number;
    minPotency: number;
    maxAmount: number;
    maxPotency: number;
  };
  /**
   * 実行前のリソース量に応じた段階威力（index 0 = 1個のとき）。配列長を超える量は末尾の威力。
   * 例: ピッチパーフェクト — 詩心 1/2/3 で威力 100/220/360。
   */
  potencyByResourceAmount?: {
    resourceId: string;
    potencies: number[];
  };
  /** consumeAllResources消費数に応じたバフ適用テーブル（index 0 = 1個消費時のbuffId[]） */
  buffApplicationsByConsumedCount?: string[][];
  /**
   * consumeAllResources で消費したリソース数に応じた別リソース獲得。
   * 例: 葉隠（侍）— 雪/月/花の閃を全消費し、消費した数 × 10 の剣気を獲得。
   */
  resourceGainByConsumedCount?: {
    /** 消費数の集計対象リソースID（consumeAllResources と同一を指定するのが基本） */
    fromResourceIds: string[];
    /** 獲得するリソースID */
    resourceId: string;
    /** 1個消費あたりの獲得量 */
    gainPerConsumed: number;
  };
  /**
   * バフ消費のOR条件（いずれか1つを消費。potency指定時は威力を上書き）。
   * fallbackPotency指定時は、効果時間内の付与元の付与確率 p_i（buffApplicationProcRates）から
   * 発動確率 P = 1 − Π(1 − p_i) を求めて期待値を計算する。確率付きの付与元が無ければ確定付与として補正しない。
   * fallbackPotency を持つ選択肢があれば、どのバフも無い枠でもエラーにせず、P = 0 として fallback の威力で撃つ（フィラー枠。#842）。
   * fallbackSkillId は出なかったときに撃つ GCD。消費時、その付与確率 p から (1 − P) × p の付与元を残してバフを付け直す
   */
  buffConsumptionAnyOf?: {
    buffId: string;
    stacks: number;
    potency?: number;
    fallbackPotency?: number;
    fallbackSkillId?: string;
  }[];
  /** 指定バフがアクティブな場合、resourceChangesの特定リソース消費をスキップしバフを1スタック消費する（バフ優先消費） */
  buffSkippableResource?: { buffId: string; resourceId: string };
  /** 指定バフがアクティブなら威力を上書きしバフを消費する。バフ未付与時は通常威力で実行（エラーにならない） */
  conditionalPotencyBuffs?: { buffId: string; potency: number }[];
  /** スキル使用に必要なバフID（未アクティブ時はエラー、威力を計上しない） */
  requiredBuff?: string;
  /** このバフがアクティブな間は使用不可（アクティブ時はエラー（comboErrors の forbidden）、威力を計上しない。例: 黒魔紋は「黒魔紋」非効果中のみ） */
  forbiddenBuff?: string;
  /** スキル使用に必要なバフIDのOR条件（いずれか1つでもアクティブなら可。全て未アクティブ時はエラー、威力を計上しない。バフは消費しない） */
  requiredBuffAnyOf?: string[];
  /**
   * 発動条件の上限。実行前のリソース量が maxAmount を超えていたらエラー（resourceErrors の overMax）にし、実行しない。
   * 例: 踏鳴（ビーストチャクラ 0）、鉄山闘気（闘気 5 未満 = maxAmount 4）。未習得のリソースは 0 として扱う
   */
  resourceMaxConditions?: { resourceId: string; maxAmount: number }[];
  /**
   * 自動変化条件。
   * - 配列形式: 先頭から優先評価し、最初に条件を満たすエントリの変化先を採用
   * - 単一エントリ形式: 後方互換のため維持
   * - 各エントリの条件:
   *   - `buffId` 指定時: 該当バフがアクティブであること
   *   - `resourceConditions` 指定時: 指定された全リソースが minAmount 以上であること（AND）
   *   - 両方指定時は AND（バフあり かつ 全リソース閾値以上）
   * - `buffId` も `resourceConditions` も無いエントリは型エラー（型レベルで「どちらかは必須」を強制）
   */
  autoTransform?: AutoTransformEntry | AutoTransformEntry[];
  /** UI上で非表示にするか（autoTransform の変化先専用スキル等で使用） */
  hidden?: boolean;
  /** スキル固有の確定クリティカル（バフ経由ではない常時クリ。乱れ雪月花・天道雪月花・奥義波切等） */
  guaranteedCrit?: boolean;
  /** スキル固有の確定ダイレクトヒット（バフ経由ではない常時DH。返し波切等） */
  guaranteedDh?: boolean;
  /**
   * 対象数（1 = 単体、2以上 = 範囲）。
   * 未設定または 1 の場合は単体スキルとして扱い、複数体ウィンドウ内でも 1 体分のみ威力を計上する。
   * データ投入はジョブ別 Issue（#269〜#273）で行う。
   */
  maxTargets?: number;
  /**
   * 2体目以降（または `falloffStartTarget` 以降）の威力減衰率（0.0〜1.0）。
   * 例: 0.5 = 50%減衰（残り 50% 威力）。未設定（または 0）は減衰なし＝フル威力。
   */
  falloffRate?: number;
  /**
   * 減衰が始まる体数（1-indexed）。未設定は 2（= 2体目から減衰）。
   * 例: 3 を指定すると 1〜2 体目はフル威力、3 体目以降が減衰対象。
   */
  falloffStartTarget?: number;
  /**
   * oGCD のまま、ウェポンスキルと同じ GCD リキャストも発生させる（黙想・鉄山闘気／陰陽闘気）。
   * GCD のリキャスト明けまで実行できない。コンボ・確定クリ/DH・consumeOnGcd の対象にはならない
   */
  triggersGcdRecast?: boolean;
  /** triggersGcdRecast で発生させる GCD の基礎リキャスト（秒。スキルスピード・ヘイスト補正前）。未設定は 2.5 秒（黙想） */
  gcdRecastTime?: number;
  /**
   * GCD のリキャストを recastTime のまま固定し、スキルスピード・speed バフ・リソースのヘイストで縮めない
   * （賢者のエウクラシア 1.0 秒・エウクラシア系魔法 1.5 秒）。autoTransform の変化先に付けたときは変化先で判定する。詠唱時間には作用しない
   */
  fixedGcdRecast?: boolean;
}

/** タイムラインに配置されたスキル */
export interface TimelineEntry {
  /** タイムラインエントリの一意ID */
  uid: string;
  /** 参照するスキルのID */
  skillId: string;
  /**
   * マニュアル設定された開始時刻（秒）。
   * 未設定（undefined）の場合は前エントリからの自動計算値を使用する。
   * 設定されている場合は自動計算値を無視してこの値を強制採用する
   * （リキャスト中等の制約違反時は recastError として警告のみ表示し、配置は尊重する）。
   */
  manualStartTime?: number;
  /**
   * 確率付与（buffApplicationProcRates が 1 未満）のバフが発生したか。
   * true なら確率 1 で付与し、false なら付与しない（効いているバフの延長もしない）。未設定なら確率を期待値に使う
   */
  procOccurred?: boolean;
  /**
   * このエントリが付ける条件バフ（autoGenerateWhileBuff）の効果中の、確率の判定（autoGenerateProcRate）ごとの発生。
   * i 番目が i + 1 回目の判定で、true なら発生、false なら不発。null と範囲外は未指定で、確率に近い既定の並びで決める（#900）
   */
  autoGenerateProcOccurred?: (boolean | null)[];
}

/** 指定バフの効果中だけ変わるリソースの性質 */
export interface ResourceBuffModifier {
  /** このバフの効果中だけ適用する */
  buffId: string;
  /** 効果中の最大スタック数（ResourceDefinition.maxStacks を上書き） */
  maxStacks?: number;
  /** スタック 1 つあたりのヘイスト（GCD のリキャスト・詠唱時間を 1 - 値×スタック数 倍にする。0.04 = 4%） */
  gcdHastePerStack?: number;
  /**
   * 効果中にこのリソースが付与されるたびに、指定のリキャストを短縮する。
   * 上限に達していても付与は発生したものとして扱い、自動生成も止めない。
   * chargeKey は短縮対象スキルの cooldownGroup（未設定ならスキル ID）
   */
  cooldownReductionOnGain?: { chargeKey: string; seconds: number };
}

/** リソースの定義データ */
export interface ResourceDefinition {
  /** リソースの一意識別子。名前とレーンラベル用の短縮名は辞書の job-<ジョブ ID> の `resources.<id>` にある（#846） */
  id: string;
  /** 最大スタック数 */
  maxStacks: number;
  /** 戦闘開始時の初期スタック数（デフォルト0） */
  initialStacks?: number;
  /** 自動生成の間隔（秒）。未設定の場合は自動生成なし */
  autoGenerateInterval?: number;
  /** 自動生成1回あたりの増加量（デフォルト1） */
  autoGenerateAmount?: number;
  /** 自動生成条件: 指定バフのいずれかがアクティブ時のみ自動生成する */
  autoGenerateWhileBuff?: string[];
  /**
   * autoGenerateWhileBuff の条件バフが付き直したとき（歌の上書きなど）、自動生成をそのバフの付与時刻から数え直す。
   * 条件バフが付いている間は上限でも刻みを進め、消費で上限を割っても付与時刻からの刻みのまま続ける。
   * 未設定なら、条件バフのいずれかが付いている間は刻みを引き継ぐ（AF と UB の切り替えでポリグロットの 30 秒を引き継ぐなど）
   */
  autoGenerateRestartOnBuffChange?: boolean;
  /** autoGenerateWhileBuff の条件バフが時間切れになる時刻ちょうどの付与も数える（黙想の 15 秒目）。未設定なら数えない（#524） */
  autoGenerateIncludeBuffEnd?: boolean;
  /**
   * 自動生成の刻みが、この確率で付与する判定であること（詩人の歌の 80%）。autoGenerateWhileBuff と併せて使う。
   * 判定ごとの発生は、条件バフを付けたエントリの TimelineEntry.autoGenerateProcOccurred で指定する。
   * 不発の判定では値を増やさず、付与ごとの効果（cooldownReductionOnGain）も起きない。未設定なら毎回付与する（#900）
   */
  autoGenerateProcRate?: number;
  /** 自動生成の付与 1 回ごとの時刻と値を TimelineResult.resourceTicks に記録し、リソースレーンに段差として描く */
  showAutoGenerateTicks?: boolean;
  /** 指定バフの効果中だけ変わる性質（例: 軍神のパイオン中の詩心最大 4・ヘイスト） */
  whileBuffModifiers?: ResourceBuffModifier[];
  /**
   * 特性で変わる性質。traitLevel 以上のレベルで maxStacks・displayMaxStacks・whileBuffModifiers（配列ごと）を置き換え、traitLevel の昇順に重ねる。
   * 例: ガンブレイカーのソイルは Lv88 で最大 2 → 3（表示のドットも 2 → 3）、ブラッドソイル中の最大 4 → 6
   */
  traitOverrides?: { traitLevel: number; maxStacks?: number; displayMaxStacks?: number; whileBuffModifiers?: ResourceBuffModifier[] }[];
  /** 指定バフのいずれかが時間切れ・排他グループの上書きで消えたときに 0 に戻す（例: 歌が終わると詩心が消える） */
  resetOnBuffEnd?: string[];
  /** 表示色 */
  color: string;
  /** 習得レベル（特性により解放されるレベル。未設定の場合は常に利用可能） */
  acquiredLevel?: number;
  /** 表示グループ名（同じグループのリソースは1行にまとめて表示） */
  displayGroup?: string;
  /** true ならドットではなく塗り＋数字ラベルのゲージで描く。塗りの分母はその時点の上限（whileBuffModifiers を反映） */
  displayAsGauge?: boolean;
  /** ドット1行あたりのスタック数（未設定の場合はmaxStacksを1行で表示。maxStacksがこの値を超える場合は複数行に折り返される） */
  stacksPerRow?: number;
  /**
   * 表示上のドット数（未設定の場合はmaxStacks個のドットを表示）。
   * maxStacksより少なく設定すると、超過分は同じドットを overflowColor で塗り直して表現する。
   * 例: MNKの闘気（上限10）を5ドットで表示し、6〜10個目は赤色ドットで表す。
   */
  displayMaxStacks?: number;
  /** displayMaxStacks 超過分を表すドット色（未設定の場合は color をそのまま使用） */
  overflowColor?: string;
  /** displayGroup内のリソース合計スタック数の上限（同グループ内で合計がこの値を超えないようキャップ） */
  groupMaxStacks?: number;
  /** 同一displayGroup内でドット表示時の描画優先順位（昇順）。小さいほどスロットの先頭に埋められる */
  displayGroupPriority?: number;
}

/** 特定時点のリソース状態 */
export interface ResourceSnapshot {
  [resourceId: string]: number;
}

/** キャラクターステータス */
export interface CharacterStats {
  /** クリティカル値 */
  critical: number;
  /** ダイレクトヒット値 */
  directHit: number;
  /** 意志力 */
  determination: number;
  /** スキルスピード / スペルスピード */
  speed: number;
}

/** バフ・デバフのエフェクト種別 */
export type BuffEffectType = "speed" | "potency" | "potencyAdd" | "critRate" | "dhRate" | "guaranteedCrit" | "guaranteedDh" | "consumeOnGcd" | "consumeOnAction" | "instantCast" | "resourceCostMultiplier" | "resourceGainOnSkill" | "bypassCombo" | "applyBuffOnSkill" | "applyBuffOnDeplete" | "recastOverride" | "castTimeMultiplier";

/** バフ・デバフの効果 */
export interface BuffEffect {
  /** エフェクト種別 */
  type: BuffEffectType;
  /**
   * 効果量
   * - speed: GCD乗算倍率（0.8 = GCD×0.8）
   * - potency: 威力乗算倍率（1.1 = 威力×1.1）
   * - potencyAdd: 威力に足す値（20 = 威力+20。倍率を掛ける前に足す。appliesToSkillIds で対象限定、機工士のオーバーヒート等）
   * - critRate: クリティカル発生率加算値（0.1 = +10%）
   * - dhRate: ダイレクトヒット発生率加算値（0.1 = +10%）
   * - guaranteedCrit: 次のWS使用時にクリティカル率を100%にする（値は未使用、appliesToSkillIds で対象限定。確定になった WS でスタックを 1 消費）
   * - guaranteedDh: 次のWS使用時にダイレクトヒット率を100%にする（値は未使用、appliesToSkillIds で対象限定。guaranteedCrit と併せ持っても消費は 1 スタック。consumeOnGcd も持つバフはそちらでだけ消費）
   * - consumeOnGcd: GCDスキル使用時に自動消費される（値は未使用）
   * - consumeOnAction: 付与した後の次のアクション（GCD/oGCD を問わない）の実行で消える（値は未使用、黙想等）
   * - instantCast: 詠唱時間を0にする（値は未使用、詠唱時間を持つGCDスキル使用時に自動消費。castTimeMultiplier で詠唱が 0 になる GCD では消費しない）
   * - resourceCostMultiplier: 指定リソースの消費量に乗じる倍率（2 = 2倍消費、0 = 消費なし）
   * - resourceGainOnSkill: スキル使用時に指定リソースを value 分追加で獲得する（appliesToSkillIds で対象限定可）
   * - bypassCombo: バフアクティブ中、対象GCD WSのコンボ条件判定（comboFrom / comboFromBuff）を強制成立扱いにする（値は未使用、appliesToSkillIds で対象限定）
   * - applyBuffOnSkill: バフアクティブ中、対象 GCD/oGCD 使用時に appliedBuffId のバフを追加付与する（値は未使用、明鏡止水中の月光→風月等）
   * - applyBuffOnDeplete: スタック式バフが消費により 0 スタックになった時点で appliedBuffId のバフを付与する（値は未使用、インスタレーション枯渇→レインボードリップ効果アップ等）
   * - recastOverride: 対象 GCD の基礎リキャスト（秒）を value で置き換える。スキルスピード補正・speed バフは置換後の値に適用される（appliesToSkillIds で対象限定、Ready 中のレインボードリップ等）
   * - castTimeMultiplier: 対象 GCD の詠唱時間に乗じる倍率。リキャストには作用しない（0.5 = 詠唱半減、appliesToSkillIds で対象限定、AF3 中の氷属性魔法等）
   */
  value: number;
  /** resourceCostMultiplier / resourceGainOnSkill バフの対象リソースID */
  resourceId?: string;
  /**
   * このエフェクトを適用するスキルIDのホワイトリスト（potency 等の対象スキル限定バフ用）。
   * 未設定の場合は全スキルに適用される。
   * 例: AF3は「ファイア系」限定で威力+80%、「ブリザド系」限定で威力-30% など、
   * 同一バフが複数スキル群に異なる倍率を適用するケースで使用する。
   */
  appliesToSkillIds?: string[];
  /** consumeOnGcd 専用: 使用しても消費しないスキルIDのリスト（竜眼を遠隔WSのピアシングタロンで消費しない等） */
  excludedSkillIds?: string[];
  /** applyBuffOnSkill / applyBuffOnDeplete 専用: 付与するバフID */
  appliedBuffId?: string;
  /**
   * resourceCostMultiplier 専用: 指定リソースが消費可能な量だけ残っていれば倍率を打ち消す。
   * 打ち消し成立時はそのリソースを消費する（例: BLMのアンブラルハートでAF中のMP2倍化を打ち消す）。
   * 倍率が等倍以下（multiplier ≤ 1）の場合は打ち消し処理は行わない。
   */
  negatedByResource?: { resourceId: string; consumeAmount: number };
}

/** バフ・デバフの定義 */
export interface BuffDefinition {
  /** バフの一意識別子。名前とレーンラベル用の短縮名は辞書の job-<ジョブ ID> の `buffs.<id>` にある（#846） */
  id: string;
  /** アイコン画像のパス */
  icon: string;
  /** 効果時間（秒）。null は永続（特定スキルで消費されるまで持続） */
  duration: number | null;
  /** バフの効果リスト */
  effects: BuffEffect[];
  /** 表示色 */
  color: string;
  /** スタック付きバフの最大スタック数（未設定の場合はスタックなし） */
  maxStacks?: number;
  /**
   * 重ねがけで延長する上限（秒。戦士の戦嵐は 60）。設定すると、効果中に付与し直したとき付け直さずに残り時間へ
   * duration を足し、付与時刻から maxDuration までで止める。Skill.buffExtensions の延長の上限にも使う
   */
  maxDuration?: number;
  /** 習得レベル（特性により解放されるレベル。未設定の場合は常に利用可能） */
  acquiredLevel?: number;
  /** 排他グループ名（同グループのバフは1つだけアクティブ。新規適用時に既存を解除） */
  exclusiveGroup?: string;
  /** バフ消失時にリソースを別リソースへ移し替える（例: 色調反転消失時にBP→WP） */
  onExpireResourceTransfer?: {
    fromResourceId: string;
    toResourceId: string;
  };
  /**
   * 時間切れで消えたとき、その時点の resourceId の量 n に応じて buffIds[n - 1] を消えた時刻から付与する（n = 0 なら付与しない）。
   * 例: 軍神のパイオンの時間切れ — 詩心 1〜4 で軍神の契約（詩心1〜4）。
   */
  onExpireApplyBuffByResource?: {
    resourceId: string;
    buffIds: string[];
  };
  /**
   * バフ付与中のリソース獲得（正の ResourceChange）を別リソースへ振り替える。
   * 例: 色調反転中にホワイトペイントの獲得をブラックペイントへ付け替える。
   * 負の ResourceChange（消費）には影響しない。
   */
  redirectResourceGain?: {
    fromResourceId: string;
    toResourceId: string;
  };
}

/** タイムライン上のアクティブなバフ */
export interface ActiveBuff {
  /** バフ定義のID */
  buffId: string;
  /** バフ適用開始時刻（秒） */
  startTime: number;
  /** バフ終了時刻（秒） */
  endTime: number;
  /** 現在のスタック数（スタック付きバフの場合） */
  stacks?: number;
  /**
   * 確率付き（buffApplicationProcRates）で付与したときの、付与時点の発動確率。
   * 効いている間に重ねた効果時間内の付与元から 1 − Π(1 − p_i) で求める。確定付与で付いている間は無い
   */
  procRate?: number;
}

/** 自動生成リソースの付与 1 回（リソースレーンの段差表示用） */
export interface ResourceTick {
  /** 付与時刻（秒） */
  time: number;
  /** リソースID */
  resourceId: string;
  /** 付与後の値 */
  value: number;
}

/** DoTの1ティック情報 */
export interface DoTTick {
  /** ティック発生時刻（秒） */
  time: number;
  /** ティック威力 */
  potency: number;
  /** DoT元スキルのID */
  skillId: string;
  /** DoT元スキルのアイコン */
  icon: string;
  /** スナップショット時のクリティカル発生率ボーナス（0.0 = なし、0.1 = +10%） */
  critRateBonus: number;
  /** スナップショット時のダイレクトヒット発生率ボーナス（0.0 = なし、0.1 = +10%） */
  dhRateBonus: number;
}

/** タイムライン上のアクティブなDoT */
export interface ActiveDoT {
  /** DoT元スキルのID */
  skillId: string;
  /** DoT適用時刻（秒） */
  startTime: number;
  /** DoT終了時刻（秒） */
  endTime: number;
  /** 1ティックあたりの威力 */
  potency: number;
  /** DoT元スキルのアイコン */
  icon: string;
  /** 適用時にスナップショットしたバフ倍率 */
  buffMultiplier: number;
}

/** ボス離脱（攻撃不可）ウィンドウ */
export interface BossUntargetableWindow {
  /** 離脱開始時刻（秒） */
  startTime: number;
  /** 離脱終了時刻（秒） */
  endTime: number;
}

/**
 * 複数体ウィンドウ（指定時間帯に複数体の敵が居る期間）。
 * この区間内に配置された対象 `enemy` スキルは `Skill.maxTargets` / `falloffRate` を元に合計威力が増加する。
 * 区間判定は半開区間 `[startTime, endTime)`（`BossUntargetableWindow` と同仕様）。
 */
export interface MultiTargetWindow {
  /** 開始時刻（秒） */
  startTime: number;
  /** 終了時刻（秒） */
  endTime: number;
  /** 敵の数（2以上） */
  targetCount: number;
}

/** PPS範囲選択 */
export interface PpsRange {
  /** 範囲開始時刻（秒） */
  startTime: number;
  /** 範囲終了時刻（秒） */
  endTime: number;
}

/** resolveTimelineの計算結果 */
export interface TimelineResult {
  /** 各スキルの計算結果 */
  entries: ResolvedTimelineEntry[];
  /** DoTティック一覧 */
  dotTicks: DoTTick[];
  /** DoT合計威力 */
  dotTotalPotency: number;
  /** アクティブDoT期間一覧（タイムライン表示用） */
  activeDoTs: ActiveDoT[];
  /** 段差として描く自動生成の付与（showAutoGenerateTicks のリソースのみ。エントリと同時刻の付与は除く）。時刻順 */
  resourceTicks: ResourceTick[];
  /** 最後のGCDスキルのリキャスト完了時刻。詠唱がリキャストより長いスキルは詠唱完了まで延ばす（#901） */
  lastGcdEndTime: number;
  /** タイムライン全体の終了時刻（GCD完了 or DoT最終ティックの遅い方） */
  timelineEndTime: number;
}

/** 時刻 t のリソースの値と上限（#1000） */
export interface ResourceStateAt {
  resourceId: string;
  value: number;
  /** その時刻の上限（whileBuffModifiers の maxStacks。着弾を待っているバフも入れる。リソースレーンと同じ） */
  maxStacks: number;
}

/** resolveStateAt の結果。t までのエントリ（t ちょうども含む）・自動生成・バフの時間切れを反映した状態（#1000） */
export interface TimelineStateAt {
  time: number;
  /** resolveStateAt に渡したリソースの順 */
  resources: ResourceStateAt[];
  /**
   * chargeKey（cooldownGroup。無ければスキル ID）ごとのチャージ。t までに使ったものだけ持つ。
   * nextChargeAt は次のチャージが戻る時刻で、t までのリキャスト短縮だけを反映する（満タンなら null）
   */
  charges: Record<string, { charges: number; nextChargeAt: number | null }>;
}

/** 時刻 t のリキャスト付きスキルの状態（#1000） */
export interface RecastStateAt {
  skillId: string;
  /** 使用可能か（チャージ式はチャージが 1 つ以上残っているか） */
  available: boolean;
  /** その時刻のゲーム内のリキャスト表示の残り秒数（t までの短縮だけを反映）。チャージ式は次のチャージが戻るまで。リキャスト中でなければ 0 */
  remaining: number;
  /** t より後の短縮も込みで、リキャスト（チャージ式は次のチャージ）が実際に戻る時刻。リキャストのレーンの区間の終わり。リキャスト中でなければ無い */
  actualEndTime?: number;
  /** チャージ式（maxCharges が 2 以上）だけ持つ。cooldownGroup を共有するスキルはグループ全体で数える */
  charges?: number;
  maxCharges?: number;
}

/** リソースのエラーの種類。insufficient: 必要量に足りない / overMax: resourceMaxConditions の上限を超えている */
export type ResourceErrorKind = "insufficient" | "overMax";

export interface ResourceError {
  resourceId: string;
  kind: ResourceErrorKind;
}

/** バフ条件のエラーの種類。missing: 必要なバフが無い・スタックが足りない / forbidden: forbiddenBuff のバフが効果中 */
export type ComboErrorKind = "missing" | "forbidden";

export interface ComboError {
  buffId: string;
  kind: ComboErrorKind;
  /** OR 条件（requiredBuffAnyOf / buffConsumptionAnyOf）の候補。どれか 1 つあればよい。buffId には先頭の候補が入る */
  anyOf?: string[];
}

/** 時間情報付きタイムラインエントリ（計算結果） */
export interface ResolvedTimelineEntry {
  /** タイムラインエントリの一意ID */
  uid: string;
  /** 参照するスキルのID（元のタイムラインエントリのスキルID） */
  skillId: string;
  /** 実際に使用されたスキルのID（自動変化後。変化なしの場合はskillIdと同じ） */
  resolvedSkillId: string;
  /** 実際に適用される威力（コンボ成否・自動変化を反映済み） */
  resolvedPotency: number;
  /** 開始時刻（秒） */
  startTime: number;
  /**
   * 自動計算による開始時刻（秒）。
   * `manualStartTime` が設定されているエントリでも、自動計算なら何秒になるかを保持する。
   * `manualStartTime` 未設定時は `startTime` と同値。詳細パネルで「自動計算値: X.XXs」を表示する用途。
   */
  autoStartTime: number;
  /** 元のタイムラインエントリにマニュアル開始時刻が設定されているか */
  manualStartTime?: number;
  /**
   * 着弾時刻（秒）= 開始 + 詠唱時間 + 遅れ（未設定なら 0）。詠唱のあるスキルと、着弾までの遅れを設定したスキル
   * （resolvedSkillId）だけが持ち、PPS 区間・集計に入るかをこの時刻で判定する。無ければ開始時刻で判定する（#901）
   */
  hitTime?: number;
  /** 元のタイムラインエントリの TimelineEntry.procOccurred */
  procOccurred?: boolean;
  /** 元のタイムラインエントリの TimelineEntry.autoGenerateProcOccurred（#900） */
  autoGenerateProcOccurred?: (boolean | null)[];
  /** スキル実行後のリソース状態（消費・獲得・バフ由来の自動消費すべて反映済み） */
  resourceSnapshot: ResourceSnapshot;
  /** 発動条件を満たさなかったリソースとその種類 */
  resourceErrors: ResourceError[];
  /** 発動条件を満たさなかったバフとその種類 */
  comboErrors: ComboError[];
  /** ボス離脱中に攻撃したエラー */
  untargetableError: boolean;
  /**
   * 実行時はボス離脱の外で、着弾時刻（hitTime）にボスが離脱中（ゴースト。#950）。ハードエラーの無い敵対象のエントリだけが持つ。
   * 警告でありハードエラーではない（リソース・コンボ・リキャスト・バフの消費は起きる）。期待威力は 0 で、
   * 着弾時の効果（このスキルが付けるバフ・シナジー・DoT の付与・打ち切り・延長）は起きない
   */
  untargetableHit?: boolean;
  /** リキャスト中に使用したエラー */
  recastError: boolean;
  /**
   * リキャストのレーンに描く区間の終わり（秒）。固有リキャストのあるスキルを、エラー無しで使ったときだけ持つ。
   * 計算でそのチャージが戻る時刻。チャージは 1 本のタイマーで順番に戻るので、続けて使った 2 本目以降は
   * 前のチャージが戻ってから数える（#924）。リキャストの短縮（reduceChargeCooldown）も反映済み（#898）
   */
  cooldownEndTime?: number;
  /** WSコンボ不成立（エラーではないがコンボ威力が適用されない） */
  wsComboError: boolean;
  /** 1 未満の確率付与（buffApplicationProcRates）だけで付いたバフを自動消費したときのバフID。警告でありハードエラーではない（威力・効果はそのまま） */
  unconfirmedProcBuffs?: string[];
  /**
   * buffConsumptionAnyOf の fallbackPotency で威力を期待値に補正したときの、消費したバフと発動確率 P。
   * 付与元が無いフィラー枠は P = 0。fallbackSkillId は出なかったときに撃つ GCD の ID（#842。名前は表示するときに引く。#846）。
   * 乱れ撃ちのような確定のバフを消費したときは無い
   */
  consumedProc?: { buffId: string; procRate: number; fallbackSkillId?: string };
  /**
   * 確率付与（buffApplicationProcRates）が、すでに付いているバフに重なって無駄になる確率（付与時点の P × 付与確率）。
   * 効いているバフに重ねたときだけ持つ（#842）
   */
  wastedProc?: { buffId: string; rate: number };
  /**
   * このエントリ実行**後**にアクティブなバフ一覧（guaranteedCrit/Dh・consumeOnGcd 等の
   * 自動消費を反映済み）。次エントリの speed 計算 / バフレーン終端検出に使用される。
   */
  activeBuffs: ActiveBuff[];
  /**
   * このエントリ実行**前**（消費が走る前）にアクティブだったバフ一覧のスナップショット。
   * ライフサージ等の guaranteedCrit バフは GCD 使用時に消費されるため `activeBuffs` には
   * 残らないが、UI 側で「このスキルに効いたバフの内訳」を表示するには消費前の状態が必要。
   * 詳細パネル等の表示用途で使う。
   */
  activeBuffsAtUse: ActiveBuff[];
  /**
   * このスキルが付けたバフのうち、着弾時刻まで待たせて付けたもの（付けた時点の複製。startTime は着弾時刻）。
   * 着弾が開始より後のスキル（遅れを設定したスキル・詠唱のあるスキル）で、待たせた付与があったときだけ持つ。
   * 付けたエントリの activeBuffs には入らず、最後のエントリより後に着弾したものはどのエントリの activeBuffs にも出ないので、
   * バフのレーンはこれも材料にする（#948）
   */
  hitAppliedBuffs?: ActiveBuff[];
  /**
   * このエントリの実行後に、着弾を待っているバフの ID（前のエントリが付けたものも含む）。待っているときだけ持つ。
   * リソースの上限を上げるバフ（whileBuffModifiers）は、着弾を待つ間も上限だけ実行時から上げるので、
   * リソースのレーンの上限の表示もこれを入れて計算する（#948）
   */
  pendingBuffIds?: string[];
  /** 威力バフの合成倍率（1.0 = バフなし） */
  buffMultiplier: number;
  /** クリティカル発生率ボーナス（0.0 = バフなし、0.1 = +10%） */
  critRateBonus: number;
  /** ダイレクトヒット発生率ボーナス（0.0 = バフなし、0.1 = +10%） */
  dhRateBonus: number;
  /** このエントリ実行後、次のGCDが使用可能になる時刻（秒） */
  gcdAvailableAt: number;
  /** このエントリ実行後、次のアクション（GCD/oGCD問わず）が使用可能になる時刻（秒） */
  actionAvailableAt: number;
  /**
   * 実行時に適用された詠唱時間（秒）。
   * 速度バフ・castTimeMultiplier バフ・instantCast バフ（三連魔・ファイアスターター等）を反映済み。
   * 非詠唱スキル・oGCDでは 0。
   * UI 側で activeBuffs を再解釈しなくても、この値を直接描画できる。
   */
  castTime: number;
  /**
   * このスキル使用時の敵の数。`multiTargetWindows` の内側であれば 2 以上、外側または対象 `enemy` 以外のスキルでは 1。
   * 合計威力計算は `Skill.maxTargets` で頭打ち、`falloffRate` / `falloffStartTarget` で減衰される。
   */
  targetCount: number;
  /** 時間差の攻撃（Skill.delayedHits）の計算結果。着弾時刻の順。ハードエラーのエントリは持たない（#957） */
  delayedHits?: ResolvedDelayedHit[];
}
