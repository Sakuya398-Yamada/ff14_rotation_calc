/** スキルの種別 */
export type SkillType = "gcd" | "ogcd";

/** リソースの変動（スキル使用時） */
export interface ResourceChange {
  /** リソースID */
  resourceId: string;
  /** 変動量（正で獲得、負で消費） */
  amount: number;
}

/** スキルの定義データ */
export interface Skill {
  /** スキルの一意識別子 */
  id: string;
  /** スキル名（日本語） */
  name: string;
  /** 威力 */
  potency: number;
  /** GCD or oGCD */
  type: SkillType;
  /** スキルアイコン画像のパス */
  icon: string;
  /** リキャストタイム（秒）。GCDスキルは2.5s、oGCDはスキル固有値 */
  recastTime: number;
  /** アニメーションロック（秒）。デフォルト0.65s */
  animationLock: number;
  /** リソース変動（未設定の場合はリソースに影響なし） */
  resourceChanges?: ResourceChange[];
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
  /** 表示色 */
  color: string;
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

/** 時間情報付きタイムラインエントリ（計算結果） */
export interface ResolvedTimelineEntry {
  /** タイムラインエントリの一意ID */
  uid: string;
  /** 参照するスキルのID */
  skillId: string;
  /** 開始時刻（秒） */
  startTime: number;
  /** スキル実行前のリソース状態 */
  resourceSnapshot: ResourceSnapshot;
  /** リソース不足のリソースIDリスト */
  resourceErrors: string[];
}
