import type { DelayedHit, Skill } from "../types/skill";

import heatedSplitShotIcon from "../assets/icons/mch/Heated_Split_Shot.png";
import heatedSlugShotIcon from "../assets/icons/mch/Heated_Slug_Shot.png";
import heatedCleanShotIcon from "../assets/icons/mch/Heated_Clean_Shot.png";
import spreadShotIcon from "../assets/icons/mch/Spread_Shot.png";
import scattergunIcon from "../assets/icons/mch/Scattergun.png";
import hotShotIcon from "../assets/icons/mch/Hot_Shot.png";
import airAnchorIcon from "../assets/icons/mch/Air_Anchor.png";
import drillIcon from "../assets/icons/mch/Drill.png";
import bioblasterIcon from "../assets/icons/mch/Bioblaster.png";
import chainSawIcon from "../assets/icons/mch/Chain_Saw.png";
import excavatorIcon from "../assets/icons/mch/Excavator.png";
import fullMetalFieldIcon from "../assets/icons/mch/Full_Metal_Field.png";
import hyperchargeIcon from "../assets/icons/mch/Hypercharge.png";
import blazingShotIcon from "../assets/icons/mch/Blazing_Shot.png";
import autoCrossbowIcon from "../assets/icons/mch/Auto_Crossbow.png";
import reassembleIcon from "../assets/icons/mch/Reassemble.png";
import gaussRoundIcon from "../assets/icons/mch/Gauss_Round.png";
import ricochetIcon from "../assets/icons/mch/Ricochet.png";
import doubleCheckIcon from "../assets/icons/mch/Double_Check.png";
import checkmateIcon from "../assets/icons/mch/Checkmate.png";
import wildfireIcon from "../assets/icons/mch/Wildfire.png";
import barrelStabilizerIcon from "../assets/icons/mch/Barrel_Stabilizer.png";
import rookAutoturretIcon from "../assets/icons/mch/Rook_Autoturret.png";
import automatonQueenIcon from "../assets/icons/mch/Automaton_Queen.png";

const GCD_RECAST = 2.5;
/** ブレイズショット・オートボウガンは 1.5 秒の GCD */
const OVERHEATED_GCD_RECAST = 1.5;
const DEFAULT_ANIMATION_LOCK = 0.65;

const heat = (amount: number) => ({ resourceId: "heat", amount });
const battery = (amount: number) => ({ resourceId: "battery", amount });
/** ガウスラウンドとダブルチェック（Lv92 で変化）は同じリキャスト。ブレイズショットはこのキーで縮める */
const GAUSS_ROUND = { cooldown: 30, cooldownGroup: "double-check" };
/** リコシェットとチェックメイト（Lv92 で変化）は同じリキャスト */
const RICOCHET = { cooldown: 30, cooldownGroup: "checkmate" };
/** ドリルとバイオブラストはリキャストを共有する */
const DRILL = { cooldown: 20, cooldownGroup: "drill" };

/**
 * ペットの攻撃の威力は、召喚したときに消費したバッテリーに比例する（50 で最低、100 で最大 = 最低の 2 倍。#958）。
 * potency は最大の威力（パレットの表示用）
 */
const petHit = (delay: number, minPotency: number): DelayedHit => ({
  delay,
  potency: minPotency * 2,
  potencyScaling: { resourceId: "battery", minAmount: 50, minPotency, maxAmount: 100, maxPotency: minPotency * 2 },
});
/**
 * オートマトン・クイーンの攻撃の、使用からの秒数（xivgear の機工士のシミュレーター）。ローラーダッシュ（GCD 2 回分）→ アームパンチ ×3 →
 * パイルバンカー → クイーン・コレダー（Lv86 から）。攻撃の回数はバッテリーに関わらず同じ（パッチ 6.2 で稼働時間が 12 秒に固定）
 */
const queenHits = (withCrownedCollider: boolean): DelayedHit[] => [
  petHit(5.6, 240),
  petHit(8.6, 120),
  petHit(10.1, 120),
  petHit(11.6, 120),
  petHit(13.6, 340),
  ...(withCrownedCollider ? [petHit(16.1, 390)] : []),
];
/**
 * オートタレット・ルークの攻撃（ボレーファイア ×4 → オーバーロード・ルーク）。回数は The Balance のレベリングガイド
 * （「9 秒で最大 620。ボレーファイア 1 回最大 75、オーバーロード最大 320」）から読んだ。各攻撃の時刻は出典が無いので、
 * 稼働 9 秒のあいだ 2 秒おきに撃ち、稼働の終わりにオーバーロードを撃つと推定した。最大は日本語版のツールチップの 70（英語版は 75）
 */
