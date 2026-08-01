import type { AutoTransformEntry, Skill } from "../types/skill";
import twinSnakesIcon from "../assets/icons/mnk/Twin_Snakes.png";
import demolishIcon from "../assets/icons/mnk/Demolish.png";
import dragonKickIcon from "../assets/icons/mnk/Dragon_Kick.png";
import leapingOpoIcon from "../assets/icons/mnk/Leaping_Opo.png";
import risingRaptorIcon from "../assets/icons/mnk/Rising_Raptor.png";
import pouncingCoeurlIcon from "../assets/icons/mnk/Pouncing_Coeurl.png";
import armOfTheDestroyerIcon from "../assets/icons/mnk/Arm_of_the_Destroyer.png";
import shadowOfTheDestroyerIcon from "../assets/icons/mnk/Shadow_of_the_Destroyer.png";
import rockbreakerIcon from "../assets/icons/mnk/Rockbreaker.png";
import fourPointFuryIcon from "../assets/icons/mnk/Four-point_Fury.png";
import formShiftIcon from "../assets/icons/mnk/Form_Shift.png";
import sixSidedStarIcon from "../assets/icons/mnk/Six-sided_Star.png";
import masterfulBlitzIcon from "../assets/icons/mnk/Masterful_Blitz.png";
import phantomRushIcon from "../assets/icons/mnk/Phantom_Rush.png";
import elixirBurstIcon from "../assets/icons/mnk/Elixir_Burst.png";
import risingPhoenixIcon from "../assets/icons/mnk/Rising_Phoenix.png";
import celestialRevolutionIcon from "../assets/icons/mnk/Celestial_Revolution.png";
import windsReplyIcon from "../assets/icons/mnk/Wind's_Reply.png";
import firesReplyIcon from "../assets/icons/mnk/Fire's_Reply.png";
import steeledMeditationIcon from "../assets/icons/mnk/Steeled_Meditation.png";
import forbiddenMeditationIcon from "../assets/icons/mnk/Forbidden_Meditation.png";
import steelPeakIcon from "../assets/icons/mnk/Steel_Peak.png";
import theForbiddenChakraIcon from "../assets/icons/mnk/The_Forbidden_Chakra.png";
import howlingFistIcon from "../assets/icons/mnk/Howling_Fist.png";
import enlightenmentIcon from "../assets/icons/mnk/Enlightenment.png";
import thunderclapIcon from "../assets/icons/mnk/Thunderclap.png";
import perfectBalanceIcon from "../assets/icons/mnk/Perfect_Balance.png";
import riddleOfFireIcon from "../assets/icons/mnk/Riddle_of_Fire.png";
import riddleOfWindIcon from "../assets/icons/mnk/Riddle_of_Wind.png";
import riddleOfEarthIcon from "../assets/icons/mnk/Riddle_of_Earth.png";
import brotherhoodIcon from "../assets/icons/mnk/Brotherhood.png";
import mantraIcon from "../assets/icons/mnk/Mantra.png";
import trueNorthIcon from "../assets/icons/mnk/role_actions/True_North.png";

