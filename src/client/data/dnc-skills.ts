import type { AutoTransformEntry, ResourceChange, Skill } from "../types/skill";

import cascadeIcon from "../assets/icons/dnc/Cascade.png";
import fountainIcon from "../assets/icons/dnc/Fountain.png";
import windmillIcon from "../assets/icons/dnc/Windmill.png";
import bladeshowerIcon from "../assets/icons/dnc/Bladeshower.png";
import reverseCascadeIcon from "../assets/icons/dnc/Reverse_Cascade.png";
import fountainfallIcon from "../assets/icons/dnc/Fountainfall.png";
import risingWindmillIcon from "../assets/icons/dnc/Rising_Windmill.png";
import bloodshowerIcon from "../assets/icons/dnc/Bloodshower.png";
import standardStepIcon from "../assets/icons/dnc/Standard_Step.png";
import technicalStepIcon from "../assets/icons/dnc/Technical_Step.png";
import emboiteIcon from "../assets/icons/dnc/Emboite.png";
import entrechatIcon from "../assets/icons/dnc/Entrechat.png";
import jeteIcon from "../assets/icons/dnc/Jete.png";
import pirouetteIcon from "../assets/icons/dnc/Pirouette.png";
import standardFinishIcon from "../assets/icons/dnc/Standard_Finish.png";
import technicalFinishIcon from "../assets/icons/dnc/Technical_Finish.png";
import finishingMoveIcon from "../assets/icons/dnc/Finishing_Move.png";
import tillanaIcon from "../assets/icons/dnc/Tillana.png";
import saberDanceIcon from "../assets/icons/dnc/Saber_Dance.png";
import danceOfTheDawnIcon from "../assets/icons/dnc/Dance_of_the_Dawn.png";
import starfallDanceIcon from "../assets/icons/dnc/Starfall_Dance.png";
import lastDanceIcon from "../assets/icons/dnc/Last_Dance.png";
import fanDanceIcon from "../assets/icons/dnc/Fan_Dance.png";
import fanDanceIIIcon from "../assets/icons/dnc/Fan_Dance_II.png";
import fanDanceIIIIcon from "../assets/icons/dnc/Fan_Dance_III.png";
import fanDanceIVIcon from "../assets/icons/dnc/Fan_Dance_IV.png";
import devilmentIcon from "../assets/icons/dnc/Devilment.png";
import flourishIcon from "../assets/icons/dnc/Flourish.png";

const GCD_RECAST = 2.5;
/** ステップは 1.0 秒、スタンダードステップ・テクニカルステップとフィニッシュは 1.5 秒の GCD（スキルスピードで縮まない） */
const STEP_GCD_RECAST = 1.0;
const DANCE_GCD_RECAST = 1.5;
const DEFAULT_ANIMATION_LOCK = 0.65;
/** 範囲攻撃の 2 体目以降の威力は 60% 減（流星の舞いだけ 75% 減） */
const AOE_FALLOFF = 0.6;

/** ダンスモード中はステップとフィニッシュしか使えない */
const DANCING = "dancing";
const ESPRIT_BUFFS = ["esprit-standard", "esprit-technical"];
/** 自分にエスプリ効果がある間の WS で得るエスプリ */
const espritGain = (amount: number): ResourceChange => ({ resourceId: "esprit", amount, requiredBuffAnyOf: ESPRIT_BUFFS });
/** リバースカスケード系の命中時に 50% で得るフェザー */
const FEATHER_PROC: ResourceChange = { resourceId: "dnc-feather", amount: 1, procRate: 0.5 };

/**
 * ステップの回数ごとのフィニッシュへの変化（多い方から先に判定する）。回数ごとのフィニッシュは別のアクション（Action ID も別）
 */
const finishTransforms = (danceBuffId: string, finishIdsByStep: string[]): AutoTransformEntry[] =>
  finishIdsByStep
    .map((skillId, steps) => ({ skillId, steps }))
    .reverse()
    .map(({ skillId, steps }) => ({
      buffId: danceBuffId,
      ...(steps > 0 ? { resourceConditions: [{ resourceId: "dance-steps", minAmount: steps }] } : {}),
      skillId,
    }));

