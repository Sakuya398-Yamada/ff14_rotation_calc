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
  /** スキルアイコンの色（仮。将来的にアイコン画像に置き換え） */
  color: string;
}

/** タイムラインに配置されたスキル */
export interface TimelineEntry {
  /** タイムラインエントリの一意ID */
  uid: string;
  /** 参照するスキルのID */
  skillId: string;
}