/**
 * モンク（MNK）の攻撃スキル定義（パッチ7.5系の公式ジョブガイド準拠、Lv100想定）。
 *
 * ## 型（フォーム）のモデル化
 * 壱→弐→参の型は WS コンボ（comboFrom）で表現する。
 * - 壱の型の WS（連撃系・双竜脚・壊神衝系）→ 弐の型を付与 → 弐の型の WS が繋がる
 * - 踏鳴・零の型は bypassCombo バフ（mnk-buffs.ts）で型を無視して成立させる
 * - ゲーム内の型は 30 秒持続だが、本ツールのコンボタイマー（15秒）と、
 *   コンボ対象外 GCD（六合星導脚等）を挟むと型が切れる点は簡略化として許容する
 *
 * ## 功力のモデル化
 * 功力はリソース（opo-fury / raptor-fury / coeurl-fury）で表現し、
 * 消費側 WS は autoTransform で「功力あり版」（hidden スキル）に自動変化する。
 * 参の功力のみ 2 スタックで、1 回の WS につき 1 ずつ消費される。
 *
 * ## 方向指定
 * SAM の月光・花車と同様に方向指定ボーナスは成功前提で威力に内包する
 * （崩拳・虎襲崩拳 = 側面、破砕拳 = 背面）。
 *
 * ## 必殺技のモデル化
 * 必殺技（masterful-blitz）はビーストチャクラの組み合わせに応じて
 * autoTransform で 4 種の hidden スキルに変化する。
 * - 夢幻闘舞: 陰陽の闘気 + チャクラ3つ（組み合わせ不問）
 * - 真空波: 同種チャクラ3つ / 鳳凰の舞: 3種チャクラ / 天宙脚: 上記以外（2+1）
 * - Lv90 未満の下位技（蒼気砲・爆裂脚・闘魂旋風脚）は対象外（Lv100 想定）
 * - 天宙脚の闘気は「陰優先、陰保有時は陽」だが、条件分岐を表現できないため
 *   常に陰の闘気を付与する近似とする（回しでの使用頻度が低いため影響軽微）
 *
 * ## その他の簡略化
 * - クリティカル時の確率チャクラ獲得（特性）は乱数のため対象外
 * - Lv92 で上位技（猿舞連撃・竜頷正拳撃・虎襲崩拳）に変化する連撃・正拳突き・崩拳、
 *   空鳴闘気・万象闘気（瞑想の範囲版。効果は鉄山闘気・陰陽闘気と同一）は
 *   パレット簡潔化のため対象外（Lv100 の実用キットのみ収録）
 * - 特性による低レベル帯の威力変動（traitPotencyOverrides）は未投入（Lv100 の値のみ）
 */

// MNK の GCD は疾風迅雷（特性）込みで 2.0 秒
const GCD_RECAST = 2.0;
const DEFAULT_ANIMATION_LOCK = 0.65;

// 型を付与する WS（= 次の型の WS の comboFrom）。autoTransform の変化先も含める
/** 壱の型を付与する WS（参の型の WS 群） */
const GRANTS_OPO_FORM = [
  "pouncing-coeurl",
  "pouncing-coeurl-fury",
  "demolish",
  "rockbreaker",
];
/** 弐の型を付与する WS（壱の型の WS 群） */
const GRANTS_RAPTOR_FORM = [
  "leaping-opo",
  "leaping-opo-fury",
  "dragon-kick",
  "arm-of-the-destroyer",
  "shadow-of-the-destroyer",
];
/** 参の型を付与する WS（弐の型の WS 群） */
const GRANTS_COEURL_FORM = [
  "rising-raptor",
  "rising-raptor-fury",
  "twin-snakes",
  "four-point-fury",
];

/** ビーストチャクラの条件リストを組み立てる（必殺技の autoTransform 用） */
function beastChakraConditions(
  opo: number,
  raptor: number,
  coeurl: number
): { resourceId: string; minAmount: number }[] {
  const conditions: { resourceId: string; minAmount: number }[] = [];
  if (opo > 0) conditions.push({ resourceId: "opo-chakra", minAmount: opo });
  if (raptor > 0) conditions.push({ resourceId: "raptor-chakra", minAmount: raptor });
  if (coeurl > 0) conditions.push({ resourceId: "coeurl-chakra", minAmount: coeurl });
  return conditions;
}

/** チャクラ合計3つになる全組み合わせ（壱, 弐, 参） */
const THREE_CHAKRA_COMBOS: [number, number, number][] = [
  [3, 0, 0], [0, 3, 0], [0, 0, 3],
  [2, 1, 0], [2, 0, 1], [1, 2, 0], [0, 2, 1], [1, 0, 2], [0, 1, 2],
  [1, 1, 1],
];

/** 同種3つ（真空波の条件） */
const SAME_CHAKRA_COMBOS: [number, number, number][] = [
  [3, 0, 0], [0, 3, 0], [0, 0, 3],
];

