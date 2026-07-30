import type { ResourceDefinition } from "../types/skill";

/**
 * モンク（MNK）のリソース定義（パッチ7.5系の公式ジョブガイド準拠）。
 *
 * - 闘気（チャクラ）: 通常上限は 5 だが、桃園結義中は 10 まで拡張される。
 *   本ツールはリソース上限の動的変更をサポートしないため、上限 10 で固定し、
 *   通常時の 5 超えは運用上発生しない（瞑想は戦闘中ほぼ使わない）前提とする。
 *   初期値 5 は「戦闘開始前に瞑想で溜めておく」標準オープナー前提。
 *   クリティカル発生時の確率的なチャクラ獲得（特性）は乱数のため本ツールでは扱わない。
 * - 功力: 双竜脚／双掌打／破砕拳で付与され、対応する猿舞連撃／竜頷正拳撃／虎襲崩拳の
 *   威力を上昇させる。参の功力のみ 2 スタック。
 * - ビーストチャクラ（壱・弐・参のチャクラ）: 踏鳴中のWSで型に応じて付与され、
 *   合計 3 つで必殺技を実行できる。ゲーム内の正式名称は単に「チャクラ」だが、
 *   闘気ゲージとの区別のため本ツールでは「壱／弐／参のチャクラ」と表記する。
 * - 陰／陽の闘気: 必殺技で付与され、両方揃うと夢幻闘舞が実行可能になる。
 */
export const MNK_RESOURCES: ResourceDefinition[] = [
  {
    id: "chakra",
    name: "闘気",
    shortName: "闘気",
    maxStacks: 10,
    initialStacks: 5,
    color: "#ff9800",
    acquiredLevel: 15,
    stacksPerRow: 5,
  },
  {
    id: "opo-fury",
    name: "壱の功力",
    shortName: "壱功",
    maxStacks: 1,
    color: "#e57373",
    acquiredLevel: 50,
    displayGroup: "fury",
    displayGroupPriority: 1,
  },
  {
    id: "raptor-fury",
    name: "弐の功力",
    shortName: "弐功",
    maxStacks: 1,
    color: "#81c784",
    acquiredLevel: 18,
    displayGroup: "fury",
    displayGroupPriority: 2,
  },
  {
    id: "coeurl-fury",
    name: "参の功力",
    shortName: "参功",
    maxStacks: 2,
    color: "#64b5f6",
    acquiredLevel: 30,
    displayGroup: "fury",
    displayGroupPriority: 3,
  },
  {
    id: "opo-chakra",
    name: "壱のチャクラ",
    shortName: "壱チ",
    maxStacks: 3,
    color: "#ef5350",
    acquiredLevel: 60,
    displayGroup: "beast-chakra",
    groupMaxStacks: 3,
    displayGroupPriority: 1,
  },
  {
    id: "raptor-chakra",
    name: "弐のチャクラ",
    shortName: "弐チ",
    maxStacks: 3,
    color: "#66bb6a",
    acquiredLevel: 60,
    displayGroup: "beast-chakra",
    groupMaxStacks: 3,
    displayGroupPriority: 2,
  },
  {
    id: "coeurl-chakra",
    name: "参のチャクラ",
    shortName: "参チ",
    maxStacks: 3,
    color: "#42a5f5",
    acquiredLevel: 60,
    displayGroup: "beast-chakra",
    groupMaxStacks: 3,
    displayGroupPriority: 3,
  },
  {
    id: "lunar-nadi",
    name: "陰の闘気",
    shortName: "陰",
    maxStacks: 1,
    color: "#b39ddb",
    acquiredLevel: 60,
    displayGroup: "nadi",
    displayGroupPriority: 1,
  },
  {
    id: "solar-nadi",
    name: "陽の闘気",
    shortName: "陽",
    maxStacks: 1,
    color: "#ffd54f",
    acquiredLevel: 60,
    displayGroup: "nadi",
    displayGroupPriority: 2,
  },
];
