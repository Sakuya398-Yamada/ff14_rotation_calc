/** スキルの種別 */
export type SkillType = "gcd" | "ogcd";

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
}

/** タイムラインに配置されたスキル */
export interface TimelineEntry {
  /** タイムラインエントリの一意ID */
  uid: string;
  /** 参照するスキルのID */
  skillId: string;
}

/** 時間情報付きタイムラインエントリ（計算結果） */
export interface ResolvedTimelineEntry {
  /** タイムラインエントリの一意ID */
  uid: string;
  /** 参照するスキルのID */
  skillId: string;
  /** 開始時刻（秒） */
  startTime: number;
}
