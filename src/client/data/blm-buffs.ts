import type { BuffDefinition } from "../types/skill";

// === バフアイコン ===
import fireIcon from "../assets/icons/blm/Fire.png";
import blizzardIcon from "../assets/icons/blm/Blizzard.png";
import thunderIcon from "../assets/icons/blm/Thunder.png";
import fire3Icon from "../assets/icons/blm/Fire_III.png";
import leyLinesIcon from "../assets/icons/blm/Ley_Lines.png";
import triplecastIcon from "../assets/icons/blm/Triplecast.png";
import swiftcastIcon from "../assets/icons/blm/role_actions/Swiftcast.png";

/**
 * 黒魔道士のバフ定義。
 *
 * AF/UB は各 3 段階を別バフ（astral-fire-1/2/3、umbral-ice-1/2/3）として定義し、
 * すべて `exclusiveGroup: "astral-umbral"` で相互排他する。
 * 段階ごとに威力倍率が異なるため、スタック式ではなく個別バフにしている。
 *
 * エノキアン（Lv86 特性で +23%、AF/UB 中常時適用）は、各 AF/UB バフに `potency 1.23`
 * エフェクトを同梱して表現する。これによりファイア/ブリザド系以外の
 * サンダー/ポリグロット/パラドックス等にもエノキアン倍率が適用される。
 *
 * ※ Lv86 未満の環境ではエノキアン倍率は近似値（本ツールは Lv100 を主想定）。
 *    正確な値は実機検証で必要に応じて調整する。
 */

// === AF/UB で対象となるスキルID群 ===
const FIRE_SKILL_IDS = [
  "fire",
  "fire-2",
  "fire-3",
  "fire-4",
  "high-fire-2",
  "despair",
  "flare-star",
];
const BLIZZARD_SKILL_IDS = [
  "blizzard",
  "blizzard-2",
  "blizzard-3",
  "blizzard-4",
  "high-blizzard-2",
  "freeze",
];

/** エノキアン倍率（Lv86 特性、AF/UB 中常時）。Lv100 想定の近似値 */
const ENOCHIAN_MULTIPLIER = 1.23;

const EXCLUSIVE_GROUP_AF_UB = "astral-umbral";

