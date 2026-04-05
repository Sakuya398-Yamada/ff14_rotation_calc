import type { BuffDefinition } from "../types/skill";

// === バフアイコン ===
import fireInRedIcon from "../assets/icons/pct/Fire_in_Red.png";
import subtractivePaletteIcon from "../assets/icons/pct/Subtractive_Palette.png";
import hammerStampIcon from "../assets/icons/pct/Hammer_Stamp.png";
import starPrismIcon from "../assets/icons/pct/Star_Prism.png";
import starryMuseIcon from "../assets/icons/pct/Starry_Muse.png";
import rainbowDripIcon from "../assets/icons/pct/Rainbow_Drip.png";
import mogOfTheAgesIcon from "../assets/icons/pct/Mog_of_the_Ages.png";

export const PCT_BUFFS: BuffDefinition[] = [
  // ============================================================
  // コンボ進行用バフ
  // ============================================================
  {
    id: "aetherhues-2",
    name: "色魔法2実行可",
    shortName: "色魔法\n2",
    icon: fireInRedIcon,
    duration: 30,
    effects: [],
    color: "#66bb6a",
  },
  {
    id: "aetherhues-3",
    name: "色魔法3実行可",
    shortName: "色魔法\n3",
    icon: fireInRedIcon,
    duration: 30,
    effects: [],
    color: "#42a5f5",
  },

  // ============================================================
  // サブトラクティブパレット関連
  // ============================================================
  {
    id: "subtractive-palette",
    name: "サブトラクティブパレット",
    shortName: "ｻﾌﾞﾄﾗ\nｸﾃｨﾌﾞ",
    icon: subtractivePaletteIcon,
    duration: 30,
    maxStacks: 3,
    effects: [],
    color: "#78909c",
  },
  {
    id: "color-inversion",
    name: "色調反転",
    shortName: "色調\n反転",
    icon: subtractivePaletteIcon,
    duration: 30,
    effects: [],
    color: "#546e7a",
  },

  // ============================================================
  // ハンマーコンボ
  // ============================================================
  {
    id: "hammer-combo-ready",
    name: "ハンマーコンボ実行可",
    shortName: "ﾊﾝﾏｰ\nｺﾝﾎﾞ",
    icon: hammerStampIcon,
    duration: 30,
    maxStacks: 3,
    effects: [
      { type: "guaranteedCrit", value: 1 },
      { type: "guaranteedDh", value: 1 },
    ],
    color: "#ffb74d",
  },

  // ============================================================
  // イマジンスカイ関連
  // ============================================================
  {
    id: "starry-muse",
    name: "イマジンスカイバフ",
    shortName: "ｲﾏｼﾞﾝ\nｽｶｲ",
    icon: starryMuseIcon,
    duration: 20,
    effects: [
      { type: "potency", value: 1.05 },
    ],
    color: "#7e57c2",
  },
  {
    id: "installation",
    name: "インスタレーション",
    shortName: "ｲﾝｽﾀ\nﾚｰｼｮﾝ",
    icon: starryMuseIcon,
    duration: 30,
    maxStacks: 5,
    effects: [
      { type: "speed", value: 0.75 },
      { type: "consumeOnGcd", value: 1 },
    ],
    color: "#b39ddb",
  },
  {
    id: "subtractive-ready",
    name: "サブトラクティブパレット実行可",
    shortName: "ｻﾌﾞﾄﾗ\nReady",
    icon: subtractivePaletteIcon,
    duration: 30,
    effects: [],
    color: "#90a4ae",
  },

  // ============================================================
  // スタープリズム実行可
  // ============================================================
  {
    id: "star-prism-ready",
    name: "スタープリズム実行可",
    shortName: "ｽﾀｰ\nﾌﾟﾘｽﾞﾑ",
    icon: starPrismIcon,
    duration: 20,
    effects: [],
    color: "#f06292",
  },

  // ============================================================
  // レインボードリップ効果アップ
  // ============================================================
  {
    id: "rainbow-drip-ready",
    name: "レインボードリップ効果アップ",
    shortName: "ﾚｲﾝﾎﾞｰ\nReady",
    icon: rainbowDripIcon,
    duration: 30,
    effects: [],
    color: "#ce93d8",
  },

  // ============================================================
  // シンボル系
  // ============================================================
  {
    id: "moogle-symbol",
    name: "モーグリシンボル",
    shortName: "ﾓｰｸﾞﾘ\nｼﾝﾎﾞﾙ",
    icon: mogOfTheAgesIcon,
    duration: 30,
    effects: [],
    color: "#ffcdd2",
  },
  {
    id: "madeen-symbol",
    name: "マディーンシンボル",
    shortName: "ﾏﾃﾞｨｰﾝ\nｼﾝﾎﾞﾙ",
    icon: mogOfTheAgesIcon,
    duration: 30,
    effects: [],
    color: "#e57373",
  },
];
