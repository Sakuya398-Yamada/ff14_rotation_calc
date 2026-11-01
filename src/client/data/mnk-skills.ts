import type { AutoTransformEntry, Skill, TraitPotencyOverride } from "../types/skill";
import bootshineIcon from "../assets/icons/mnk/Bootshine.png";
import trueStrikeIcon from "../assets/icons/mnk/True_Strike.png";
import snapPunchIcon from "../assets/icons/mnk/Snap_Punch.png";
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
import tornadoKickIcon from "../assets/icons/mnk/Tornado_Kick.png";
import phantomRushIcon from "../assets/icons/mnk/Phantom_Rush.png";
import elixirFieldIcon from "../assets/icons/mnk/Elixir_Field.png";
import elixirBurstIcon from "../assets/icons/mnk/Elixir_Burst.png";
import flintStrikeIcon from "../assets/icons/mnk/Flint_Strike.png";
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
 * モンク（MNK）の攻撃スキル定義（パッチ7.5系の公式ジョブガイド準拠。収録スキルは Lv70〜100 の実用キット）。
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#515 で照合）。公式ジョブガイド（Patch 7.5、7.55 表記）とは #521 で GCD の拘束・発動条件を揃えた。
 * #610 で型の発動条件も揃え、既知の差分なし
 *
 * ## 型（フォーム）のモデル化
 * 壱→弐→参の型は、型のバフ（mnk-buffs.ts。効果時間 30 秒、同時に 1 つだけ）と付与バフで表すコンボ（comboFromBuff）で表現する。
 * - 型の WS は型の成否を問わず buffApplications で次の型を付ける（壱→弐→参→壱）。型の付かない GCD（六合星導脚等）を挟んでも型は残る
 * - 弐・参の型の WS は型が発動条件（required: true）。型が無ければ発動条件エラーにする
 * - 壱の型の WS は型が無くても撃てる（required: false）。型が無いと警告を出し、双竜脚の壱の功力・壊神衝の威力アップが付かない
 * - 踏鳴・零の型は bypassCombo バフ（mnk-buffs.ts）で型を無視して成立させる。そのときも追加効果は付く
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
 * autoTransform で Lv60 の hidden スキルに変化し、上位技を修得済みならその autoTransform で続けて上位技に変化する。
 * - 闘魂旋風脚（Lv90 から夢幻闘舞）: 陰陽の闘気 + チャクラ3つ（組み合わせ不問）
 * - 蒼気砲（Lv92 から真空波）: 同種チャクラ3つ / 爆裂脚（Lv86 から鳳凰の舞）: 3種チャクラ / 天宙脚: 上記以外（2+1）
 * - 天宙脚の闘気は「陰優先、陰保有時は陽」だが、条件分岐を表現できないため
 *   常に陰の闘気を付与する近似とする（回しでの使用頻度が低いため影響軽微）
 *
 * ## その他の簡略化
 * - クリティカル時の確率チャクラ獲得（特性）は乱数のため対象外
 * - 空鳴闘気・万象闘気（瞑想の範囲版。効果は鉄山闘気・陰陽闘気と同一）はパレット簡潔化のため対象外
 *
 * ## 特性によるレベル別の値（#517・#769）
 * 基本値は特性修得前の値にし、修得レベル以降の値を traitPotencyOverrides で上書きする。
 * - 疾風迅雷効果アップIII（Lv76）: GCD 2.125 → 2.0 秒（Lv76 未満で習得する GCD と鉄山闘気・陰陽闘気）
 * - 抜重歩法効果アップ（Lv84）: 抜重歩法の最大チャージ数 2 → 3
 * - アクション威力アップ（Lv84）/ II（Lv94）: 連撃・正拳突き・崩拳・双掌打・破砕拳・双竜脚・陰陽闘気斬・六合星導脚・夢幻闘舞の威力
 * - 桃園結義効果アップ（Lv88）: 桃園結義中の自身の WS による闘気獲得（Lv88 未満は確率なので付けない。mnk-buffs.ts）
 * - 象形拳（Lv92）: 連撃・正拳突き・崩拳が猿舞連撃・竜頷正拳撃・虎襲崩拳に置き換わる（replacesSkillId）
 * 修得後の値は公式ジョブガイドの特性の原文、修得前の値は consolegameswiki の Notes による
 * （連撃・正拳突き・崩拳はクラス版の説明文とも一致。功力時の威力も特性で同じだけ上がる）。
 * 踏鳴の最大チャージ数 2 は特性で変わらない。
 */

