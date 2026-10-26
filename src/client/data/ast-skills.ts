import type { Skill } from "../types/skill";

import maleficIcon from "../assets/icons/ast/Malefic.png";
import malefic2Icon from "../assets/icons/ast/Malefic_II.png";
import malefic3Icon from "../assets/icons/ast/Malefic_III.png";
import malefic4Icon from "../assets/icons/ast/Malefic_IV.png";
import fallMaleficIcon from "../assets/icons/ast/Fall_Malefic.png";
import combustIcon from "../assets/icons/ast/Combust.png";
import combust2Icon from "../assets/icons/ast/Combust_II.png";
import combust3Icon from "../assets/icons/ast/Combust_III.png";
import gravityIcon from "../assets/icons/ast/Gravity.png";
import gravity2Icon from "../assets/icons/ast/Gravity_II.png";
import macrocosmosIcon from "../assets/icons/ast/Macrocosmos.png";
import divinationIcon from "../assets/icons/ast/Divination.png";
import oracleIcon from "../assets/icons/ast/Oracle.png";
import lightspeedIcon from "../assets/icons/ast/Lightspeed.png";
import astralDrawIcon from "../assets/icons/ast/Astral_Draw.png";
import umbralDrawIcon from "../assets/icons/ast/Umbral_Draw.png";
import lordOfCrownsIcon from "../assets/icons/ast/Lord_of_Crowns.png";
import earthlyStarIcon from "../assets/icons/ast/Earthly_Star.png";
import stellarDetonationIcon from "../assets/icons/ast/Stellar_Detonation.png";
import swiftcastIcon from "../assets/icons/ast/role_actions/Swiftcast.png";

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/**
 * 占星術師（AST）攻撃スキル一覧
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#499 で照合）。公式ジョブガイド（Patch 7.5、7.55 表記）とも照合済みで、既知の差分なし
 * 威力はジョブガイド準拠（基本値 = 特性適用前。特性習得前の値はパッチノート 7.x の変更履歴と consolegameswiki で照合）
 * Lv94 特性「アクション威力アップ」による威力変動は traitPotencyOverrides で定義
 * 回復・バリア・MP は計算対象外。カード（プレイI〜III）とクラウンレディも扱わず、ドローはクラウンロードを使えるかどうかの流れだけを表す
 */
