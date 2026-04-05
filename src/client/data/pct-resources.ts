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
    acquiredLevel: 1,
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
    acquiredLevel: 15,
    displayGroup: "paint",
  },
  {
    id: "black-paint",
    name: "ブラックペイント",
    shortName: "BP",
    maxStacks: 1,
    color: "#424242",
    acquiredLevel: 90,
    displayGroup: "paint",
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
