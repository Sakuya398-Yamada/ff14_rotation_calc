import type { Skill } from "../types/skill";

import hardSlashIcon from "../assets/icons/drk/Hard_Slash.png";
import syphonStrikeIcon from "../assets/icons/drk/Syphon_Strike.png";
import souleaterIcon from "../assets/icons/drk/Souleater.png";
import unleashIcon from "../assets/icons/drk/Unleash.png";
import stalwartSoulIcon from "../assets/icons/drk/Stalwart_Soul.png";
import unmendIcon from "../assets/icons/drk/Unmend.png";
import bloodspillerIcon from "../assets/icons/drk/Bloodspiller.png";
import quietusIcon from "../assets/icons/drk/Quietus.png";
import scarletDeliriumIcon from "../assets/icons/drk/Scarlet_Delirium.png";
import comeuppanceIcon from "../assets/icons/drk/Comeuppance.png";
import torcleaverIcon from "../assets/icons/drk/Torcleaver.png";
import impalementIcon from "../assets/icons/drk/Impalement.png";
import disesteemIcon from "../assets/icons/drk/Disesteem.png";
import edgeOfDarknessIcon from "../assets/icons/drk/Edge_of_Darkness.png";
import floodOfDarknessIcon from "../assets/icons/drk/Flood_of_Darkness.png";
import edgeOfShadowIcon from "../assets/icons/drk/Edge_of_Shadow.png";
import floodOfShadowIcon from "../assets/icons/drk/Flood_of_Shadow.png";
import deliriumIcon from "../assets/icons/drk/Delirium.png";
import livingShadowIcon from "../assets/icons/drk/Living_Shadow.png";
import saltedEarthIcon from "../assets/icons/drk/Salted_Earth.png";
import saltAndDarknessIcon from "../assets/icons/drk/Salt_and_Darkness.png";
import abyssalDrainIcon from "../assets/icons/drk/Abyssal_Drain.png";
import carveAndSpitIcon from "../assets/icons/drk/Carve_and_Spit.png";
import shadowbringerIcon from "../assets/icons/drk/Shadowbringer.png";

const GCD_RECAST = 2.5;
const DEFAULT_ANIMATION_LOCK = 0.65;

const mp = (amount: number) => ({ resourceId: "mp", amount });
const blood = (amount: number) => ({ resourceId: "blackblood", amount });
/** 暗黒の剣・暗黒の波動（変化後の漆黒の剣・漆黒の波動も）は 1 秒のリキャストを共有する */
const EDGE_FLOOD = { cooldown: 1, cooldownGroup: "edge-flood" };
/** カーヴ・アンド・スピットとアビサルドレインは 60 秒のリキャストを共有する */
const CARVE_DRAIN = { cooldown: 60, cooldownGroup: "carve-and-spit" };
/** デリリアムのコンボ（レッドデリリアム → カマパンス → トアクリーバー）の段のバフ。インペイルメントで途切れる */
const DELIRIUM_COMBO_BUFFS = ["comeuppance-ready", "torcleaver-ready"];

