import type { Skill } from "../types/skill";
import fastBladeIcon from "../assets/icons/pld/Fast_Blade.png";
import riotBladeIcon from "../assets/icons/pld/Riot_Blade.png";
import royalAuthorityIcon from "../assets/icons/pld/Royal_Authority.png";
import totalEclipseIcon from "../assets/icons/pld/Total_Eclipse.png";
import prominenceIcon from "../assets/icons/pld/Prominence.png";
import shieldLobIcon from "../assets/icons/pld/Shield_Lob.png";
import goringBladeIcon from "../assets/icons/pld/Goring_Blade.png";
import holySpiritIcon from "../assets/icons/pld/Holy_Spirit.png";
import holyCircleIcon from "../assets/icons/pld/Holy_Circle.png";
import atonementIcon from "../assets/icons/pld/Atonement.png";
import supplicationIcon from "../assets/icons/pld/Supplication.png";
import sepulchreIcon from "../assets/icons/pld/Sepulchre.png";
import confiteorIcon from "../assets/icons/pld/Confiteor.png";
import bladeOfFaithIcon from "../assets/icons/pld/Blade_of_Faith.png";
import bladeOfTruthIcon from "../assets/icons/pld/Blade_of_Truth.png";
import bladeOfValorIcon from "../assets/icons/pld/Blade_of_Valor.png";
import fightOrFlightIcon from "../assets/icons/pld/Fight_or_Flight.png";
import spiritsWithinIcon from "../assets/icons/pld/Spirits_Within.png";
import expiacionIcon from "../assets/icons/pld/Expiacion.png";
import circleOfScornIcon from "../assets/icons/pld/Circle_of_Scorn.png";
import interveneIcon from "../assets/icons/pld/Intervene.png";
import requiescatIcon from "../assets/icons/pld/Requiescat.png";
import imperatorIcon from "../assets/icons/pld/Imperator.png";
import bladeOfHonorIcon from "../assets/icons/pld/Blade_of_Honor.png";

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/** コンフィテオルからの魔法コンボの段を表すバフ。WS コンボのスキルを使うと外れる（魔法コンボが途切れる） */
const CONFITEOR_COMBO_STEP_BUFF_IDS = ["blade-of-faith-ready", "blade-of-truth-ready", "blade-of-valor-ready"];

/**
 * ナイト（PLD）攻撃スキル一覧
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#863 で照合）。公式ジョブガイド（Patch 7.5、7.55 表記）とも照合済みで、既知の差分なし
 * 威力はジョブガイド準拠（基本値 = 特性適用前。特性習得前の値はパッチノート 7.x の変更履歴と consolegameswiki で照合）
 * Lv84 特性「アクション威力アップ」・Lv94 特性「アクション威力アップII」による威力変動は traitPotencyOverrides で定義
 * 推定値: ライオットソード・ロイヤルアソリティのコンボ時威力とホーリースピリットの神聖魔法効果アップ時・レクイエスカット時威力の Lv84〜93 の値と、
 *   コンフィテオル・ブレード系の Lv94 未満の値は、出典が無いため 6.5 の Lv90 の値を据え置いたものとして推定している（#863）
 * WS コンボ（ファストブレード → ライオットソード → ロイヤルアソリティ、トータルエクリプス → プロミネンス）は comboFrom。
 *   ロイエ系・ホーリー系・ゴアブレード・コンフィテオル系・シールドロブは WS コンボを途切れさせない（keepsCombo）
 * ロイエ → ゲベート → グラブカッマーは「〜実行可」のバフで、コンフィテオル → ブレード・オブ・フェイス → トゥルース → ヴァラーは段のバフで変化する（autoTransform）。
 *   魔法コンボの段は 7.0 からゲーム内ではバフでなくコンボで管理されるため、段のバフ（30 秒 = コンボの受付時間）で表し、WS コンボのスキルで外す
 * 神聖魔法効果アップ中・レクイエスカット中のホーリー系と、レクイエスカット中のコンフィテオル系は、威力の違う隠しスキルに変化する。
 *   ホーリー系は両方あるとき神聖魔法効果アップを優先して消費する。レクイエスカットのスタックは、レクイエスカット中の版がバフの consumeOnGcd で 1 つずつ消費する
 * 回復・軽減・挑発・かばう・タンクスタンスは計算対象外。シールドバッシュ（スタン用）とタンクのロールアクションも定義しない。
 *   レイジ・オブ・ハルオーネは Lv60 でロイヤルアソリティに置き換わり、対応レベル（Lv70〜）では使わないので定義しない。MP は扱わない
 */