const ROOK_HITS: DelayedHit[] = [petHit(2, 35), petHit(4, 35), petHit(6, 35), petHit(8, 35), petHit(9, 160)];

/** ワイルドファイア: 効果中（10 秒）に当てた WS 1 回ごとの威力（6 回まで）が、効果の終わりに入る */
const wildfireHit = (potencyPerWeaponskill: number): DelayedHit => ({
  delay: 10,
  potency: potencyPerWeaponskill * 6,
  potencyPerWeaponskill: { potency: potencyPerWeaponskill, maxCount: 6 },
  snapshotAtUse: true,
  noCritDh: true,
});

/**
 * 機工士（MCH）攻撃スキル定義（Lv100まで）
 * パッチノートの PvE ジョブ調整は 7.58 まで反映済み（#958 で照合。7.5〜7.58 に機工士の PvE 調整は無い）。
 * 公式ジョブガイド（Patch 7.5、7.55 表記）とも照合済みで、既知の差分なし
 * アクション威力アップ（Lv84）・アクション威力アップII（Lv94）・ワイルドファイア効果アップ（Lv78）などによる変動は traitPotencyOverrides で定義し、
 * 基本値は特性修得前の値にする（パッチノートの「修得時の威力」と consolegameswiki の Notes で照合。ブレイズショットの Lv94 未満の 220 は、
 * 7.1 の「220 → 240」が特性アクション威力アップIIの値の変更であること（同 wiki の特性ページの 7.1 の履歴）から決めた）
 * Lv70 未満で上位版に変わるスキル（スプリットショット・スラッグショット・クリーンショット・ヒートブラスト）は定義しない
 * 計算の対象外: タクティシャン・ウェポンブレイク・ロールアクション・フレイムスロアー（使い続ける行動）・
 * オーバードライブ・ルーク／クイーン、デトネーター（途中で打ち切る操作）・オートアタック
 *
 * 大別:
 * 1. 単体 WS コンボ（ヒートスプリットショット → ヒートスラッグショット → ヒートクリーンショット）
 * 2. 範囲 WS（スプレッドショット／スキャッターガン・バイオブラスト）
 * 3. ツール（ホットショット／エアアンカー・ドリル・回転のこぎり → エクスカベーター・フルメタルバースト）
 * 4. ハイパーチャージ（ハイパーチャージ・ブレイズショット・オートボウガン）
 * 5. アビリティ（整備・ガウスラウンド／ダブルチェック・リコシェット／チェックメイト・ワイルドファイア・バレルヒーター）
 * 6. ペット（オートタレット・ルーク／オートマトン・クイーン。攻撃は時間差の攻撃で入る）
 *
 * コンボ以外の GCD はすべて keepsCombo（コンボを途切れさせない）
 */