/**
 * 暗黒騎士（DRK）攻撃スキル定義（Lv100まで）
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#865 で照合。7.5〜7.57 に暗黒騎士の PvE 調整は無い）。
 * 公式ジョブガイド（Patch 7.5 表記）とも照合済みで、既知の差分なし
 * アクション威力アップ（Lv84）・アクション威力アップII（Lv94）による変動は traitPotencyOverrides で定義し、基本値は特性修得前の値にする
 * （中国版クライアントのレベル条件付きの説明文と consolegameswiki の Notes で照合。カーヴ・アンド・スピットの 510 → 540 は 7.05 のパッチノート）
 * MP の回復量は公式に記載が無いので、consolegameswiki と The Balance の値（サイフォンストライク・ストルワートソウル・カーヴ・アンド・スピット・
 * アビサルドレイン 600、レッドデリリアム・カマパンス・トアクリーバー 200、インペイルメント 500）
 * 計算の対象外: グリットスタンス・ロールアクション・軽減と回復のアビリティ・ブラックナイトとダークアーツ（バリアの成否が被ダメージで決まる）・
 * シャドウストライド（突進。威力なし）。Lv68〜95 のデリリアム中のブラッドスピラー・クワイタスの MP 回復（量の記載が無い）
 *
 * 大別:
 * 1. 単体 WS コンボ（ハードスラッシュ → サイフォンストライク → ソウルイーター）
 * 2. 範囲コンボ（アンリーシュ → ストルワートソウル）・アンメンド
 * 3. ブラックブラッド消費（ブラッドスピラー・クワイタス）とデリリアム中の変化先（レッドデリリアム → カマパンス → トアクリーバー、インペイルメント）・ディセスティーム
 * 4. MP 消費（暗黒の剣・暗黒の波動 → 漆黒の剣・漆黒の波動。暗黒を付与・延長）
 * 5. その他のアビリティ（ブラッドデリリアム・影身具現・ソルトアース・ソルト・アンド・ダーク・アビサルドレイン・カーヴ・アンド・スピット・シャドウブリンガー）
 *
 * デリリアムのコンボはメインのコンボとは別に進むので、段のバフ（drk-buffs.ts）でつなぎ、keepsCombo を付ける
 */
