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

// 軍神の契約中に使うと軍神の加護になる歌（ジョブガイドの原文どおり 3 曲。パイオンはリキャスト 120 秒のため契約中には使えない）
const ARMYS_ETHOS_SONGS = ["mages-ballad", "armys-paeon", "wanderers-minuet"];

/**
 * 詩人（BRD）バフ定義
 */
export const BRD_BUFFS: BuffDefinition[] = [
  // ============================================================
  // ダメージバフ
  // ============================================================
  {
    id: "raging-strikes",
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
    // 軍神のパイオン効果アップ（Lv78）: 詩心が残ったまま時間切れになると軍神の契約を付与する
    onExpireApplyBuffByResource: {
      resourceId: "repertoire",
      buffIds: ["armys-ethos-1", "armys-ethos-2", "armys-ethos-3", "armys-ethos-4"],
    },
  },
  {
    id: "wanderers-minuet",
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
  // 軍神のパイオン効果アップ（Lv78）
  // 効果量は付与されたときの詩心の数で決まるため、詩心 1〜4 ごとに別のバフにする（光神のフィナーレと同じ方式）。
  // 加護（パイオン中の歌の上書き → brd-skills.ts の buffApplicationByResourceWhileBuff）:
  //   ウェポンスキルのキャスト・リキャストを詩心 1/2/3/4 で 1/2/4/12% 短縮（オートアタック間隔の短縮は未対応）
  // 契約（パイオンの時間切れ → armys-paeon の onExpireApplyBuffByResource）:
  //   3 曲のどれかを使うと同じ詩心数の加護になる。加護と同じ排他グループなので、加護が付くと契約は外れる
  // ============================================================
  {
    id: "armys-muse-1",
    icon: armysPaeonIcon,
    duration: 10,
    effects: [
      {
        type: "speed",
        value: 0.99,
      },
    ],
    color: "#ffa726",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },
  {
    id: "armys-muse-2",
    icon: armysPaeonIcon,
    duration: 10,
    effects: [
      {
        type: "speed",
        value: 0.98,
      },
    ],
    color: "#ffa726",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },
  {
    id: "armys-muse-3",
    icon: armysPaeonIcon,
    duration: 10,
    effects: [
      {
        type: "speed",
        value: 0.96,
      },
    ],
    color: "#ffa726",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },
  {
    id: "armys-muse-4",
    icon: armysPaeonIcon,
    duration: 10,
    effects: [
      {
        type: "speed",
        value: 0.88,
      },
    ],
    color: "#ffa726",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },
  {
    id: "armys-ethos-1",
    icon: armysPaeonIcon,
    duration: 30,
    effects: [
      {
        type: "applyBuffOnSkill",
        value: 1,
        appliesToSkillIds: ARMYS_ETHOS_SONGS,
        appliedBuffId: "armys-muse-1",
      },
    ],
    color: "#ffcc80",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },
  {
    id: "armys-ethos-2",
    icon: armysPaeonIcon,
    duration: 30,
    effects: [
      {
        type: "applyBuffOnSkill",
        value: 1,
        appliesToSkillIds: ARMYS_ETHOS_SONGS,
        appliedBuffId: "armys-muse-2",
      },
    ],
    color: "#ffcc80",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },
  {
    id: "armys-ethos-3",
    icon: armysPaeonIcon,
    duration: 30,
    effects: [
      {
        type: "applyBuffOnSkill",
        value: 1,
        appliesToSkillIds: ARMYS_ETHOS_SONGS,
        appliedBuffId: "armys-muse-3",
      },
    ],
    color: "#ffcc80",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },
  {
    id: "armys-ethos-4",
    icon: armysPaeonIcon,
    duration: 30,
    effects: [
      {
        type: "applyBuffOnSkill",
        value: 1,
        appliesToSkillIds: ARMYS_ETHOS_SONGS,
        appliedBuffId: "armys-muse-4",
      },
    ],
    color: "#ffcc80",
    acquiredLevel: 78,
    exclusiveGroup: "armys-muse",
  },

  // ============================================================
  // proc / レディ系バフ
  // ============================================================
  {
    id: "hawks-eye",
    icon: straightShotIcon,
    duration: 30,
    effects: [],
    color: "#e91e63",
    maxStacks: 1,
  },
  {
    id: "barrage",
    icon: barrageIcon,
    duration: 10,
    effects: [],
    color: "#ff6d00",
    maxStacks: 1,
    acquiredLevel: 38,
  },
  {
    id: "blast-arrow-ready",
    icon: blastArrowIcon,
    duration: 10,
    effects: [],
    color: "#d50000",
    maxStacks: 1,
    acquiredLevel: 86,
  },
  {
    id: "resonant-arrow-ready",
    icon: resonantArrowIcon,
    duration: 30,
    effects: [],
    color: "#7c4dff",
    maxStacks: 1,
    acquiredLevel: 96,
  },
  {
    id: "radiant-encore-ready-1",
    icon: radiantEncoreIcon,
    duration: 30,
    effects: [],
    color: "#6200ea",
    maxStacks: 1,
    acquiredLevel: 100,
  },
  {
    id: "radiant-encore-ready-2",
    icon: radiantEncoreIcon,
    duration: 30,
    effects: [],
    color: "#6200ea",
    maxStacks: 1,
    acquiredLevel: 100,
  },
  {
    id: "radiant-encore-ready-3",
    icon: radiantEncoreIcon,
    duration: 30,
    effects: [],
    color: "#6200ea",
    maxStacks: 1,
    acquiredLevel: 100,
  },
];