export const MCH_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // 1. 単体 WS コンボ
  // ============================================================
  {
    id: "heated-split-shot",
    gameActionId: 7411,
    potency: 180,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 200 },
      { traitLevel: 94, potency: 220 },
    ],
    type: "gcd",
    target: "enemy",
    icon: heatedSplitShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    resourceChanges: [heat(5)],
  },
  {
    id: "heated-slug-shot",
    gameActionId: 7412,
    potency: 280,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 300, nonComboPotency: 120 },
      { traitLevel: 94, potency: 320, nonComboPotency: 140 },
    ],
    type: "gcd",
    target: "enemy",
    icon: heatedSlugShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    comboFrom: ["heated-split-shot"],
    comboResourceChanges: [heat(5)],
  },
  {
    id: "heated-clean-shot",
    gameActionId: 7413,
    potency: 360,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 380, nonComboPotency: 120 },
      { traitLevel: 94, potency: 420, nonComboPotency: 160 },
    ],
    type: "gcd",
    target: "enemy",
    icon: heatedCleanShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    comboFrom: ["heated-slug-shot"],
    comboResourceChanges: [heat(5), battery(10)],
  },

  // ============================================================
  // 2. 範囲 WS
  // ============================================================
  {
    // 前方扇範囲。減衰の記載なし
    id: "spread-shot",
    gameActionId: 2870,
    potency: 110,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: spreadShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 18,
    maxTargets: Infinity,
    resourceChanges: [heat(5)],
  },
  {
    id: "scattergun",
    gameActionId: 25786,
    potency: 130,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: scattergunIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 82,
    replacesSkillId: "spread-shot",
    maxTargets: Infinity,
    resourceChanges: [heat(10)],
  },
  {
    // 前方扇範囲（減衰の記載なし）に継続ダメージ（DoT は 1 体分）。リキャストをドリルと共有し、Lv94 から 2 チャージ
    id: "bioblaster",
    gameActionId: 16499,
    potency: 50,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: bioblasterIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...DRILL,
    traitPotencyOverrides: [{ traitLevel: 94, maxCharges: 2 }],
    acquiredLevel: 72,
    maxTargets: Infinity,
    dotPotency: 50,
    dotDuration: 15,
  },

  // ============================================================
  // 3. ツール
  // ============================================================
  {
    id: "hot-shot",
    gameActionId: 2872,
    potency: 240,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: hotShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    acquiredLevel: 4,
    resourceChanges: [battery(20)],
  },
  {
    id: "air-anchor",
    gameActionId: 16500,
    potency: 620,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 660 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: airAnchorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 40,
    acquiredLevel: 76,
    replacesSkillId: "hot-shot",
    resourceChanges: [battery(20)],
  },
  {
    // リキャストをバイオブラストと共有し、Lv94 から 2 チャージ
    id: "drill",
    gameActionId: 16498,
    potency: 620,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 660, maxCharges: 2 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: drillIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...DRILL,
    acquiredLevel: 58,
  },
  {
    // 前方直線範囲。2 体目以降は威力 25% 減。エクスカベーター実行可は Lv96 から付く（バフの acquiredLevel）
    id: "chain-saw",
    gameActionId: 25788,
    potency: 620,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 660 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: chainSawIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 90,
    maxTargets: Infinity,
    falloffRate: 0.25,
    resourceChanges: [battery(20)],
    buffApplications: ["excavator-ready"],
    autoTransform: [{ buffId: "excavator-ready", skillId: "excavator" }],
  },
  {
    // 回転のこぎりの変化先。対象とその周囲に範囲攻撃。2 体目以降は威力 25% 減。回転のこぎりのリキャストは使わない
    id: "excavator",
    gameActionId: 36981,
    potency: 660,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: excavatorIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    hidden: true,
    maxTargets: Infinity,
    falloffRate: 0.25,
    buffConsumptions: [{ buffId: "excavator-ready", stacks: 1 }],
    resourceChanges: [battery(20)],
  },
  {
    // 必ずクリティカルかつダイレクトヒット。整備の効果対象にならない（mch-buffs.ts の整備の対象に入れない）。2 体目以降は威力 25% 減
    id: "full-metal-field",
    gameActionId: 36982,
    potency: 900,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: fullMetalFieldIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    maxTargets: Infinity,
    falloffRate: 0.25,
    guaranteedCrit: true,
    guaranteedDh: true,
    buffConsumptions: [{ buffId: "full-metal-machinist", stacks: 1 }],
  },

  // ============================================================
  // 4. ハイパーチャージ
  // ============================================================
  {
    // ハイパーチャージ実行可（バレルヒーター）があれば、ヒートを使わずにバフを消費する
    id: "hypercharge",
    gameActionId: 17209,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: hyperchargeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 10,
    acquiredLevel: 30,
    resourceChanges: [heat(-50)],
    buffSkippableResource: { buffId: "hypercharged", resourceId: "heat" },
    buffApplications: ["overheated"],
  },
  {
    // オーバーヒートのスタックを 1 つ使う（オーバーヒートの consumeOnGcd）。Lv92 未満はガウスラウンド・リコシェット、
    // Lv92 からはダブルチェック・チェックメイトのリキャストを 15 秒縮める（どちらも同じ cooldownGroup）
    id: "blazing-shot",
    gameActionId: 36978,
    potency: 220,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 240 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: blazingShotIcon,
    recastTime: OVERHEATED_GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 68,
    requiredBuff: "overheated",
    cooldownReductionsOnUse: [
      { chargeKey: "double-check", seconds: 15 },
      { chargeKey: "checkmate", seconds: 15 },
    ],
  },
  {
    // 前方扇範囲（減衰の記載なし）。オーバーヒートのスタックを 1 つ使うが、威力 +20 は乗らない（範囲の WS）
    id: "auto-crossbow",
    gameActionId: 16497,
    potency: 140,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 180 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: autoCrossbowIcon,
    recastTime: OVERHEATED_GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 52,
    maxTargets: Infinity,
    requiredBuff: "overheated",
  },

  // ============================================================
  // 5. アビリティ
  // ============================================================
  {
    // Lv84 から 2 チャージ（特性整備効果アップ）
    id: "reassemble",
    gameActionId: 2876,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: reassembleIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 55,
    traitPotencyOverrides: [{ traitLevel: 84, maxCharges: 2 }],
    acquiredLevel: 10,
    buffApplications: ["reassembled"],
  },
  {
    // Lv74 から 3 チャージ（特性チャージアクション効果アップ）
    id: "gauss-round",
    gameActionId: 2874,
    potency: 130,
    type: "ogcd",
    target: "enemy",
    icon: gaussRoundIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...GAUSS_ROUND,
    maxCharges: 2,
    traitPotencyOverrides: [{ traitLevel: 74, maxCharges: 3 }],
    acquiredLevel: 15,
  },
  {
    // 対象とその周囲に範囲攻撃。2 体目以降は威力 30% 減。Lv74 から 3 チャージ
    id: "ricochet",
    gameActionId: 2890,
    potency: 130,
    type: "ogcd",
    target: "enemy",
    icon: ricochetIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...RICOCHET,
    maxCharges: 2,
    traitPotencyOverrides: [{ traitLevel: 74, maxCharges: 3 }],
    acquiredLevel: 50,
    maxTargets: Infinity,
    falloffRate: 0.3,
  },
  {
    id: "double-check",
    gameActionId: 36979,
    potency: 180,
    type: "ogcd",
    target: "enemy",
    icon: doubleCheckIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...GAUSS_ROUND,
    maxCharges: 3,
    acquiredLevel: 92,
    replacesSkillId: "gauss-round",
    maxTargets: Infinity,
    falloffRate: 0.3,
  },
  {
    id: "checkmate",
    gameActionId: 36980,
    potency: 180,
    type: "ogcd",
    target: "enemy",
    icon: checkmateIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...RICOCHET,
    maxCharges: 3,
    acquiredLevel: 92,
    replacesSkillId: "ricochet",
    maxTargets: Infinity,
    falloffRate: 0.3,
  },
  {
    // 効果中（10 秒）に当てた WS の回数（6 回まで）で、効果の終わりの威力が決まる。威力のバフは使ったときの状態で決まり
    // （The Balance。内部では DoT と同じ扱い）、クリティカル・ダイレクトヒットは発生しない（consolegameswiki）。
    // 1 回ごとの威力は Lv78 未満 100（特性ワイルドファイア効果アップ）
    id: "wildfire",
    gameActionId: 2878,
    potency: 0,
    delayedHits: [wildfireHit(100)],
    traitPotencyOverrides: [{ traitLevel: 78, delayedHits: [wildfireHit(240)] }],
    type: "ogcd",
    target: "enemy",
    icon: wildfireIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 45,
    buffApplications: ["wildfire"],
  },
  {
    // フルメタルバースト実行可は Lv100 から付く（バフの acquiredLevel）。戦闘中しか使えない条件は表さない
    id: "barrel-stabilizer",
    gameActionId: 7414,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: barrelStabilizerIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 66,
    buffApplications: ["hypercharged", "full-metal-machinist"],
  },

  // ============================================================
  // 6. ペット（バッテリー 50 以上で全消費。攻撃の威力は消費したバッテリーに比例する）
  // ============================================================
  {
    // 動いている間の再召喚は止めない（リキャスト 6 秒のまま）
    id: "rook-autoturret",
    gameActionId: 2864,
    potency: 0,
    delayedHits: ROOK_HITS,
    type: "ogcd",
    target: "enemy",
    icon: rookAutoturretIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 6,
    acquiredLevel: 40,
    resourceChanges: [battery(-50)],
    consumeAllOfResource: "battery",
  },
  {
    // 動いている間の再召喚は止めない（リキャスト 6 秒のまま）。クイーン・コレダーは Lv86 から（特性クイーンズ・ガンビット）
    id: "automaton-queen",
    gameActionId: 16501,
    potency: 0,
    delayedHits: queenHits(false),
    traitPotencyOverrides: [{ traitLevel: 86, delayedHits: queenHits(true) }],
    type: "ogcd",
    target: "enemy",
    icon: automatonQueenIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 6,
    acquiredLevel: 80,
    replacesSkillId: "rook-autoturret",
    resourceChanges: [battery(-50)],
    consumeAllOfResource: "battery",
  },
];
