import type { ResourceDefinition } from "../types/skill";

/**
 * 戦士（WAR）リソース定義
 * ビーストゲージ（インナービースト）: メイム +10・シュトルムヴィント +20・シュトルムブレハ +10・ミスリルテンペスト +20（Lv74）の
 * コンボ成立とウォークライ（+50）で得て、原初の魂・フェルクリーヴ・スチールサイクロン・デシメート・インナーカオス・
 * カオティックサイクロン（いずれも 50）で消費する。原初の解放中のフェルクリーヴ・デシメートは消費しない（war-buffs.ts）
 */
export const WAR_RESOURCES: ResourceDefinition[] = [
  {
    id: "beast-gauge",
    maxStacks: 100,
    color: "#e65100",
    displayAsGauge: true,
    acquiredLevel: 35,
  },
];
