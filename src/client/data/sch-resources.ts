import type { ResourceDefinition } from "../types/skill";

/**
 * 学者（SCH）リソース定義
 *
 * - エーテルフロー: エーテルフロー／転化で最大スタック（3）まで獲得し、エナジードレインと回復アビリティで 1 ずつ消費する
 *   エーテルフローの発動条件（戦闘状態）は扱わず、戦闘開始時は 0 から始める
 * - フェイエーテル（エーテルゲージ）は回復専用のフェイユニオンにしか使わないため定義しない
 */
export const SCH_RESOURCES: ResourceDefinition[] = [
  {
    id: "aetherflow",
    name: "エーテルフロー",
    shortName: "ｴｰﾃﾙ\nﾌﾛｰ",
    maxStacks: 3,
    color: "#26a69a",
    acquiredLevel: 45,
  },
];
