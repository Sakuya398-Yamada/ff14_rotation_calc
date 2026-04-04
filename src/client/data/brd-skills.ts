import type { Skill } from "../types/skill";

// === GCD アイコン ===
import heavyShotIcon from "../assets/icons/brd/Heavy_Shot.png";
import straightShotIcon from "../assets/icons/brd/Straight_Shot.png";
import venomousBiteIcon from "../assets/icons/brd/Venomous_Bite.png";
import quickNockIcon from "../assets/icons/brd/Quick_Nock.png";
import windbiteIcon from "../assets/icons/brd/Windbite.png";
import ironJawsIcon from "../assets/icons/brd/Iron_Jaws.png";
import causticBiteIcon from "../assets/icons/brd/Caustic_Bite.png";
import stormbiteIcon from "../assets/icons/brd/Stormbite.png";
import refulgentArrowIcon from "../assets/icons/brd/Refulgent_Arrow.png";
import shadowbiteIcon from "../assets/icons/brd/Shadowbite.png";
import burstShotIcon from "../assets/icons/brd/Burst_Shot.png";
import apexArrowIcon from "../assets/icons/brd/Apex_Arrow.png";
import ladonsbiteIcon from "../assets/icons/brd/Ladonsbite.png";
import blastArrowIcon from "../assets/icons/brd/Blast_Arrow.png";
import resonantArrowIcon from "../assets/icons/brd/Resonant_Arrow.png";
import radiantEncoreIcon from "../assets/icons/brd/Radiant_Encore.png";

// === oGCD アイコン ===
import bloodletterIcon from "../assets/icons/brd/Bloodletter.png";
import rainOfDeathIcon from "../assets/icons/brd/Rain_of_Death.png";
import empyrealArrowIcon from "../assets/icons/brd/Empyreal_Arrow.png";
import pitchPerfectIcon from "../assets/icons/brd/Pitch_Perfect.png";
import sidewinderIcon from "../assets/icons/brd/Sidewinder.png";
import heartbreakShotIcon from "../assets/icons/brd/Heartbreak_Shot.png";

// === バフ/歌 アイコン ===
import ragingStrikesIcon from "../assets/icons/brd/Raging_Strikes.png";
import barrageIcon from "../assets/icons/brd/Barrage.png";
import battleVoiceIcon from "../assets/icons/brd/Battle_Voice.png";
import radiantFinaleIcon from "../assets/icons/brd/Radiant_Finale.png";
import magesBalladIcon from "../assets/icons/brd/Mage's_Ballad.png";
import armysPaeonIcon from "../assets/icons/brd/Army's_Paeon.png";
import wanderersMinuetIcon from "../assets/icons/brd/The_Wanderer's_Minuet.png";

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/**
 * 詩人（BRD）攻撃スキル一覧
 * 威力は公式ジョブガイド準拠
 */