export const DRK_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // 1. 単体 WS コンボ
  // ============================================================
  {
    id: "hard-slash",
    potency: 150,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 180 },
      { traitLevel: 94, potency: 300 },
    ],
    type: "gcd",
    target: "enemy",
    icon: hardSlashIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
  },
  {
    id: "syphon-strike",
    potency: 240,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 260, nonComboPotency: 120 },
      { traitLevel: 94, potency: 380, nonComboPotency: 240 },
    ],
    type: "gcd",
    target: "enemy",
    icon: syphonStrikeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 2,
    comboFrom: ["hard-slash"],
    comboResourceChanges: [mp(600)],
  },
  {
    id: "souleater",
    potency: 320,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 360, nonComboPotency: 140 },
      { traitLevel: 94, potency: 480, nonComboPotency: 260 },
    ],
    type: "gcd",
    target: "enemy",
    icon: souleaterIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 26,
    comboFrom: ["syphon-strike"],
    comboResourceChanges: [blood(20)],
  },

  // ============================================================
  // 2. 範囲コンボ・アンメンド
  // ============================================================
  {
    id: "unleash",
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: unleashIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 6,
    // 自身の周囲の敵にヒット、減衰なし
    maxTargets: Infinity,
  },
  {
    id: "stalwart-soul",
    potency: 140,
    nonComboPotency: 100,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 160, nonComboPotency: 120 }],
    type: "gcd",
    target: "enemy",
    icon: stalwartSoulIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 40,
    comboFrom: ["unleash"],
    comboResourceChanges: [mp(600), blood(20)],
    maxTargets: Infinity,
  },
  {
    // 遠隔攻撃の魔法。シャドウストライドのリキャスト短縮（Lv84）は、シャドウストライドが計算の対象外なので表さない
    id: "unmend",
    potency: 150,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: unmendIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
  },

  // ============================================================
  // 3. ブラックブラッド消費・デリリアム中の変化先・ディセスティーム
  // ============================================================
  {
    // デリリアム中は、Lv68〜95 ではブラックブラッドを消費せずに使え（drk-buffs.ts）、Lv96 からはレッドデリリアムに変化する
    id: "bloodspiller",
    potency: 500,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 600 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: bloodspillerIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 62,
    resourceChanges: [blood(-50)],
    autoTransform: [{ buffId: "delirium", skillId: "scarlet-delirium" }],
  },
  {
    id: "quietus",
    potency: 200,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 240 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: quietusIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 64,
    resourceChanges: [blood(-50)],
    autoTransform: [{ buffId: "delirium", skillId: "impalement" }],
    maxTargets: Infinity,
  },
  {
    // デリリアム中のブラッドスピラーの変化先。使うと段のバフでカマパンス → トアクリーバーに変化する。
    // デリリアムのスタックは drk-buffs.ts の consumeOnGcd で 1 つ消費する（変化先の 3 つとインペイルメントで計 3 回）
    id: "scarlet-delirium",
    potency: 620,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: scarletDeliriumIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    hidden: true,
    resourceChanges: [mp(200)],
    buffApplications: ["comeuppance-ready"],
    autoTransform: [
      { buffId: "torcleaver-ready", skillId: "torcleaver" },
      { buffId: "comeuppance-ready", skillId: "comeuppance" },
    ],
  },
  {
    id: "comeuppance",
    potency: 720,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: comeuppanceIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    hidden: true,
    comboFromBuff: { buffId: "comeuppance-ready", required: true },
    resourceChanges: [mp(200)],
    buffApplications: ["torcleaver-ready"],
  },
  {
    id: "torcleaver",
    potency: 820,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: torcleaverIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    hidden: true,
    comboFromBuff: { buffId: "torcleaver-ready", required: true },
    resourceChanges: [mp(200)],
    removesBuffs: ["torcleaver-ready"],
  },
  {
    // デリリアム中のクワイタスの変化先。デリリアムのコンボ（レッドデリリアム → カマパンス → トアクリーバー）を途切れさせる
    id: "impalement",
    potency: 300,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: impalementIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 96,
    hidden: true,
    resourceChanges: [mp(500)],
    removesBuffs: DELIRIUM_COMBO_BUFFS,
    maxTargets: Infinity,
  },
  {
    // 影身具現で付く「ディセスティーム実行可」を消費する
    id: "disesteem",
    potency: 1000,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: disesteemIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    buffConsumptions: [{ buffId: "scorn", stacks: 1 }],
    // 前方直線範囲、2体目以降は威力25%減
    maxTargets: Infinity,
    falloffRate: 0.25,
  },

  // ============================================================
  // 4. MP 消費（暗黒の付与・延長）
  // ============================================================
  {
    // 暗黒は効果中に付け直すと 30 秒延長、上限 60 秒（drk-buffs.ts の maxDuration）
    id: "edge-of-darkness",
    potency: 300,
    type: "ogcd",
    target: "enemy",
    icon: edgeOfDarknessIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...EDGE_FLOOD,
    acquiredLevel: 40,
    resourceChanges: [mp(-3000)],
    buffApplications: ["darkside"],
  },
  {
    id: "flood-of-darkness",
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: floodOfDarknessIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...EDGE_FLOOD,
    acquiredLevel: 30,
    resourceChanges: [mp(-3000)],
    buffApplications: ["darkside"],
    // 前方直線範囲、減衰なし
    maxTargets: Infinity,
  },
  {
    id: "edge-of-shadow",
    potency: 460,
    type: "ogcd",
    target: "enemy",
    icon: edgeOfShadowIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...EDGE_FLOOD,
    acquiredLevel: 74,
    replacesSkillId: "edge-of-darkness",
    resourceChanges: [mp(-3000)],
    buffApplications: ["darkside"],
  },
  {
    id: "flood-of-shadow",
    potency: 160,
    type: "ogcd",
    target: "enemy",
    icon: floodOfShadowIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...EDGE_FLOOD,
    acquiredLevel: 74,
    replacesSkillId: "flood-of-darkness",
    resourceChanges: [mp(-3000)],
    buffApplications: ["darkside"],
    maxTargets: Infinity,
  },

  // ============================================================
  // 5. その他のアビリティ
  // ============================================================
  {
    // ブラッドデリリアム（3 スタック）とブラッドウェポン（3 スタック）を付与する。Lv68 でブラッドウェポンから変化（Lv70 からを扱うので、変化前は定義しない）
    id: "delirium",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: deliriumIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 68,
    buffApplications: ["delirium", "blood-weapon"],
  },
  {
    // 英雄の影身は使用の約 6.8 秒後から約 2.18 秒おきに 5 回攻撃する（The Balance）。時間差の攻撃を表す仕組みが無いので、
    // 5 回分の合計を使用時の威力にまとめて計上する近似（ダメージの時刻は実機より 6.8〜17.7 秒早い。範囲攻撃も 1 体分）。
    // Lv100 は アビサルドレイン 420・シャドウブリンガー 570・漆黒の剣 420・ブラッドスピラー 420・ディセスティーム 620 で計 2450。
    // Lv88 で 1 回の威力が 340 → 420、Lv90 で 3 回目が漆黒の波動からシャドウブリンガー（570）に、Lv100 で 5 回目がカーヴ・アンド・スピットから
    // ディセスティーム（620）に変わる（中国版クライアントの説明文・The Balance）。分身には暗黒が乗らない（drk-buffs.ts の暗黒の対象から外す）
    id: "living-shadow",
    potency: 1700,
    traitPotencyOverrides: [
      { traitLevel: 88, potency: 2100 },
      { traitLevel: 90, potency: 2250 },
      { traitLevel: 100, potency: 2450 },
    ],
    type: "ogcd",
    target: "enemy",
    icon: livingShadowIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 120,
    acquiredLevel: 80,
    // ディセスティーム実行可は Lv100 から付く（バフの acquiredLevel）
    buffApplications: ["scorn"],
  },
  {
    // 足元の設置範囲に 15 秒。置いた瞬間に 1 回入り、そのあと 3 秒おきに 5 回（The Balance・consolegameswiki）。
    // 置いた瞬間の 1 回を直接の威力、残りを DoT で表す（DoT は 1 体分）。効果中はソルト・アンド・ダークを使える
    id: "salted-earth",
    potency: 50,
    type: "ogcd",
    target: "enemy",
    icon: saltedEarthIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 90,
    acquiredLevel: 52,
    dotPotency: 50,
    dotDuration: 15,
    buffApplications: ["salted-earth"],
    maxTargets: Infinity,
  },
  {
    id: "salt-and-darkness",
    potency: 500,
    type: "ogcd",
    target: "enemy",
    icon: saltAndDarknessIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 20,
    acquiredLevel: 86,
    requiredBuff: "salted-earth",
    // ソルトアースの範囲内の敵にヒット、2体目以降は威力25%減
    maxTargets: Infinity,
    falloffRate: 0.25,
  },
  {
    id: "abyssal-drain",
    potency: 240,
    type: "ogcd",
    target: "enemy",
    icon: abyssalDrainIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CARVE_DRAIN,
    acquiredLevel: 56,
    resourceChanges: [mp(600)],
    // 対象を中心に範囲、減衰なし
    maxTargets: Infinity,
  },
  {
    id: "carve-and-spit",
    potency: 510,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 540 }],
    type: "ogcd",
    target: "enemy",
    icon: carveAndSpitIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CARVE_DRAIN,
    acquiredLevel: 60,
    resourceChanges: [mp(600)],
  },
  {
    id: "shadowbringer",
    potency: 600,
    type: "ogcd",
    target: "enemy",
    icon: shadowbringerIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    maxCharges: 2,
    acquiredLevel: 90,
    requiredBuff: "darkside",
    // 前方直線範囲、2体目以降は威力25%減
    maxTargets: Infinity,
    falloffRate: 0.25,
  },
];

/** ブラッドウェポン・ブラッドデリリアムの対象（ウェポンスキルと魔法。変化先を含む全 GCD） */
export const DRK_GCD_IDS = DRK_ATTACK_SKILLS.filter((s) => s.type === "gcd").map((s) => s.id);

/** 暗黒（与ダメージ上昇）の対象。英雄の影身の攻撃（影身具現）には乗らない（The Balance） */
export const DRK_DARKSIDE_TARGET_IDS = DRK_ATTACK_SKILLS.filter((s) => s.id !== "living-shadow").map((s) => s.id);
