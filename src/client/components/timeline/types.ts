import type { Skill, ResolvedTimelineEntry, ResourceDefinition } from "../../types/skill";

/** 表示用に skill / displaySkill を付与した解決済みエントリ */
export type DisplayEntry = ResolvedTimelineEntry & { skill: Skill; displaySkill: Skill };

/** displayGroup でまとめたリソースレーンの描画単位 */
export interface ResourceGroup {
  key: string;
  label: string;
  resources: ResourceDefinition[];
  /** displayGroupPriority 昇順で並べたリソース（統合スロット描画時の充填順） */
  sortedResources: ResourceDefinition[];
  /** グループ合計の最大スタック数（統合スロット描画する場合のみ設定） */
  groupMaxStacks?: number;
  /** 統合スロット描画時の1行あたりドット数 */
  stacksPerRow?: number;
}

/** 個別リキャスト（クールダウン）の表示スパン */
export interface CooldownSpan {
  startTime: number;
  endTime: number;
  skillName: string;
  icon: string;
}
