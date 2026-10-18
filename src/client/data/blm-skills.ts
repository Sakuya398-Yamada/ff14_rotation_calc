import type { AutoTransformEntry, Skill } from "../types/skill";

// === GCD アイコン ===
import fireIcon from "../assets/icons/blm/Fire.png";
import fire2Icon from "../assets/icons/blm/Fire_II.png";
import fire3Icon from "../assets/icons/blm/Fire_III.png";
import fire4Icon from "../assets/icons/blm/Fire_IV.png";
import highFire2Icon from "../assets/icons/blm/High_Fire_II.png";
import flareIcon from "../assets/icons/blm/Flare.png";
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
import lucidDreamingIcon from "../assets/icons/blm/role_actions/Lucid_Dreaming.png";

/** GCDリキャスト（秒） */
const GCD_RECAST = 2.5;
/** デフォルトアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/** AF 中（段階不問）を発動条件にするための requiredBuffAnyOf */
const ASTRAL_FIRE_ANY = ["astral-fire-1", "astral-fire-2", "astral-fire-3"];
/** UB 中（段階不問）を発動条件にするための requiredBuffAnyOf */
const UMBRAL_ICE_ANY = ["umbral-ice-1", "umbral-ice-2", "umbral-ice-3"];

/** UB→AF の反転でパラドックスが付く条件（UB3 かつアンブラルハート 3） */
const UB3_FULL_HEARTS = {
  buffId: "umbral-ice-3",
  resourceConditions: [{ resourceId: "umbral-heart", minAmount: 3 }],
};

/** いずれかのバフがアクティブなら skillId に変化させる autoTransform エントリ群 */
function transformWhileAny(buffIds: string[], skillId: string): AutoTransformEntry[] {
  return buffIds.map((buffId) => ({ buffId, skillId }));
}

/**
 * 黒魔道士のスキル定義。
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#515 で照合）。公式ジョブガイド（Patch 7.5、7.55 表記）との既知の差分は #519
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
 * ファイア／ブリザドは autoTransform の隠しスキルで 1→2→3 と段階を進め、
 * ファイガ／ブリザガ・ファイラ系／ブリザラ系・デスペア・フレア・マナフォントは
 * 最大段階（AF3／UB3）を直接付与する。ファイジャ・デスペア・ブリザジャ・フリーズは
 * AF／UB 中なら段階不問で使用でき、ファイジャ・ブリザジャ・フリーズは段階を変えない（#417）。
 *
 * ### サンダーヘッド・パラドックス・ファイアスターター（#416）
 * サンダーヘッドは AF/UB が無い状態からいずれかが付与されたとき、または AF⇔UB が反転したときだけ付与する
 * （段階の維持・上昇では付与しない）。トランスによる反転では付与しない（#219 の判断を維持）。
 * パラドックスゲージ（Lv90）は AF3 から UB へ、または UB3 かつアンブラルハート 3 から AF へ反転したときに +1 する。
 * どちらも実行前の AF/UB の状態で付与内容が変わるため、変化元スキルの autoTransform で隠しスキル
 * （`*-in-af` / `*-in-ub` / `*-from-af3` / `*-from-ub3`。末尾の `deriveHidden` で生成）に切り替える。
 * AF/UB は時間で切れない（duration: null）ため、「AF/UB の解除でパラドックスが消える」は表現する場面が無い。
 * `firestarter` はパラドックス使用時（AF 中）に同時付与する。
 */