export const PLD_ATTACK_SKILLS: Skill[] = [
  // === GCD: 単体 WS コンボ ===
  {
    id: "fast-blade",
    potency: 150,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 200 },
      { traitLevel: 94, potency: 220 },
    ],
    type: "gcd",
    target: "enemy",
    icon: fastBladeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
    removesBuffs: CONFITEOR_COMBO_STEP_BUFF_IDS,
  },
  {
    id: "riot-blade",
    potency: 260,
    nonComboPotency: 100,
    // Lv84〜93 のコンボ時威力 300 は推定（冒頭コメント）
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 300, nonComboPotency: 140 },
      { traitLevel: 94, potency: 330, nonComboPotency: 170 },
    ],
    type: "gcd",
    target: "enemy",
    icon: riotBladeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 4,
    comboFrom: ["fast-blade"],
    removesBuffs: CONFITEOR_COMBO_STEP_BUFF_IDS,
  },
  {
    id: "royal-authority",
    potency: 360,
    nonComboPotency: 100,
    // Lv84〜93 のコンボ時威力 400 は推定（冒頭コメント）
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 400, nonComboPotency: 140 },
      { traitLevel: 94, potency: 460, nonComboPotency: 200 },
    ],
    type: "gcd",
    target: "enemy",
    icon: royalAuthorityIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    comboFrom: ["riot-blade"],
    // ロイエ実行可は Lv76 から（バフの acquiredLevel で外れる）
    comboBuffApplications: ["atonement-ready", "divine-might"],
    removesBuffs: CONFITEOR_COMBO_STEP_BUFF_IDS,
  },

  // === GCD: 範囲 WS コンボ ===
  {
    id: "total-eclipse",
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: totalEclipseIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 6,
    removesBuffs: CONFITEOR_COMBO_STEP_BUFF_IDS,
    // 自身の周囲の敵にヒット、減衰なし
    maxTargets: Infinity,
  },
  {
    id: "prominence",
    potency: 220,
    nonComboPotency: 100,
    // コンボ成立時の神聖魔法効果アップは Lv72 特性「プロミネンス効果アップ」から
    traitPotencyOverrides: [{ traitLevel: 72, comboBuffApplications: ["divine-might"] }],
    type: "gcd",
    target: "enemy",
    icon: prominenceIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 40,
    comboFrom: ["total-eclipse"],
    removesBuffs: CONFITEOR_COMBO_STEP_BUFF_IDS,
    // 自身の周囲の敵にヒット、減衰なし
    maxTargets: Infinity,
  },

  // === GCD: コンボ対象外の WS ===
  {
    id: "shield-lob",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: shieldLobIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    keepsCombo: true,
  },
  {
    id: "goring-blade",
    potency: 700,
    type: "gcd",
    target: "enemy",
    icon: goringBladeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    keepsCombo: true,
    requiredBuff: "goring-blade-ready",
    buffConsumptions: [{ buffId: "goring-blade-ready", stacks: 1 }],
  },

  // === GCD: ロイエ系（ロイエ実行可 → ゲベート実行可 → グラブカッマー実行可） ===
  {
    id: "atonement",
    potency: 360,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 400 },
      { traitLevel: 94, potency: 460 },
    ],
    type: "gcd",
    target: "enemy",
    icon: atonementIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 76,
    keepsCombo: true,
    requiredBuff: "atonement-ready",
    buffConsumptions: [{ buffId: "atonement-ready", stacks: 1 }],
    buffApplications: ["supplication-ready"],
    // 後の段の実行可が付いていれば、そちらに変化する
    autoTransform: [
      { buffId: "sepulchre-ready", skillId: "sepulchre" },
      { buffId: "supplication-ready", skillId: "supplication" },
    ],
  },
  {
    id: "supplication",
    potency: 380,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 420 },
      { traitLevel: 94, potency: 500 },
    ],
    type: "gcd",
    target: "enemy",
    icon: supplicationIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 76,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "supplication-ready",
    buffConsumptions: [{ buffId: "supplication-ready", stacks: 1 }],
    buffApplications: ["sepulchre-ready"],
  },
  {
    id: "sepulchre",
    potency: 400,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 440 },
      { traitLevel: 94, potency: 540 },
    ],
    type: "gcd",
    target: "enemy",
    icon: sepulchreIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 76,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "sepulchre-ready",
    buffConsumptions: [{ buffId: "sepulchre-ready", stacks: 1 }],
  },

  // === GCD: ホーリー系（神聖魔法効果アップ中・レクイエスカット中は詠唱なしの隠しスキルに変化） ===
  {
    id: "holy-spirit",
    potency: 300,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 350 },
      { traitLevel: 94, potency: 400 },
    ],
    type: "gcd",
    target: "enemy",
    icon: holySpiritIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    keepsCombo: true,
    // 両方付いているときは神聖魔法効果アップを優先する（公式の説明文）
    autoTransform: [
      { buffId: "divine-might", skillId: "holy-spirit-divine-might" },
      { buffId: "requiescat", skillId: "holy-spirit-requiescat" },
    ],
  },
  {
    id: "holy-spirit-divine-might",
    potency: 400,
    // Lv84〜93 の 450 は推定（冒頭コメント）
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 450 },
      { traitLevel: 94, potency: 500 },
    ],
    type: "gcd",
    target: "enemy",
    icon: holySpiritIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    hidden: true,
    keepsCombo: true,
    buffConsumptions: [{ buffId: "divine-might", stacks: 1 }],
  },
  {
    id: "holy-spirit-requiescat",
    potency: 600,
    // Lv84〜93 の 650 は推定（冒頭コメント）。レクイエスカットはバフの consumeOnGcd で消費する
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 650 },
      { traitLevel: 94, potency: 700 },
    ],
    type: "gcd",
    target: "enemy",
    icon: holySpiritIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    hidden: true,
    keepsCombo: true,
  },
  {
    id: "holy-circle",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: holyCircleIcon,
    recastTime: GCD_RECAST,
    castTime: 1.5,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    keepsCombo: true,
    autoTransform: [
      { buffId: "divine-might", skillId: "holy-circle-divine-might" },
      { buffId: "requiescat", skillId: "holy-circle-requiescat" },
    ],
    // 自身の周囲の敵にヒット、減衰なし
    maxTargets: Infinity,
  },
  {
    id: "holy-circle-divine-might",
    potency: 250,
    type: "gcd",
    target: "enemy",
    icon: holyCircleIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    hidden: true,
    keepsCombo: true,
    buffConsumptions: [{ buffId: "divine-might", stacks: 1 }],
    maxTargets: Infinity,
  },
  {
    id: "holy-circle-requiescat",
    potency: 350,
    type: "gcd",
    target: "enemy",
    icon: holyCircleIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    hidden: true,
    keepsCombo: true,
    maxTargets: Infinity,
  },

  // === GCD: コンフィテオル系（コンフィテオル実行可 → 段のバフでブレード・オブ・フェイス → トゥルース → ヴァラー） ===
  {
    id: "confiteor",
    potency: 420,
    // Lv94 未満の 420 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 500 }],
    type: "gcd",
    target: "enemy",
    icon: confiteorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 80,
    keepsCombo: true,
    requiredBuff: "confiteor-ready",
    buffConsumptions: [{ buffId: "confiteor-ready", stacks: 1 }],
    buffApplications: ["blade-of-faith-ready"],
    // 魔法コンボの後の段を先に見る。段のバフが無ければ、レクイエスカット中の版に変化する
    autoTransform: [
      { buffId: "blade-of-valor-ready", skillId: "blade-of-valor" },
      { buffId: "blade-of-truth-ready", skillId: "blade-of-truth" },
      { buffId: "blade-of-faith-ready", skillId: "blade-of-faith" },
      { buffId: "requiescat", skillId: "confiteor-requiescat" },
    ],
    // 対象とその周囲にヒット、2体目以降は威力60%減
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "confiteor-requiescat",
    potency: 920,
    // Lv94 未満の 920 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 1000 }],
    type: "gcd",
    target: "enemy",
    icon: confiteorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 80,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "confiteor-ready",
    buffConsumptions: [{ buffId: "confiteor-ready", stacks: 1 }],
    buffApplications: ["blade-of-faith-ready"],
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "blade-of-faith",
    potency: 220,
    // Lv94 未満の 220 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 260 }],
    type: "gcd",
    target: "enemy",
    icon: bladeOfFaithIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "blade-of-faith-ready",
    buffConsumptions: [{ buffId: "blade-of-faith-ready", stacks: 1 }],
    buffApplications: ["blade-of-truth-ready"],
    autoTransform: { buffId: "requiescat", skillId: "blade-of-faith-requiescat" },
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "blade-of-faith-requiescat",
    potency: 720,
    // Lv94 未満の 720 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 760 }],
    type: "gcd",
    target: "enemy",
    icon: bladeOfFaithIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "blade-of-faith-ready",
    buffConsumptions: [{ buffId: "blade-of-faith-ready", stacks: 1 }],
    buffApplications: ["blade-of-truth-ready"],
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "blade-of-truth",
    potency: 320,
    // Lv94 未満の 320 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 380 }],
    type: "gcd",
    target: "enemy",
    icon: bladeOfTruthIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "blade-of-truth-ready",
    buffConsumptions: [{ buffId: "blade-of-truth-ready", stacks: 1 }],
    buffApplications: ["blade-of-valor-ready"],
    autoTransform: { buffId: "requiescat", skillId: "blade-of-truth-requiescat" },
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "blade-of-truth-requiescat",
    potency: 820,
    // Lv94 未満の 820 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 880 }],
    type: "gcd",
    target: "enemy",
    icon: bladeOfTruthIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "blade-of-truth-ready",
    buffConsumptions: [{ buffId: "blade-of-truth-ready", stacks: 1 }],
    buffApplications: ["blade-of-valor-ready"],
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "blade-of-valor",
    potency: 420,
    // Lv94 未満の 420 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 500 }],
    type: "gcd",
    target: "enemy",
    icon: bladeOfValorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "blade-of-valor-ready",
    buffConsumptions: [{ buffId: "blade-of-valor-ready", stacks: 1 }],
    // ブレード・オブ・オナー実行可は Lv100 から（バフの acquiredLevel で外れる）
    buffApplications: ["blade-of-honor-ready"],
    autoTransform: { buffId: "requiescat", skillId: "blade-of-valor-requiescat" },
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "blade-of-valor-requiescat",
    potency: 920,
    // Lv94 未満の 920 は推定（冒頭コメント）
    traitPotencyOverrides: [{ traitLevel: 94, potency: 1000 }],
    type: "gcd",
    target: "enemy",
    icon: bladeOfValorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    hidden: true,
    keepsCombo: true,
    requiredBuff: "blade-of-valor-ready",
    buffConsumptions: [{ buffId: "blade-of-valor-ready", stacks: 1 }],
    buffApplications: ["blade-of-honor-ready"],
    maxTargets: Infinity,
    falloffRate: 0.6,
  },

  // === oGCD ===
  {
    id: "fight-or-flight",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: fightOrFlightIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 2,
    // ゴアブレード実行可は Lv54 特性から（バフの acquiredLevel で外れる）
    buffApplications: ["fight-or-flight", "goring-blade-ready"],
  },
  {
    id: "spirits-within",
    potency: 270,
    type: "ogcd",
    target: "enemy",
    icon: spiritsWithinIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 30,
  },
  {
    id: "expiacion",
    potency: 450,
    type: "ogcd",
    target: "enemy",
    icon: expiacionIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 86,
    replacesSkillId: "spirits-within",
    // 対象とその周囲にヒット、2体目以降は威力60%減
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "circle-of-scorn",
    potency: 140,
    type: "ogcd",
    target: "enemy",
    icon: circleOfScornIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 50,
    dotPotency: 30,
    dotDuration: 15,
    // 自身の周囲の敵にヒット、減衰なし
    maxTargets: Infinity,
  },
  {
    id: "intervene",
    potency: 150,
    type: "ogcd",
    target: "enemy",
    icon: interveneIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    maxCharges: 2,
    acquiredLevel: 66,
  },
  {
    id: "requiescat",
    potency: 320,
    type: "ogcd",
    target: "enemy",
    icon: requiescatIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 68,
    // コンフィテオル実行可は Lv80 特性から（バフの acquiredLevel で外れる）
    buffApplications: ["requiescat", "confiteor-ready"],
  },
  {
    id: "imperator",
    potency: 580,
    type: "ogcd",
    target: "enemy",
    icon: imperatorIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 96,
    replacesSkillId: "requiescat",
    buffApplications: ["requiescat", "confiteor-ready"],
    // 対象とその周囲にヒット、2体目以降は威力60%減
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "blade-of-honor",
    potency: 1000,
    type: "ogcd",
    target: "enemy",
    icon: bladeOfHonorIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 1,
    acquiredLevel: 100,
    requiredBuff: "blade-of-honor-ready",
    buffConsumptions: [{ buffId: "blade-of-honor-ready", stacks: 1 }],
    // 対象とその周囲にヒット、2体目以降は威力60%減
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
];
