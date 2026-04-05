import type { BuffDefinition } from "../types/skill";

import ragingStrikesIcon from "../assets/icons/brd/Raging_Strikes.png";
import battleVoiceIcon from "../assets/icons/brd/Battle_Voice.png";
import radiantFinaleIcon from "../assets/icons/brd/Radiant_Finale.png";
import straightShotIcon from "../assets/icons/brd/Straight_Shot.png";
import barrageIcon from "../assets/icons/brd/Barrage.png";
import blastArrowIcon from "../assets/icons/brd/Blast_Arrow.png";
import resonantArrowIcon from "../assets/icons/brd/Resonant_Arrow.png";
import radiantEncoreIcon from "../assets/icons/brd/Radiant_Encore.png";
import magesBalladIcon from "../assets/icons/brd/Mage's_Ballad.png";
import armysPaeonIcon from "../assets/icons/brd/Army's_Paeon.png";
import wanderersMinuetIcon from "../assets/icons/brd/The_Wanderer's_Minuet.png";

/**
 * 詩人（BRD）バフ定義
 */
export const BRD_BUFFS: BuffDefinition[] = [
  // ============================================================
  // ダメージバフ
  // ============================================================
  {
    id: "raging-strikes",
    name: "猛者の撃",
    shortName: "猛者の\n撃",
    icon: ragingStrikesIcon,
    duration: 20,
    effects: [
      {
        type: "potency",
        value: 1.15,
      },
    ],
    color: "#ff5722",
  },
  {
    id: "battle-voice",
    name: "バトルボイス",
    shortName: "ﾊﾞﾄﾙ\nﾎﾞｲｽ",
    icon: battleVoiceIcon,
    duration: 20,
    effects: [
      {
        type: "dhRate",
        value: 0.2,
      },
    ],
    color: "#2196f3",
    acquiredLevel: 50,
  },
  {
    id: "radiant-finale-1",
    name: "光神のフィナーレ（1種）",
    shortName: "ﾌｨﾅｰﾚ\n1種",
    icon: radiantFinaleIcon,
    duration: 20,
    effects: [
      {
        type: "potency",
        value: 1.02,
      },
    ],
    color: "#ffd700",
    acquiredLevel: 90,
  },
  {
    id: "radiant-finale-2",
    name: "光神のフィナーレ（2種）",
    shortName: "ﾌｨﾅｰﾚ\n2種",
    icon: radiantFinaleIcon,
    duration: 20,
    effects: [
      {
        type: "potency",
        value: 1.04,
      },
    ],
    color: "#ffd700",
    acquiredLevel: 90,
  },
  {
    id: "radiant-finale-3",
    name: "光神のフィナーレ（3種）",
    shortName: "ﾌｨﾅｰﾚ\n3種",
    icon: radiantFinaleIcon,
    duration: 20,
    effects: [
      {
        type: "potency",
        value: 1.06,
      },
    ],
    color: "#ffd700",
    acquiredLevel: 90,
  },

  // ============================================================
  // 歌（ソング）バフ
  // ============================================================
  {
    id: "mages-ballad",
    name: "賢人のバラード",
    shortName: "ﾊﾞﾗｰﾄﾞ",
    icon: magesBalladIcon,
    duration: 45,
    effects: [
      {
        type: "potency",
        value: 1.01,
      },
    ],
    color: "#9c27b0",
    acquiredLevel: 30,
    exclusiveGroup: "song",
  },
  {
    id: "armys-paeon",
    name: "軍神のパイオン",
    shortName: "ﾊﾟｲｵﾝ",
    icon: armysPaeonIcon,
    duration: 45,
    effects: [
      {
        type: "dhRate",
        value: 0.03,
      },
    ],
    color: "#ff9800",
    acquiredLevel: 40,
    exclusiveGroup: "song",
  },
  {
    id: "wanderers-minuet",
    name: "旅神のメヌエット",
    shortName: "ﾒﾇｴｯﾄ",
    icon: wanderersMinuetIcon,
    duration: 45,
    effects: [
      {
        type: "critRate",
        value: 0.02,
      },
    ],
    color: "#4caf50",
    acquiredLevel: 52,
    exclusiveGroup: "song",
  },

  // ============================================================
  // proc / レディ系バフ
  // ============================================================
  {
    id: "hawks-eye",
    name: "ホークアイ",
    shortName: "ﾎｰｸ\nｱｲ",
    icon: straightShotIcon,
    duration: 30,
    effects: [],
    color: "#e91e63",
    maxStacks: 1,
  },
  {
    id: "barrage",
    name: "乱れ撃ち",
    shortName: "乱れ\n撃ち",
    icon: barrageIcon,
    duration: 10,
    effects: [],
    color: "#ff6d00",
    maxStacks: 1,
    acquiredLevel: 38,
  },
  {
    id: "blast-arrow-ready",
    name: "ブラストアローレディ",
    shortName: "ﾌﾞﾗｽﾄ\nﾚﾃﾞｨ",
    icon: blastArrowIcon,
    duration: 10,
    effects: [],
    color: "#d50000",
    maxStacks: 1,
    acquiredLevel: 86,
  },
  {
    id: "resonant-arrow-ready",
    name: "レゾナンスアローレディ",
    shortName: "ﾚｿﾞﾅﾝｽ\nﾚﾃﾞｨ",
    icon: resonantArrowIcon,
    duration: 30,
    effects: [],
    color: "#7c4dff",
    maxStacks: 1,
    acquiredLevel: 96,
  },
  {
    id: "radiant-encore-ready-1",
    name: "光神のアンコールレディ（1種）",
    shortName: "ｱﾝｺｰﾙ\nﾚﾃﾞｨ1",
    icon: radiantEncoreIcon,
    duration: 30,
    effects: [],
    color: "#6200ea",
    maxStacks: 1,
    acquiredLevel: 100,
  },
  {
    id: "radiant-encore-ready-2",
    name: "光神のアンコールレディ（2種）",
    shortName: "ｱﾝｺｰﾙ\nﾚﾃﾞｨ2",
    icon: radiantEncoreIcon,
    duration: 30,
    effects: [],
    color: "#6200ea",
    maxStacks: 1,
    acquiredLevel: 100,
  },
  {
    id: "radiant-encore-ready-3",
    name: "光神のアンコールレディ（3種）",
    shortName: "ｱﾝｺｰﾙ\nﾚﾃﾞｨ3",
    icon: radiantEncoreIcon,
    duration: 30,
    effects: [],
    color: "#6200ea",
    maxStacks: 1,
    acquiredLevel: 100,
  },
];
