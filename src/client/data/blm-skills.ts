import type { Skill } from "../types/skill";

// === GCD アイコン ===
import fireIcon from "../assets/icons/blm/Fire.png";
import fire2Icon from "../assets/icons/blm/Fire_II.png";
import fire3Icon from "../assets/icons/blm/Fire_III.png";
import fire4Icon from "../assets/icons/blm/Fire_IV.png";
import highFire2Icon from "../assets/icons/blm/High_Fire_II.png";
import flareStarIcon from "../assets/icons/blm/Flare_Star.png";
import despairIcon from "../assets/icons/blm/Despair.png";
import blizzardIcon from "../assets/icons/blm/Blizzard.png";
import blizzard2Icon from "../assets/icons/blm/Blizzard_II.png";
import blizzard3Icon from "../assets/icons/blm/Blizzard_III.png";
import blizzard4Icon from "../assets/icons/blm/Blizzard_IV.png";
import highBlizzard2Icon from "../assets/icons/blm/High_Blizzard_II.png";
import freezeIcon from "../assets/icons/blm/Freeze.png";
import paradoxIcon from "../assets/icons/blm/Paradox.png";
import thunder3Icon from "../assets/icons/blm/Thunder_III.png";
import thunder4Icon from "../assets/icons/blm/Thunder_IV.png";
import highThunderIcon from "../assets/icons/blm/High_Thunder.png";
import highThunder2Icon from "../assets/icons/blm/High_Thunder_II.png";
import xenoglossyIcon from "../assets/icons/blm/Xenoglossy.png";
import foulIcon from "../assets/icons/blm/Foul.png";

// === oGCD アイコン ===
import manafontIcon from "../assets/icons/blm/Manafont.png";
import triplecastIcon from "../assets/icons/blm/Triplecast.png";
import leyLinesIcon from "../assets/icons/blm/Ley_Lines.png";
import transposeIcon from "../assets/icons/blm/Transpose.png";
import amplifierIcon from "../assets/icons/blm/Amplifier.png";
import swiftcastIcon from "../assets/icons/blm/role_actions/Swiftcast.png";

/** GCDリキャスト（秒） */
const GCD_RECAST = 2.5;
/** デフォルトアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/**
 * 黒魔道士のスキル定義。
 *
 * ### MP 管理の方針（ユーザー指定）
 * - MP 自然回復は実装しない
 * - AF 中ファイア系は MP 消費増（アンブラルハートで軽減）
 * - UB 中ブリザド系は MP 消費 0 かつ MP 回復
 *
 * MP 消費量は公式値の近似を使用し、`resourceChanges` で表現する。
 * 正確な値は実機検証で調整する前提。
 *
 * ### AF/UB の段階付与
 * AF/UB は 3 段階のバフ（astral-fire-1/2/3, umbral-ice-1/2/3）で表現する。
 * 同じ exclusiveGroup ("astral-umbral") により相互排他される。
 * スタック式ではないため、段階の引き上げは個別にバフを差し替える形で表現する。
 *
 * 現行では単純化のため、各ファイア／ブリザド系スキルは「AF3／UB3 を直接付与」する
 * 挙動で実装する（実機では 1→2→3 と段階的に上がるが、ビルド目的では AF3/UB3 に
 * 到達した状態で威力計算するのが一般的のため実用上の差は小さい）。
 *
 * ### サンダーヘッド・ファイアスターター
 * 7.2 以降は proc ではなく AF/UB 切替時の確定付与に変更されている（永続）。
 * ファイア/ブリザド系で AF/UB を付与するタイミングで `thunderhead` も同時付与する。
 * `firestarter` はパラドックス使用時（AF 中）に同時付与する。
 */