// 疾風迅雷（特性）: GCD は Lv76 未満が 2.5 秒の 15% 短縮で 2.125 秒（calcGcd が 10ms 単位に切り捨てて 2.12 秒）、
// 疾風迅雷効果アップIII（Lv76）からは 20% 短縮で 2.0 秒
const GCD_RECAST = 2.0;
const GCD_RECAST_BEFORE_LV76 = 2.125;
/** Lv76 未満で習得する WS の GCD を Lv76 から 2.0 秒にする */
const GCD_TRAIT_LV76: TraitPotencyOverride = { traitLevel: 76, recastTime: GCD_RECAST };
/** 鉄山闘気・陰陽闘気が発生させる GCD を Lv76 から 2.0 秒にする */
const MEDITATION_GCD_TRAIT_LV76: TraitPotencyOverride = { traitLevel: 76, gcdRecastTime: GCD_RECAST };
const DEFAULT_ANIMATION_LOCK = 0.65;

// 型の WS の comboFromBuff（付与バフで表すコンボ）。型の WS は buffApplications で次の型を付ける（mnk-buffs.ts の型のバフ）
/** 壱の型の WS: 型が無くても撃てる。壱の型効果中だけ追加効果（双竜脚の壱の功力・壊神衝の威力） */
const FROM_OPO_FORM = { buffId: "opo-form", required: false };
/** 弐の型の WS: 発動条件「弐の型」効果中 */
const FROM_RAPTOR_FORM = { buffId: "raptor-form", required: true };
/** 参の型の WS: 発動条件「参の型」効果中 */
const FROM_COEURL_FORM = { buffId: "coeurl-form", required: true };

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

/** 陰陽の闘気が両方ある（闘魂旋風脚・夢幻闘舞の条件） */
const BOTH_NADI_CONDITIONS = [
  { resourceId: "lunar-nadi", minAmount: 1 },
  { resourceId: "solar-nadi", minAmount: 1 },
];

