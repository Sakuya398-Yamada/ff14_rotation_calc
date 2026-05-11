import type { BuffDefinition } from "../types/skill";

import jinpuIcon from "../assets/icons/sam/Jinpu.png";
import shifuIcon from "../assets/icons/sam/Shifu.png";
import meikyoShisuiIcon from "../assets/icons/sam/Meikyo_Shisui.png";
import ikishotenIcon from "../assets/icons/sam/Ikishoten.png";
import zanshinIcon from "../assets/icons/sam/Zanshin.png";
import ogiNamikiriIcon from "../assets/icons/sam/Ogi_Namikiri.png";
import kaeshiGokenIcon from "../assets/icons/sam/Kaeshi_Goken.png";
import kaeshiSetsugekkaIcon from "../assets/icons/sam/Kaeshi_Setsugekka.png";
import tendoKaeshiGokenIcon from "../assets/icons/sam/Tendo_Kaeshi_Goken.png";
import tendoKaeshiSetsugekkaIcon from "../assets/icons/sam/Tendo_Kaeshi_Setsugekka.png";
import kaeshiNamikiriIcon from "../assets/icons/sam/Kaeshi_Namikiri.png";
import tendoSetsugekkaIcon from "../assets/icons/sam/Tendo_Setsugekka.png";
import enpiIcon from "../assets/icons/sam/Enpi.png";

/**
 * 明鏡止水でコンボ条件無視（bypassCombo）の対象となるWS群。
 * - 1段目（刃風/暁風/風雅/風光）は comboFrom を持たないのでバイパス不要
 * - 2段目（陣風/士風/雪風/満月/桜花）と 3段目（月光/花車）が対象
 */
const MEIKYO_BYPASS_TARGETS = [
  "jinpu",
  "shifu",
  "yukikaze",
  "gekko",
  "kasha",
  "mangetsu",
  "oka",
];

/**
 * 侍（SAM）バフ定義
 */
export const SAM_BUFFS: BuffDefinition[] = [
  // ============================================================
  // コンボ完走で付与される自己バフ
  // ============================================================
  {
    id: "fugetsu",
    name: "風月",
    shortName: "風月",
    icon: jinpuIcon,
    duration: 40,
    effects: [
      {
        type: "potency",
        value: 1.13,
      },
    ],
    color: "#1976d2",
    acquiredLevel: 4,
  },
  {
    id: "fuka",
    name: "風花",
    shortName: "風花",
    icon: shifuIcon,
    duration: 40,
    effects: [
      {
        type: "speed",
        value: 0.87,
      },
    ],
    color: "#7e57c2",
    acquiredLevel: 18,
  },

  // ============================================================
  // 明鏡止水（コンボ条件無視 + GCDで自動消費）
  // ============================================================
  {
    id: "meikyo-shisui",
    name: "明鏡止水",
    shortName: "明鏡\n止水",
    icon: meikyoShisuiIcon,
    duration: 20,
    effects: [
      {
        type: "bypassCombo",
        value: 1,
        appliesToSkillIds: MEIKYO_BYPASS_TARGETS,
      },
      {
        type: "consumeOnGcd",
        value: 1,
        appliesToSkillIds: MEIKYO_BYPASS_TARGETS,
      },
    ],
    color: "#26c6da",
    maxStacks: 3,
    acquiredLevel: 50,
  },

  // ============================================================
  // 天道（Lv100、明鏡止水使用時に同時付与。次の居合術が天道版に変化）
  // ============================================================
  {
    id: "tendo",
    name: "天道",
    shortName: "天道",
    icon: tendoSetsugekkaIcon,
    duration: 30,
    effects: [],
    color: "#ffd54f",
    maxStacks: 1,
    acquiredLevel: 100,
  },

  // ============================================================
  // 意気衝天（燕飛使用可）
  // ============================================================
  {
    id: "ikishoten-buff",
    name: "意気衝天効果",
    shortName: "意気\n衝天",
    icon: enpiIcon,
    duration: 30,
    effects: [],
    color: "#ff7043",
    maxStacks: 1,
    acquiredLevel: 68,
  },

  // ============================================================
  // 奥義波切実行可（Lv90、意気衝天で付与）
  // ============================================================
  {
    id: "ogi-namikiri-ready",
    name: "奥義波切実行可",
    shortName: "奥義\nﾚﾃﾞｨ",
    icon: ogiNamikiriIcon,
    duration: 30,
    effects: [],
    color: "#ec407a",
    maxStacks: 1,
    acquiredLevel: 90,
  },

  // ============================================================
  // 残心実行可（Lv96、意気衝天で付与）
  // ============================================================
  {
    id: "zanshin-ready",
    name: "残心実行可",
    shortName: "残心\nﾚﾃﾞｨ",
    icon: zanshinIcon,
    duration: 30,
    effects: [],
    color: "#ab47bc",
    maxStacks: 1,
    acquiredLevel: 96,
  },

  // ============================================================
  // 燕返し系 Ready バフ（5種、exclusiveGroup="tsubame-ready" で排他）
  // ============================================================
  {
    id: "tsubame-kaeshi-goken-ready",
    name: "返し五剣準備",
    shortName: "返五剣\nﾚﾃﾞｨ",
    icon: kaeshiGokenIcon,
    duration: 60,
    effects: [],
    color: "#42a5f5",
    maxStacks: 1,
    acquiredLevel: 76,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-kaeshi-setsugekka-ready",
    name: "返し雪月花準備",
    shortName: "返雪月\nﾚﾃﾞｨ",
    icon: kaeshiSetsugekkaIcon,
    duration: 60,
    effects: [],
    color: "#5c6bc0",
    maxStacks: 1,
    acquiredLevel: 76,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-tendo-kaeshi-goken-ready",
    name: "天道返し五剣準備",
    shortName: "天道\n返五剣",
    icon: tendoKaeshiGokenIcon,
    duration: 60,
    effects: [],
    color: "#ffa726",
    maxStacks: 1,
    acquiredLevel: 100,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-tendo-kaeshi-setsugekka-ready",
    name: "天道返し雪月花準備",
    shortName: "天道\n返雪月",
    icon: tendoKaeshiSetsugekkaIcon,
    duration: 60,
    effects: [],
    color: "#ffb74d",
    maxStacks: 1,
    acquiredLevel: 100,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-kaeshi-namikiri-ready",
    name: "返し波切準備",
    shortName: "返波切\nﾚﾃﾞｨ",
    icon: kaeshiNamikiriIcon,
    duration: 60,
    effects: [],
    color: "#26a69a",
    maxStacks: 1,
    acquiredLevel: 90,
    exclusiveGroup: "tsubame-ready",
  },
];
