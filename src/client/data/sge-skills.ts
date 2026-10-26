import type { Skill } from "../types/skill";

import dosisIcon from "../assets/icons/sge/Dosis.png";
import dosis2Icon from "../assets/icons/sge/Dosis_II.png";
import dosis3Icon from "../assets/icons/sge/Dosis_III.png";
import eukrasianDosisIcon from "../assets/icons/sge/Eukrasian_Dosis.png";
import eukrasianDosis2Icon from "../assets/icons/sge/Eukrasian_Dosis_II.png";
import eukrasianDosis3Icon from "../assets/icons/sge/Eukrasian_Dosis_III.png";
import eukrasiaIcon from "../assets/icons/sge/Eukrasia.png";
import phlegmaIcon from "../assets/icons/sge/Phlegma.png";
import phlegma2Icon from "../assets/icons/sge/Phlegma_II.png";
import phlegma3Icon from "../assets/icons/sge/Phlegma_III.png";
import toxikonIcon from "../assets/icons/sge/Toxikon.png";
import toxikon2Icon from "../assets/icons/sge/Toxikon_II.png";
import dyskrasiaIcon from "../assets/icons/sge/Dyskrasia.png";
import dyskrasia2Icon from "../assets/icons/sge/Dyskrasia_II.png";
import eukrasianDyskrasiaIcon from "../assets/icons/sge/Eukrasian_Dyskrasia.png";
import pneumaIcon from "../assets/icons/sge/Pneuma.png";
import psycheIcon from "../assets/icons/sge/Psyche.png";
import diagnosisIcon from "../assets/icons/sge/Diagnosis.png";
import eukrasianDiagnosisIcon from "../assets/icons/sge/Eukrasian_Diagnosis.png";
import druocholeIcon from "../assets/icons/sge/Druochole.png";
import keracholeIcon from "../assets/icons/sge/Kerachole.png";
import ixocholeIcon from "../assets/icons/sge/Ixochole.png";
import taurocholeIcon from "../assets/icons/sge/Taurochole.png";
import rhizomataIcon from "../assets/icons/sge/Rhizomata.png";
import swiftcastIcon from "../assets/icons/sge/role_actions/Swiftcast.png";

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** エウクラシア系魔法の GCD リキャスト（秒。スピードで縮まない） */
const EUKRASIAN_RECAST = 1.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/** エウクラシア系の DoT は同時に 1 種類だけ（E.ドシスIII と E.ディスクラシアは同時に付与されない） */
const SGE_EUKRASIAN_DOT_IDS = ["eukrasian-dosis", "eukrasian-dosis2", "eukrasian-dosis3", "eukrasian-dyskrasia"];

/**
 * 賢者（SGE）攻撃スキル一覧
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#500 で照合）。公式ジョブガイド（Patch 7.5、7.55 表記）とも照合済みで、既知の差分なし
 * 威力はジョブガイド準拠（基本値 = 特性適用前。特性習得前の値はパッチノート 7.x の変更履歴と consolegameswiki で照合）
 * 賢学の誓い（Lv54/64）・攻撃魔法マスタリー（Lv72）と Lv94 特性「アクション威力アップ」による威力変動は traitPotencyOverrides で定義
 * エウクラシア中はドシス系・ディスクラシアII・ディアグノシスがエウクラシア系の魔法に変わる（autoTransform）。エウクラシアとエウクラシア系の魔法の GCD はスピードで縮まない（fixedGcdRecast）
 * 回復・バリア・カルディアは計算対象外。アダーガル・アダーステックを増減する回復魔法・アビリティだけ、リソース管理用に威力 0 で定義する
 */
