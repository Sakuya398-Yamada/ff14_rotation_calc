import type { Skill } from "../types/skill";

// === GCD アイコン ===
import fireInRedIcon from "../assets/icons/pct/Fire_in_Red.png";
import aeroInGreenIcon from "../assets/icons/pct/Aero_in_Green.png";
import waterInBlueIcon from "../assets/icons/pct/Water_in_Blue.png";
import blizzardInCyanIcon from "../assets/icons/pct/Blizzard_in_Cyan.png";
import stoneInYellowIcon from "../assets/icons/pct/Stone_in_Yellow.png";
import thunderInMagentaIcon from "../assets/icons/pct/Thunder_in_Magenta.png";
import hammerStampIcon from "../assets/icons/pct/Hammer_Stamp.png";
import hammerBrushIcon from "../assets/icons/pct/Hammer_Brush.png";
import polishingHammerIcon from "../assets/icons/pct/Polishing_Hammer.png";
import holyInWhiteIcon from "../assets/icons/pct/Holy_in_White.png";
import cometInBlackIcon from "../assets/icons/pct/Comet_in_Black.png";
import starPrismIcon from "../assets/icons/pct/Star_Prism.png";
import rainbowDripIcon from "../assets/icons/pct/Rainbow_Drip.png";
import creatureMotifIcon from "../assets/icons/pct/Creature_Motif.png";
import weaponMotifIcon from "../assets/icons/pct/Weapon_Motif.png";
import landscapeMotifIcon from "../assets/icons/pct/Landscape_Motif.png";

// === oGCD アイコン ===
import pomMuseIcon from "../assets/icons/pct/Pom_Muse.png";
import wingedMuseIcon from "../assets/icons/pct/Winged_Muse.png";
import clawedMuseIcon from "../assets/icons/pct/Clawed_Muse.png";
import fangedMuseIcon from "../assets/icons/pct/Fanged_Muse.png";
import mogOfTheAgesIcon from "../assets/icons/pct/Mog_of_the_Ages.png";
import retributionOfTheMadeenIcon from "../assets/icons/pct/Retribution_of_the_Madeen.png";
import strikingMuseIcon from "../assets/icons/pct/Striking_Muse.png";
import subtractivePaletteIcon from "../assets/icons/pct/Subtractive_Palette.png";
import starryMuseIcon from "../assets/icons/pct/Starry_Muse.png";

