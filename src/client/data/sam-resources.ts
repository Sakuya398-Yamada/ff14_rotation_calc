import type { ResourceDefinition } from "../types/skill";

/**
 * 侍（SAM）リソース定義
 *
 * - 剣気（Kenki）: WSコンボ完走・必殺剣使用で増減（最大100）
 * - 閃（Sen）: 雪・月・花の3種。WSコンボ完走で1つ付与、居合術で消費（合計最大3）
 *   雪/月/花は1つの「閃」レーンに統合表示する
 * - 剣圧（Meditation）: 居合術・奥義波切で+1（最大3、Lv80以降）
 * - 黙想: 効果中は 3 秒ごとに剣気 +10・剣圧 +1。実行の 3 秒後から数え、15 秒目も含めて完走で 5 回
 *   （実機の 1 回目はサーバーティック依存。#471 の近似）。付与の段差をリソースレーンに描く
 */
export const SAM_RESOURCES: ResourceDefinition[] = [
  // ============================================================
  // 剣気ゲージ
  // ============================================================
  {
    id: "kenki",
    name: "剣気",
    shortName: "剣気",
    maxStacks: 100,
    color: "#d32f2f",
    acquiredLevel: 52,
    autoGenerateInterval: 3,
    autoGenerateAmount: 10,
    autoGenerateWhileBuff: ["meditate"],
    autoGenerateIncludeBuffEnd: true,
    showAutoGenerateTicks: true,
  },

  // ============================================================
  // 閃（雪・月・花）— 1レーンに統合表示
  // ============================================================
  {
    id: "setsu",
    name: "雪閃",
    shortName: "雪",
    maxStacks: 1,
    color: "#e1f5fe",
    acquiredLevel: 50,
    displayGroup: "sen",
    groupMaxStacks: 3,
    displayGroupPriority: 1,
  },
  {
    id: "getsu",
    name: "月閃",
    shortName: "月",
    maxStacks: 1,
    color: "#ffeb3b",
    acquiredLevel: 30,
    displayGroup: "sen",
    groupMaxStacks: 3,
    displayGroupPriority: 2,
  },
  {
    id: "ka",
    name: "花閃",
    shortName: "花",
    maxStacks: 1,
    color: "#ec407a",
    acquiredLevel: 40,
    displayGroup: "sen",
    groupMaxStacks: 3,
    displayGroupPriority: 3,
  },

  // ============================================================
  // 剣圧（Meditation）
  // ============================================================
  {
    id: "meditation",
    name: "剣圧",
    shortName: "剣圧",
    maxStacks: 3,
    color: "#ff6f00",
    acquiredLevel: 80,
    autoGenerateInterval: 3,
    autoGenerateAmount: 1,
    autoGenerateWhileBuff: ["meditate"],
    autoGenerateIncludeBuffEnd: true,
    showAutoGenerateTicks: true,
  },
];
