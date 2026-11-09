import type { Skill } from "../types/skill";

import heavySwingIcon from "../assets/icons/war/Heavy_Swing.png";
import maimIcon from "../assets/icons/war/Maim.png";
import stormsPathIcon from "../assets/icons/war/Storm's_Path.png";
import stormsEyeIcon from "../assets/icons/war/Storm's_Eye.png";
import overpowerIcon from "../assets/icons/war/Overpower.png";
import mythrilTempestIcon from "../assets/icons/war/Mythril_Tempest.png";
import tomahawkIcon from "../assets/icons/war/Tomahawk.png";
import innerBeastIcon from "../assets/icons/war/Inner_Beast.png";
import fellCleaveIcon from "../assets/icons/war/Fell_Cleave.png";
import innerChaosIcon from "../assets/icons/war/Inner_Chaos.png";
import steelCycloneIcon from "../assets/icons/war/Steel_Cyclone.png";
import decimateIcon from "../assets/icons/war/Decimate.png";
import chaoticCycloneIcon from "../assets/icons/war/Chaotic_Cyclone.png";
import primalRendIcon from "../assets/icons/war/Primal_Rend.png";
import primalRuinationIcon from "../assets/icons/war/Primal_Ruination.png";
import berserkIcon from "../assets/icons/war/Berserk.png";
import innerReleaseIcon from "../assets/icons/war/Inner_Release.png";
import primalWrathIcon from "../assets/icons/war/Primal_Wrath.png";
import infuriateIcon from "../assets/icons/war/Infuriate.png";
import upheavalIcon from "../assets/icons/war/Upheaval.png";
import orogenyIcon from "../assets/icons/war/Orogeny.png";
import onslaughtIcon from "../assets/icons/war/Onslaught.png";

const GCD_RECAST = 2.5;
const DEFAULT_ANIMATION_LOCK = 0.65;

const BEAST_GAUGE_COST = [{ resourceId: "beast-gauge", amount: -50 }];
/** フェルクリーヴ・デシメート（特性ウォークライ効果アップ。Lv66）、インナーカオス・カオティックサイクロンの追加効果 */
const REDUCE_INFURIATE = [{ chargeKey: "infuriate", seconds: 5 }];
/** 原初の混沌中かつビーストゲージ 50 以上で変化する（使う前の状態で判定する） */
const NASCENT_CHAOS_CONDITION = { buffId: "nascent-chaos", resourceConditions: [{ resourceId: "beast-gauge", minAmount: 50 }] };

/**
 * 戦士（WAR）攻撃スキル定義（Lv100まで）
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#864 で照合）。公式ジョブガイド（Patch 7.5 表記）とも照合済みで、既知の差分なし
 * アクション威力アップ（Lv84）・アクション威力アップII（Lv94）による変動は traitPotencyOverrides で定義し、基本値は特性修得前の値にする
 * （consolegameswiki の Notes で照合。特性は基本威力とコンボ時威力を同じだけ上げる。フェルクリーヴの Lv94 未満の 520 は、
 * 7.0 時点の特性の説明にフェルクリーヴが入っていたことから、7.0 の「520 → 580」を特性の値の変更と読んだもの）
 * 計算の対象外: ディフェンダー・ロールアクション・軽減と回復のアビリティ（ヴェンジェンス／ダムネーションの反撃を含む）
 *
 * 大別:
 * 1. 単体 WS コンボ（ヘヴィスウィング → メイム → シュトルムヴィント／シュトルムブレハ）
 * 2. 範囲 WS コンボ（オーバーパワー → ミスリルテンペスト）
 * 3. ビーストゲージ消費（原初の魂 → フェルクリーヴ → インナーカオス、スチールサイクロン → デシメート → カオティックサイクロン）
 * 4. 原初の解放系（バーサク → 原初の解放 → 原初の激震、プライマルレンド → ルイネーター）
 * 5. その他（トマホーク・ウォークライ・アップヒーバル／オロジェネシス・オンスロート）
 */