const BLM_BASE_SKILLS: Skill[] = [
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
    // 通常時（AF外/UB外）または UB 中（exclusiveGroup により UB が解除されて AF1 となる）に AF1 を付与
    buffApplications: ["astral-fire-1", "thunderhead"],
    // AF 中は段階を進める（サンダーヘッドは付与しない）。AF3 中は維持
    // UB3 かつアンブラルハート 3 からの反転はパラドックスも付与する
    autoTransform: [
      { buffId: "astral-fire-3", skillId: "fire-stay-af3" },
      { buffId: "astral-fire-2", skillId: "fire-up-af3" },
      { buffId: "astral-fire-1", skillId: "fire-up-af2" },
      { ...UB3_FULL_HEARTS, skillId: "fire-from-ub3" },
    ],
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
    autoTransform: [
      ...transformWhileAny(ASTRAL_FIRE_ANY, "fire-3-in-af"),
      { ...UB3_FULL_HEARTS, skillId: "fire-3-from-ub3" },
    ],
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
    // AF 中のみ使用可（段階不問）。AF を付与する追加効果は無いので段階は変えない
    requiredBuffAnyOf: ASTRAL_FIRE_ANY,
    resourceChanges: [
      { resourceId: "mp", amount: -800 },
      { resourceId: "astral-soul", amount: 1 },
    ],
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
    // AF 中のみ使用可（段階不問）。最大スタック分の AF を付与するので AF3 へ引き上げる
    requiredBuffAnyOf: ASTRAL_FIRE_ANY,
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
    // 対象とその周囲の敵にヒット、2体目以降は威力65%減
    maxTargets: Infinity,
    falloffRate: 0.65,
  },

  // ============================================================
  // GCD: ファイア系（範囲）
  // ============================================================
  {
    id: "fire-2",
    name: "ファイラ",
    potency: 80,
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
    autoTransform: [
      ...transformWhileAny(ASTRAL_FIRE_ANY, "fire-2-in-af"),
      { ...UB3_FULL_HEARTS, skillId: "fire-2-from-ub3" },
    ],
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
  },
  {
    id: "high-fire-2",
    name: "ハイファイラ",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: highFire2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.0,
    acquiredLevel: 82,
    replacesSkillId: "fire-2",
    resourceChanges: [
      { resourceId: "mp", amount: -1500 },
    ],
    buffApplications: ["astral-fire-3", "thunderhead"],
    autoTransform: [
      ...transformWhileAny(ASTRAL_FIRE_ANY, "high-fire-2-in-af"),
      { ...UB3_FULL_HEARTS, skillId: "high-fire-2-from-ub3" },
    ],
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
  },
  {
    id: "flare",
    name: "フレア",
    potency: 240,
    type: "gcd",
    target: "enemy",
    icon: flareIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 50,
    // AF 中のみ使用可（AF1〜AF3 いずれでも可。トランス→フレアの範囲ローテに対応）
    requiredBuffAnyOf: ASTRAL_FIRE_ANY,
    // MP を全消費する。アンブラルハート全消費時の「消費 MP 2/3」は
    // 既存の MP 機構（resourceCostMultiplier は固定コストのみ対象）では
    // 表現できないためモデル化しない（Issue #316 で決定）
    consumeAllOfResource: "mp",
    resourceChanges: [
      { resourceId: "astral-soul", amount: 3 },
    ],
    buffApplications: ["astral-fire-3"],
    // 対象とその周囲の敵にヒット、2体目以降は威力30%減
    maxTargets: Infinity,
    falloffRate: 0.3,
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
    resourceChanges: [{ resourceId: "mp", amount: -400 }],
    // UB外/AF中→UB1 付与時は MP 回復なし（UB 段階遷移時の回復は隠しスキル側で表現）
    buffApplications: ["umbral-ice-1", "thunderhead"],
    // UB 中は段階を進めつつヒット時 MP を回復する（隠しスキルに委譲、サンダーヘッドは付与しない）。UB3 中は維持＋全回復
    // AF3 からの反転はパラドックスも付与する
    autoTransform: [
      { buffId: "umbral-ice-3", skillId: "blizzard-stay-ub3" },
      { buffId: "umbral-ice-2", skillId: "blizzard-up-ub3" },
      { buffId: "umbral-ice-1", skillId: "blizzard-up-ub2" },
      { buffId: "astral-fire-3", skillId: "blizzard-from-af3" },
    ],
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
    autoTransform: [
      ...transformWhileAny(UMBRAL_ICE_ANY, "blizzard-3-in-ub"),
      { buffId: "astral-fire-3", skillId: "blizzard-3-from-af3" },
    ],
  },
  {
    id: "blizzard-4",
    name: "ブリザジャ",
    potency: 300,
    type: "gcd",
    target: "enemy",
    icon: blizzard4Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 58,
    // UB 中のみ使用可（段階不問）。UB を付与する追加効果は無いので段階は変えない
    requiredBuffAnyOf: UMBRAL_ICE_ANY,
    // MP 800 は UB 中なら UB バフの効果で 0 になる
    resourceChanges: [
      { resourceId: "mp", amount: -800 },
      { resourceId: "umbral-heart", amount: 3 },
    ],
  },

  // ============================================================
  // GCD: ブリザド系（範囲）
  // ============================================================
  {
    id: "blizzard-2",
    name: "ブリザラ",
    potency: 80,
    type: "gcd",
    target: "enemy",
    icon: blizzard2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.0,
    acquiredLevel: 12,
    resourceChanges: [{ resourceId: "mp", amount: -800 }],
    buffApplications: ["umbral-ice-3", "thunderhead"],
    autoTransform: [
      ...transformWhileAny(UMBRAL_ICE_ANY, "blizzard-2-in-ub"),
      { buffId: "astral-fire-3", skillId: "blizzard-2-from-af3" },
    ],
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
  },
  {
    id: "high-blizzard-2",
    name: "ハイブリザラ",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: highBlizzard2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 3.0,
    acquiredLevel: 82,
    replacesSkillId: "blizzard-2",
    resourceChanges: [{ resourceId: "mp", amount: -800 }],
    buffApplications: ["umbral-ice-3", "thunderhead"],
    autoTransform: [
      ...transformWhileAny(UMBRAL_ICE_ANY, "high-blizzard-2-in-ub"),
      { buffId: "astral-fire-3", skillId: "high-blizzard-2-from-af3" },
    ],
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
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
    // UB 中のみ使用可（段階不問）。UB を付与する追加効果は無いので段階は変えない
    requiredBuffAnyOf: UMBRAL_ICE_ANY,
    resourceChanges: [
      { resourceId: "mp", amount: -1000 },
      { resourceId: "umbral-heart", amount: 3 },
    ],
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
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
      { resourceId: "mp", amount: -1600 },
      { resourceId: "paradox-gauge", amount: -1 },
    ],
    // AF 中はファイアスターターを付与する隠しスキルに切替（UB 中は付与しない）
    autoTransform: [
      { buffId: "astral-fire-3", skillId: "paradox-af" },
      { buffId: "astral-fire-2", skillId: "paradox-af" },
      { buffId: "astral-fire-1", skillId: "paradox-af" },
    ],
  },

  // ============================================================
  // GCD: サンダー系（サンダーヘッド中のみ使用可）
  // ============================================================
  // Issue 本文の「サンダガ Lv45」は旧名称で、7.x では Lv45 時点では Thunder III、
  // Lv92 の特性でハイサンダーに置き換わる。ツールではハイサンダーに集約する。
  {
    id: "high-thunder",
    name: "ハイサンダー",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: highThunderIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    replacesSkillId: "thunder-3",
    requiredBuff: "thunderhead",
    buffConsumptions: [{ buffId: "thunderhead", stacks: 1 }],
    dotPotency: 60,
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
    dotDuration: 27,
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
    acquiredLevel: 92,
    replacesSkillId: "thunder-4",
    requiredBuff: "thunderhead",
    buffConsumptions: [{ buffId: "thunderhead", stacks: 1 }],
    dotPotency: 40,
    dotDuration: 24,
    refreshesDots: ["high-thunder-2"],
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
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
    dotPotency: 35,
    dotDuration: 21,
    refreshesDots: ["thunder-4"],
    // 対象とその周囲の敵に減衰なしでヒット（対象数上限なし）
    maxTargets: Infinity,
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
    // 対象とその周囲の敵にヒット、2体目以降は威力25%減
    maxTargets: Infinity,
    falloffRate: 0.25,
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
    maxCharges: 2,
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
    // 無極性時は何もしない（cooldown 消費のみ）。AF/UB 中は autoTransform で隠しスキルに切替 (Issue #218)
    buffApplications: [],
    // AF 中は UB1 へ、UB 中は AF1 へ切替。サンダーヘッドは付与しない（#219）
    // AF3 から、または UB3 かつアンブラルハート 3 からの反転はパラドックスも付与する
    autoTransform: [
      { buffId: "astral-fire-3", skillId: "transpose-to-ub1-from-af3" },
      { ...UB3_FULL_HEARTS, skillId: "transpose-to-af1-from-ub3" },
      { buffId: "astral-fire-2", skillId: "transpose-to-ub1" },
      { buffId: "astral-fire-1", skillId: "transpose-to-ub1" },
      { buffId: "umbral-ice-3", skillId: "transpose-to-af1" },
      { buffId: "umbral-ice-2", skillId: "transpose-to-af1" },
      { buffId: "umbral-ice-1", skillId: "transpose-to-af1" },
    ],
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
    // AF または UB 中のみ使用可（段階不問）
    requiredBuffAnyOf: [...ASTRAL_FIRE_ANY, ...UMBRAL_ICE_ANY],
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
    // Lv94 ロール特性「迅速魔効果アップ」でリキャスト 40 秒
    traitPotencyOverrides: [{ traitLevel: 94, cooldown: 40 }],
    buffApplications: ["swiftcast"],
  },
  // MP 回復は `lucid-dreaming` バフ + `BLM_RESOURCES` の `autoGenerateWhileBuff` 連携で駆動する。
  // ここで即時 `resourceChanges` は付けない（回復はバフ中の 3 秒ごとのティックだけにするため）
  {
    id: "lucid-dreaming",
    name: "ルーシッドドリーム",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: lucidDreamingIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 14,
    buffApplications: ["lucid-dreaming"],
  },

  // ============================================================
  // 隠しスキル: AF/UB 段階進行・AF 中のパラドックス・トランス（fire/blizzard/transpose/paradox の autoTransform 先）
  // 反転時のサンダーヘッド・パラドックス付与用の隠しスキルは BLM_ATTACK_SKILLS で deriveHidden から作る
  // UI 非表示。元スキルから威力・コスト・キャストを引き継ぎ、付与バフのみが異なる
  // ============================================================
  {
    id: "fire-up-af2",
    name: "ファイア (AF1→AF2)",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: fireIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 2,
    hidden: true,
    resourceChanges: [{ resourceId: "mp", amount: -800 }],
    buffApplications: ["astral-fire-2"],
  },
  {
    id: "fire-up-af3",
    name: "ファイア (AF2→AF3)",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: fireIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 2,
    hidden: true,
    resourceChanges: [{ resourceId: "mp", amount: -800 }],
    buffApplications: ["astral-fire-3"],
  },
  {
    id: "fire-stay-af3",
    name: "ファイア (AF3 維持)",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: fireIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 2,
    hidden: true,
    resourceChanges: [{ resourceId: "mp", amount: -800 }],
    buffApplications: ["astral-fire-3"],
  },
  // 注: ブリザド系の段階別 MP 回復（UB1: +2500, UB2: +5000, UB3: +10000）は
  // UB バフの `resourceGainOnSkill` 効果で自動発動するため、隠しスキル側に MP 回復を持たせない。
  {
    id: "blizzard-up-ub2",
    name: "ブリザド (UB1→UB2)",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: blizzardIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 1,
    hidden: true,
    resourceChanges: [{ resourceId: "mp", amount: -400 }],
    buffApplications: ["umbral-ice-2"],
  },
  {
    id: "blizzard-up-ub3",
    name: "ブリザド (UB2→UB3)",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: blizzardIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 1,
    hidden: true,
    resourceChanges: [{ resourceId: "mp", amount: -400 }],
    buffApplications: ["umbral-ice-3"],
  },
  {
    id: "blizzard-stay-ub3",
    name: "ブリザド (UB3 維持)",
    potency: 180,
    type: "gcd",
    target: "enemy",
    icon: blizzardIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    castTime: 2.0,
    acquiredLevel: 1,
    hidden: true,
    resourceChanges: [{ resourceId: "mp", amount: -400 }],
    buffApplications: ["umbral-ice-3"],
  },
  {
    id: "paradox-af",
    name: "パラドックス (AF)",
    potency: 540,
    type: "gcd",
    target: "enemy",
    icon: paradoxIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    hidden: true,
    resourceChanges: [
      { resourceId: "mp", amount: -1600 },
      { resourceId: "paradox-gauge", amount: -1 },
    ],
    buffApplications: ["firestarter"],
  },
  {
    id: "transpose-to-ub1",
    name: "トランス (AF→UB1)",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: transposeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 5,
    acquiredLevel: 4,
    hidden: true,
    buffApplications: ["umbral-ice-1"],
  },
  {
    id: "transpose-to-af1",
    name: "トランス (UB→AF1)",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: transposeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 5,
    acquiredLevel: 4,
    hidden: true,
    buffApplications: ["astral-fire-1"],
  },
];

