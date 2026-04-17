import type { Skill } from "../types/skill";

// === GCD アイコン ===
import trueThrustIcon from "../assets/icons/drg/True_Thrust.png";
import vorpalThrustIcon from "../assets/icons/drg/Vorpal_Thrust.png";
import piercingTalonIcon from "../assets/icons/drg/Piercing_Talon.png";
import disembowelIcon from "../assets/icons/drg/Disembowel.png";
import fullThrustIcon from "../assets/icons/drg/Full_Thrust.png";
import doomSpikeIcon from "../assets/icons/drg/Doom_Spike.png";
import chaosThrustIcon from "../assets/icons/drg/Chaos_Thrust.png";
import fangAndClawIcon from "../assets/icons/drg/Fang_and_Claw.png";
import wheelingThrustIcon from "../assets/icons/drg/Wheeling_Thrust.png";
import sonicThrustIcon from "../assets/icons/drg/Sonic_Thrust.png";
import drakesbaneIcon from "../assets/icons/drg/Drakesbane.png";
import coerthanTormentIcon from "../assets/icons/drg/Coerthan_Torment.png";
import raidenThrustIcon from "../assets/icons/drg/Raiden_Thrust.png";
import draconianFuryIcon from "../assets/icons/drg/Draconian_Fury.png";
import heavensThrustIcon from "../assets/icons/drg/Heavens'_Thrust.png";
import chaoticSpringIcon from "../assets/icons/drg/Chaotic_Spring.png";
import lanceBarrageIcon from "../assets/icons/drg/Lance_Barrage.png";
import spiralBlowIcon from "../assets/icons/drg/Spiral_Blow.png";

// === oGCD アイコン ===
import lifeSurgeIcon from "../assets/icons/drg/Life_Surge.png";
import lanceChargeIcon from "../assets/icons/drg/Lance_Charge.png";
import jumpIcon from "../assets/icons/drg/Jump.png";
import elusiveJumpIcon from "../assets/icons/drg/Elusive_Jump.png";
import wingedGlideIcon from "../assets/icons/drg/Winged_Glide.png";
import dragonfireDiveIcon from "../assets/icons/drg/Dragonfire_Dive.png";
import battleLitanyIcon from "../assets/icons/drg/Battle_Litany.png";
import geirskogulIcon from "../assets/icons/drg/Geirskogul.png";
import mirageDiveIcon from "../assets/icons/drg/Mirage_Dive.png";
import nastrondIcon from "../assets/icons/drg/Nastrond.png";
import highJumpIcon from "../assets/icons/drg/High_Jump.png";
import stardiverIcon from "../assets/icons/drg/Stardiver.png";
import wyrmwindThrustIcon from "../assets/icons/drg/Wyrmwind_Thrust.png";
import riseOfTheDragonIcon from "../assets/icons/drg/Rise_of_the_Dragon.png";
import starcrossIcon from "../assets/icons/drg/Starcross.png";

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/**
 * 竜騎士（DRG）攻撃スキル一覧
 * 威力はジョブガイド準拠（コンボ時威力を基本potencyに採用、方向指定ボーナスなし）
 * comboFrom: コンボ元スキルIDリスト
 * nonComboPotency: コンボ不成立時の威力
 */