export const WAR_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // 1. 単体 WS コンボ
  // ============================================================
  {
    id: "heavy-swing",
    gameActionId: 31,
    potency: 150,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 200 },
      { traitLevel: 94, potency: 240 },
    ],
    type: "gcd",
    target: "enemy",
    icon: heavySwingIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
  },
  {
    id: "maim",
    gameActionId: 37,
    potency: 250,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 300, nonComboPotency: 150 },
      { traitLevel: 94, potency: 340, nonComboPotency: 190 },
    ],
    type: "gcd",
    target: "enemy",
    icon: maimIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 4,
    comboFrom: ["heavy-swing"],
    comboResourceChanges: [{ resourceId: "beast-gauge", amount: 10 }],
  },
  {
    id: "storms-path",
    gameActionId: 42,
    potency: 380,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 440, nonComboPotency: 160 },
      { traitLevel: 94, potency: 500, nonComboPotency: 220 },
    ],
    type: "gcd",
    target: "enemy",
    icon: stormsPathIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 26,
    comboFrom: ["maim"],
    comboResourceChanges: [{ resourceId: "beast-gauge", amount: 20 }],
  },
  {
    id: "storms-eye",
    gameActionId: 45,
    potency: 380,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 440, nonComboPotency: 160 },
      { traitLevel: 94, potency: 500, nonComboPotency: 220 },
    ],
    type: "gcd",
    target: "enemy",
    icon: stormsEyeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    comboFrom: ["maim"],
    comboBuffApplications: ["surging-tempest"],
    comboResourceChanges: [{ resourceId: "beast-gauge", amount: 10 }],
  },

  // ============================================================
  // 2. 範囲 WS コンボ
  // ============================================================
  {
    id: "overpower",
    gameActionId: 41,
    potency: 110,
    type: "gcd",
    target: "enemy",
    icon: overpowerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 10,
    maxTargets: Infinity,
  },
  {
    // ビーストゲージの獲得は特性インナービーストマスタリー（Lv74）から
    id: "mythril-tempest",
    gameActionId: 16462,
    potency: 140,
    nonComboPotency: 100,
    traitPotencyOverrides: [{ traitLevel: 74, comboResourceChanges: [{ resourceId: "beast-gauge", amount: 20 }] }],
    type: "gcd",
    target: "enemy",
    icon: mythrilTempestIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 40,
    comboFrom: ["overpower"],
    comboBuffApplications: ["surging-tempest"],
    maxTargets: Infinity,
  },

  // ============================================================
  // 3. ビーストゲージ消費
  // ============================================================
  {
    id: "inner-beast",
    gameActionId: 49,
    potency: 330,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: innerBeastIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 35,
    resourceChanges: BEAST_GAUGE_COST,
  },
  {
    id: "fell-cleave",
    gameActionId: 3549,
    potency: 520,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 580 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: fellCleaveIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    replacesSkillId: "inner-beast",
    resourceChanges: BEAST_GAUGE_COST,
    cooldownReductionsOnUse: REDUCE_INFURIATE,
    autoTransform: { ...NASCENT_CHAOS_CONDITION, skillId: "inner-chaos" },
  },
  {
    id: "inner-chaos",
    gameActionId: 16465,
    potency: 700,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: innerChaosIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 80,
    hidden: true,
    guaranteedCrit: true,
    guaranteedDh: true,
    resourceChanges: BEAST_GAUGE_COST,
    removesBuffs: ["nascent-chaos"],
    cooldownReductionsOnUse: REDUCE_INFURIATE,
  },
  {
    id: "steel-cyclone",
    gameActionId: 51,
    potency: 160,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: steelCycloneIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 45,
    resourceChanges: BEAST_GAUGE_COST,
    maxTargets: Infinity,
  },
  {
    id: "decimate",
    gameActionId: 3550,
    potency: 180,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: decimateIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    replacesSkillId: "steel-cyclone",
    resourceChanges: BEAST_GAUGE_COST,
    cooldownReductionsOnUse: REDUCE_INFURIATE,
    autoTransform: { ...NASCENT_CHAOS_CONDITION, skillId: "chaotic-cyclone" },
    maxTargets: Infinity,
  },
  {
    id: "chaotic-cyclone",
    gameActionId: 16463,
    potency: 200,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: chaoticCycloneIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    hidden: true,
    guaranteedCrit: true,
    guaranteedDh: true,
    resourceChanges: BEAST_GAUGE_COST,
    removesBuffs: ["nascent-chaos"],
    cooldownReductionsOnUse: REDUCE_INFURIATE,
    maxTargets: Infinity,
  },

  // ============================================================
  // 4. 原初の解放系
  // ============================================================
  {
    id: "berserk",
    gameActionId: 38,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: berserkIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 6,
    buffApplications: ["berserk"],
    buffExtensions: [{ buffId: "surging-tempest", seconds: 10 }],
  },
  {
    // 原初の激震実行可の間は原初の激震に変化する。プライマルレンド実行可は Lv90 から付く（バフの acquiredLevel）
    id: "inner-release",
    gameActionId: 7389,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: innerReleaseIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 70,
    replacesSkillId: "berserk",
    buffApplications: ["inner-release", "primal-rend-ready"],
    buffExtensions: [{ buffId: "surging-tempest", seconds: 10 }],
    autoTransform: { buffId: "wrathful", skillId: "primal-wrath" },
  },
  {
    id: "primal-wrath",
    gameActionId: 36924,
    potency: 700,
    type: "ogcd",
    target: "enemy",
    icon: primalWrathIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    hidden: true,
    buffConsumptions: [{ buffId: "wrathful", stacks: 1 }],
    maxTargets: Infinity,
    falloffRate: 0.5,
  },
  {
    // ルイネーター実行可の間はルイネーターに変化する（Lv100）
    id: "primal-rend",
    gameActionId: 25753,
    potency: 720,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: primalRendIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    guaranteedCrit: true,
    guaranteedDh: true,
    buffConsumptions: [{ buffId: "primal-rend-ready", stacks: 1 }],
    buffApplications: ["primal-ruination-ready"],
    autoTransform: { buffId: "primal-ruination-ready", skillId: "primal-ruination" },
    maxTargets: Infinity,
    falloffRate: 0.5,
  },
  {
    id: "primal-ruination",
    gameActionId: 36925,
    potency: 800,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: primalRuinationIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    hidden: true,
    guaranteedCrit: true,
    guaranteedDh: true,
    buffConsumptions: [{ buffId: "primal-ruination-ready", stacks: 1 }],
    maxTargets: Infinity,
    falloffRate: 0.5,
  },

  // ============================================================
  // 5. その他
  // ============================================================
  {
    id: "tomahawk",
    gameActionId: 46,
    potency: 150,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: tomahawkIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
  },
  {
    // 原初の混沌は Lv72 から付く（バフの acquiredLevel）
    id: "infuriate",
    gameActionId: 52,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: infuriateIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    maxCharges: 2,
    acquiredLevel: 50,
    resourceChanges: [{ resourceId: "beast-gauge", amount: 50 }],
    buffApplications: ["nascent-chaos"],
  },
  {
    id: "upheaval",
    gameActionId: 7387,
    potency: 400,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 420 }],
    type: "ogcd",
    target: "enemy",
    icon: upheavalIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    cooldownGroup: "upheaval-orogeny",
    acquiredLevel: 64,
  },
  {
    id: "orogeny",
    gameActionId: 25752,
    potency: 150,
    type: "ogcd",
    target: "enemy",
    icon: orogenyIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    cooldownGroup: "upheaval-orogeny",
    acquiredLevel: 86,
    maxTargets: Infinity,
  },
  {
    // 最大チャージ数は特性オンスロート効果アップ（Lv88）で 2 → 3
    id: "onslaught",
    gameActionId: 7386,
    potency: 150,
    type: "ogcd",
    target: "enemy",
    icon: onslaughtIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    maxCharges: 2,
    traitPotencyOverrides: [{ traitLevel: 88, maxCharges: 3 }],
    acquiredLevel: 62,
  },
];