export const SGE_ATTACK_SKILLS: Skill[] = [
  // === GCD: ドシス系（単体攻撃魔法チェーン） ===
  {
    id: "dosis",
    name: "ドシス",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: dosisIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 250 },
      { traitLevel: 64, potency: 300 },
    ],
    autoTransform: { buffId: "eukrasia", skillId: "eukrasian-dosis" },
  },
  {
    id: "dosis2",
    name: "ドシスII",
    potency: 320,
    type: "gcd",
    target: "enemy",
    icon: dosis2Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    replacesSkillId: "dosis",
    autoTransform: { buffId: "eukrasia", skillId: "eukrasian-dosis2" },
  },
  {
    id: "dosis3",
    name: "ドシスIII",
    potency: 330,
    type: "gcd",
    target: "enemy",
    icon: dosis3Icon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "dosis2",
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 380 },
    ],
    autoTransform: { buffId: "eukrasia", skillId: "eukrasian-dosis3" },
  },

  // === GCD: エウクラシア・ドシス系（DoT。エウクラシア中のドシス系の変化先） ===
  {
    id: "eukrasian-dosis",
    name: "エウクラシア・ドシス",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: eukrasianDosisIcon,
    recastTime: EUKRASIAN_RECAST,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 30,
    dotDuration: 30,
    acquiredLevel: 30,
    traitPotencyOverrides: [
      { traitLevel: 54, dotPotency: 35 },
      { traitLevel: 64, dotPotency: 40 },
    ],
    buffConsumptions: [{ buffId: "eukrasia", stacks: 1 }],
    replacesDots: SGE_EUKRASIAN_DOT_IDS,
    hidden: true,
  },
  {
    id: "eukrasian-dosis2",
    name: "エウクラシア・ドシスII",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: eukrasianDosis2Icon,
    recastTime: EUKRASIAN_RECAST,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 60,
    dotDuration: 30,
    acquiredLevel: 72,
    buffConsumptions: [{ buffId: "eukrasia", stacks: 1 }],
    replacesDots: SGE_EUKRASIAN_DOT_IDS,
    hidden: true,
  },
  {
    id: "eukrasian-dosis3",
    name: "エウクラシア・ドシスIII",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: eukrasianDosis3Icon,
    recastTime: EUKRASIAN_RECAST,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 80,
    dotDuration: 30,
    acquiredLevel: 82,
    // Lv94 未満の 80 は 7.2 の基本値の変更（75 → 80）。アクション威力アップの対象に入ったのは 7.4 から
    traitPotencyOverrides: [
      { traitLevel: 94, dotPotency: 90 },
    ],
    buffConsumptions: [{ buffId: "eukrasia", stacks: 1 }],
    replacesDots: SGE_EUKRASIAN_DOT_IDS,
    hidden: true,
  },

  // === GCD: エウクラシア ===
  {
    id: "eukrasia",
    name: "エウクラシア",
    potency: 0,
    type: "gcd",
    target: "self",
    icon: eukrasiaIcon,
    recastTime: 1.0,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    buffApplications: ["eukrasia"],
  },

  // === GCD: フレグマ系（チャージ式の範囲攻撃魔法） ===
  {
    id: "phlegma",
    name: "フレグマ",
    potency: 230,
    type: "gcd",
    target: "enemy",
    icon: phlegmaIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    // 固有のリキャストタイマーを持つ GCD
    cooldown: 40,
    maxCharges: 2,
    acquiredLevel: 26,
    traitPotencyOverrides: [
      { traitLevel: 54, potency: 330 },
      { traitLevel: 64, potency: 400 },
    ],
    // 対象とその周囲の敵にヒット、2体目以降は威力30%減
    maxTargets: Infinity,
    falloffRate: 0.3,
  },
  {
    id: "phlegma2",
    name: "フレグマII",
    potency: 490,
    type: "gcd",
    target: "enemy",
    icon: phlegma2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    maxCharges: 2,
    acquiredLevel: 72,
    replacesSkillId: "phlegma",
    // 対象とその周囲の敵にヒット、2体目以降は威力50%減
    maxTargets: Infinity,
    falloffRate: 0.5,
  },
  {
    id: "phlegma3",
    name: "フレグマIII",
    potency: 690,
    type: "gcd",
    target: "enemy",
    icon: phlegma3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    maxCharges: 2,
    acquiredLevel: 82,
    replacesSkillId: "phlegma2",
    maxTargets: Infinity,
    falloffRate: 0.5,
  },

  // === GCD: トキシコン系（アダーステックを消費する範囲攻撃魔法） ===
  {
    id: "toxikon",
    name: "トキシコン",
    potency: 240,
    type: "gcd",
    target: "enemy",
    icon: toxikonIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 66,
    traitPotencyOverrides: [
      { traitLevel: 72, potency: 300 },
    ],
    resourceChanges: [
      { resourceId: "addersting", amount: -1 },
    ],
    // 対象とその周囲の敵にヒット、2体目以降は威力50%減
    maxTargets: Infinity,
    falloffRate: 0.5,
  },
  {
    id: "toxikon2",
    name: "トキシコンII",
    potency: 330,
    type: "gcd",
    target: "enemy",
    icon: toxikon2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "toxikon",
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 380 },
    ],
    resourceChanges: [
      { resourceId: "addersting", amount: -1 },
    ],
    maxTargets: Infinity,
    falloffRate: 0.5,
  },

  // === GCD: ディスクラシア系（自身の周囲への範囲攻撃魔法） ===
  {
    id: "dyskrasia",
    name: "ディスクラシア",
    potency: 160,
    type: "gcd",
    target: "enemy",
    icon: dyskrasiaIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 46,
    // 自身の周囲の敵全体に減衰なしでヒット。エウクラシアでは変化しない（変化するのはディスクラシアII から）
    maxTargets: Infinity,
  },
  {
    id: "dyskrasia2",
    name: "ディスクラシアII",
    potency: 170,
    type: "gcd",
    target: "enemy",
    icon: dyskrasia2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "dyskrasia",
    maxTargets: Infinity,
    autoTransform: { buffId: "eukrasia", skillId: "eukrasian-dyskrasia" },
  },
  {
    id: "eukrasian-dyskrasia",
    name: "エウクラシア・ディスクラシア",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: eukrasianDyskrasiaIcon,
    recastTime: EUKRASIAN_RECAST,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 40,
    dotDuration: 30,
    acquiredLevel: 82,
    buffConsumptions: [{ buffId: "eukrasia", stacks: 1 }],
    replacesDots: SGE_EUKRASIAN_DOT_IDS,
    // 自身の周囲の敵に DoT を付与。DoT は既存仕様どおり 1 体分で数える
    maxTargets: Infinity,
    hidden: true,
  },

  // === GCD: プネウマ ===
  {
    id: "pneuma",
    name: "プネウマ",
    potency: 330,
    type: "gcd",
    target: "enemy",
    icon: pneumaIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    // 固有のリキャストタイマーを持つ GCD
    cooldown: 120,
    acquiredLevel: 90,
    traitPotencyOverrides: [
      { traitLevel: 94, potency: 380 },
    ],
    // 前方直線範囲の敵にヒット、2体目以降は威力40%減。回復効果は扱わない
    maxTargets: Infinity,
    falloffRate: 0.4,
  },

  // === GCD: ディアグノシス（アダーステックの補充用。威力 0） ===
  {
    id: "diagnosis",
    name: "ディアグノシス",
    potency: 0,
    type: "gcd",
    target: "party",
    icon: diagnosisIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 2,
    autoTransform: { buffId: "eukrasia", skillId: "eukrasian-diagnosis" },
  },
  {
    id: "eukrasian-diagnosis",
    name: "エウクラシア・ディアグノシス",
    potency: 0,
    type: "gcd",
    target: "party",
    icon: eukrasianDiagnosisIcon,
    recastTime: EUKRASIAN_RECAST,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    buffConsumptions: [{ buffId: "eukrasia", stacks: 1 }],
    // 実際はバリアが完全に吸収されたときに獲得する。バリアが割れた前提で実行時に獲得する
    resourceChanges: [
      { resourceId: "addersting", amount: 1 },
    ],
    hidden: true,
  },

  // === oGCD: プシュケー ===
  {
    id: "psyche",
    name: "プシュケー",
    potency: 690,
    type: "ogcd",
    target: "enemy",
    icon: psycheIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 92,
    // 対象とその周囲の敵にヒット、2体目以降は威力50%減
    maxTargets: Infinity,
    falloffRate: 0.5,
  },

  // === oGCD: アダーガルを消費する回復アビリティ（威力 0。回復に回した分をリソースに反映するためだけに置く） ===
  {
    id: "druochole",
    name: "ドルオコレ",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: druocholeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 45,
    resourceChanges: [
      { resourceId: "addersgall", amount: -1 },
    ],
  },
  {
    id: "kerachole",
    name: "ケーラコレ",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: keracholeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 50,
    resourceChanges: [
      { resourceId: "addersgall", amount: -1 },
    ],
  },
  {
    id: "ixochole",
    name: "イックソコレ",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: ixocholeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 52,
    resourceChanges: [
      { resourceId: "addersgall", amount: -1 },
    ],
  },
  {
    id: "taurochole",
    name: "タウロコレ",
    potency: 0,
    type: "ogcd",
    target: "party",
    icon: taurocholeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 45,
    acquiredLevel: 62,
    resourceChanges: [
      { resourceId: "addersgall", amount: -1 },
    ],
  },
  {
    id: "rhizomata",
    name: "リゾーマタ",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: rhizomataIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 90,
    acquiredLevel: 74,
    resourceChanges: [
      { resourceId: "addersgall", amount: 1 },
    ],
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