const step = (id: string, gameActionId: number, icon: string): Skill => ({
  id,
  gameActionId,
  potency: 0,
  type: "gcd",
  keepsCombo: true,
  target: "self",
  icon,
  recastTime: STEP_GCD_RECAST,
  fixedGcdRecast: true,
  animationLock: DEFAULT_ANIMATION_LOCK,
  acquiredLevel: 15,
  requiredBuff: DANCING,
  resourceChanges: [{ resourceId: "dance-steps", amount: 1 }],
});

/** フィニッシュ（ステップの変化先）。ステップを 1 回以上成功させたときだけ、与ダメージ上昇・エスプリ・実行可のバフが付く */
const finish = (
  overrides: Partial<Skill> & Pick<Skill, "id" | "gameActionId" | "potency" | "icon" | "acquiredLevel" | "removesBuffs">,
): Skill => ({
  type: "gcd",
  keepsCombo: true,
  target: "enemy",
  recastTime: DANCE_GCD_RECAST,
  fixedGcdRecast: true,
  animationLock: DEFAULT_ANIMATION_LOCK,
  hidden: true,
  maxTargets: Infinity,
  falloffRate: AOE_FALLOFF,
  ...overrides,
});

const STANDARD_FINISH_BUFFS = (bonusBuffId: string) => [bonusBuffId, "esprit-standard", "last-dance-ready"];
const TECHNICAL_FINISH_BUFFS = (bonusBuffId: string) => [
  bonusBuffId,
  "esprit-technical",
  "flourishing-finish",
  "dance-of-the-dawn-ready",
];
const STANDARD_FINISH_REMOVES = ["standard-step", DANCING];
const TECHNICAL_FINISH_REMOVES = ["technical-step", DANCING];

/**
 * 踊り子（DNC）攻撃スキル定義（Lv100まで）
 * パッチノートの PvE ジョブ調整は 7.58 まで反映済み（#959 で照合。7.5〜7.58 に踊り子の PvE 調整は無い）。
 * 公式ジョブガイド（Patch 7.5 表記）とも照合済みで、既知の差分なし
 * アクション威力アップ（Lv94）による変動は traitPotencyOverrides で定義し、基本値は特性修得前の値にする（consolegameswiki の Notes で照合）。
 * リバースカスケード系のエスプリ +10（Lv84 から。それまでは +5）も traitPotencyOverrides で定義する
 * 0 回のフィニッシュは威力だけで、与ダメージ上昇・エスプリ・実行可のバフは付かない（ジョブガイドの「ステップ成功時」と、
 * xivintheshell の踊り子の実装に揃えた）。フィニシングムーブの GCD は 2.5 秒（xivintheshell。ジョブガイドに記載が無い）
 * 確率で付く・得る効果は、ホークアイと同じくタイムライン上は出た扱いにし、消費するスキルの威力を期待値にする。
 * リバースカスケード系が出なかったときに撃つ GCD は、リバースカスケード → カスケード、ファウンテンフォール → ファウンテン（コンボ時）、
 * 範囲版も同じ組み合わせとする（近似）。エスプリは出た扱いで数え、期待値にしない
 * 対称投擲と対称投擲：フラリッシュ（非対称も）が両方あるとき、ゲームは対称投擲を先に消費するが、ここでは確定の
 * フラリッシュを先に消費する（2 回の消費の期待値はどちらでも同じ）
 * 計算の対象外: クローズドポジション（パートナーに付く効果）・パートナーとパーティメンバーの行動で得るエスプリ・
 * 癒やしのワルツ・守りのサンバ・インプロビゼーション・アン・アヴァン・ロールアクション・オートアタック・
 * フラリッシュの「戦闘状態」の発動条件
 *
 * 大別:
 * 1. WS コンボ（カスケード → ファウンテン、ウィンドミル → ブレードシャワー）
 * 2. 確率で付くバフで撃つ WS（リバースカスケード・ファウンテンフォール・ライジングウィンドミル・ブラッドシャワー）
 * 3. ダンス（スタンダードステップ → フィニッシュ／フィニシングムーブ、テクニカルステップ → フィニッシュ／ティラナ、ステップ 4 種）
 * 4. エスプリ・実行可のバフで撃つ WS（剣の舞い → 暁の舞い・流星の舞い・ラストダンス）
 * 5. アビリティ（扇の舞い【序】【破】【急】【終】・攻めのタンゴ・フラリッシュ）
 *
 * コンボ以外の GCD はすべて keepsCombo（コンボを途切れさせない）
 */
