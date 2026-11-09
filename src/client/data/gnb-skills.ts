import type { Skill } from "../types/skill";

import keenEdgeIcon from "../assets/icons/gnb/Keen_Edge.png";
import brutalShellIcon from "../assets/icons/gnb/Brutal_Shell.png";
import solidBarrelIcon from "../assets/icons/gnb/Solid_Barrel.png";
import demonSliceIcon from "../assets/icons/gnb/Demon_Slice.png";
import demonSlaughterIcon from "../assets/icons/gnb/Demon_Slaughter.png";
import burstStrikeIcon from "../assets/icons/gnb/Burst_Strike.png";
import fatedCircleIcon from "../assets/icons/gnb/Fated_Circle.png";
import doubleDownIcon from "../assets/icons/gnb/Double_Down.png";
import gnashingFangIcon from "../assets/icons/gnb/Gnashing_Fang.png";
import savageClawIcon from "../assets/icons/gnb/Savage_Claw.png";
import wickedTalonIcon from "../assets/icons/gnb/Wicked_Talon.png";
import continuationIcon from "../assets/icons/gnb/Continuation.png";
import jugularRipIcon from "../assets/icons/gnb/Jugular_Rip.png";
import abdomenTearIcon from "../assets/icons/gnb/Abdomen_Tear.png";
import eyeGougeIcon from "../assets/icons/gnb/Eye_Gouge.png";
import hypervelocityIcon from "../assets/icons/gnb/Hypervelocity.png";
import fatedBrandIcon from "../assets/icons/gnb/Fated_Brand.png";
import noMercyIcon from "../assets/icons/gnb/No_Mercy.png";
import sonicBreakIcon from "../assets/icons/gnb/Sonic_Break.png";
import bloodfestIcon from "../assets/icons/gnb/Bloodfest.png";
import reignOfBeastsIcon from "../assets/icons/gnb/Reign_of_Beasts.png";
import nobleBloodIcon from "../assets/icons/gnb/Noble_Blood.png";
import lionHeartIcon from "../assets/icons/gnb/Lion_Heart.png";
import lightningShotIcon from "../assets/icons/gnb/Lightning_Shot.png";
import dangerZoneIcon from "../assets/icons/gnb/Danger_Zone.png";
import blastingZoneIcon from "../assets/icons/gnb/Blasting_Zone.png";
import bowShockIcon from "../assets/icons/gnb/Bow_Shock.png";

const GCD_RECAST = 2.5;
const DEFAULT_ANIMATION_LOCK = 0.65;

const CARTRIDGE_COST = [{ resourceId: "cartridge", amount: -1 }];
const CARTRIDGE_GAIN = [{ resourceId: "cartridge", amount: 1 }];
/** コンティニュエーションと変化先は 1 秒のリキャストを共有する */
const CONTINUATION = { cooldown: 1, cooldownGroup: "continuation" };

/**
 * ガンブレイカー（GNB）攻撃スキル定義（Lv100まで）
 * パッチノートの PvE ジョブ調整は 7.57 まで反映済み（#866 で照合。7.5〜7.57 にガンブレイカーの PvE 調整は無い）。
 * 公式ジョブガイド（Patch 7.5 表記）とも照合済みで、既知の差分なし
 * アクション威力アップ（Lv84）・アクション威力アップII（Lv94）による変動は traitPotencyOverrides で定義し、基本値は特性修得前の値にする
 * （consolegameswiki の Notes で照合。Lv84〜93 のブルータルシェル・ソリッドバレルのコンボ時威力は、6.2・6.4 の Lv90 時点の値）
 * 計算の対象外: ロイヤルガード・ロールアクション・軽減と回復のアビリティ・トラジェクトリー（突進。7.0 から威力なし）
 *
 * 大別:
 * 1. 単体 WS コンボ（キーンエッジ → ブルータルシェル → ソリッドバレル）
 * 2. 範囲 WS コンボ（デーモンスライス → デーモンスローター）
 * 3. ソイル消費（バーストストライク・フェイテッドサークル・ダブルダウン・ビートファング → サベッジクロウ → ウィケッドタロン）
 * 4. コンティニュエーション（ジャギュラーリップ・アブドメンテアー・アイガウジ・ハイパーヴェロシティ・フェイテッドブランド）
 * 5. ノー・マーシー・ブラッドソイル系（ソニックブレイク、ライズ・オブ・ハート → ルーラー・オブ・ハート → エンド・オブ・ハート）
 * 6. その他（サンダーバレット・デンジャーゾーン／ブラスティングゾーン・バウショック）
 *
 * ビートファング系とライズ・オブ・ハート系はメインのコンボとは別に進むので、段のバフ（gnb-buffs.ts）でつなぎ、keepsCombo を付ける
 */