/** 2+1（天宙脚の条件。夢幻闘舞・真空波・鳳凰の舞に該当しない残り） */
const MIXED_CHAKRA_COMBOS: [number, number, number][] = [
  [2, 1, 0], [2, 0, 1], [1, 2, 0], [0, 2, 1], [1, 0, 2], [0, 1, 2],
];

// 必殺技の変化テーブル。先頭から優先評価されるため、
// 夢幻闘舞（陰陽+3チャクラ）→ 真空波（同種3）→ 鳳凰の舞（3種）→ 天宙脚（2+1）の順に並べる
const MASTERFUL_BLITZ_TRANSFORMS: AutoTransformEntry[] = [
  ...THREE_CHAKRA_COMBOS.map(([o, r, c]) => ({
    resourceConditions: [
      ...beastChakraConditions(o, r, c),
      { resourceId: "lunar-nadi", minAmount: 1 },
      { resourceId: "solar-nadi", minAmount: 1 },
    ],
    skillId: "phantom-rush",
  })),
  ...SAME_CHAKRA_COMBOS.map(([o, r, c]) => ({
    resourceConditions: beastChakraConditions(o, r, c),
    skillId: "elixir-burst",
  })),
  {
    resourceConditions: beastChakraConditions(1, 1, 1),
    skillId: "rising-phoenix",
  },
  ...MIXED_CHAKRA_COMBOS.map(([o, r, c]) => ({
    resourceConditions: beastChakraConditions(o, r, c),
    skillId: "celestial-revolution",
  })),
];