/**
 * 実行前の AF/UB の状態でサンダーヘッド・パラドックスの付与だけが変わる隠しスキルを、変化元スキルから作る（#416）。
 * 威力・MP・詠唱などは変化元の値をそのまま使うので、変化元を直せば追従する。
 * `addsParadox` はパラドックスゲージ +1 を足す（Lv90 未満ではゲージごとレベル調整で外れる）。
 */
function deriveHidden(
  baseId: string,
  id: string,
  name: string,
  buffApplications: string[],
  addsParadox = false,
): Skill {
  const base = BLM_BASE_SKILLS.find((s) => s.id === baseId);
  if (!base) throw new Error(`BLM skill not found: ${baseId}`);
  const resourceChanges = addsParadox
    ? [...(base.resourceChanges ?? []), { resourceId: "paradox-gauge", amount: 1 }]
    : base.resourceChanges;
  return {
    ...base,
    id,
    name,
    hidden: true,
    replacesSkillId: undefined,
    autoTransform: undefined,
    buffApplications,
    resourceChanges,
  };
}

export const BLM_ATTACK_SKILLS: Skill[] = [
  ...BLM_BASE_SKILLS,
  // AF 中のファイア系（AF3 付与）: 反転ではないのでサンダーヘッドは付かない
  deriveHidden("fire-3", "fire-3-in-af", "ファイガ (AF 中)", ["astral-fire-3"]),
  deriveHidden("fire-2", "fire-2-in-af", "ファイラ (AF 中)", ["astral-fire-3"]),
  deriveHidden("high-fire-2", "high-fire-2-in-af", "ハイファイラ (AF 中)", ["astral-fire-3"]),
  // UB3 かつアンブラルハート 3 から AF への反転: サンダーヘッド＋パラドックス
  deriveHidden("fire", "fire-from-ub3", "ファイア (UB3→AF1)", ["astral-fire-1", "thunderhead"], true),
  deriveHidden("fire-3", "fire-3-from-ub3", "ファイガ (UB3→AF3)", ["astral-fire-3", "thunderhead"], true),
  deriveHidden("fire-2", "fire-2-from-ub3", "ファイラ (UB3→AF3)", ["astral-fire-3", "thunderhead"], true),
  deriveHidden("high-fire-2", "high-fire-2-from-ub3", "ハイファイラ (UB3→AF3)", ["astral-fire-3", "thunderhead"], true),
  // トランスはパラドックスのみ（サンダーヘッドは付与しない。#219）
  deriveHidden("transpose", "transpose-to-af1-from-ub3", "トランス (UB3→AF1)", ["astral-fire-1"], true),
  // UB 中のブリザド系（UB3 付与）: 反転ではないのでサンダーヘッドは付かない
  deriveHidden("blizzard-3", "blizzard-3-in-ub", "ブリザガ (UB 中)", ["umbral-ice-3"]),
  deriveHidden("blizzard-2", "blizzard-2-in-ub", "ブリザラ (UB 中)", ["umbral-ice-3"]),
  deriveHidden("high-blizzard-2", "high-blizzard-2-in-ub", "ハイブリザラ (UB 中)", ["umbral-ice-3"]),
  // AF3 から UB への反転: サンダーヘッド＋パラドックス
  deriveHidden("blizzard", "blizzard-from-af3", "ブリザド (AF3→UB1)", ["umbral-ice-1", "thunderhead"], true),
  deriveHidden("blizzard-3", "blizzard-3-from-af3", "ブリザガ (AF3→UB3)", ["umbral-ice-3", "thunderhead"], true),
  deriveHidden("blizzard-2", "blizzard-2-from-af3", "ブリザラ (AF3→UB3)", ["umbral-ice-3", "thunderhead"], true),
  deriveHidden("high-blizzard-2", "high-blizzard-2-from-af3", "ハイブリザラ (AF3→UB3)", ["umbral-ice-3", "thunderhead"], true),
  // トランスはパラドックスのみ（サンダーヘッドは付与しない。#219）
  deriveHidden("transpose", "transpose-to-ub1-from-af3", "トランス (AF3→UB1)", ["umbral-ice-1"], true),
];