/** GCDリキャスト（秒） */
const GCD_RECAST = 2.5;
/** デフォルトアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

export const PCT_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // GCD: 色魔法コンボ（通常）
  // ============================================================
  {
    id: "fire-in-red",
    name: "レッドファイア",
    potency: 490,
    type: "gcd",
    target: "enemy",
    icon: fireInRedIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 1.5,
    acquiredLevel: 1,
    buffApplications: ["aetherhues-2"],
    autoTransform: [
      { buffId: "subtractive-palette", skillId: "blizzard-in-cyan" },
      { buffId: "aetherhues-3", skillId: "water-in-blue" },
      { buffId: "aetherhues-2", skillId: "aero-in-green" },
    ],
  },
  {
    id: "aero-in-green",
    name: "グリーンエアロ",
    potency: 530,
    type: "gcd",
    target: "enemy",
    icon: aeroInGreenIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 1.5,
    acquiredLevel: 5,
    buffApplications: ["aetherhues-3"],
    buffConsumptions: [{ buffId: "aetherhues-2", stacks: 1 }],
    requiredBuff: "aetherhues-2",
    autoTransform: { buffId: "aetherhues-3", skillId: "water-in-blue" },
  },
  {
    id: "water-in-blue",
    name: "ブルーウォータ",
    potency: 570,
    type: "gcd",
    target: "enemy",
    icon: waterInBlueIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 1.5,
    acquiredLevel: 15,
    buffConsumptions: [{ buffId: "aetherhues-3", stacks: 1 }],
    requiredBuff: "aetherhues-3",
    resourceChanges: [
      { resourceId: "palette-gauge", amount: 25 },
      { resourceId: "white-paint", amount: 1 },
    ],
  },

  // ============================================================
  // GCD: 色魔法コンボ（サブトラクティブ）
  // ============================================================
  {
    id: "blizzard-in-cyan",
    name: "シアンブリザド",
    potency: 860,
    type: "gcd",
    target: "enemy",
    icon: blizzardInCyanIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.3,
    acquiredLevel: 60,
    buffApplications: ["aetherhues-2"],
    buffConsumptions: [{ buffId: "subtractive-palette", stacks: 1 }],
    requiredBuff: "subtractive-palette",
    autoTransform: [
      { buffId: "aetherhues-3", skillId: "thunder-in-magenta" },
      { buffId: "aetherhues-2", skillId: "stone-in-yellow" },
    ],
  },
  {
    id: "stone-in-yellow",
    name: "イエローストーン",
    potency: 900,
    type: "gcd",
    target: "enemy",
    icon: stoneInYellowIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.3,
    acquiredLevel: 60,
    buffApplications: ["aetherhues-3"],
    buffConsumptions: [{ buffId: "aetherhues-2", stacks: 1 }, { buffId: "subtractive-palette", stacks: 1 }],
    requiredBuff: "aetherhues-2",
    autoTransform: { buffId: "aetherhues-3", skillId: "thunder-in-magenta" },
  },
  {
    id: "thunder-in-magenta",
    name: "マゼンタサンダー",
    potency: 940,
    type: "gcd",
    target: "enemy",
    icon: thunderInMagentaIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.3,
    acquiredLevel: 60,
    buffConsumptions: [{ buffId: "aetherhues-3", stacks: 1 }, { buffId: "subtractive-palette", stacks: 1 }],
    requiredBuff: "aetherhues-3",
    resourceChanges: [
      { resourceId: "palette-gauge", amount: 25 },
      { resourceId: "white-paint", amount: 1 },
    ],
  },

  // ============================================================
  // GCD: ハンマーコンボ（確定クリティカル＆ダイレクトヒット）
  // ============================================================
  {
    id: "hammer-stamp",
    name: "ハンマースタンプ",
    potency: 560,
    type: "gcd",
    target: "enemy",
    icon: hammerStampIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    requiredBuff: "hammer-combo-ready",
    buffConsumptions: [{ buffId: "hammer-combo-ready", stacks: 1 }],
    buffApplications: ["hammer-brush-ready"],
    autoTransform: [
      { buffId: "hammer-polish-ready", skillId: "polishing-hammer" },
      { buffId: "hammer-brush-ready", skillId: "hammer-brush" },
    ],
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 420 },
      { traitLevel: 84, potency: 500 },
      { traitLevel: 86, potency: 540 },
      { traitLevel: 94, potency: 560 },
    ],
  },
  {
    id: "hammer-brush",
    name: "ハンマーブラッシュ",
    potency: 580,
    type: "gcd",
    target: "enemy",
    icon: hammerBrushIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 86,
    requiredBuff: "hammer-combo-ready",
    buffConsumptions: [{ buffId: "hammer-combo-ready", stacks: 1 }, { buffId: "hammer-brush-ready", stacks: 1 }],
    buffApplications: ["hammer-polish-ready"],
  },
  {
    id: "polishing-hammer",
    name: "ハンマーポリッシュ",
    potency: 600,
    type: "gcd",
    target: "enemy",
    icon: polishingHammerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 86,
    requiredBuff: "hammer-combo-ready",
    buffConsumptions: [{ buffId: "hammer-combo-ready", stacks: 1 }, { buffId: "hammer-polish-ready", stacks: 1 }],
  },

  // ============================================================
  // GCD: ホワイトホーリー / ブラックコメット
  // ============================================================
  {
    id: "holy-in-white",
    name: "ホワイトホーリー",
    potency: 570,
    type: "gcd",
    target: "enemy",
    icon: holyInWhiteIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 80,
    resourceChanges: [
      { resourceId: "white-paint", amount: -1 },
    ],
    autoTransform: { buffId: "color-inversion", skillId: "comet-in-black" },
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 500 },
      { traitLevel: 94, potency: 570 },
    ],
  },
  {
    id: "comet-in-black",
    name: "ブラックコメット",
    potency: 940,
    type: "gcd",
    target: "enemy",
    icon: cometInBlackIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    resourceChanges: [
      { resourceId: "black-paint", amount: -1 },
    ],
    requiredBuff: "color-inversion",
    buffConsumptions: [{ buffId: "color-inversion", stacks: 1 }],
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 940 },
    ],
  },

  // ============================================================
  // GCD: スタープリズム
  // ============================================================
  {
    id: "star-prism",
    name: "スタープリズム",
    potency: 1100,
    type: "gcd",
    target: "enemy",
    icon: starPrismIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    requiredBuff: "star-prism-ready",
    buffConsumptions: [{ buffId: "star-prism-ready", stacks: 1 }],
  },

  // ============================================================
  // GCD: レインボードリップ
  // ============================================================
  {
    id: "rainbow-drip",
    name: "レインボードリップ",
    potency: 1000,
    type: "gcd",
    target: "enemy",
    icon: rainbowDripIcon,
    recastTime: 6,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 4,
    acquiredLevel: 92,
    resourceChanges: [
      { resourceId: "white-paint", amount: 1 },
    ],
  },

  // ============================================================
  // GCD: 描画スキル
  // ============================================================
  {
    id: "creature-motif",
    name: "ピクトアニマル",
    potency: 0,
    type: "gcd",
    target: "self",
    icon: creatureMotifIcon,
    recastTime: 4,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3,
    acquiredLevel: 30,
    resourceChanges: [
      { resourceId: "animal-canvas", amount: 1 },
    ],
  },
  {
    id: "weapon-motif",
    name: "ピクトウェポン",
    potency: 0,
    type: "gcd",
    target: "self",
    icon: weaponMotifIcon,
    recastTime: 4,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3,
    acquiredLevel: 50,
    resourceChanges: [
      { resourceId: "weapon-canvas", amount: 1 },
    ],
  },
  {
    id: "landscape-motif",
    name: "ピクトスケープ",
    potency: 0,
    type: "gcd",
    target: "self",
    icon: landscapeMotifIcon,
    recastTime: 4,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3,
    acquiredLevel: 70,
    resourceChanges: [
      { resourceId: "scape-canvas", amount: 1 },
    ],
  },

  // ============================================================
  // oGCD: イマジン具現化（アニマル）
  // ============================================================
  {
    id: "pom-muse",
    name: "イマジンポンポン",
    potency: 800,
    type: "ogcd",
    target: "enemy",
    icon: pomMuseIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    maxCharges: 3,
    acquiredLevel: 30,
    resourceChanges: [
      { resourceId: "animal-canvas", amount: -1 },
    ],
    buffApplications: ["wing-muse-ready"],
    autoTransform: [
      { buffId: "fang-muse-ready", skillId: "fanged-muse" },
      { buffId: "claw-muse-ready", skillId: "clawed-muse" },
      { buffId: "wing-muse-ready", skillId: "winged-muse" },
    ],
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 700 },
      { traitLevel: 84, potency: 800 },
    ],
  },
  {
    id: "winged-muse",
    name: "イマジンウィング",
    potency: 800,
    type: "ogcd",
    target: "enemy",
    icon: wingedMuseIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    maxCharges: 3,
    acquiredLevel: 30,
    resourceChanges: [
      { resourceId: "animal-canvas", amount: -1 },
    ],
    buffConsumptions: [{ buffId: "wing-muse-ready", stacks: 1 }],
    buffApplications: ["moogle-symbol", "claw-muse-ready"],
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 700 },
      { traitLevel: 84, potency: 800 },
    ],
  },
  {
    id: "clawed-muse",
    name: "イマジンクロー",
    potency: 800,
    type: "ogcd",
    target: "enemy",
    icon: clawedMuseIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    maxCharges: 3,
    acquiredLevel: 96,
    resourceChanges: [
      { resourceId: "animal-canvas", amount: -1 },
    ],
    buffConsumptions: [{ buffId: "claw-muse-ready", stacks: 1 }],
    buffApplications: ["fang-muse-ready"],
  },
  {
    id: "fanged-muse",
    name: "イマジンファング",
    potency: 800,
    type: "ogcd",
    target: "enemy",
    icon: fangedMuseIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    maxCharges: 3,
    acquiredLevel: 96,
    resourceChanges: [
      { resourceId: "animal-canvas", amount: -1 },
    ],
    buffConsumptions: [{ buffId: "fang-muse-ready", stacks: 1 }],
    buffApplications: ["madeen-symbol"],
  },

  // ============================================================
  // oGCD: モーグリ / マディーン
  // ============================================================
  {
    id: "mog-of-the-ages",
    name: "モーグリストリーム",
    potency: 1000,
    type: "ogcd",
    target: "enemy",
    icon: mogOfTheAgesIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 30,
    requiredBuff: "moogle-symbol",
    buffConsumptions: [{ buffId: "moogle-symbol", stacks: 1 }],
    autoTransform: { buffId: "madeen-symbol", skillId: "retribution-of-the-madeen" },
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 800 },
      { traitLevel: 84, potency: 1000 },
    ],
  },
  {
    id: "retribution-of-the-madeen",
    name: "マディーンレトリビューション",
    potency: 1100,
    type: "ogcd",
    target: "enemy",
    icon: retributionOfTheMadeenIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 96,
    requiredBuff: "madeen-symbol",
    buffConsumptions: [{ buffId: "madeen-symbol", stacks: 1 }],
  },

  // ============================================================
  // oGCD: イマジンハンマー（ウェポン具現化）
  // ============================================================
  {
    id: "steel-muse",
    name: "イマジンハンマー",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: strikingMuseIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    maxCharges: 2,
    acquiredLevel: 50,
    resourceChanges: [
      { resourceId: "weapon-canvas", amount: -1 },
    ],
    buffApplications: ["hammer-combo-ready"],
  },

  // ============================================================
  // oGCD: サブトラクティブパレット
  // ============================================================
  {
    id: "subtractive-palette",
    name: "サブトラクティブパレット",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: subtractivePaletteIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 60,
    resourceChanges: [
      { resourceId: "palette-gauge", amount: -50 },
      { resourceId: "white-paint", amount: -1 },
      { resourceId: "black-paint", amount: 1 },
    ],
    buffApplications: ["subtractive-palette", "color-inversion"],
  },

  // ============================================================
  // oGCD: イマジンスカイ（スケープ具現化）
  // ============================================================
  {
    id: "scenic-muse",
    name: "イマジンスカイ",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: starryMuseIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 70,
    resourceChanges: [
      { resourceId: "scape-canvas", amount: -1 },
    ],
    buffApplications: ["starry-muse", "installation", "star-prism-ready", "subtractive-ready"],
  },
];
