import type { ResourceDefinition } from "../types/skill";

/**
 * 黒魔道士のリソース定義。
 *
 * AF/UB 状態自体はスタックをバフ（astral-fire-1/2/3、umbral-ice-1/2/3）で管理するため、
 * ここでは扱わない。AF/UB バフの排他制御は `exclusiveGroup: "astral-umbral"` で実現する。
 *
 * ポリグロットは AF/UB バフのいずれかがアクティブな間のみ 30 秒ごとに 1 蓄積される
 * （旧エノキアンのポリグロット蓄積を模倣）。`autoGenerateWhileBuff` で表現。
 *
 * MP の自然回復は本ツールでは実装しない（ユーザー指定）。スキル使用時の消費・回復のみ管理する。
 */
export const BLM_RESOURCES: ResourceDefinition[] = [
  {
    id: "mp",
    name: "MP",
    shortName: "MP",
    maxStacks: 10000,
    initialStacks: 10000,
    color: "#5b9bd5",
    acquiredLevel: 1,
  },
  {
    id: "umbral-heart",
    name: "アンブラルハート",
    shortName: "ﾊｰﾄ",
    maxStacks: 3,
    color: "#81d4fa",
    acquiredLevel: 58,
  },
  {
    id: "paradox-gauge",
    name: "パラドックスゲージ",
    shortName: "ﾊﾟﾗﾄﾞ",
    maxStacks: 1,
    color: "#ba68c8",
    acquiredLevel: 90,
  },
  {
    id: "polyglot",
    name: "ポリグロット",
    shortName: "ﾎﾟﾘｸﾞ",
    maxStacks: 3,
    color: "#ff8a65",
    acquiredLevel: 70,
    // AF または UB がアクティブな間のみ 30 秒ごとに 1 蓄積（現行 FF14 の仕様を模倣）
    autoGenerateInterval: 30,
    autoGenerateAmount: 1,
    autoGenerateWhileBuff: [
      "astral-fire-1",
      "astral-fire-2",
      "astral-fire-3",
      "umbral-ice-1",
      "umbral-ice-2",
      "umbral-ice-3",
    ],
  },
  {
    id: "astral-soul",
    name: "アストラルソウル",
    shortName: "ｱｽﾄﾗﾙ\nｿｳﾙ",
    maxStacks: 6,
    color: "#ffca28",
    acquiredLevel: 100,
  },
];
