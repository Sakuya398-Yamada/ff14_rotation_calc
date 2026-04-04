import type { ResourceDefinition } from "../types/skill";

/**
 * 詩人（BRD）リソース定義
 *
 * - ソウルボイス（Soul Voice）: 詩心付与時に+5（最大100）
 *   → エイペックスアローで全消費
 * - コーダシンボル（Coda）: 各歌の実行時に付与（最大3）
 *   → 光神のフィナーレ / 光神のアンコールで消費
 * - 詩心（Repertoire）: 歌の効果中にDoTクリティカル時等で付与（最大3）
 *   → メヌエット中はピッチパーフェクトで消費
 */
export const BRD_RESOURCES: ResourceDefinition[] = [
  {
    id: "soul-voice",
    name: "ソウルボイス",
    shortName: "ｿｳﾙ\nﾎﾞｲｽ",
    maxStacks: 100,
    color: "#ffd700",
    acquiredLevel: 80,
  },
  {
    id: "coda",
    name: "コーダシンボル",
    shortName: "ｺｰﾀﾞ",
    maxStacks: 3,
    color: "#e91e63",
    acquiredLevel: 90,
  },
  {
    id: "repertoire",
    name: "詩心",
    shortName: "詩心",
    maxStacks: 3,
    color: "#4caf50",
    acquiredLevel: 52,
  },
];
