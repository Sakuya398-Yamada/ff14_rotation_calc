import type { ResourceDefinition } from "../types/skill";

/**
 * 白魔道士（WHM）リソース定義
 *
 * - ヒーリングリリー: 戦闘中20秒ごとに自動生成（最大3）
 * - ブラッドリリー: ハート・オブ・ソラス/ラプチャー使用で獲得（最大3）
 *   → 3つ溜まるとハート・オブ・ミゼリが使用可能
 */
export const WHM_RESOURCES: ResourceDefinition[] = [
  {
    id: "healing-lily",
    name: "ヒーリングリリー",
    maxStacks: 3,
    autoGenerateInterval: 20,
    color: "#4fc3f7",
  },
  {
    id: "blood-lily",
    name: "ブラッドリリー",
    maxStacks: 3,
    color: "#ef5350",
  },
];