export const BLM_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // GCD: ファイア系（単体）
  // ============================================================
  {
    id: "fire",
    name: "ファイア",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: fireIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 2,
    resourceChanges: [
      { resourceId: "mp", amount: -800 },
    ],
    // AF1 付与（初回）。後続では AF2/3 を使う方が自然だが、現行は簡易実装
    buffApplications: ["astral-fire-1", "thunderhead"],
  },
  {
    id: "fire-3",
    name: "ファイガ",
    potency: 290,
    type: "gcd",
    target: "enemy",
    icon: fire3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.5,
    acquiredLevel: 35,
    resourceChanges: [
      { resourceId: "mp", amount: -2000 },
    ],
    // AF3 直接付与（AF を一気に 3 段階まで引き上げる）
    buffApplications: ["astral-fire-3", "thunderhead"],
  },
  {
    id: "fire-4",
    name: "ファイジャ",
    potency: 300,
    type: "gcd",
    target: "enemy",
    icon: fire4Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 60,
    // AF3 中でのみ実用、AF1/AF2 でもゲーム上は使用可能
    requiredBuff: "astral-fire-3",
    resourceChanges: [
      { resourceId: "mp", amount: -800 },
      { resourceId: "astral-soul", amount: 1 },
    ],
    buffApplications: ["astral-fire-3"],
  },
  {
    id: "despair",
    name: "デスペア",
    potency: 350,
    type: "gcd",
    target: "enemy",
    icon: despairIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    // AF 中のみ使用可（AF3 へ直接引き上げる）
    requiredBuff: "astral-fire-3",
    // MP を全消費する（最低 500 必要）
    consumeAllOfResource: "mp",
    buffApplications: ["astral-fire-3"],
  },
  {
    id: "flare-star",
    name: "フレアスター",
    potency: 500,
    type: "gcd",
    target: "enemy",
    icon: flareStarIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 100,
    // アストラルソウル 6 を消費
    resourceChanges: [
      { resourceId: "astral-soul", amount: -6 },
    ],
  },

  // ============================================================
  // GCD: ファイア系（範囲）
  // ============================================================
  {
    id: "fire-2",
    name: "ファイラ",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: fire2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.0,
    acquiredLevel: 18,
    resourceChanges: [
      { resourceId: "mp", amount: -1500 },
    ],
    buffApplications: ["astral-fire-3", "thunderhead"],
  },
  {
    id: "high-fire-2",
    name: "ハイファイラ",
    potency: 140,
    type: "gcd",
    target: "enemy",
    icon: highFire2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.0,
    acquiredLevel: 35,
    replacesSkillId: "fire-2",
    resourceChanges: [
      { resourceId: "mp", amount: -1500 },
    ],
    buffApplications: ["astral-fire-3", "thunderhead"],
  },

  // ============================================================
  // GCD: ブリザド系（単体）
  // ============================================================
  {
    id: "blizzard",
    name: "ブリザド",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: blizzardIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 1,
    resourceChanges: [
      // 通常ヒット時に MP 回復（UB 中はさらに多く回復すべきだが簡易化）
      { resourceId: "mp", amount: 400 },
    ],
    buffApplications: ["umbral-ice-1", "thunderhead"],
  },
  {
    id: "blizzard-3",
    name: "ブリザガ",
    potency: 290,
    type: "gcd",
    target: "enemy",
    icon: blizzard3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.5,
    acquiredLevel: 35,
    resourceChanges: [
      { resourceId: "mp", amount: -800 },
    ],
    buffApplications: ["umbral-ice-3", "thunderhead"],
  },
  {
    id: "blizzard-4",
    name: "ブリザジャ",
    potency: 310,
    type: "gcd",
    target: "enemy",
    icon: blizzard4Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 58,
    // UB 中のみ使用可
    requiredBuff: "umbral-ice-3",
    // UB3 中の使用が前提のため MP 消費は 0 として扱う（resourceChanges 省略）
    resourceChanges: [
      { resourceId: "umbral-heart", amount: 3 },
    ],
    buffApplications: ["umbral-ice-3"],
  },

  // ============================================================
  // GCD: ブリザド系（範囲）
  // ============================================================
  {
    id: "blizzard-2",
    name: "ブリザラ",
    potency: 50,
    type: "gcd",
    target: "enemy",
    icon: blizzard2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.0,
    acquiredLevel: 12,
    resourceChanges: [
      { resourceId: "mp", amount: 400 },
    ],
    buffApplications: ["umbral-ice-3", "thunderhead"],
  },
  {
    id: "high-blizzard-2",
    name: "ハイブリザラ",
    potency: 140,
    type: "gcd",
    target: "enemy",
    icon: highBlizzard2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.0,
    acquiredLevel: 45,
    replacesSkillId: "blizzard-2",
    resourceChanges: [
      { resourceId: "mp", amount: 400 },
    ],
    buffApplications: ["umbral-ice-3", "thunderhead"],
  },
  {
    id: "freeze",
    name: "フリーズ",
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: freezeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 40,
    resourceChanges: [
      { resourceId: "mp", amount: -1000 },
      { resourceId: "umbral-heart", amount: 3 },
    ],
    buffApplications: ["umbral-ice-3", "thunderhead"],
  },

  // ============================================================
  // GCD: パラドックス
  // ============================================================
  {
    id: "paradox",
    name: "パラドックス",
    potency: 540,
    type: "gcd",
    target: "enemy",
    icon: paradoxIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    // パラドックスゲージを 1 消費
    resourceChanges: [
      { resourceId: "paradox-gauge", amount: -1 },
    ],
    // AF 中に使用するとファイアスターター付与（実機仕様）
    buffApplications: ["firestarter"],
  },

  // ============================================================
  // GCD: サンダー系（サンダーヘッド中のみ使用可）
  // ============================================================
  // Issue 本文の「サンダガ Lv45」は旧名称で、7.x では Lv45 時点では Thunder III、
  // Lv92 の特性でハイサンダーに置き換わる。ツールではハイサンダーに集約する。
  {
    id: "high-thunder",
    name: "ハイサンダー",
    potency: 240,
    type: "gcd",
    target: "enemy",
    icon: highThunderIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    replacesSkillId: "thunder-3",
    requiredBuff: "thunderhead",
    buffConsumptions: [{ buffId: "thunderhead", stacks: 1 }],
    dotPotency: 65,
    dotDuration: 30,
    refreshesDots: ["high-thunder"],
  },
  {
    id: "thunder-3",
    name: "サンダガ",
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: thunder3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 45,
    requiredBuff: "thunderhead",
    buffConsumptions: [{ buffId: "thunderhead", stacks: 1 }],
    dotPotency: 50,
    dotDuration: 30,
    refreshesDots: ["thunder-3"],
    // Lv92 で high-thunder に置き換えられる。skill-level の replacedIds により自動除外される
  },
  {
    id: "high-thunder-2",
    name: "ハイサンダラ",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: highThunder2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    replacesSkillId: "thunder-4",
    requiredBuff: "thunderhead",
    buffConsumptions: [{ buffId: "thunderhead", stacks: 1 }],
    dotPotency: 40,
    dotDuration: 30,
    refreshesDots: ["high-thunder-2"],
  },
  {
    id: "thunder-4",
    name: "サンダジャ",
    potency: 80,
    type: "gcd",
    target: "enemy",
    icon: thunder4Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    requiredBuff: "thunderhead",
    buffConsumptions: [{ buffId: "thunderhead", stacks: 1 }],
    dotPotency: 30,
    dotDuration: 30,
    refreshesDots: ["thunder-4"],
  },

  // ============================================================
  // GCD: ポリグロット系（Instant）
  // ============================================================
  {
    id: "xenoglossy",
    name: "ゼノグロシー",
    potency: 890,
    type: "gcd",
    target: "enemy",
    icon: xenoglossyIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 80,
    resourceChanges: [
      { resourceId: "polyglot", amount: -1 },
    ],
  },
  {
    id: "foul",
    name: "ファウル",
    potency: 600,
    type: "gcd",
    target: "enemy",
    icon: foulIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 70,
    resourceChanges: [
      { resourceId: "polyglot", amount: -1 },
    ],
  },

  // ============================================================
  // oGCD: ユーティリティ
  // ============================================================
  {
    id: "manafont",
    name: "マナフォント",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: manafontIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 100,
    acquiredLevel: 30,
    // MP 全回復 + AF3 + アンブラルハート 3 + パラドックス + サンダーヘッド付与（7.2 仕様）
    resourceChanges: [
      { resourceId: "mp", amount: 10000 },
      { resourceId: "umbral-heart", amount: 3 },
      { resourceId: "paradox-gauge", amount: 1 },
    ],
    buffApplications: ["astral-fire-3", "thunderhead"],
  },
  {
    id: "triplecast",
    name: "三連魔",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: triplecastIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    maxCharges: 2,
    acquiredLevel: 66,
    buffApplications: ["triplecast"],
  },
  {
    id: "ley-lines",
    name: "黒魔紋",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: leyLinesIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 52,
    buffApplications: ["ley-lines"],
  },
  {
    id: "transpose",
    name: "トランス",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: transposeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 5,
    acquiredLevel: 4,
    // AF と UB の状態を単純に「反転」させる。AF が一切無ければ UB1、UB が無ければ AF1 を付与
    // という実機挙動の近似として、UB1 を付与してサンダーヘッドを更新する
    // （スキル回し的には切替目的で使用され、精密計算上の威力影響は軽微）
    buffApplications: ["umbral-ice-1", "thunderhead"],
  },
  {
    id: "amplifier",
    name: "アンプリファイア",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: amplifierIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 86,
    // 実機では AF/UB 中のみ使用可。本ツールでは OR 条件の requiredBuff 機構が無いため、
    // 使用判定はユーザー側に委ね、ポリグロット +1 の効果のみを反映する
    resourceChanges: [
      { resourceId: "polyglot", amount: 1 },
    ],
  },
  {
    id: "swiftcast",
    name: "迅速魔",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: swiftcastIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 18,
    buffApplications: ["swiftcast"],
  },
];