export const BRD_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // GCD: 単体攻撃
  // ============================================================
  {
    id: "heavy-shot",
    name: "ヘヴィショット",
    potency: 160,
    type: "gcd",
    target: "enemy",
    icon: heavyShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
    buffApplications: ["hawks-eye"],
  },
  {
    id: "straight-shot",
    name: "ストレートショット",
    potency: 200,
    type: "gcd",
    target: "enemy",
    icon: straightShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 2,
    buffConsumptionAnyOf: [
      { buffId: "barrage", stacks: 1, potency: 600 },
      { buffId: "hawks-eye", stacks: 1, procRate: 0.35, fallbackPotency: 160 },
    ],
  },
  {
    id: "venomous-bite",
    name: "ベノムバイト",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: venomousBiteIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 6,
    dotPotency: 15,
    dotDuration: 45,
    buffApplications: ["hawks-eye"],
  },
  {
    id: "windbite",
    name: "ウィンドバイト",
    potency: 60,
    type: "gcd",
    target: "enemy",
    icon: windbiteIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    dotPotency: 20,
    dotDuration: 45,
    buffApplications: ["hawks-eye"],
  },
  {
    id: "iron-jaws",
    name: "アイアンジョー",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: ironJawsIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 56,
    refreshesDots: ["venomous-bite", "caustic-bite", "windbite", "stormbite"],
    buffApplications: ["hawks-eye"],
  },

  // ============================================================
  // GCD: 単体攻撃（レベル置き換え）
  // ============================================================
  {
    id: "caustic-bite",
    name: "コースティックバイト",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: causticBiteIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    replacesSkillId: "venomous-bite",
    dotPotency: 20,
    dotDuration: 45,
    buffApplications: ["hawks-eye"],
  },
  {
    id: "stormbite",
    name: "ストームバイト",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: stormbiteIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    replacesSkillId: "windbite",
    dotPotency: 25,
    dotDuration: 45,
    buffApplications: ["hawks-eye"],
  },
  {
    id: "refulgent-arrow",
    name: "リフルジェントアロー",
    potency: 280,
    type: "gcd",
    target: "enemy",
    icon: refulgentArrowIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 70,
    replacesSkillId: "straight-shot",
    buffConsumptionAnyOf: [
      { buffId: "barrage", stacks: 1, potency: 840 },
      { buffId: "hawks-eye", stacks: 1, procRate: 0.35, fallbackPotency: 220 },
    ],
  },
  {
    id: "burst-shot",
    name: "バーストショット",
    potency: 220,
    type: "gcd",
    target: "enemy",
    icon: burstShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 76,
    replacesSkillId: "heavy-shot",
    buffApplications: ["hawks-eye"],
  },

  // ============================================================
  // GCD: 範囲攻撃
  // ============================================================
  {
    id: "quick-nock",
    name: "クイックノック",
    potency: 110,
    type: "gcd",
    target: "enemy",
    icon: quickNockIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 18,
    buffApplications: ["hawks-eye"],
  },
  {
    id: "shadowbite",
    name: "シャドウバイト",
    potency: 200,
    type: "gcd",
    target: "enemy",
    icon: shadowbiteIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    buffConsumptionAnyOf: [
      { buffId: "barrage", stacks: 1, potency: 300 },
      { buffId: "hawks-eye", stacks: 1, procRate: 0.35, fallbackPotency: 140 },
    ],
  },
  {
    id: "ladonsbite",
    name: "ラドンバイト",
    potency: 140,
    type: "gcd",
    target: "enemy",
    icon: ladonsbiteIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "quick-nock",
    buffApplications: ["hawks-eye"],
  },

  // ============================================================
  // GCD: 特殊（ソウルボイス/バフ依存）
  // ============================================================
  {
    id: "apex-arrow",
    name: "エイペックスアロー",
    potency: 700,
    type: "gcd",
    target: "enemy",
    icon: apexArrowIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 80,
    resourceChanges: [
      { resourceId: "soul-voice", amount: -100 },
    ],
    buffApplications: ["blast-arrow-ready"],
  },
  {
    id: "blast-arrow",
    name: "ブラストアロー",
    potency: 700,
    type: "gcd",
    target: "enemy",
    icon: blastArrowIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 86,
    buffConsumptions: [{ buffId: "blast-arrow-ready", stacks: 1 }],
  },
  {
    id: "resonant-arrow",
    name: "レゾナンスアロー",
    potency: 640,
    type: "gcd",
    target: "enemy",
    icon: resonantArrowIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    buffConsumptions: [{ buffId: "resonant-arrow-ready", stacks: 1 }],
  },
  {
    id: "radiant-encore",
    name: "光神のアンコール",
    potency: 1100,
    type: "gcd",
    target: "enemy",
    icon: radiantEncoreIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    buffConsumptionAnyOf: [
      { buffId: "radiant-encore-ready-3", stacks: 1, potency: 1100 },
      { buffId: "radiant-encore-ready-2", stacks: 1, potency: 800 },
      { buffId: "radiant-encore-ready-1", stacks: 1, potency: 700 },
    ],
  },

  // ============================================================
  // oGCD: 攻撃アビリティ
  // ============================================================
  {
    id: "bloodletter",
    name: "ブラッドレッター",
    potency: 130,
    type: "ogcd",
    target: "enemy",
    icon: bloodletterIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 15,
    acquiredLevel: 12,
    traitPotencyOverrides: [
      { traitLevel: 84, maxCharges: 3 },
    ],
  },
  {
    id: "rain-of-death",
    name: "レイン・オブ・デス",
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: rainOfDeathIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 15,
    acquiredLevel: 45,
    maxCharges: 3,
  },
  {
    id: "empyreal-arrow",
    name: "エンピリアルアロー",
    potency: 260,
    type: "ogcd",
    target: "enemy",
    icon: empyrealArrowIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 15,
    acquiredLevel: 54,
    resourceChanges: [
      { resourceId: "repertoire", amount: 1 },
      { resourceId: "soul-voice", amount: 5 },
    ],
  },
  {
    id: "pitch-perfect",
    name: "ピッチパーフェクト",
    potency: 360,
    type: "ogcd",
    target: "enemy",
    icon: pitchPerfectIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 52,
    requiredBuff: "wanderers-minuet",
    resourceChanges: [
      { resourceId: "repertoire", amount: -3 },
    ],
  },
  {
    id: "sidewinder",
    name: "サイドワインダー",
    potency: 400,
    type: "ogcd",
    target: "enemy",
    icon: sidewinderIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 60,
  },
  {
    id: "heartbreak-shot",
    name: "ハートブレイクショット",
    potency: 180,
    type: "ogcd",
    target: "enemy",
    icon: heartbreakShotIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 15,
    acquiredLevel: 92,
    replacesSkillId: "bloodletter",
    maxCharges: 3,
  },

  // ============================================================
  // oGCD: バフ
  // ============================================================
  {
    id: "raging-strikes",
    name: "猛者の撃",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: ragingStrikesIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 4,
    buffApplications: ["raging-strikes"],
  },
  {
    id: "barrage",
    name: "乱れ撃ち",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: barrageIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 38,
    buffApplications: ["barrage", "resonant-arrow-ready"],
  },
  {
    id: "battle-voice",
    name: "バトルボイス",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: battleVoiceIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 50,
    buffApplications: ["battle-voice"],
  },
  {
    id: "radiant-finale",
    name: "光神のフィナーレ",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: radiantFinaleIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 110,
    acquiredLevel: 90,
    consumeAllResources: ["coda-mages", "coda-armys", "coda-wanderers"],
    buffApplicationsByConsumedCount: [
      ["radiant-finale-1", "radiant-encore-ready-1"],
      ["radiant-finale-2", "radiant-encore-ready-2"],
      ["radiant-finale-3", "radiant-encore-ready-3"],
    ],
  },

  // ============================================================
  // oGCD: 歌（ソング）
  // ============================================================
  {
    id: "mages-ballad",
    name: "賢人のバラード",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: magesBalladIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 30,
    buffApplications: ["mages-ballad"],
    resourceChanges: [
      { resourceId: "coda-mages", amount: 1 },
    ],
  },
  {
    id: "armys-paeon",
    name: "軍神のパイオン",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: armysPaeonIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 40,
    buffApplications: ["armys-paeon"],
    resourceChanges: [
      { resourceId: "coda-armys", amount: 1 },
    ],
  },
  {
    id: "wanderers-minuet",
    name: "旅神のメヌエット",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: wanderersMinuetIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 52,
    buffApplications: ["wanderers-minuet"],
    resourceChanges: [
      { resourceId: "coda-wanderers", amount: 1 },
    ],
  },
];
