import type { BuffDefinition } from "../types/skill";

import reassembleIcon from "../assets/icons/mch/Reassemble.png";
import hyperchargeIcon from "../assets/icons/mch/Hypercharge.png";
import barrelStabilizerIcon from "../assets/icons/mch/Barrel_Stabilizer.png";
import fullMetalFieldIcon from "../assets/icons/mch/Full_Metal_Field.png";
import excavatorIcon from "../assets/icons/mch/Excavator.png";
import wildfireIcon from "../assets/icons/mch/Wildfire.png";

/**
 * オーバーヒートで威力が上がる単体の WS（機工士のジョブアクションのうち単体のもの。ジョブガイドの「単体対象ウェポンスキル」）。
 * 回転のこぎり（直線範囲）・エクスカベーター・フルメタルバースト・スプレッドショット系・バイオブラスト・オートボウガンは範囲なので入れない
 */
export const MCH_OVERHEATED_POTENCY_TARGET_IDS = [
  "heated-split-shot",
  "heated-slug-shot",
  "heated-clean-shot",
  "hot-shot",
  "air-anchor",
  "drill",
  "blazing-shot",
];

/**
 * 整備の確定クリティカル・ダイレクトヒットが乗り、整備を消費する WS（範囲の WS も入る）。
 * フルメタルバーストは「整備の効果対象にならない」（ジョブガイド）ので入れない
 */
export const MCH_REASSEMBLE_TARGET_IDS = [
  "heated-split-shot",
  "heated-slug-shot",
  "heated-clean-shot",
  "hot-shot",
  "air-anchor",
  "drill",
  "chain-saw",
  "excavator",
  "blazing-shot",
  "spread-shot",
  "scattergun",
  "auto-crossbow",
  "bioblaster",
];

/**
 * 機工士（MCH）バフ定義
 * オーバーヒートのスタックは、単体の WS とオートボウガンで 1 つ減る（スキャッターガンなどの範囲の WS では減らない。
 * 出典は xivintheshell の機工士の実装。ジョブガイドは「5スタック」とブレイズショット・オートボウガンを実行できることだけを書く）
 */
export const MCH_BUFFS: BuffDefinition[] = [
  {
    // 次の WS 1 回が確定クリティカル・ダイレクトヒット（DoT には乗らない）
    id: "reassembled",
    icon: reassembleIcon,
    duration: 5,
    effects: [
      { type: "guaranteedCrit", value: 1, appliesToSkillIds: MCH_REASSEMBLE_TARGET_IDS },
      { type: "guaranteedDh", value: 1, appliesToSkillIds: MCH_REASSEMBLE_TARGET_IDS },
    ],
    color: "#ffb300",
    acquiredLevel: 10,
  },
  {
    // ハイパーチャージで 5 スタック付与。ブレイズショット・オートボウガンの発動条件
    id: "overheated",
    icon: hyperchargeIcon,
    duration: 10,
    maxStacks: 5,
    effects: [
      { type: "potencyAdd", value: 20, appliesToSkillIds: MCH_OVERHEATED_POTENCY_TARGET_IDS },
      { type: "consumeOnGcd", value: 1, appliesToSkillIds: [...MCH_OVERHEATED_POTENCY_TARGET_IDS, "auto-crossbow"] },
    ],
    color: "#e53935",
    acquiredLevel: 30,
  },
  {
    // バレルヒーターで付与。ヒートを使わずにハイパーチャージを実行できる（ハイパーチャージの buffSkippableResource）
    id: "hypercharged",
    icon: barrelStabilizerIcon,
    duration: 30,
    effects: [],
    color: "#8e24aa",
    acquiredLevel: 66,
  },
  {
    // バレルヒーターで付与（特性バレルヒーター効果アップ）。フルメタルバーストの発動条件
    id: "full-metal-machinist",
    icon: fullMetalFieldIcon,
    duration: 30,
    effects: [],
    color: "#546e7a",
    acquiredLevel: 100,
  },
  {
    // 回転のこぎりで付与（特性マルチウェポン効果アップII）。回転のこぎりがエクスカベーターに変化する
    id: "excavator-ready",
    icon: excavatorIcon,
    duration: 30,
    effects: [],
    color: "#6d4c41",
    acquiredLevel: 96,
  },
  {
    // 敵に付く効果（データでは効果中の目印。計算はワイルドファイアの時間差の攻撃で行う）。効果中に当てた WS の回数で、効果の終わりの威力が決まる
    id: "wildfire",
    icon: wildfireIcon,
    duration: 10,
    effects: [],
    color: "#ff7043",
    acquiredLevel: 45,
  },
];
