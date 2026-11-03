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
import meditateIcon from "../assets/icons/sam/Meditate.png";

// === ロールアクション アイコン ===
import trueNorthIcon from "../assets/icons/sam/role_actions/True_North.png";

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
 * 明鏡止水のスタックを消費するWS群（「居合術および奥義波切を除くウェポンスキル」）。
 * 燕返し系は居合術・奥義波切の再発動なので消費しない。
 */
const MEIKYO_CONSUME_TARGETS = [
  ...MEIKYO_BYPASS_TARGETS,
  "hakaze",
  "gyofu",
  "fuga",
  "fuko",
  "enpi",
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
  // 明鏡止水（コンボ条件無視 + WSで自動消費 + 月光/花車使用時に風月/風花付与）
  // 満月/桜花の風月/風花はコンボ成立扱いにより comboBuffApplications 側で付与される
  // ============================================================
  {
    id: "meikyo-shisui",
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
        appliesToSkillIds: MEIKYO_CONSUME_TARGETS,
      },
      // 月光使用時に風月バフ付与
      {
        type: "applyBuffOnSkill",
        value: 1,
        appliesToSkillIds: ["gekko"],
        appliedBuffId: "fugetsu",
      },
      // 花車使用時に風花バフ付与
      {
        type: "applyBuffOnSkill",
        value: 1,
        appliesToSkillIds: ["kasha"],
        appliedBuffId: "fuka",
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
    icon: tendoSetsugekkaIcon,
    duration: 30,
    effects: [],
    color: "#ffd54f",
    maxStacks: 1,
    acquiredLevel: 100,
  },

  // ============================================================
  // 燕飛効果アップ（必殺剣・夜天で付与。燕飛の威力を上げて消費される）
  // ============================================================
  {
    id: "enhanced-enpi",
    icon: enpiIcon,
    duration: 15,
    effects: [],
    color: "#ff7043",
    maxStacks: 1,
    acquiredLevel: 56,
  },

  // ============================================================
  // 奥義波切実行可（Lv90、意気衝天で付与）
  // ============================================================
  {
    id: "ogi-namikiri-ready",
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
    icon: zanshinIcon,
    duration: 30,
    effects: [],
    color: "#ab47bc",
    maxStacks: 1,
    acquiredLevel: 96,
  },

  // ============================================================
  // 燕返し系 Ready バフ（4種、exclusiveGroup="tsubame-ready" で排他）。返し波切準備は奥義波切側の変化条件なので排他にしない
  // ============================================================
  {
    id: "tsubame-kaeshi-goken-ready",
    icon: kaeshiGokenIcon,
    duration: 30,
    effects: [],
    color: "#42a5f5",
    maxStacks: 1,
    acquiredLevel: 74,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-kaeshi-setsugekka-ready",
    icon: kaeshiSetsugekkaIcon,
    duration: 30,
    effects: [],
    color: "#5c6bc0",
    maxStacks: 1,
    acquiredLevel: 74,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-tendo-kaeshi-goken-ready",
    icon: tendoKaeshiGokenIcon,
    duration: 30,
    effects: [],
    color: "#ffa726",
    maxStacks: 1,
    acquiredLevel: 100,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-tendo-kaeshi-setsugekka-ready",
    icon: tendoKaeshiSetsugekkaIcon,
    duration: 30,
    effects: [],
    color: "#ffb74d",
    maxStacks: 1,
    acquiredLevel: 100,
    exclusiveGroup: "tsubame-ready",
  },
  {
    id: "tsubame-kaeshi-namikiri-ready",
    icon: kaeshiNamikiriIcon,
    duration: 60,
    effects: [],
    color: "#26a69a",
    maxStacks: 1,
    acquiredLevel: 90,
  },

  // ============================================================
  // 黙想（効果中は 3 秒ごとに剣気・剣圧。付与は SAM_RESOURCES の autoGenerateWhileBuff で行う）
  // 次のアクションの実行で外れる（移動・ターンでの解除は扱わない）
  // ============================================================
  {
    id: "meditate",
    icon: meditateIcon,
    duration: 15,
    effects: [{ type: "consumeOnAction", value: 1 }],
    color: "#8d6e63",
    acquiredLevel: 60,
  },
  // ロールアクション: トゥルーノース（方向指定無視）
  // effects は空（方向指定ボーナス計算が本ツール未実装のため）
  {
    id: "true-north",
    icon: trueNorthIcon,
    duration: 10,
    effects: [],
    color: "#ce93d8",
    maxStacks: 1,
    acquiredLevel: 50,
  },
];