// 必殺技の変化テーブル。先頭から優先評価されるため、
// 闘魂旋風脚（陰陽+3チャクラ）→ 蒼気砲（同種3）→ 爆裂脚（3種）→ 天宙脚（2+1）の順に並べる。
// 変化先を Lv60 の下位技にし、上位技へは下位技の autoTransform で続けて変化させる。
// autoTransform は条件の合った先頭の変化先が未習得（スキルマップに無い）だとそこで止まり後続を見ないので、
// 上位技を先頭に並べると上位技を修得するまで必殺技が変化しなくなる
const MASTERFUL_BLITZ_TRANSFORMS: AutoTransformEntry[] = [
  ...THREE_CHAKRA_COMBOS.map(([o, r, c]) => ({
    resourceConditions: [...beastChakraConditions(o, r, c), ...BOTH_NADI_CONDITIONS],
    skillId: "tornado-kick",
  })),
  ...SAME_CHAKRA_COMBOS.map(([o, r, c]) => ({
    resourceConditions: beastChakraConditions(o, r, c),
    skillId: "elixir-field",
  })),
  {
    resourceConditions: beastChakraConditions(1, 1, 1),
    skillId: "flint-strike",
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
    potency: 240,
    type: "gcd",
    target: "enemy",
    icon: dragonKickIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    comboFromBuff: FROM_OPO_FORM,
    buffApplications: ["raptor-form"],
    comboResourceChanges: [{ resourceId: "opo-fury", amount: 1 }],
    traitPotencyOverrides: [
      GCD_TRAIT_LV76,
      { traitLevel: 84, potency: 280 },
      { traitLevel: 94, potency: 320 },
    ],
  },
  // 連撃: 壱の型ボーナス（確定クリティカル）は型成立前提で常時適用する
  {
    id: "bootshine",
    name: "連撃",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: bootshineIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
    comboFromBuff: FROM_OPO_FORM,
    buffApplications: ["raptor-form"],
    guaranteedCrit: true,
    autoTransform: [
      { resourceConditions: [{ resourceId: "opo-fury", minAmount: 1 }], skillId: "bootshine-fury" },
    ],
    traitPotencyOverrides: [GCD_TRAIT_LV76, { traitLevel: 84, potency: 220 }],
  },
  {
    id: "bootshine-fury",
    name: "連撃（功力）",
    potency: 380,
    type: "gcd",
    target: "enemy",
    icon: bootshineIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
    comboFromBuff: FROM_OPO_FORM,
    buffApplications: ["raptor-form"],
    guaranteedCrit: true,
    resourceChanges: [{ resourceId: "opo-fury", amount: -1 }],
    hidden: true,
    traitPotencyOverrides: [GCD_TRAIT_LV76, { traitLevel: 84, potency: 420 }],
  },
  // 猿舞連撃（Lv92: 連撃から変化）: 壱の型ボーナス（確定クリティカル）は型成立前提で常時適用する
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
    replacesSkillId: "bootshine",
    comboFromBuff: FROM_OPO_FORM,
    buffApplications: ["raptor-form"],
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
    comboFromBuff: FROM_OPO_FORM,
    buffApplications: ["raptor-form"],
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
    potency: 340,
    type: "gcd",
    target: "enemy",
    icon: twinSnakesIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 18,
    comboFromBuff: FROM_RAPTOR_FORM,
    buffApplications: ["coeurl-form"],
    comboResourceChanges: [{ resourceId: "raptor-fury", amount: 1 }],
    traitPotencyOverrides: [
      GCD_TRAIT_LV76,
      { traitLevel: 84, potency: 380 },
      { traitLevel: 94, potency: 420 },
    ],
  },
  {
    id: "true-strike",
    name: "正拳突き",
    potency: 260,
    type: "gcd",
    target: "enemy",
    icon: trueStrikeIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 4,
    comboFromBuff: FROM_RAPTOR_FORM,
    buffApplications: ["coeurl-form"],
    autoTransform: [
      { resourceConditions: [{ resourceId: "raptor-fury", minAmount: 1 }], skillId: "true-strike-fury" },
    ],
    traitPotencyOverrides: [GCD_TRAIT_LV76, { traitLevel: 84, potency: 300 }],
  },
  {
    id: "true-strike-fury",
    name: "正拳突き（功力）",
    potency: 460,
    type: "gcd",
    target: "enemy",
    icon: trueStrikeIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 4,
    comboFromBuff: FROM_RAPTOR_FORM,
    buffApplications: ["coeurl-form"],
    resourceChanges: [{ resourceId: "raptor-fury", amount: -1 }],
    hidden: true,
    traitPotencyOverrides: [GCD_TRAIT_LV76, { traitLevel: 84, potency: 500 }],
  },
  // 竜頷正拳撃（Lv92: 正拳突きから変化）
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
    replacesSkillId: "true-strike",
    comboFromBuff: FROM_RAPTOR_FORM,
    buffApplications: ["coeurl-form"],
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
    comboFromBuff: FROM_RAPTOR_FORM,
    buffApplications: ["coeurl-form"],
    resourceChanges: [{ resourceId: "raptor-fury", amount: -1 }],
    hidden: true,
  },
  // ============================================================
  // GCD: 参の型（クァール）の WS
  // ============================================================
  // 破砕拳: 威力 280 / 320（Lv84）/ 360（Lv94）+ 背面ボーナス60（方向指定成功前提）。型成立時に参の功力を2付与
  {
    id: "demolish",
    name: "破砕拳",
    potency: 340,
    type: "gcd",
    target: "enemy",
    icon: demolishIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    comboFromBuff: FROM_COEURL_FORM,
    buffApplications: ["opo-form"],
    comboResourceChanges: [{ resourceId: "coeurl-fury", amount: 2 }],
    traitPotencyOverrides: [
      GCD_TRAIT_LV76,
      { traitLevel: 84, potency: 380 },
      { traitLevel: 94, potency: 420 },
    ],
  },
  // 崩拳: 威力 230 / 270（Lv84）+ 側面ボーナス60（方向指定成功前提）
  {
    id: "snap-punch",
    name: "崩拳",
    potency: 290,
    type: "gcd",
    target: "enemy",
    icon: snapPunchIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 6,
    comboFromBuff: FROM_COEURL_FORM,
    buffApplications: ["opo-form"],
    autoTransform: [
      { resourceConditions: [{ resourceId: "coeurl-fury", minAmount: 1 }], skillId: "snap-punch-fury" },
    ],
    traitPotencyOverrides: [GCD_TRAIT_LV76, { traitLevel: 84, potency: 330 }],
  },
  // 崩拳（功力）: 威力 380 / 420（Lv84）+ 側面ボーナス60（方向指定成功前提）
  {
    id: "snap-punch-fury",
    name: "崩拳（功力）",
    potency: 440,
    type: "gcd",
    target: "enemy",
    icon: snapPunchIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 6,
    comboFromBuff: FROM_COEURL_FORM,
    buffApplications: ["opo-form"],
    resourceChanges: [{ resourceId: "coeurl-fury", amount: -1 }],
    hidden: true,
    traitPotencyOverrides: [GCD_TRAIT_LV76, { traitLevel: 84, potency: 480 }],
  },
  // 虎襲崩拳（Lv92: 崩拳から変化）: 威力310 + 側面ボーナス60 = 370（方向指定成功前提）
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
    replacesSkillId: "snap-punch",
    comboFromBuff: FROM_COEURL_FORM,
    buffApplications: ["opo-form"],
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
    comboFromBuff: FROM_COEURL_FORM,
    buffApplications: ["opo-form"],
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
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 26,
    comboFromBuff: FROM_OPO_FORM,
    buffApplications: ["raptor-form"],
    maxTargets: Infinity,
    traitPotencyOverrides: [GCD_TRAIT_LV76],
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
    comboFromBuff: FROM_OPO_FORM,
    buffApplications: ["raptor-form"],
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
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 45,
    comboFromBuff: FROM_RAPTOR_FORM,
    buffApplications: ["coeurl-form"],
    maxTargets: Infinity,
    traitPotencyOverrides: [GCD_TRAIT_LV76],
  },
  {
    id: "rockbreaker",
    name: "地烈斬",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: rockbreakerIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    comboFromBuff: FROM_COEURL_FORM,
    buffApplications: ["opo-form"],
    maxTargets: Infinity,
    traitPotencyOverrides: [GCD_TRAIT_LV76],
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
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 52,
    buffApplications: ["formless-fist"],
    traitPotencyOverrides: [GCD_TRAIT_LV76],
  },
  // 六合星導脚: 710（Lv94 から 780）+ 闘気1つにつき80。闘気を全消費（リキャスト4秒）
  {
    id: "six-sided-star",
    name: "六合星導脚",
    potency: 710,
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
      minPotency: 710,
      maxAmount: 10,
      maxPotency: 1510,
    },
    traitPotencyOverrides: [
      {
        traitLevel: 94,
        potency: 780,
        potencyScaling: { resourceId: "chakra", minAmount: 0, minPotency: 780, maxAmount: 10, maxPotency: 1580 },
      },
    ],
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
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    autoTransform: MASTERFUL_BLITZ_TRANSFORMS,
    traitPotencyOverrides: [GCD_TRAIT_LV76],
  },
  // 闘魂旋風脚: 陰陽の闘気 + チャクラ3つ。両闘気を消費（夢幻闘舞と同じ扱い）。Lv90 から夢幻闘舞に変化
  {
    id: "tornado-kick",
    name: "闘魂旋風脚",
    potency: 1200,
    type: "gcd",
    target: "enemy",
    icon: tornadoKickIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [
      { resourceId: "lunar-nadi", amount: -1 },
      { resourceId: "solar-nadi", amount: -1 },
    ],
    buffApplications: ["formless-fist"],
    maxTargets: Infinity,
    falloffRate: 0.35,
    hidden: true,
    autoTransform: [{ resourceConditions: BOTH_NADI_CONDITIONS, skillId: "phantom-rush" }],
    traitPotencyOverrides: [GCD_TRAIT_LV76],
  },
  // 夢幻闘舞（Lv90: 闘魂旋風脚から変化）: 陰陽の闘気 + チャクラ3つ。両闘気を消費
  {
    id: "phantom-rush",
    name: "夢幻闘舞",
    potency: 1400,
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
    traitPotencyOverrides: [{ traitLevel: 94, potency: 1500 }],
  },
  // 蒼気砲: 同種チャクラ3つ。陰の闘気を付与。Lv92 から真空波に変化
  {
    id: "elixir-field",
    name: "蒼気砲",
    potency: 800,
    type: "gcd",
    target: "enemy",
    icon: elixirFieldIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [{ resourceId: "lunar-nadi", amount: 1 }],
    buffApplications: ["formless-fist"],
    maxTargets: Infinity,
    falloffRate: 0.35,
    hidden: true,
    autoTransform: SAME_CHAKRA_COMBOS.map(([o, r, c]) => ({
      resourceConditions: beastChakraConditions(o, r, c),
      skillId: "elixir-burst",
    })),
    traitPotencyOverrides: [GCD_TRAIT_LV76],
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
  // 爆裂脚: 3種チャクラ。陽の闘気を付与。Lv86 から鳳凰の舞に変化
  {
    id: "flint-strike",
    name: "爆裂脚",
    potency: 800,
    type: "gcd",
    target: "enemy",
    icon: flintStrikeIcon,
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [{ resourceId: "solar-nadi", amount: 1 }],
    buffApplications: ["formless-fist"],
    maxTargets: Infinity,
    falloffRate: 0.35,
    hidden: true,
    autoTransform: [{ resourceConditions: beastChakraConditions(1, 1, 1), skillId: "rising-phoenix" }],
    traitPotencyOverrides: [GCD_TRAIT_LV76],
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
    recastTime: GCD_RECAST_BEFORE_LV76,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    consumeAllResources: ["opo-chakra", "raptor-chakra", "coeurl-chakra"],
    resourceChanges: [{ resourceId: "lunar-nadi", amount: 1 }],
    buffApplications: ["formless-fist"],
    hidden: true,
    traitPotencyOverrides: [GCD_TRAIT_LV76],
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
  // 鉄山闘気: 闘気を1つ開く（Lv54で陰陽闘気に変化）。闘気 5 未満で実行でき、ウェポンスキルと同じ GCD リキャストを発生させる
  {
    id: "steeled-meditation",
    name: "鉄山闘気",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: steeledMeditationIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    cooldown: 1,
    cooldownGroup: "mnk-meditation",
    resourceChanges: [{ resourceId: "chakra", amount: 1 }],
    resourceMaxConditions: [{ resourceId: "chakra", maxAmount: 4 }],
    triggersGcdRecast: true,
    gcdRecastTime: GCD_RECAST_BEFORE_LV76,
    traitPotencyOverrides: [MEDITATION_GCD_TRAIT_LV76],
  },
  {
    id: "forbidden-meditation",
    name: "陰陽闘気",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: forbiddenMeditationIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    replacesSkillId: "steeled-meditation",
    cooldown: 1,
    cooldownGroup: "mnk-meditation",
    resourceChanges: [{ resourceId: "chakra", amount: 1 }],
    resourceMaxConditions: [{ resourceId: "chakra", maxAmount: 4 }],
    triggersGcdRecast: true,
    gcdRecastTime: GCD_RECAST_BEFORE_LV76,
    traitPotencyOverrides: [MEDITATION_GCD_TRAIT_LV76],
  },
  // 鉄山靠: 闘気5消費（Lv54で陰陽闘気斬に変化）
  {
    id: "steel-peak",
    name: "鉄山靠",
    potency: 180,
    type: "ogcd",
    target: "enemy",
    icon: steelPeakIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    cooldown: 1,
    cooldownGroup: "mnk-chakra-st",
    resourceChanges: [{ resourceId: "chakra", amount: -5 }],
  },
  {
    id: "the-forbidden-chakra",
    name: "陰陽闘気斬",
    potency: 310,
    type: "ogcd",
    target: "enemy",
    icon: theForbiddenChakraIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    replacesSkillId: "steel-peak",
    cooldown: 1,
    cooldownGroup: "mnk-chakra-st",
    resourceChanges: [{ resourceId: "chakra", amount: -5 }],
    traitPotencyOverrides: [{ traitLevel: 84, potency: 400 }],
  },
  // 空鳴拳: 闘気5消費・前方直線範囲（Lv74で万象闘気圏に変化。減衰なし）
  {
    id: "howling-fist",
    name: "空鳴拳",
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: howlingFistIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
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
    recastTime: DEFAULT_ANIMATION_LOCK,
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
  // 踏鳴: 3スタック付与。WS を型不問で成立させ、ビーストチャクラを獲得できる。ビーストチャクラが無いときだけ実行できる
  {
    id: "perfect-balance",
    name: "踏鳴",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: perfectBalanceIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    cooldown: 40,
    maxCharges: 2,
    buffApplications: ["perfect-balance"],
    resourceMaxConditions: [
      { resourceId: "opo-chakra", maxAmount: 0 },
      { resourceId: "raptor-chakra", maxAmount: 0 },
      { resourceId: "coeurl-chakra", maxAmount: 0 },
    ],
  },
  // 紅蓮の極意: 与ダメージ15%上昇 + 乾坤闘気弾実行可を付与
  {
    id: "riddle-of-fire",
    name: "紅蓮の極意",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: riddleOfFireIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
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
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    cooldown: 90,
    buffApplications: ["riddle-of-wind", "wind-rumination"],
  },
  // 桃園結義: 与ダメージ5%上昇 + WS使用時に闘気獲得（自身の WS による獲得は桃園結義効果アップ（Lv88）から）
  {
    id: "brotherhood",
    name: "桃園結義",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: brotherhoodIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 70,
    cooldown: 120,
    buffApplications: ["brotherhood-no-chakra-gain"],
    traitPotencyOverrides: [{ traitLevel: 88, buffApplications: ["brotherhood"] }],
  },
  // 金剛の極意: 被ダメージ軽減（防御アビリティ。リキャスト管理用）
  {
    id: "riddle-of-earth",
    name: "金剛の極意",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: riddleOfEarthIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
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
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 42,
    cooldown: 90,
    buffApplications: ["mantra"],
  },
  // 抜重歩法: 移動アビリティ（2チャージ。抜重歩法効果アップ（Lv84）から3チャージ）
  {
    id: "thunderclap",
    name: "抜重歩法",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: thunderclapIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 35,
    cooldown: 30,
    maxCharges: 2,
    traitPotencyOverrides: [{ traitLevel: 84, maxCharges: 3 }],
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
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: 0.65,
    cooldown: 45,
    maxCharges: 2,
    acquiredLevel: 50,
    buffApplications: ["true-north"],
  },
];