export const AST_ATTACK_SKILLS: Skill[] = [
  // === GCD: マレフィク系（単体攻撃魔法チェーン） ===
  {
    id: "malefic",
    name: "マレフィク",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: maleficIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
  },
  {
    id: "malefic2",
    name: "マレフィラ",
    potency: 160,
    type: "gcd",
    target: "enemy",
    icon: malefic2Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    replacesSkillId: "malefic",
  },
  {
    id: "malefic3",
    name: "マレフィガ",
    potency: 190,
    type: "gcd",
    target: "enemy",
    icon: malefic3Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    replacesSkillId: "malefic2",
  },
  {
    id: "malefic4",
    name: "マレフィジャ",
    potency: 230,
    type: "gcd",
    target: "enemy",
    icon: malefic4Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    replacesSkillId: "malefic3",
  },
  {
    id: "fall-malefic",
    name: "フォールマレフィク",
    potency: 250,
    type: "gcd",
    target: "enemy",
    icon: fallMaleficIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "malefic4",
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 270 },
    ],
  },

  // === GCD: コンバス系（DoTチェーン） ===
  {
    id: "combust",
    name: "コンバス",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: combustIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 50,
    dotDuration: 30,
    acquiredLevel: 4,
  },
  {
    id: "combust2",
    name: "コンバラ",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: combust2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 60,
    dotDuration: 30,
    acquiredLevel: 46,
    replacesSkillId: "combust",
  },
  {
    id: "combust3",
    name: "コンバガ",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: combust3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 65,
    dotDuration: 30,
    acquiredLevel: 72,
    replacesSkillId: "combust2",
    traitPotencyOverrides: [
      { traitLevel: 94, dotPotency: 70 },
    ],
  },

  // === GCD: グラビデ系（対象とその周囲への範囲攻撃魔法） ===
  {
    id: "gravity",
    name: "グラビデ",
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: gravityIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 45,
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
  },
  {
    id: "gravity2",
    name: "グラビラ",
    potency: 130,
    type: "gcd",
    target: "enemy",
    icon: gravity2Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "gravity",
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 140 },
    ],
    maxTargets: Infinity,
  },

  // === GCD: マクロコスモス ===
  {
    id: "macrocosmos",
    name: "マクロコスモス",
    potency: 250,
    type: "gcd",
    target: "enemy",
    icon: macrocosmosIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    // 固有のリキャストタイマーを持つ GCD
    cooldown: 180,
    acquiredLevel: 90,
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 270 },
    ],
    // 自身の周囲の敵にヒット、2体目以降は威力40%減。回復効果（ミクロコスモス）は扱わない
    maxTargets: Infinity,
    falloffRate: 0.4,
  },

  // === oGCD: ディヴィネーション・オラクル ===
  {
    id: "divination",
    name: "ディヴィネーション",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: divinationIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 50,
    // divining は acquiredLevel 92 のため、Lv92 未満では付与されない
    buffApplications: ["divination", "divining"],
  },
  {
    id: "oracle",
    name: "オラクル",
    potency: 860,
    type: "ogcd",
    target: "enemy",
    icon: oracleIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 92,
    // requiredBuff を併用すると、条件未達のエラーに同じ ID が 2 回入る（#663）ため buffConsumptions だけで判定する
    buffConsumptions: [{ buffId: "divining", stacks: 1 }],
    // 対象とその周囲の敵にヒット、2体目以降は威力50%減
    maxTargets: Infinity,
    falloffRate: 0.5,
  },

  // === oGCD: ライトスピード ===
  {
    id: "lightspeed",
    name: "ライトスピード",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: lightspeedIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    // Lv68 特性「ライトスピード効果アップ」で 90 → 60 秒。レベルの選択肢は 70 以上なので 60 秒で固定する
    cooldown: 60,
    maxCharges: 2,
    acquiredLevel: 6,
    buffApplications: ["lightspeed"],
  },

  // === oGCD: ドロー・クラウンロード ===
  {
    id: "astral-draw",
    name: "アストラルドロー",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: astralDrawIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 55,
    cooldownGroup: "ast-draw",
    acquiredLevel: 30,
    resourceChanges: [
      { resourceId: "umbral-draw-next", amount: 1 },
      { resourceId: "lord-of-crowns", amount: 1 },
    ],
    // 実機と同じく 1 つのボタンで交互に入れ替わる。開幕はアストラルドロー済みなのでアンブラルドローから始まる
    autoTransform: {
      resourceConditions: [{ resourceId: "umbral-draw-next", minAmount: 1 }],
      skillId: "umbral-draw",
    },
  },
  {
    id: "umbral-draw",
    name: "アンブラルドロー",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: umbralDrawIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 55,
    cooldownGroup: "ast-draw",
    acquiredLevel: 30,
    resourceChanges: [
      { resourceId: "umbral-draw-next", amount: -1 },
    ],
    // 引いたクラウンレディでマイナーアルカナが上書きされ、使わずにいたクラウンロードも消える
    consumeAllOfResource: "lord-of-crowns",
  },
  {
    id: "lord-of-crowns",
    name: "クラウンロード",
    potency: 400,
    type: "ogcd",
    target: "enemy",
    icon: lordOfCrownsIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 70,
    resourceChanges: [
      { resourceId: "lord-of-crowns", amount: -1 },
    ],
    // 自身の周囲の敵に減衰なしでヒット
    maxTargets: Infinity,
  },

  // === oGCD: アーサリースター ===
  {
    id: "earthly-star",
    name: "アーサリースター",
    potency: 0,
    type: "ogcd",
    // 地面に設置するため、ボスが離脱中でも置ける
    target: "self",
    icon: earthlyStarIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 62,
    buffApplications: ["earthly-star", "earthly-dominance"],
  },
  {
    id: "stellar-detonation",
    name: "ステラデトネーション",
    // 巨星の支配者中（設置から 10 秒以降）の威力
    potency: 310,
    type: "ogcd",
    target: "enemy",
    icon: stellarDetonationIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 3,
    acquiredLevel: 62,
    // 設置したアーサリースターを消費する。無ければエラー（requiredBuff は併用しない。#663）
    buffConsumptions: [{ buffId: "earthly-star", stacks: 1 }],
    // 星の支配者中（成熟前）は威力 205。星の支配者も消費する
    conditionalPotencyBuffs: [{ buffId: "earthly-dominance", potency: 205 }],
    // 範囲内の敵に減衰なしでヒット
    maxTargets: Infinity,
  },

  // === oGCD: ロールアクション ===
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
    traitPotencyOverrides: [{ traitLevel: 94, cooldown: 40 }],
    buffApplications: ["swiftcast"],
  },
];
