import type { ResourceDefinition } from "../types/skill";

/**
 * 竜騎士（DRG）リソース定義
 *
 * - 天竜眼（Firstminds' Focus）: 竜眼雷電・竜眼蒼穹の使用で獲得（最大2）
 *   → 2つ溜まると天竜点睛が使用可能
 */
export const DRG_RESOURCES: ResourceDefinition[] = [
  {
    id: "firstminds-focus",
    name: "天竜眼",
    shortName: "天竜眼",
    maxStacks: 2,
    color: "#9c27b0",
    acquiredLevel: 90,
  },
];
