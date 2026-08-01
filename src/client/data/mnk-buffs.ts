import type { BuffDefinition } from "../types/skill";
import perfectBalanceIcon from "../assets/icons/mnk/Perfect_Balance.png";
import formShiftIcon from "../assets/icons/mnk/Form_Shift.png";
import riddleOfFireIcon from "../assets/icons/mnk/Riddle_of_Fire.png";
import firesReplyIcon from "../assets/icons/mnk/Fire's_Reply.png";
import riddleOfWindIcon from "../assets/icons/mnk/Riddle_of_Wind.png";
import windsReplyIcon from "../assets/icons/mnk/Wind's_Reply.png";
import riddleOfEarthIcon from "../assets/icons/mnk/Riddle_of_Earth.png";
import brotherhoodIcon from "../assets/icons/mnk/Brotherhood.png";
import mantraIcon from "../assets/icons/mnk/Mantra.png";
import trueNorthIcon from "../assets/icons/mnk/role_actions/True_North.png";

/**
 * モンク（MNK）のバフ定義（パッチ7.5系の公式ジョブガイド準拠）。
 *
 * 型（壱／弐／参の型）は WS コンボ（comboFrom）として表現しているため、
 * バフとしては定義しない。踏鳴・零の型は「型を無視して WS を成立させる」
 * bypassCombo バフとして表現する（SAM の明鏡止水と同じパターン）。
 */

/** 壱の型（壱ノ型）で使う WS（型ボーナス対象）。autoTransform の変化先も含める */
const OPO_WS = [
  "leaping-opo",
  "leaping-opo-fury",
  "dragon-kick",
  "arm-of-the-destroyer",
  "shadow-of-the-destroyer",
];

/** 弐の型で使う WS */
const RAPTOR_WS = [
  "rising-raptor",
  "rising-raptor-fury",
  "twin-snakes",
  "four-point-fury",
];

/** 参の型で使う WS */
const COEURL_WS = [
  "pouncing-coeurl",
  "pouncing-coeurl-fury",
  "demolish",
  "rockbreaker",
];

/** 型に紐づく全 WS（踏鳴・零の型のコンボバイパス対象） */
const FORM_WS = [...OPO_WS, ...RAPTOR_WS, ...COEURL_WS];

/** 全ウェポンスキル（桃園結義のチャクラ獲得対象。アビリティは対象外） */
const ALL_WS = [
  ...FORM_WS,
  "form-shift",
  "six-sided-star",
  "masterful-blitz",
  "phantom-rush",
  "elixir-burst",
  "rising-phoenix",
  "celestial-revolution",
  "winds-reply",
  "fires-reply",
];

export const MNK_BUFFS: BuffDefinition[] = [
  // 踏鳴: 3スタック。型を無視して WS を成立させ（bypassCombo）、
  // 使用した WS の型に応じたビーストチャクラを獲得する
  {
    id: "perfect-balance",
    name: "踏鳴",
    shortName: "踏鳴",
    icon: perfectBalanceIcon,
    duration: 20,
    maxStacks: 3,
    effects: [
      { type: "bypassCombo", value: 1, appliesToSkillIds: FORM_WS },
      { type: "consumeOnGcd", value: 1, appliesToSkillIds: FORM_WS },
      { type: "resourceGainOnSkill", value: 1, resourceId: "opo-chakra", appliesToSkillIds: OPO_WS },
      { type: "resourceGainOnSkill", value: 1, resourceId: "raptor-chakra", appliesToSkillIds: RAPTOR_WS },
      { type: "resourceGainOnSkill", value: 1, resourceId: "coeurl-chakra", appliesToSkillIds: COEURL_WS },
    ],
    color: "#ffb74d",
    acquiredLevel: 50,
  },
  // 零の型: 次の WS 1回を型不問で成立させる（演武・必殺技・乾坤闘気弾で付与）
  {
    id: "formless-fist",
    name: "零の型",
    shortName: "零型",
    icon: formShiftIcon,
    duration: 30,
    effects: [
      { type: "bypassCombo", value: 1, appliesToSkillIds: FORM_WS },
      { type: "consumeOnGcd", value: 1, appliesToSkillIds: FORM_WS },
    ],
    color: "#b0bec5",
    acquiredLevel: 52,
  },
  // 紅蓮の極意: 与ダメージ15%上昇
  {
    id: "riddle-of-fire",
    name: "紅蓮の極意",
    shortName: "紅蓮",
    icon: riddleOfFireIcon,
    duration: 20,
    effects: [{ type: "potency", value: 1.15 }],
    color: "#ef5350",
    acquiredLevel: 68,
  },
  // 乾坤闘気弾実行可
  {
    id: "fire-rumination",
    name: "乾坤闘気弾実行可",
    shortName: "乾坤\nﾚﾃﾞｨ",
    icon: firesReplyIcon,
    duration: 20,
    effects: [],
    color: "#ff8a65",
    acquiredLevel: 100,
  },
  // 疾風の極意: オートアタック間隔50%短縮（本ツールはオートアタック未実装のため effects は空）
  {
    id: "riddle-of-wind",
    name: "疾風の極意",
    shortName: "疾風",
    icon: riddleOfWindIcon,
    duration: 15,
    effects: [],
    color: "#4dd0e1",
    acquiredLevel: 72,
  },
  // 絶空拳実行可
  {
    id: "wind-rumination",
    name: "絶空拳実行可",
    shortName: "絶空\nﾚﾃﾞｨ",
    icon: windsReplyIcon,
    duration: 15,
    effects: [],
    color: "#80deea",
    acquiredLevel: 96,
  },
  // 桃園結義: 与ダメージ5%上昇 + WS使用時にチャクラ獲得（Meditative Brotherhood）。
  // パーティメンバーのWSによる確率獲得（20%）は乱数のため対象外とし、
  // 自身のWSによる獲得（確定）のみをモデル化する
  {
    id: "brotherhood",
    name: "桃園結義",
    shortName: "桃園",
    icon: brotherhoodIcon,
    duration: 20,
    effects: [
      { type: "potency", value: 1.05 },
      { type: "resourceGainOnSkill", value: 1, resourceId: "chakra", appliesToSkillIds: ALL_WS },
    ],
    color: "#ff7043",
    acquiredLevel: 70,
  },
  // 金剛の極意: 被ダメージ軽減（防御バフのため effects は空。リキャスト管理用）
  {
    id: "riddle-of-earth",
    name: "金剛の極意",
    shortName: "金剛",
    icon: riddleOfEarthIcon,
    duration: 10,
    effects: [],
    color: "#a1887f",
    acquiredLevel: 64,
  },
  // マントラ: HP回復効果上昇（回復バフのため effects は空）
  {
    id: "mantra",
    name: "マントラ",
    shortName: "ﾏﾝﾄﾗ",
    icon: mantraIcon,
    duration: 15,
    effects: [],
    color: "#f48fb1",
    acquiredLevel: 42,
  },
  // ロールアクション: トゥルーノース（方向指定無視）
  // effects は空（方向指定ボーナス計算が本ツール未実装のため）
  {
    id: "true-north",
    name: "トゥルーノース",
    shortName: "ﾄｩﾙｰ\nﾉｰｽ",
    icon: trueNorthIcon,
    duration: 10,
    effects: [],
    color: "#ce93d8",
    maxStacks: 1,
    acquiredLevel: 50,
  },
];
