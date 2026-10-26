import type { ResourceDefinition } from "../types/skill";

export const PCT_RESOURCES: ResourceDefinition[] = [
  // ============================================================
  // パレットゲージ
  // ============================================================
  {
    id: "palette-gauge",
    name: "パレットゲージ",
    shortName: "ﾊﾟﾚｯﾄ",
    maxStacks: 100,
    color: "#7e57c2",
    displayAsGauge: true,
    acquiredLevel: 60,
  },

  // ============================================================
  // ペイント
  // ============================================================
  {
    id: "white-paint",
    name: "ホワイトペイント",
    shortName: "WP",
    maxStacks: 5,
    color: "#ffffff",
    acquiredLevel: 80,
    displayGroup: "paint",
    stacksPerRow: 3,
    groupMaxStacks: 5,
    displayGroupPriority: 2,
  },
  {
    id: "black-paint",
    name: "ブラックペイント",
    shortName: "BP",
    // 色調反転で黒く変化するペイントは 1 つだけ（公式ジョブガイド「ホワイトペイントが1スタックのみブラックペイントに変化する」）
    maxStacks: 1,
    // 「黒」よりも紫として認識される方が直感的なため、濃い紫にする
    color: "#7b1fa2",
    acquiredLevel: 90,
    displayGroup: "paint",
    groupMaxStacks: 5,
    displayGroupPriority: 1,
  },

  // ============================================================
  // キャンバス
  // ============================================================
  {
    id: "animal-canvas",
    name: "アニマルキャンバス",
    shortName: "ｱﾆﾏﾙ",
    maxStacks: 1,
    initialStacks: 1,
    color: "#ef5350",
    acquiredLevel: 30,
    displayGroup: "canvas",
  },
  {
    id: "weapon-canvas",
    name: "ウェポンキャンバス",
    shortName: "ｳｪﾎﾟﾝ",
    maxStacks: 1,
    initialStacks: 1,
    color: "#42a5f5",
    acquiredLevel: 50,
    displayGroup: "canvas",
  },
  {
    id: "scape-canvas",
    name: "スケープキャンバス",
    shortName: "ｽｹｰﾌﾟ",
    maxStacks: 1,
    initialStacks: 1,
    color: "#66bb6a",
    acquiredLevel: 70,
    displayGroup: "canvas",
  },
];