export const GNB_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // 1. 単体 WS コンボ
  // ============================================================
  {
    id: "keen-edge",
    gameActionId: 16137,
    potency: 150,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 200 },
      { traitLevel: 94, potency: 300 },
    ],
    type: "gcd",
    target: "enemy",
    icon: keenEdgeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 1,
  },
  {
    id: "brutal-shell",
    gameActionId: 16139,
    potency: 240,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 300, nonComboPotency: 160 },
      { traitLevel: 94, potency: 380, nonComboPotency: 240 },
    ],
    type: "gcd",
    target: "enemy",
    icon: brutalShellIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 4,
    comboFrom: ["keen-edge"],
  },
  {
    // ソイルの獲得は特性ソイルチャージ（Lv30）から（ソイルの acquiredLevel）
    id: "solid-barrel",
    gameActionId: 16145,
    potency: 320,
    nonComboPotency: 100,
    traitPotencyOverrides: [
      { traitLevel: 84, potency: 360, nonComboPotency: 140 },
      { traitLevel: 94, potency: 460, nonComboPotency: 240 },
    ],
    type: "gcd",
    target: "enemy",
    icon: solidBarrelIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 26,
    comboFrom: ["brutal-shell"],
    comboResourceChanges: CARTRIDGE_GAIN,
  },

  // ============================================================
  // 2. 範囲 WS コンボ
  // ============================================================
  {
    id: "demon-slice",
    gameActionId: 16141,
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: demonSliceIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 10,
    maxTargets: Infinity,
  },
  {
    id: "demon-slaughter",
    gameActionId: 16149,
    potency: 160,
    nonComboPotency: 100,
    type: "gcd",
    target: "enemy",
    icon: demonSlaughterIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 40,
    comboFrom: ["demon-slice"],
    comboResourceChanges: CARTRIDGE_GAIN,
    maxTargets: Infinity,
  },

  // ============================================================
  // 3. ソイル消費
  // ============================================================
  {
    // ハイパーヴェロシティ実行可は Lv86 から付く（バフの acquiredLevel）
    id: "burst-strike",
    gameActionId: 16162,
    potency: 340,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 420 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: burstStrikeIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 30,
    resourceChanges: CARTRIDGE_COST,
    buffApplications: ["ready-to-blast"],
  },
  {
    // フェイテッドブランド実行可は Lv96 から付く（バフの acquiredLevel）
    id: "fated-circle",
    gameActionId: 16163,
    potency: 300,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: fatedCircleIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 72,
    resourceChanges: CARTRIDGE_COST,
    buffApplications: ["ready-to-raze"],
    maxTargets: Infinity,
  },
  {
    id: "double-down",
    gameActionId: 25760,
    potency: 1000,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: doubleDownIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 90,
    resourceChanges: [{ resourceId: "cartridge", amount: -2 }],
    // 自身の周囲の敵にヒット、2体目以降は威力15%減
    maxTargets: Infinity,
    falloffRate: 0.15,
  },
  {
    // 使うと段のバフでサベッジクロウ → ウィケッドタロンに変化する（変化中はビートファングのチャージを使わない）。
    // ジャギュラーリップ実行可は Lv70 から付く（バフの acquiredLevel）
    id: "gnashing-fang",
    gameActionId: 16146,
    potency: 330,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 440 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: gnashingFangIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    maxCharges: 2,
    acquiredLevel: 60,
    resourceChanges: CARTRIDGE_COST,
    buffApplications: ["savage-claw-ready", "ready-to-rip"],
    autoTransform: [
      { buffId: "wicked-talon-ready", skillId: "wicked-talon" },
      { buffId: "savage-claw-ready", skillId: "savage-claw" },
    ],
  },
  {
    id: "savage-claw",
    gameActionId: 16147,
    potency: 410,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 500 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: savageClawIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    hidden: true,
    comboFromBuff: { buffId: "savage-claw-ready", required: true },
    buffApplications: ["wicked-talon-ready", "ready-to-tear"],
  },
  {
    id: "wicked-talon",
    gameActionId: 16150,
    potency: 490,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 560 }],
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: wickedTalonIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 60,
    hidden: true,
    comboFromBuff: { buffId: "wicked-talon-ready", required: true },
    removesBuffs: ["wicked-talon-ready"],
    buffApplications: ["ready-to-gouge"],
  },

  // ============================================================
  // 4. コンティニュエーション
  // ============================================================
  {
    // 「〜実行可」の効果中だけ、対応するアクションに変化する。どれも無ければ実行できない
    id: "continuation",
    gameActionId: 16155,
    potency: 0,
    type: "ogcd",
    target: "enemy",
    icon: continuationIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CONTINUATION,
    acquiredLevel: 70,
    requiredBuffAnyOf: ["ready-to-rip", "ready-to-tear", "ready-to-gouge", "ready-to-blast", "ready-to-raze"],
    autoTransform: [
      { buffId: "ready-to-rip", skillId: "jugular-rip" },
      { buffId: "ready-to-tear", skillId: "abdomen-tear" },
      { buffId: "ready-to-gouge", skillId: "eye-gouge" },
      { buffId: "ready-to-blast", skillId: "hypervelocity" },
      { buffId: "ready-to-raze", skillId: "fated-brand" },
    ],
  },
  {
    id: "jugular-rip",
    gameActionId: 16156,
    potency: 180,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 220 }],
    type: "ogcd",
    target: "enemy",
    icon: jugularRipIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CONTINUATION,
    acquiredLevel: 70,
    hidden: true,
    buffConsumptions: [{ buffId: "ready-to-rip", stacks: 1 }],
  },
  {
    id: "abdomen-tear",
    gameActionId: 16157,
    potency: 220,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 260 }],
    type: "ogcd",
    target: "enemy",
    icon: abdomenTearIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CONTINUATION,
    acquiredLevel: 70,
    hidden: true,
    buffConsumptions: [{ buffId: "ready-to-tear", stacks: 1 }],
  },
  {
    id: "eye-gouge",
    gameActionId: 16158,
    potency: 260,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 300 }],
    type: "ogcd",
    target: "enemy",
    icon: eyeGougeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CONTINUATION,
    acquiredLevel: 70,
    hidden: true,
    buffConsumptions: [{ buffId: "ready-to-gouge", stacks: 1 }],
  },
  {
    id: "hypervelocity",
    gameActionId: 25759,
    potency: 140,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 180 }],
    type: "ogcd",
    target: "enemy",
    icon: hypervelocityIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CONTINUATION,
    acquiredLevel: 86,
    hidden: true,
    buffConsumptions: [{ buffId: "ready-to-blast", stacks: 1 }],
  },
  {
    id: "fated-brand",
    gameActionId: 36936,
    potency: 120,
    type: "ogcd",
    target: "enemy",
    icon: fatedBrandIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    ...CONTINUATION,
    acquiredLevel: 96,
    hidden: true,
    buffConsumptions: [{ buffId: "ready-to-raze", stacks: 1 }],
    maxTargets: Infinity,
  },

  // ============================================================
  // 5. ノー・マーシー・ブラッドソイル系
  // ============================================================
  {
    // ソニックブレイク実行可は Lv54 から付く（バフの acquiredLevel）
    id: "no-mercy",
    gameActionId: 16138,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: noMercyIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 2,
    buffApplications: ["no-mercy", "ready-to-break"],
  },
  {
    id: "sonic-break",
    gameActionId: 16153,
    potency: 340,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: sonicBreakIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 54,
    buffConsumptions: [{ buffId: "ready-to-break", stacks: 1 }],
    dotPotency: 120,
    dotDuration: 15,
  },
  {
    // 実行には敵の対象が要る。ソイルの獲得は Lv88 から 3（特性ソイルチャージ効果アップ）。ハートコンボ実行可は Lv100 から付く
    id: "bloodfest",
    gameActionId: 16164,
    potency: 0,
    type: "ogcd",
    target: "enemy",
    icon: bloodfestIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 76,
    resourceChanges: [{ resourceId: "cartridge", amount: 2 }],
    traitPotencyOverrides: [{ traitLevel: 88, resourceChanges: [{ resourceId: "cartridge", amount: 3 }] }],
    buffApplications: ["bloodfest", "ready-to-reign"],
  },
  {
    // 使うと段のバフでルーラー・オブ・ハート → エンド・オブ・ハートに変化する
    id: "reign-of-beasts",
    gameActionId: 36937,
    potency: 800,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: reignOfBeastsIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    buffConsumptions: [{ buffId: "ready-to-reign", stacks: 1 }],
    buffApplications: ["noble-blood-ready"],
    autoTransform: [
      { buffId: "lion-heart-ready", skillId: "lion-heart" },
      { buffId: "noble-blood-ready", skillId: "noble-blood" },
    ],
    // 対象とその周囲にヒット、2体目以降は威力60%減
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "noble-blood",
    gameActionId: 36938,
    potency: 900,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: nobleBloodIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    hidden: true,
    comboFromBuff: { buffId: "noble-blood-ready", required: true },
    buffApplications: ["lion-heart-ready"],
    maxTargets: Infinity,
    falloffRate: 0.6,
  },
  {
    id: "lion-heart",
    gameActionId: 36939,
    potency: 1000,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: lionHeartIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 100,
    hidden: true,
    comboFromBuff: { buffId: "lion-heart-ready", required: true },
    removesBuffs: ["lion-heart-ready"],
    maxTargets: Infinity,
    falloffRate: 0.6,
  },

  // ============================================================
  // 6. その他
  // ============================================================
  {
    id: "lightning-shot",
    gameActionId: 16143,
    potency: 150,
    type: "gcd",
    keepsCombo: true,
    target: "enemy",
    icon: lightningShotIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    acquiredLevel: 15,
  },
  {
    id: "danger-zone",
    gameActionId: 16144,
    potency: 250,
    type: "ogcd",
    target: "enemy",
    icon: dangerZoneIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 18,
  },
  {
    id: "blasting-zone",
    gameActionId: 16165,
    potency: 720,
    traitPotencyOverrides: [{ traitLevel: 94, potency: 800 }],
    type: "ogcd",
    target: "enemy",
    icon: blastingZoneIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 30,
    acquiredLevel: 80,
    replacesSkillId: "danger-zone",
  },
  {
    id: "bow-shock",
    gameActionId: 16159,
    potency: 150,
    type: "ogcd",
    target: "enemy",
    icon: bowShockIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    cooldown: 60,
    acquiredLevel: 62,
    dotPotency: 60,
    dotDuration: 15,
    // 自身の周囲の敵にヒット、減衰なし
    maxTargets: Infinity,
  },
];