export const DRG_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // GCD: 単体コンボルート1（トゥルースラスト → ボーパルスラスト → フルスラスト → 竜牙竜爪 → 雲蒸竜変）
  // ============================================================
  {
    id: "true-thrust",
    name: "トゥルースラスト",
    potency: 170,
    type: "gcd",
    target: "enemy",
    icon: trueThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
    autoTransform: { buffId: "dragons-eye", skillId: "raiden-thrust" },
    traitPotencyOverrides: [
      { traitLevel: 76, potency: 230 },
    ],
  },
  {
    id: "vorpal-thrust",
    name: "ボーパルスラスト",
    potency: 250,
    nonComboPotency: 100,
    comboFrom: ["true-thrust", "raiden-thrust"],
    type: "gcd",
    target: "enemy",
    icon: vorpalThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 4,
    traitPotencyOverrides: [
      { traitLevel: 76, potency: 280, nonComboPotency: 130 },
    ],
  },
  {
    id: "full-thrust",
    name: "フルスラスト",
    potency: 380,
    nonComboPotency: 100,
    comboFrom: ["vorpal-thrust"],
    type: "gcd",
    target: "enemy",
    icon: fullThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 26,
  },
  {
    id: "fang-and-claw",
    name: "竜牙竜爪",
    potency: 300,
    nonComboPotency: 140,
    comboFrom: ["full-thrust", "heavens-thrust"],
    comboBuffApplications: ["drakesbane-ready"],
    type: "gcd",
    target: "enemy",
    icon: fangAndClawIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 56,
    autoTransform: { buffId: "drakesbane-ready", skillId: "drakesbane" },
  },

  // ============================================================
  // GCD: 単体コンボルート2（トゥルースラスト → ディセムボウル → 桜華狂咲 → 竜尾大車輪 → 雲蒸竜変）
  // ============================================================
  {
    id: "disembowel",
    name: "ディセムボウル",
    potency: 210,
    nonComboPotency: 100,
    comboFrom: ["true-thrust", "raiden-thrust"],
    comboBuffApplications: ["power-surge"],
    type: "gcd",
    target: "enemy",
    icon: disembowelIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 18,
    traitPotencyOverrides: [
      { traitLevel: 76, potency: 250, nonComboPotency: 140 },
    ],
  },
  {
    id: "chaos-thrust",
    name: "桜華狂咲",
    potency: 220,
    nonComboPotency: 100,
    comboFrom: ["disembowel"],
    type: "gcd",
    target: "enemy",
    icon: chaosThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    dotPotency: 40,
    dotDuration: 24,
  },
  {
    id: "wheeling-thrust",
    name: "竜尾大車輪",
    potency: 300,
    nonComboPotency: 140,
    comboFrom: ["chaos-thrust", "chaotic-spring"],
    comboBuffApplications: ["drakesbane-ready"],
    type: "gcd",
    target: "enemy",
    icon: wheelingThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 58,
    autoTransform: { buffId: "drakesbane-ready", skillId: "drakesbane" },
  },

  // ============================================================
  // GCD: 5段目共通（雲蒸竜変）
  // ============================================================
  {
    id: "drakesbane",
    name: "雲蒸竜変",
    potency: 460,
    type: "gcd",
    target: "enemy",
    icon: drakesbaneIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    comboFrom: ["fang-and-claw", "wheeling-thrust"],
    comboBuffApplications: ["dragons-eye"],
    traitPotencyOverrides: [
      { traitLevel: 86, potency: 400 },
      { traitLevel: 94, potency: 460 },
    ],
  },

  // ============================================================
  // GCD: 竜眼系（自動変化スキル）
  // ============================================================
  {
    id: "raiden-thrust",
    name: "竜眼雷電",
    potency: 320,
    type: "gcd",
    target: "enemy",
    icon: raidenThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 76,
    buffConsumptions: [{ buffId: "dragons-eye", stacks: 1 }],
    resourceChanges: [
      { resourceId: "firstminds-focus", amount: 1 },
    ],
  },

  // ============================================================
  // GCD: 遠隔攻撃
  // ============================================================
  {
    id: "piercing-talon",
    name: "ピアシングタロン",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: piercingTalonIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    traitPotencyOverrides: [
      { traitLevel: 76, potency: 200 },
    ],
    conditionalPotencyBuffs: [
      { buffId: "enhanced-piercing-talon", potency: 350 },
    ],
  },

  // ============================================================
  // GCD: 範囲コンボ（ドゥームスパイク → ソニックスラスト → クルザントーメント）
  // ============================================================
  {
    id: "doom-spike",
    name: "ドゥームスパイク",
    potency: 110,
    type: "gcd",
    target: "enemy",
    icon: doomSpikeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 40,
    autoTransform: { buffId: "dragons-eye", skillId: "draconian-fury" },
  },
  {
    id: "sonic-thrust",
    name: "ソニックスラスト",
    potency: 120,
    nonComboPotency: 100,
    comboFrom: ["doom-spike", "draconian-fury"],
    comboBuffApplications: ["power-surge"],
    type: "gcd",
    target: "enemy",
    icon: sonicThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 62,
  },
  {
    id: "coerthan-torment",
    name: "クルザントーメント",
    potency: 150,
    nonComboPotency: 100,
    comboFrom: ["sonic-thrust"],
    comboBuffApplications: ["dragons-eye"],
    type: "gcd",
    target: "enemy",
    icon: coerthanTormentIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
  },
  {
    id: "draconian-fury",
    name: "竜眼蒼穹",
    potency: 130,
    type: "gcd",
    target: "enemy",
    icon: draconianFuryIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    buffConsumptions: [{ buffId: "dragons-eye", stacks: 1 }],
    resourceChanges: [
      { resourceId: "firstminds-focus", amount: 1 },
    ],
  },

  // ============================================================
  // GCD: 特性変化スキル（レベルで元スキルを置き換え）
  // ============================================================
  {
    id: "heavens-thrust",
    name: "ヘヴンスラスト",
    potency: 400,
    nonComboPotency: 160,
    comboFrom: ["vorpal-thrust", "lance-barrage"],
    type: "gcd",
    target: "enemy",
    icon: heavensThrustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 86,
    replacesSkillId: "full-thrust",
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 460 },
    ],
  },
  {
    id: "chaotic-spring",
    name: "桜華繚乱",
    potency: 300,
    nonComboPotency: 140,
    comboFrom: ["disembowel", "spiral-blow"],
    type: "gcd",
    target: "enemy",
    icon: chaoticSpringIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 86,
    replacesSkillId: "chaos-thrust",
    dotPotency: 45,
    dotDuration: 24,
  },
  {
    id: "lance-barrage",
    name: "スラストラッシュ",
    potency: 340,
    nonComboPotency: 130,
    comboFrom: ["true-thrust", "raiden-thrust"],
    type: "gcd",
    target: "enemy",
    icon: lanceBarrageIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    replacesSkillId: "vorpal-thrust",
  },
  {
    id: "spiral-blow",
    name: "スパイラルブロウ",
    potency: 300,
    nonComboPotency: 140,
    comboFrom: ["true-thrust", "raiden-thrust"],
    comboBuffApplications: ["power-surge"],
    type: "gcd",
    target: "enemy",
    icon: spiralBlowIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    replacesSkillId: "disembowel",
  },

  // ============================================================
  // oGCD: バフ
  // ============================================================
  {
    id: "life-surge",
    name: "ライフサージ",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: lifeSurgeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    acquiredLevel: 6,
    buffApplications: ["life-surge"],
    traitPotencyOverrides: [
      { traitLevel: 88, maxCharges: 2 },
    ],
  },
  {
    id: "lance-charge",
    name: "ランスチャージ",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: lanceChargeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 30,
    buffApplications: ["lance-charge"],
  },
  {
    id: "battle-litany",
    name: "バトルリタニー",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: battleLitanyIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 52,
    buffApplications: ["battle-litany"],
  },

  // ============================================================
  // oGCD: ジャンプ系攻撃
  // ============================================================
  {
    id: "jump",
    name: "ジャンプ",
    potency: 320,
    type: "ogcd",
    target: "enemy",
    icon: jumpIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 30,
    buffApplications: ["dive-ready"],
  },
  {
    id: "high-jump",
    name: "ハイジャンプ",
    potency: 400,
    type: "ogcd",
    target: "enemy",
    icon: highJumpIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 74,
    replacesSkillId: "jump",
    buffApplications: ["dive-ready"],
  },
  {
    id: "mirage-dive",
    name: "ミラージュダイブ",
    potency: 380,
    type: "ogcd",
    target: "enemy",
    icon: mirageDiveIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 68,
    buffConsumptions: [{ buffId: "dive-ready", stacks: 1 }],
  },
  {
    id: "dragonfire-dive",
    name: "ドラゴンダイブ",
    potency: 500,
    type: "ogcd",
    target: "enemy",
    icon: dragonfireDiveIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 50,
    buffApplications: ["dragons-flight"],
  },
  {
    id: "rise-of-the-dragon",
    name: "ドラゴンライズ",
    potency: 550,
    type: "ogcd",
    target: "enemy",
    icon: riseOfTheDragonIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 92,
    buffConsumptions: [{ buffId: "dragons-flight", stacks: 1 }],
  },
  {
    id: "stardiver",
    name: "スターダイバー",
    potency: 720,
    type: "ogcd",
    target: "enemy",
    icon: stardiverIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 80,
    buffConsumptions: [{ buffId: "stardiver-ready", stacks: 1 }],
    buffApplications: ["starcross-ready"],
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 840 },
    ],
  },
  {
    id: "starcross",
    name: "スタークロッサー",
    potency: 1000,
    type: "ogcd",
    target: "enemy",
    icon: starcrossIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 100,
    buffConsumptions: [{ buffId: "starcross-ready", stacks: 1 }],
  },

  // ============================================================
  // oGCD: 竜血系攻撃
  // ============================================================
  {
    id: "geirskogul",
    name: "ゲイルスコグル",
    potency: 260,
    type: "ogcd",
    target: "enemy",
    icon: geirskogulIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 60,
    buffApplications: ["life-of-the-dragon", "nastrond-ready", "stardiver-ready"],
    traitPotencyOverrides: [
      { traitLevel: 90, potency: 280 },
    ],
  },
  {
    id: "nastrond",
    name: "ナーストレンド",
    potency: 600,
    type: "ogcd",
    target: "enemy",
    icon: nastrondIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 2,
    acquiredLevel: 70,
    buffConsumptions: [{ buffId: "nastrond-ready", stacks: 1 }],
    traitPotencyOverrides: [
      { traitLevel: 90, potency: 720 },
    ],
  },
  {
    id: "wyrmwind-thrust",
    name: "天竜点睛",
    potency: 440,
    type: "ogcd",
    target: "enemy",
    icon: wyrmwindThrustIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 10,
    acquiredLevel: 90,
    resourceChanges: [
      { resourceId: "firstminds-focus", amount: -2 },
    ],
  },

  // ============================================================
  // oGCD: 移動系
  // ============================================================
  {
    id: "elusive-jump",
    name: "イルーシブジャンプ",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: elusiveJumpIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 35,
    buffApplications: ["enhanced-piercing-talon"],
  },
  {
    id: "winged-glide",
    name: "ウィンググライド",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: wingedGlideIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 45,
  },
];