export const MNK_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // GCD: 壱の型（オポオポ）の WS
  // ============================================================
  // 双竜脚: 型成立（またはバイパス）時に壱の功力を付与
  {
    id: "dragon-kick",
    name: "双竜脚",
    potency: 320,
    type: "gcd",
    target: "enemy",
    icon: dragonKickIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    comboFrom: GRANTS_OPO_FORM,
    comboResourceChanges: [{ resourceId: "opo-fury", amount: 1 }],
  },
  // 猿舞連撃: 壱の型ボーナス（確定クリティカル）は型成立前提で常時適用する
  {
    id: "leaping-opo",
    name: "猿舞連撃",
    potency: 260,
    type: "gcd",
    target: "enemy",
    icon: leapingOpoIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    comboFrom: GRANTS_OPO_FORM,
    guaranteedCrit: true,
    autoTransform: [
      { resourceConditions: [{ resourceId: "opo-fury", minAmount: 1 }], skillId: "leaping-opo-fury" },
    ],
  },
  {
    id: "leaping-opo-fury",
    name: "猿舞連撃（功力）",
    potency: 460,
    type: "gcd",
    target: "enemy",
    icon: leapingOpoIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    comboFrom: GRANTS_OPO_FORM,
    guaranteedCrit: true,
    resourceChanges: [{ resourceId: "opo-fury", amount: -1 }],
    hidden: true,
  },
  // ============================================================
  // GCD: 弐の型（ラプトル）の WS
  // ============================================================
  // 双掌打: 型成立時に弐の功力を付与
  {
    id: "twin-snakes",
    name: "双掌打",
    potency: 420,
    type: "gcd",
    target: "enemy",
    icon: twinSnakesIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 18,
    comboFrom: GRANTS_RAPTOR_FORM,
    comboResourceChanges: [{ resourceId: "raptor-fury", amount: 1 }],
  },
  // 竜頷正拳撃
  {
    id: "rising-raptor",
    name: "竜頷正拳撃",
    potency: 340,
    type: "gcd",
    target: "enemy",
    icon: risingRaptorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    comboFrom: GRANTS_RAPTOR_FORM,
    autoTransform: [
      { resourceConditions: [{ resourceId: "raptor-fury", minAmount: 1 }], skillId: "rising-raptor-fury" },
    ],
  },
  {
    id: "rising-raptor-fury",
    name: "竜頷正拳撃（功力）",
    potency: 540,
    type: "gcd",
    target: "enemy",
    icon: risingRaptorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    comboFrom: GRANTS_RAPTOR_FORM,
    resourceChanges: [{ resourceId: "raptor-fury", amount: -1 }],
    hidden: true,
  },
  // ============================================================
  // GCD: 参の型（クァール）の WS
  // ============================================================
  // 破砕拳: 威力360 + 背面ボーナス60 = 420（方向指定成功前提）。型成立時に参の功力を2付与
  {
    id: "demolish",
    name: "破砕拳",
    potency: 420,
    type: "gcd",
    target: "enemy",
    icon: demolishIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    comboFrom: GRANTS_COEURL_FORM,
    comboResourceChanges: [{ resourceId: "coeurl-fury", amount: 2 }],
  },
  // 虎襲崩拳: 威力310 + 側面ボーナス60 = 370（方向指定成功前提）
  {
    id: "pouncing-coeurl",
    name: "虎襲崩拳",
    potency: 370,
    type: "gcd",
    target: "enemy",
    icon: pouncingCoeurlIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    comboFrom: GRANTS_COEURL_FORM,
    autoTransform: [
      { resourceConditions: [{ resourceId: "coeurl-fury", minAmount: 1 }], skillId: "pouncing-coeurl-fury" },
    ],
  },
  // 虎襲崩拳（功力）: 威力460 + 側面ボーナス60 = 520（方向指定成功前提）
  {
    id: "pouncing-coeurl-fury",
    name: "虎襲崩拳（功力）",
    potency: 520,
    type: "gcd",
    target: "enemy",
    icon: pouncingCoeurlIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    comboFrom: GRANTS_COEURL_FORM,
    resourceChanges: [{ resourceId: "coeurl-fury", amount: -1 }],
    hidden: true,
  },
  // ============================================================
  // GCD: 範囲 WS
  // ============================================================
  // 壊神衝: 壱の型成立時は威力120（型ボーナス）
  {
    id: "arm-of-the-destroyer",
    name: "壊神衝",
    potency: 120,
    nonComboPotency: 110,
    type: "gcd",
    target: "enemy",
    icon: armOfTheDestroyerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 26,
    comboFrom: GRANTS_OPO_FORM,
    maxTargets: Infinity,
  },
  // 壊神脚（Lv82: 壊神衝から変化）: 壱の型ボーナスは確定クリティカル（型成立前提で常時適用）
  {
    id: "shadow-of-the-destroyer",
    name: "壊神脚",
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: shadowOfTheDestroyerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "arm-of-the-destroyer",
    comboFrom: GRANTS_OPO_FORM,
    guaranteedCrit: true,
    maxTargets: Infinity,
  },
  {
    id: "four-point-fury",
    name: "四面脚",
    potency: 140,
    type: "gcd",
    target: "enemy",
    icon: fourPointFuryIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 45,
    comboFrom: GRANTS_RAPTOR_FORM,
    maxTargets: Infinity,
  },
  {
    id: "rockbreaker",
    name: "地烈斬",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: rockbreakerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    comboFrom: GRANTS_COEURL_FORM,
    maxTargets: Infinity,
  },
  // ============================================================
  // GCD: その他の WS
  // ============================================================
  // 演武: 零の型を付与
  {
    id: "form-shift",
    name: "演武",
    potency: 0,
    type: "gcd",
    target: "self",
    icon: formShiftIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 52,
    buffApplications: ["formless-fist"],
  },
  // 六合星導脚: 780 + 闘気1つにつき80。闘気を全消費（リキャスト4秒）
  {
    id: "six-sided-star",
    name: "六合星導脚",
    potency: 780,
    type: "gcd",
    target: "enemy",
    icon: sixSidedStarIcon,
    recastTime: 4.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 80,
    consumeAllOfResource: "chakra",
    potencyScaling: {
      resourceId: "chakra",
      minAmount: 0,
      minPotency: 780,
      maxAmount: 10,
      maxPotency: 1580,
    },
  },
  // ============================================================
  // GCD: 必殺技（ビーストチャクラ消費）
  // ============================================================
  {
    id: "masterful-blitz",
    name: "必殺技",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: masterfulBlitzIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    autoTransform: MASTERFUL_BLITZ_TRANSFORMS,
  },
  // 夢幻闘舞: 陰陽の闘気 + チャクラ3つ。両闘気を消費
  {
    id: "phantom-rush",
    name: "夢幻闘舞",
    potency: 1500,
    type: "gcd",
    target: "enemy",
    icon: phantomRushIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [
      { resourceId: "lunar-nadi", amount: -1 },
      { resourceId: "solar-nadi", amount: -1 },
    ],
    buffApplications: ["formless-fist"],
    maxTargets: Infinity,
    falloffRate: 0.35,
    hidden: true,
  },
  // 真空波（Lv92: 蒼気砲から変化）: 同種チャクラ3つ。陰の闘気を付与
  {
    id: "elixir-burst",
    name: "真空波",
    potency: 900,
    type: "gcd",
    target: "enemy",
    icon: elixirBurstIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [{ resourceId: "lunar-nadi", amount: 1 }],
    buffApplications: ["formless-fist"],
    maxTargets: Infinity,
    falloffRate: 0.35,
    hidden: true,
  },
  // 鳳凰の舞（Lv86: 爆裂脚から変化）: 3種チャクラ。陽の闘気を付与
  {
    id: "rising-phoenix",
    name: "鳳凰の舞",
    potency: 900,
    type: "gcd",
    target: "enemy",
    icon: risingPhoenixIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 86,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [{ resourceId: "solar-nadi", amount: 1 }],
    buffApplications: ["formless-fist"],
    maxTargets: Infinity,
    falloffRate: 0.35,
    hidden: true,
  },
  // 天宙脚: 2+1のチャクラ。ゲーム内では陰優先（陰保有時は陽）だが、常に陰を付与する近似
  {
    id: "celestial-revolution",
    name: "天宙脚",
    potency: 600,
    type: "gcd",
    target: "enemy",
    icon: celestialRevolutionIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [{ resourceId: "lunar-nadi", amount: 1 }],
    buffApplications: ["formless-fist"],
    hidden: true,
  },
  // ============================================================
  // GCD: 極意派生 WS
  // ============================================================
  // 絶空拳: 疾風の極意使用後のみ実行可（前方直線範囲）
  {
    id: "winds-reply",
    name: "絶空拳",
    potency: 1040,
    type: "gcd",
    target: "enemy",
    icon: windsReplyIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    requiredBuff: "wind-rumination",
    buffConsumptions: [{ buffId: "wind-rumination", stacks: 1 }],
    maxTargets: Infinity,
    falloffRate: 0.35,
  },
  // 乾坤闘気弾: 紅蓮の極意使用後のみ実行可。零の型を付与
  {
    id: "fires-reply",
    name: "乾坤闘気弾",
    potency: 1400,
    type: "gcd",
    target: "enemy",
    icon: firesReplyIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    requiredBuff: "fire-rumination",
    buffConsumptions: [{ buffId: "fire-rumination", stacks: 1 }],
    buffApplications: ["formless-fist"],
    maxTargets: Infinity,
    falloffRate: 0.35,
  },
  // ============================================================
  // oGCD: 闘気（チャクラ）関連
  // ============================================================
  // 鉄山闘気: 闘気を1つ開く（Lv54で陰陽闘気に変化）
  {
    id: "steeled-meditation",
    name: "鉄山闘気",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: steeledMeditationIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    cooldown: 1,
    cooldownGroup: "mnk-meditation",
    resourceChanges: [{ resourceId: "chakra", amount: 1 }],
  },
  {
    id: "forbidden-meditation",
    name: "陰陽闘気",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: forbiddenMeditationIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    replacesSkillId: "steeled-meditation",
    cooldown: 1,
    cooldownGroup: "mnk-meditation",
    resourceChanges: [{ resourceId: "chakra", amount: 1 }],
  },
  // 鉄山靠: 闘気5消費（Lv54で陰陽闘気斬に変化）
  {
    id: "steel-peak",
    name: "鉄山靠",
    potency: 180,
    type: "ogcd",
    target: "enemy",
    icon: steelPeakIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    cooldown: 1,
    cooldownGroup: "mnk-chakra-st",
    resourceChanges: [{ resourceId: "chakra", amount: -5 }],
  },
  {
    id: "the-forbidden-chakra",
    name: "陰陽闘気斬",
    potency: 400,
    type: "ogcd",
    target: "enemy",
    icon: theForbiddenChakraIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    replacesSkillId: "steel-peak",
    cooldown: 1,
    cooldownGroup: "mnk-chakra-st",
    resourceChanges: [{ resourceId: "chakra", amount: -5 }],
  },
  // 空鳴拳: 闘気5消費・前方直線範囲（Lv74で万象闘気圏に変化。減衰なし）
  {
    id: "howling-fist",
    name: "空鳴拳",
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: howlingFistIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 40,
    cooldown: 1,
    cooldownGroup: "mnk-chakra-aoe",
    resourceChanges: [{ resourceId: "chakra", amount: -5 }],
    maxTargets: Infinity,
  },
  {
    id: "enlightenment",
    name: "万象闘気圏",
    potency: 160,
    type: "ogcd",
    target: "enemy",
    icon: enlightenmentIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 74,
    replacesSkillId: "howling-fist",
    cooldown: 1,
    cooldownGroup: "mnk-chakra-aoe",
    resourceChanges: [{ resourceId: "chakra", amount: -5 }],
    maxTargets: Infinity,
  },
  // ============================================================
  // oGCD: バフ・その他アビリティ
  // ============================================================
  // 踏鳴: 3スタック付与。WS を型不問で成立させ、ビーストチャクラを獲得できる
  {
    id: "perfect-balance",
    name: "踏鳴",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: perfectBalanceIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    cooldown: 40,
    maxCharges: 2,
    buffApplications: ["perfect-balance"],
  },
  // 紅蓮の極意: 与ダメージ15%上昇 + 乾坤闘気弾実行可を付与
  {
    id: "riddle-of-fire",
    name: "紅蓮の極意",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: riddleOfFireIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 68,
    cooldown: 60,
    buffApplications: ["riddle-of-fire", "fire-rumination"],
  },
  // 疾風の極意: オートアタック間隔短縮 + 絶空拳実行可を付与
  {
    id: "riddle-of-wind",
    name: "疾風の極意",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: riddleOfWindIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    cooldown: 90,
    buffApplications: ["riddle-of-wind", "wind-rumination"],
  },
  // 桃園結義: 与ダメージ5%上昇 + WS使用時にチャクラ獲得
  {
    id: "brotherhood",
    name: "桃園結義",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: brotherhoodIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 70,
    cooldown: 120,
    buffApplications: ["brotherhood"],
  },
  // 金剛の極意: 被ダメージ軽減（防御アビリティ。リキャスト管理用）
  {
    id: "riddle-of-earth",
    name: "金剛の極意",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: riddleOfEarthIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    cooldown: 120,
    buffApplications: ["riddle-of-earth"],
  },
  // マントラ: HP回復効果上昇（回復アビリティ。リキャスト管理用）
  {
    id: "mantra",
    name: "マントラ",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: mantraIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 42,
    cooldown: 90,
    buffApplications: ["mantra"],
  },
  // 抜重歩法: 移動アビリティ（3チャージ）
  {
    id: "thunderclap",
    name: "抜重歩法",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: thunderclapIcon,
    recastTime: 1.0,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 35,
    cooldown: 30,
    maxCharges: 3,
  },

  // ============================================================
  // oGCD: 近接DPSロールアクション
  // ============================================================
  // 方向指定ボーナスを無視するアビリティ。本ツールは方向指定ボーナス計算自体を
  // 実装していないため、バフ effects は空。リキャスト枠の管理用途で配置可能。
  {
    id: "true-north",
    name: "トゥルーノース",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: trueNorthIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    cooldown: 45,
    maxCharges: 2,
    acquiredLevel: 50,
    buffApplications: ["true-north"],
  },
];