export const BLM_BUFFS: BuffDefinition[] = [
  // ============================================================
  // アストラルファイア（AF）: ファイア系威力増、ブリザド系威力減
  // ============================================================
  {
    id: "astral-fire-1",
    name: "アストラルファイア I",
    shortName: "AF1",
    icon: fireIcon,
    duration: null,
    exclusiveGroup: EXCLUSIVE_GROUP_AF_UB,
    effects: [
      { type: "potency", value: 1.4, appliesToSkillIds: FIRE_SKILL_IDS },
      { type: "potency", value: 0.9, appliesToSkillIds: BLIZZARD_SKILL_IDS },
      { type: "potency", value: ENOCHIAN_MULTIPLIER },
    ],
    color: "#ef5350",
    acquiredLevel: 2,
  },
  {
    id: "astral-fire-2",
    name: "アストラルファイア II",
    shortName: "AF2",
    icon: fireIcon,
    duration: null,
    exclusiveGroup: EXCLUSIVE_GROUP_AF_UB,
    effects: [
      { type: "potency", value: 1.6, appliesToSkillIds: FIRE_SKILL_IDS },
      { type: "potency", value: 0.8, appliesToSkillIds: BLIZZARD_SKILL_IDS },
      { type: "potency", value: ENOCHIAN_MULTIPLIER },
    ],
    color: "#e53935",
    acquiredLevel: 2,
  },
  {
    id: "astral-fire-3",
    name: "アストラルファイア III",
    shortName: "AF3",
    icon: fireIcon,
    duration: null,
    exclusiveGroup: EXCLUSIVE_GROUP_AF_UB,
    effects: [
      { type: "potency", value: 1.8, appliesToSkillIds: FIRE_SKILL_IDS },
      { type: "potency", value: 0.7, appliesToSkillIds: BLIZZARD_SKILL_IDS },
      { type: "potency", value: ENOCHIAN_MULTIPLIER },
    ],
    color: "#c62828",
    acquiredLevel: 2,
  },

  // ============================================================
  // アンブラルブリザード（UB）: ファイア系威力減、ブリザド系は等倍
  // （7.x ではアイス側に倍率ボーナスはなく、MP 回復・MP 消費 0 が主効果）
  // ============================================================
  {
    id: "umbral-ice-1",
    name: "アンブラルブリザード I",
    shortName: "UB1",
    icon: blizzardIcon,
    duration: null,
    exclusiveGroup: EXCLUSIVE_GROUP_AF_UB,
    effects: [
      { type: "potency", value: 0.9, appliesToSkillIds: FIRE_SKILL_IDS },
      { type: "potency", value: ENOCHIAN_MULTIPLIER },
    ],
    color: "#42a5f5",
    acquiredLevel: 1,
  },
  {
    id: "umbral-ice-2",
    name: "アンブラルブリザード II",
    shortName: "UB2",
    icon: blizzardIcon,
    duration: null,
    exclusiveGroup: EXCLUSIVE_GROUP_AF_UB,
    effects: [
      { type: "potency", value: 0.8, appliesToSkillIds: FIRE_SKILL_IDS },
      { type: "potency", value: ENOCHIAN_MULTIPLIER },
    ],
    color: "#1e88e5",
    acquiredLevel: 1,
  },
  {
    id: "umbral-ice-3",
    name: "アンブラルブリザード III",
    shortName: "UB3",
    icon: blizzardIcon,
    duration: null,
    exclusiveGroup: EXCLUSIVE_GROUP_AF_UB,
    effects: [
      { type: "potency", value: 0.7, appliesToSkillIds: FIRE_SKILL_IDS },
      { type: "potency", value: ENOCHIAN_MULTIPLIER },
    ],
    color: "#1565c0",
    acquiredLevel: 1,
  },

  // ============================================================
  // proc 系（7.2 以降は確定付与に変更済み、永続）
  // ============================================================
  {
    id: "thunderhead",
    name: "サンダーヘッド",
    shortName: "ｻﾝﾀﾞｰ\nﾍｯﾄﾞ",
    icon: thunderIcon,
    duration: null,
    effects: [],
    color: "#ba68c8",
    acquiredLevel: 6,
  },
  {
    id: "firestarter",
    name: "ファイアスターター",
    shortName: "ﾌｧｲｱ\nｽﾀｰﾀｰ",
    icon: fire3Icon,
    duration: null,
    // 次のファイガ詠唱を Instant 化（実スキル側の補正は別途対応。本バフは詠唱時間 0 化のみ担う）
    effects: [{ type: "instantCast", value: 0 }],
    color: "#ff7043",
    acquiredLevel: 2,
  },

  // ============================================================
  // 三連魔・黒魔紋・鋭利魔削除済み（7.0）
  // ============================================================
  {
    id: "triplecast",
    name: "三連魔",
    shortName: "三連魔",
    icon: triplecastIcon,
    duration: 15,
    maxStacks: 3,
    // 詠唱時間を持つ次 3 発の GCD を Instant 化
    effects: [{ type: "instantCast", value: 0 }],
    color: "#ffee58",
    acquiredLevel: 66,
  },
  {
    id: "ley-lines",
    name: "黒魔紋",
    shortName: "黒魔紋",
    icon: leyLinesIcon,
    duration: 20,
    effects: [
      // スペルスピード +15% 相当 → GCD/詠唱が約 0.85 倍
      { type: "speed", value: 0.85 },
    ],
    color: "#ab47bc",
    acquiredLevel: 52,
  },
  {
    id: "swiftcast",
    name: "迅速魔",
    shortName: "迅速魔",
    icon: swiftcastIcon,
    duration: 10,
    effects: [{ type: "instantCast", value: 0 }],
    color: "#80deea",
    acquiredLevel: 18,
  },
];
