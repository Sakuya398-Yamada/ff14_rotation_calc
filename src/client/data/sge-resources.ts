import type { ResourceDefinition } from "../types/skill";

/**
 * 賢者（SGE）リソース定義
 *
 * - アダーガル: 20 秒ごとに自動で 1 ずつ獲得（最大 3）。戦闘外でもたまるため、戦闘開始時は 3 から始める
 *   消費先はドルオコレ・ケーラコレ・イックソコレ・タウロコレ（回復アビリティ。威力 0 で置く）。リゾーマタで 1 獲得する
 * - アダーステック: エウクラシア・ディアグノシスのバリアが完全に吸収されると 1 獲得し、トキシコン系で 1 消費する（最大 3）
 *   バリアが割れた前提で、エウクラシア・ディアグノシスの実行時に獲得する。インスタンス突入時に最大まで付与される（6.1 以降）ため、戦闘開始時は 3 から始める
 */
export const SGE_RESOURCES: ResourceDefinition[] = [
  {
    id: "addersgall",
    name: "アダーガル",
    shortName: "ｱﾀﾞｰ\nｶﾞﾙ",
    maxStacks: 3,
    initialStacks: 3,
    autoGenerateInterval: 20,
    color: "#4dd0e1",
    acquiredLevel: 45,
  },
  {
    id: "addersting",
    name: "アダーステック",
    shortName: "ｱﾀﾞｰ\nｽﾃｨｸ",
    maxStacks: 3,
    initialStacks: 3,
    color: "#ec407a",
    acquiredLevel: 66,
  },
];