// ============================================================
// AF/UB バフ効果の対象スキル ID 群
// ============================================================
// blm-buffs.ts の AF/UB バフが potency 倍率・MP 消費倍率・
// MP 回復対象を判定する際に参照する。隠しスキル（fire-up-af2 等）も
// autoTransform 経由で実行されるため対象に含める。
// 新スキルや段階進行用の隠しスキルを追加した際は、ここを更新するだけで
// blm-buffs.ts の AF/UB 効果が自動追従する。

/** ファイガと、AF/UB の状態で切り替わるその隠しスキル（ファイアスターターの対象） */
export const BLM_FIRE_3_IDS = ["fire-3", "fire-3-in-af", "fire-3-from-ub3"];

/** AF（アストラルファイア）効果の対象となるファイア系スキル ID 群 */
export const BLM_FIRE_FAMILY_IDS = [
  "fire",
  "fire-2",
  "fire-3",
  "fire-4",
  "high-fire-2",
  "flare",
  "despair",
  "flare-star",
  "fire-up-af2",
  "fire-up-af3",
  "fire-stay-af3",
  "fire-3-in-af",
  "fire-2-in-af",
  "high-fire-2-in-af",
  "fire-from-ub3",
  "fire-3-from-ub3",
  "fire-2-from-ub3",
  "high-fire-2-from-ub3",
];

/** UB（アンブラルブリザード）効果の対象となるブリザド系スキル ID 群 */
export const BLM_BLIZZARD_FAMILY_IDS = [
  "blizzard",
  "blizzard-2",
  "blizzard-3",
  "blizzard-4",
  "high-blizzard-2",
  "freeze",
  "blizzard-up-ub2",
  "blizzard-up-ub3",
  "blizzard-stay-ub3",
  "blizzard-3-in-ub",
  "blizzard-2-in-ub",
  "high-blizzard-2-in-ub",
  "blizzard-from-af3",
  "blizzard-3-from-af3",
  "blizzard-2-from-af3",
  "high-blizzard-2-from-af3",
];
