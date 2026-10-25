import type { ResourceDefinition } from "../types/skill";

/**
 * モンク（MNK）のリソース定義（パッチ7.5系の公式ジョブガイド準拠）。
 *
 * - 闘気（チャクラ）: 通常上限は 5 だが、桃園結義中は 10 まで拡張される。
 *   上限は 10 で固定している（桃園結義中だけ広げる whileBuffModifiers にはしていない）。
 *   鉄山闘気／陰陽闘気は闘気 5 以上では実行できないので、5 を超えるのは桃園結義中の WS で得たときだけ。
 *   初期値 5 は「戦闘開始前に瞑想で溜めておく」標準オープナー前提。
 *   クリティカル発生時の確率的なチャクラ獲得（特性）は乱数のため本ツールでは扱わない。
 * - 功力: 双竜脚／双掌打／破砕拳で付与され、対応する猿舞連撃／竜頷正拳撃／虎襲崩拳の
 *   威力を上昇させる。参の功力のみ 2 スタック。
 * - ビーストチャクラ（壱・弐・参のチャクラ）: 踏鳴中のWSで型に応じて付与され、
 *   合計 3 つで必殺技を実行でき、1 つでも残っていると踏鳴は実行できない。ジョブガイドでの名称は
 *   魔猿／走竜／猛虎のチャクラ（壱／弐／参の型の WS で付与）だが、型との対応が分かるよう
 *   本ツールでは「壱／弐／参のチャクラ」と表記する。
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
    // 表示は5ドット（3+2の2行）に抑え、桃園結義中の6〜10個目は赤色ドットで表現する
    stacksPerRow: 3,
    displayMaxStacks: 5,
    overflowColor: "#e53935",
  },
  {
    id: "opo-fury",
    name: "壱の功力",
    shortName: "功力",
    maxStacks: 1,
    color: "#e57373",
    acquiredLevel: 50,
    displayGroup: "fury",
    displayGroupPriority: 1,
  },
  {
    id: "raptor-fury",
    name: "弐の功力",
    shortName: "功力",
    maxStacks: 1,
    color: "#81c784",
    acquiredLevel: 18,
    displayGroup: "fury",
    displayGroupPriority: 2,
  },
  {
    id: "coeurl-fury",
    name: "参の功力",
    shortName: "功力",
    maxStacks: 2,
    color: "#64b5f6",
    acquiredLevel: 30,
    displayGroup: "fury",
    displayGroupPriority: 3,
  },
  {
    id: "opo-chakra",
    name: "壱のチャクラ",
    shortName: "ﾁｬｸﾗ",
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
    shortName: "ﾁｬｸﾗ",
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
    shortName: "ﾁｬｸﾗ",
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
    // レーンラベルは先頭リソースの shortName が使われるため「陰陽」とする
    shortName: "陰陽",
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
