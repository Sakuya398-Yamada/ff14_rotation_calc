import type { Skill } from "../types/skill";

import ruinIcon from "../assets/icons/sch/Ruin.png";
import broilIcon from "../assets/icons/sch/Broil.png";
import broil2Icon from "../assets/icons/sch/Broil_II.png";
import broil3Icon from "../assets/icons/sch/Broil_III.png";
import broil4Icon from "../assets/icons/sch/Broil_IV.png";
import ruin2Icon from "../assets/icons/sch/Ruin_II.png";
import bioIcon from "../assets/icons/sch/Bio.png";
import bio2Icon from "../assets/icons/sch/Bio_II.png";
import biolysisIcon from "../assets/icons/sch/Biolysis.png";
import artOfWarIcon from "../assets/icons/sch/Art_of_War.png";
import artOfWar2Icon from "../assets/icons/sch/Art_of_War_II.png";
import energyDrainIcon from "../assets/icons/sch/Energy_Drain.png";
import aetherflowIcon from "../assets/icons/sch/Aetherflow.png";
import dissipationIcon from "../assets/icons/sch/Dissipation.png";
import chainStratagemIcon from "../assets/icons/sch/Chain_Stratagem.png";
import banefulImpactionIcon from "../assets/icons/sch/Baneful_Impaction.png";
import lustrateIcon from "../assets/icons/sch/Lustrate.png";
import sacredSoilIcon from "../assets/icons/sch/Sacred_Soil.png";
import indomitabilityIcon from "../assets/icons/sch/Indomitability.png";
import excogitationIcon from "../assets/icons/sch/Excogitation.png";
import swiftcastIcon from "../assets/icons/sch/role_actions/Swiftcast.png";

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/**
 * 学者（SCH）攻撃スキル一覧
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#498 で照合）。公式ジョブガイド（Patch 7.5、7.55 表記）とも照合済みで、既知の差分なし
 * 威力はジョブガイド準拠（基本値 = 特性適用前。特性習得前の値はパッチノート 7.x の変更履歴と consolegameswiki で照合）
 * 炎法マスタリー（Lv54/64/72/82）と Lv94 特性「アクション威力アップ」による威力変動は traitPotencyOverrides で定義
 * 回復・バリア・フェアリーの行動は計算対象外。エーテルフローを消費する回復アビリティだけ、リソース管理用に威力 0 で定義する
 */
export const SCH_ATTACK_SKILLS: Skill[] = [
  // === GCD: ルイン／炎法系（単体攻撃魔法チェーン） ===
  {
    id: "sch-ruin",
    name: "ルイン",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: ruinIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
  },
  {
    id: "broil",
    name: "気炎法",
    potency: 220,
    type: "gcd",
    target: "enemy",
    icon: broilIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    replacesSkillId: "sch-ruin",
  },
  {
    id: "broil2",
    name: "魔炎法",
    potency: 240,
    type: "gcd",
    target: "enemy",
    icon: broil2Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    replacesSkillId: "broil",
  },
  {
    id: "broil3",
    name: "死炎法",
    potency: 255,
    type: "gcd",
    target: "enemy",
    icon: broil3Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    replacesSkillId: "broil2",
  },
  {
    id: "broil4",
    name: "極炎法",
    potency: 295,
    type: "gcd",
    target: "enemy",
    icon: broil4Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "broil3",
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 320 },
    ],
  },

  // === GCD: ルインラ（移動用のインスタント魔法） ===
  {
    id: "sch-ruin2",
    name: "ルインラ",
    potency: 140,
    type: "gcd",
    target: "enemy",
    icon: ruin2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 38,
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 160 },
      { traitLevel: 64, potency: 180 },
      { traitLevel: 72, potency: 200 },
      { traitLevel: 82, potency: 220 },
    ],
  },

  // === GCD: バイオ系（DoTチェーン） ===
  {
    id: "sch-bio",
    name: "バイオ",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: bioIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 20,
    dotDuration: 30,
    acquiredLevel: 2,
  },
  {
    id: "sch-bio2",
    name: "バイオラ",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: bio2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 40,
    dotDuration: 30,
    acquiredLevel: 26,
    replacesSkillId: "sch-bio",
  },
  {
    id: "biolysis",
    name: "蠱毒法",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: biolysisIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 70,
    dotDuration: 30,
    acquiredLevel: 72,
    replacesSkillId: "sch-bio2",
    traitPotencyOverrides: [
      { traitLevel: 94, dotPotency: 85 },
    ],
  },

  // === GCD: 破陣法系（自身の周囲への範囲攻撃魔法） ===
  {
    id: "art-of-war",
    name: "破陣法",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: artOfWarIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 46,
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 165 },
    ],
    // 周囲の敵全体に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
  },
  {
    id: "art-of-war2",
    name: "裂陣法",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: artOfWar2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "art-of-war",
    maxTargets: Infinity,
  },

  // === oGCD: エーテルフロー関連 ===
  {
    id: "energy-drain",
    name: "エナジードレイン",
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: energyDrainIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 45,
    resourceChanges: [
      { resourceId: "aetherflow", amount: -1 },
    ],
  },
  {
    id: "aetherflow",
    name: "エーテルフロー",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: aetherflowIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 45,
    // 「最大スタック分を付与」は上限 3 で頭打ちになる +3 で表す
    resourceChanges: [
      { resourceId: "aetherflow", amount: 3 },
    ],
  },
  {
    id: "dissipation",
    name: "転化",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: dissipationIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 180,
    acquiredLevel: 60,
    resourceChanges: [
      { resourceId: "aetherflow", amount: 3 },
    ],
  },

  // === oGCD: エーテルフローを消費する回復アビリティ（威力 0。回復に回した分をリソースに反映するためだけに置く） ===
  {
    id: "lustrate",
    name: "生命活性法",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: lustrateIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 45,
    resourceChanges: [
      { resourceId: "aetherflow", amount: -1 },
    ],
  },
  {
    id: "sacred-soil",
    name: "野戦治療の陣",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: sacredSoilIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 50,
    resourceChanges: [
      { resourceId: "aetherflow", amount: -1 },
    ],
  },
  {
    id: "indomitability",
    name: "不撓不屈の策",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: indomitabilityIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 52,
    resourceChanges: [
      { resourceId: "aetherflow", amount: -1 },
    ],
  },
  {
    id: "excogitation",
    name: "深謀遠慮の策",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: excogitationIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 45,
    acquiredLevel: 62,
    resourceChanges: [
      { resourceId: "aetherflow", amount: -1 },
    ],
  },

  // === oGCD: 連環計・埋伏の毒 ===
  {
    id: "chain-stratagem",
    name: "連環計",
    potency: 0,
    type: "ogcd",
    target: "enemy",
    icon: chainStratagemIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 66,
    // impact-imminent は acquiredLevel 92 のため、Lv92 未満では付与されない
    buffApplications: ["chain-stratagem", "impact-imminent"],
  },
  {
    id: "baneful-impaction",
    name: "埋伏の毒",
    potency: 0,
    type: "ogcd",
    target: "enemy",
    icon: banefulImpactionIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 92,
    requiredBuff: "impact-imminent",
    buffConsumptions: [{ buffId: "impact-imminent", stacks: 1 }],
    dotPotency: 140,
    dotDuration: 15,
    // 対象とその周囲の敵にヒット（減衰なし）。DoT は既存仕様どおり 1 体分で数える
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
