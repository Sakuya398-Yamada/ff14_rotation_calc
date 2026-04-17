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
}

/** サポートするプレイヤーレベル */
export type PlayerLevel = 70 | 80 | 90 | 100;

/** スキルの定義データ */
export interface Skill {
  /** スキルの一意識別子 */
  id: string;
  /** スキル名（日本語） */
  name: string;
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
  /** 使用時に消費するバフスタック */
  buffConsumptions?: BuffConsumption[];
  /** 詠唱時間（秒）。詠唱中はoGCDスキルを使用できない。未設定の場合はインスタント（詠唱なし） */
  castTime?: number;
  /** 個別リキャストタイム（秒）。oGCDスキル等の固有クールダウン。未設定の場合はリキャスト制約なし */
  cooldown?: number;
  /** 最大チャージ数。未設定の場合は1（従来通り1回使用でクールダウン） */
  maxCharges?: number;
  /** DoT威力（1ティックあたり。基本値。特性適用前） */
  dotPotency?: number;
  /** DoT持続時間（秒）。dotPotency設定時は必須 */
  dotDuration?: number;
  /** 使用時にDoT効果時間をリセットする対象スキルIDリスト（バフスナップショットも再取得） */
  refreshesDots?: string[];
  /** コンボ元スキルIDリスト（いずれかの直後に使用するとコンボ成立） */
  comboFrom?: string[];
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
  /** リソース消費量に応じた威力スケーリング（線形補間） */
  potencyScaling?: {
    resourceId: string;
    minAmount: number;
    minPotency: number;
    maxAmount: number;
    maxPotency: number;
  };
  /** consumeAllResources消費数に応じたバフ適用テーブル（index 0 = 1個消費時のbuffId[]） */
  buffApplicationsByConsumedCount?: string[][];
  /** バフ消費のOR条件（いずれか1つを消費。potency指定時は威力を上書き、procRate+fallbackPotency指定時は期待値を計算） */
  buffConsumptionAnyOf?: { buffId: string; stacks: number; potency?: number; procRate?: number; fallbackPotency?: number }[];
  /** 指定バフがアクティブなら威力を上書きしバフを消費する。バフ未付与時は通常威力で実行（エラーにならない） */
  conditionalPotencyBuffs?: { buffId: string; potency: number }[];
  /** スキル使用に必要なバフID（未アクティブ時はエラー、威力を計上しない） */
  requiredBuff?: string;
  /** 自動変化条件（指定バフがアクティブ時に別スキルに変化。配列の場合は先頭から優先チェック） */
  autoTransform?: {
    /** 変化条件となるバフID */
    buffId: string;
    /** 変化先スキルID */
    skillId: string;
  } | {
    buffId: string;
    skillId: string;
  }[];
}

/** タイムラインに配置されたスキル */
export interface TimelineEntry {
  /** タイムラインエントリの一意ID */
  uid: string;
  /** 参照するスキルのID */
  skillId: string;
}

/** リソースの定義データ */
export interface ResourceDefinition {
  /** リソースの一意識別子 */
  id: string;
  /** リソース名（日本語） */
  name: string;
  /** 短縮名（レーンラベル用） */
  shortName: string;
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
  /** 表示色 */
  color: string;
  /** 習得レベル（特性により解放されるレベル。未設定の場合は常に利用可能） */
  acquiredLevel?: number;
  /** 表示グループ名（同じグループのリソースは1行にまとめて表示） */
  displayGroup?: string;
  /** ドット1行あたりのスタック数（未設定の場合はmaxStacksを1行で表示。maxStacksがこの値を超える場合は複数行に折り返される） */
  stacksPerRow?: number;
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
export type BuffEffectType = "speed" | "potency" | "stat" | "resource" | "critRate" | "dhRate" | "guaranteedCrit" | "guaranteedDh" | "consumeOnGcd";

/** バフ・デバフの効果 */
export interface BuffEffect {
  /** エフェクト種別 */
  type: BuffEffectType;
  /**
   * 効果量
   * - speed: GCD乗算倍率（0.8 = GCD×0.8）
   * - potency: 威力乗算倍率（1.1 = 威力×1.1）
   * - critRate: クリティカル発生率加算値（0.1 = +10%）
   * - dhRate: ダイレクトヒット発生率加算値（0.1 = +10%）
   * - guaranteedCrit: 次のWS使用時にクリティカル率を100%にする（値は未使用）
   * - guaranteedDh: 次のWS使用時にダイレクトヒット率を100%にする（値は未使用）
   * - consumeOnGcd: GCDスキル使用時に自動消費される（値は未使用）
   * - stat: ステータス加算値
   * - resource: リソース変動量
   */
  value: number;
  /** statバフの対象ステータスキー */
  statKey?: keyof CharacterStats;
  /** resourceバフの対象リソースID */
  resourceId?: string;
}

/** バフ・デバフの定義 */
export interface BuffDefinition {
  /** バフの一意識別子 */
  id: string;
  /** バフ名 */
  name: string;
  /** 短縮名（レーンラベル用） */
  shortName: string;
  /** アイコン画像のパス */
  icon: string;
  /** 効果時間（秒） */
  duration: number;
  /** バフの効果リスト */
  effects: BuffEffect[];
  /** 表示色 */
  color: string;
  /** スタック付きバフの最大スタック数（未設定の場合はスタックなし） */
  maxStacks?: number;
  /** 習得レベル（特性により解放されるレベル。未設定の場合は常に利用可能） */
  acquiredLevel?: number;
  /** 排他グループ名（同グループのバフは1つだけアクティブ。新規適用時に既存を解除） */
  exclusiveGroup?: string;
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
  /** 最後のGCDスキルのリキャスト完了時刻 */
  lastGcdEndTime: number;
  /** タイムライン全体の終了時刻（GCD完了 or DoT最終ティックの遅い方） */
  timelineEndTime: number;
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
  /** スキル実行前のリソース状態 */
  resourceSnapshot: ResourceSnapshot;
  /** リソース不足のリソースIDリスト */
  resourceErrors: string[];
  /** バフスタック不足のバフIDリスト */
  comboErrors: string[];
  /** ボス離脱中に攻撃したエラー */
  untargetableError: boolean;
  /** リキャスト中に使用したエラー */
  recastError: boolean;
  /** WSコンボ不成立（エラーではないがコンボ威力が適用されない） */
  wsComboError: boolean;
  /** このスキル使用時にアクティブなバフ一覧 */
  activeBuffs: ActiveBuff[];
  /** 威力バフの合成倍率（1.0 = バフなし） */
  buffMultiplier: number;
  /** クリティカル発生率ボーナス（0.0 = バフなし、0.1 = +10%） */
  critRateBonus: number;
  /** ダイレクトヒット発生率ボーナス（0.0 = バフなし、0.1 = +10%） */
  dhRateBonus: number;
}
