import type { Skill } from "../types/skill";

/**
 * 白魔道士（WHM）攻撃スキル一覧
 * パッチ7.x準拠の威力値
 */
export const WHM_ATTACK_SKILLS: Skill[] = [
  // === GCD ===
  {
    id: "stone",
    name: "ストーン",
    potency: 140,
    type: "gcd",
    color: "#a0855b",
  },
  {
    id: "aero",
    name: "エアロ",
    potency: 50,
    type: "gcd",
    color: "#7ecf7e",
  },
  {
    id: "stone2",
    name: "ストンラ",
    potency: 190,
    type: "gcd",
    color: "#b8975f",
  },
  {
    id: "aero2",
    name: "エアロラ",
    potency: 50,
    type: "gcd",
    color: "#5fbf5f",
  },
  {
    id: "stone3",
    name: "ストンガ",
    potency: 220,
    type: "gcd",
    color: "#c9a96a",
  },
  {
    id: "stone4",
    name: "ストンジャ",
    potency: 260,
    type: "gcd",
    color: "#d4b87a",
  },
  {
    id: "dia",
    name: "ディア",
    potency: 85,
    type: "gcd",
    color: "#f5e6a3",
  },
  {
    id: "glare",
    name: "グレア",
    potency: 290,
    type: "gcd",
    color: "#f0e68c",
  },
  {
    id: "glare3",
    name: "グレアガ",
    potency: 350,
    type: "gcd",
    color: "#fff8a0",
  },
  {
    id: "glare4",
    name: "グレアジャ",
    potency: 640,
    type: "gcd",
    color: "#fffacd",
  },
  {
    id: "holy",
    name: "ホーリー",
    potency: 140,
    type: "gcd",
    color: "#ffd700",
  },
  {
    id: "holy3",
    name: "ホーリガ",
    potency: 150,
    type: "gcd",
    color: "#ffe44d",
  },

  {
    id: "heart-of-misery",
    name: "ハート・オブ・ミゼリ",
    potency: 1400,
    type: "gcd",
    color: "#ff6b6b",
  },

  // === oGCD ===
  {
    id: "assize",
    name: "アサイズ",
    potency: 400,
    type: "ogcd",
    color: "#87ceeb",
  },
];
