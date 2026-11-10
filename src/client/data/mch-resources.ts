import type { ResourceDefinition } from "../types/skill";

/**
 * 機工士（MCH）リソース定義
 * - ヒート: ヒートスプリットショット（+5）とコンボ成立時のヒートスラッグショット・ヒートクリーンショット（各 +5）、
 *   スプレッドショット（+5）・スキャッターガン（+10）で得て、ハイパーチャージ（50）で消費する
 * - バッテリー: コンボ成立時のヒートクリーンショット（+10）とホットショット／エアアンカー・回転のこぎり・エクスカベーター（各 +20）で得て、
 *   オートタレット・ルーク／オートマトン・クイーン（50 以上で全消費）で消費する
 */
export const MCH_RESOURCES: ResourceDefinition[] = [
  {
    id: "heat",
    maxStacks: 100,
    color: "#ef6c00",
    displayAsGauge: true,
    acquiredLevel: 30,
  },
  {
    id: "battery",
    maxStacks: 100,
    color: "#29b6f6",
    displayAsGauge: true,
    acquiredLevel: 40,
  },
];
