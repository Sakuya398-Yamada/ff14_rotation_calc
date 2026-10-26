import type { ResourceDefinition } from "../types/skill";

/**
 * 占星術師（AST）リソース定義
 *
 * カード（プレイI〜III）とクラウンレディは扱わず、ダメージに関係するドローの流れだけをリソースで表す。
 * インスタンスに入った時点でアストラルドローのカードは引き終わっているため、どちらも 1 から始める。
 * - クラウンロード実行可: アストラルドローで 1 になり、クラウンロードで消費する。アンブラルドローで引くクラウンレディに上書きされて 0 になる
 * - アンブラルドロー待ち: 1 のときドローがアンブラルドローに変化する。アストラルドローで 1、アンブラルドローで 0 にする
 */
export const AST_RESOURCES: ResourceDefinition[] = [
  {
    id: "lord-of-crowns",
    name: "クラウンロード実行可",
    shortName: "ｸﾗｳﾝ\nﾛｰﾄﾞ",
    maxStacks: 1,
    initialStacks: 1,
    color: "#ffb74d",
    acquiredLevel: 70,
  },
  {
    id: "umbral-draw-next",
    name: "アンブラルドロー待ち",
    shortName: "ｱﾝﾌﾞﾗﾙ\n待ち",
    maxStacks: 1,
    initialStacks: 1,
    color: "#7986cb",
    acquiredLevel: 30,
  },
];