export const DNC_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // 1. WS コンボ
  // ============================================================
  {
    id: "cascade",
    gameActionId: 15989,
    potency: 200,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 220 }],
    type: "gcd",
    target: "enemy",
    icon: cascadeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
    forbiddenBuff: DANCING,
    buffApplications: ["silken-symmetry"],
    buffApplicationProcRates: { "silken-symmetry": 0.5 },
    resourceChanges: [espritGain(5)],
  },
  {
    id: "fountain",
    gameActionId: 15990,
    potency: 260,
    nonComboPotency: 100,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 280, nonComboPotency: 120 }],
    type: "gcd",
    target: "enemy",
    icon: fountainIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 2,
    forbiddenBuff: DANCING,
    comboFrom: ["cascade"],
    comboBuffApplications: ["silken-flow"],
    buffApplicationProcRates: { "silken-flow": 0.5 },
    resourceChanges: [espritGain(5)],
  },
  {
    // 自身の周囲の範囲攻撃。減衰の記載なし
    id: "windmill",
    gameActionId: 15993,
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: windmillIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    maxTargets: Infinity,
    forbiddenBuff: DANCING,
    buffApplications: ["silken-symmetry"],
    buffApplicationProcRates: { "silken-symmetry": 0.5 },
    resourceChanges: [espritGain(5)],
  },
  {
    // 自身の周囲の範囲攻撃。減衰の記載なし
    id: "bladeshower",
    gameActionId: 15994,
    potency: 160,
    nonComboPotency: 100,
    type: "gcd",
    target: "enemy",
    icon: bladeshowerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 25,
    maxTargets: Infinity,
    forbiddenBuff: DANCING,
    comboFrom: ["windmill"],
    comboBuffApplications: ["silken-flow"],
    buffApplicationProcRates: { "silken-flow": 0.5 },
    resourceChanges: [espritGain(5)],
  },

  // ============================================================
  // 2. 確率で付くバフで撃つ WS（出なかったときは対応するコンボの WS を撃つ期待値）
  // ============================================================
  {
    id: "reverse-cascade",
    gameActionId: 15991,
    potency: 260,
    traitPotencyOverrides: [
      { traitLevel: 84, resourceChanges: [FEATHER_PROC, espritGain(10)] },
      {
        traitLevel: 94,
        potency: 280,
        buffConsumptionAnyOf: [
          { buffId: "flourishing-symmetry", stacks: 1 },
          { buffId: "silken-symmetry", stacks: 1, fallbackPotency: 220, fallbackSkillId: "cascade" },
        ],
      },
    ],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: reverseCascadeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 20,
    forbiddenBuff: DANCING,
    buffConsumptionAnyOf: [
      { buffId: "flourishing-symmetry", stacks: 1 },
      { buffId: "silken-symmetry", stacks: 1, fallbackPotency: 200, fallbackSkillId: "cascade" },
    ],
    resourceChanges: [FEATHER_PROC, espritGain(5)],
  },
  {
    id: "fountainfall",
    gameActionId: 15992,
    potency: 320,
    traitPotencyOverrides: [
      { traitLevel: 84, resourceChanges: [FEATHER_PROC, espritGain(10)] },
      {
        traitLevel: 94,
        potency: 340,
        buffConsumptionAnyOf: [
          { buffId: "flourishing-flow", stacks: 1 },
          { buffId: "silken-flow", stacks: 1, fallbackPotency: 280, fallbackSkillId: "fountain" },
        ],
      },
    ],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: fountainfallIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 40,
    forbiddenBuff: DANCING,
    buffConsumptionAnyOf: [
      { buffId: "flourishing-flow", stacks: 1 },
      { buffId: "silken-flow", stacks: 1, fallbackPotency: 260, fallbackSkillId: "fountain" },
    ],
    resourceChanges: [FEATHER_PROC, espritGain(5)],
  },
  {
    // 自身の周囲の範囲攻撃。減衰の記載なし
    id: "rising-windmill",
    gameActionId: 15995,
    potency: 160,
    traitPotencyOverrides: [{ traitLevel: 84, resourceChanges: [FEATHER_PROC, espritGain(10)] }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: risingWindmillIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 35,
    maxTargets: Infinity,
    forbiddenBuff: DANCING,
    buffConsumptionAnyOf: [
      { buffId: "flourishing-symmetry", stacks: 1 },
      { buffId: "silken-symmetry", stacks: 1, fallbackPotency: 120, fallbackSkillId: "windmill" },
    ],
    resourceChanges: [FEATHER_PROC, espritGain(5)],
  },
  {
    // 自身の周囲の範囲攻撃。減衰の記載なし
    id: "bloodshower",
    gameActionId: 15996,
    potency: 200,
    traitPotencyOverrides: [{ traitLevel: 84, resourceChanges: [FEATHER_PROC, espritGain(10)] }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: bloodshowerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 45,
    maxTargets: Infinity,
    forbiddenBuff: DANCING,
    buffConsumptionAnyOf: [
      { buffId: "flourishing-flow", stacks: 1 },
      { buffId: "silken-flow", stacks: 1, fallbackPotency: 160, fallbackSkillId: "bladeshower" },
    ],
    resourceChanges: [FEATHER_PROC, espritGain(5)],
  },

  // ============================================================
  // 3. ダンス
  // ============================================================
  {
    // ダンス中は回数ごとのフィニッシュに、フィニシングムーブ実行可ならフィニシングムーブに変化する
    id: "standard-step",
    gameActionId: 15997,
    potency: 0,
    type: "gcd",
    keepsCombo: true,
    target: "self",
    icon: standardStepIcon,
    recastTime: DANCE_GCD_RECAST,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
    cooldown: 30,
    cooldownGroup: "standard-step",
    forbiddenBuff: DANCING,
    buffApplications: ["standard-step", DANCING],
    autoTransform: [
      ...finishTransforms("standard-step", ["standard-finish", "single-standard-finish", "double-standard-finish"]),
      { buffId: "finishing-move-ready", skillId: "finishing-move" },
    ],
  },
  finish({
    id: "standard-finish",
    gameActionId: 16003,
    potency: 360,
    icon: standardFinishIcon,
    acquiredLevel: 15,
    removesBuffs: STANDARD_FINISH_REMOVES,
  }),
  finish({
    id: "single-standard-finish",
    gameActionId: 16191,
    potency: 540,
    icon: standardFinishIcon,
    acquiredLevel: 15,
    removesBuffs: STANDARD_FINISH_REMOVES,
    buffApplications: STANDARD_FINISH_BUFFS("standard-finish-1"),
  }),
  finish({
    id: "double-standard-finish",
    gameActionId: 16192,
    potency: 800,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 850 }],
    icon: standardFinishIcon,
    acquiredLevel: 15,
    removesBuffs: STANDARD_FINISH_REMOVES,
    buffApplications: STANDARD_FINISH_BUFFS("standard-finish-2"),
  }),
  {
    // フラリッシュで付くフィニシングムーブ実行可で、スタンダードステップから変化する。リキャストはスタンダードステップと共有
    id: "finishing-move",
    gameActionId: 36984,
    potency: 850,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: finishingMoveIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    hidden: true,
    cooldown: 30,
    cooldownGroup: "standard-step",
    maxTargets: Infinity,
    falloffRate: AOE_FALLOFF,
    forbiddenBuff: DANCING,
    buffConsumptions: [{ buffId: "finishing-move-ready", stacks: 1 }],
    buffApplications: STANDARD_FINISH_BUFFS("standard-finish-2"),
  },
  {
    // ダンス中は回数ごとのフィニッシュに、ティラナ実行可ならティラナに変化する
    id: "technical-step",
    gameActionId: 15998,
    potency: 0,
    type: "gcd",
    keepsCombo: true,
    target: "self",
    icon: technicalStepIcon,
    recastTime: DANCE_GCD_RECAST,
    fixedGcdRecast: true,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 70,
    cooldown: 120,
    forbiddenBuff: DANCING,
    buffApplications: ["technical-step", DANCING],
    autoTransform: [
      ...finishTransforms("technical-step", [
        "technical-finish",
        "single-technical-finish",
        "double-technical-finish",
        "triple-technical-finish",
        "quadruple-technical-finish",
      ]),
      { buffId: "flourishing-finish", skillId: "tillana" },
    ],
  },
  finish({
    id: "technical-finish",
    gameActionId: 16004,
    potency: 350,
    icon: technicalFinishIcon,
    acquiredLevel: 70,
    removesBuffs: TECHNICAL_FINISH_REMOVES,
  }),
  finish({
    id: "single-technical-finish",
    gameActionId: 16193,
    potency: 540,
    icon: technicalFinishIcon,
    acquiredLevel: 70,
    removesBuffs: TECHNICAL_FINISH_REMOVES,
    buffApplications: TECHNICAL_FINISH_BUFFS("technical-finish-1"),
  }),
  finish({
    id: "double-technical-finish",
    gameActionId: 16194,
    potency: 720,
    icon: technicalFinishIcon,
    acquiredLevel: 70,
    removesBuffs: TECHNICAL_FINISH_REMOVES,
    buffApplications: TECHNICAL_FINISH_BUFFS("technical-finish-2"),
  }),
  finish({
    id: "triple-technical-finish",
    gameActionId: 16195,
    potency: 900,
    icon: technicalFinishIcon,
    acquiredLevel: 70,
    removesBuffs: TECHNICAL_FINISH_REMOVES,
    buffApplications: TECHNICAL_FINISH_BUFFS("technical-finish-3"),
  }),
  finish({
    id: "quadruple-technical-finish",
    gameActionId: 16196,
    potency: 1200,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 1300 }],
    icon: technicalFinishIcon,
    acquiredLevel: 70,
    removesBuffs: TECHNICAL_FINISH_REMOVES,
    buffApplications: TECHNICAL_FINISH_BUFFS("technical-finish-4"),
  }),
  {
    // テクニカルフィニッシュで付くティラナ実行可で、テクニカルステップから変化する
    id: "tillana",
    gameActionId: 25790,
    potency: 600,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: tillanaIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    hidden: true,
    maxTargets: Infinity,
    falloffRate: AOE_FALLOFF,
    forbiddenBuff: DANCING,
    buffConsumptions: [{ buffId: "flourishing-finish", stacks: 1 }],
    resourceChanges: [{ resourceId: "esprit", amount: 50 }],
  },
  step("emboite", 15999, emboiteIcon),
  step("entrechat", 16000, entrechatIcon),
  step("jete", 16001, jeteIcon),
  step("pirouette", 16002, pirouetteIcon),

  // ============================================================
  // 4. エスプリ・実行可のバフで撃つ WS
  // ============================================================
  {
    // 暁の舞い実行可かつエスプリ 50 以上なら暁の舞いに変化する
    id: "saber-dance",
    gameActionId: 16005,
    potency: 500,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 540 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: saberDanceIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 76,
    maxTargets: Infinity,
    falloffRate: AOE_FALLOFF,
    forbiddenBuff: DANCING,
    resourceChanges: [{ resourceId: "esprit", amount: -50 }],
    autoTransform: [
      {
        buffId: "dance-of-the-dawn-ready",
        resourceConditions: [{ resourceId: "esprit", minAmount: 50 }],
        skillId: "dance-of-the-dawn",
      },
    ],
  },
  {
    id: "dance-of-the-dawn",
    gameActionId: 36985,
    potency: 1000,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: danceOfTheDawnIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    hidden: true,
    maxTargets: Infinity,
    falloffRate: AOE_FALLOFF,
    forbiddenBuff: DANCING,
    buffConsumptions: [{ buffId: "dance-of-the-dawn-ready", stacks: 1 }],
    resourceChanges: [{ resourceId: "esprit", amount: -50 }],
  },
  {
    // 前方直線範囲。必ずクリティカルかつダイレクトヒット。2 体目以降は威力 75% 減
    id: "starfall-dance",
    gameActionId: 25792,
    potency: 600,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: starfallDanceIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 90,
    maxTargets: Infinity,
    falloffRate: 0.75,
    guaranteedCrit: true,
    guaranteedDh: true,
    forbiddenBuff: DANCING,
    buffConsumptions: [{ buffId: "flourishing-starfall", stacks: 1 }],
  },
  {
    id: "last-dance",
    gameActionId: 36983,
    potency: 540,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: lastDanceIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 92,
    maxTargets: Infinity,
    falloffRate: AOE_FALLOFF,
    forbiddenBuff: DANCING,
    buffConsumptions: [{ buffId: "last-dance-ready", stacks: 1 }],
  },

  // ============================================================
  // 5. アビリティ
  // ============================================================
  {
    // フェザーを 1 つ使う。フェザーがあった確率を威力に掛け、扇の舞い【急】実行可の付与率にも掛ける
    id: "fan-dance",
    gameActionId: 16007,
    potency: 150,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 180 }],
    type: "ogcd",
    target: "enemy",
    icon: fanDanceIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    cooldown: 1,
    forbiddenBuff: DANCING,
    resourceChanges: [{ resourceId: "dnc-feather", amount: -1 }],
    buffApplications: ["threefold-fan-dance"],
    buffApplicationProcRates: { "threefold-fan-dance": 0.5 },
  },
  {
    // 自身の周囲の範囲攻撃。減衰の記載なし
    id: "fan-dance-ii",
    gameActionId: 16008,
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: fanDanceIIIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 50,
    cooldown: 1,
    maxTargets: Infinity,
    forbiddenBuff: DANCING,
    resourceChanges: [{ resourceId: "dnc-feather", amount: -1 }],
    buffApplications: ["threefold-fan-dance"],
    buffApplicationProcRates: { "threefold-fan-dance": 0.5 },
  },
  {
    // 扇の舞い【急】実行可が付いている確率を掛けた期待値で撃つ（付いていなければ撃たない = 威力 0）
    id: "fan-dance-iii",
    gameActionId: 16009,
    potency: 200,
    traitPotencyOverrides: [
      {
        traitLevel: 94,
        potency: 220,
        buffConsumptionAnyOf: [{ buffId: "threefold-fan-dance", stacks: 1, fallbackPotency: 0 }],
      },
    ],
    type: "ogcd",
    target: "enemy",
    icon: fanDanceIIIIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 66,
    cooldown: 1,
    maxTargets: Infinity,
    falloffRate: AOE_FALLOFF,
    forbiddenBuff: DANCING,
    buffConsumptionAnyOf: [{ buffId: "threefold-fan-dance", stacks: 1, fallbackPotency: 0 }],
  },
  {
    // 前方扇範囲
    id: "fan-dance-iv",
    gameActionId: 25791,
    potency: 300,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 460 }],
    type: "ogcd",
    target: "enemy",
    icon: fanDanceIVIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 86,
    cooldown: 1,
    maxTargets: Infinity,
    falloffRate: AOE_FALLOFF,
    forbiddenBuff: DANCING,
    buffConsumptions: [{ buffId: "fourfold-fan-dance", stacks: 1 }],
  },
  {
    id: "devilment",
    gameActionId: 16011,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: devilmentIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 62,
    cooldown: 120,
    forbiddenBuff: DANCING,
    buffApplications: ["devilment", "flourishing-starfall"],
  },
  {
    id: "flourish",
    gameActionId: 16013,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: flourishIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    cooldown: 60,
    forbiddenBuff: DANCING,
    buffApplications: [
      "flourishing-symmetry",
      "flourishing-flow",
      "threefold-fan-dance",
      "fourfold-fan-dance",
      "finishing-move-ready",
    ],
  },
];
