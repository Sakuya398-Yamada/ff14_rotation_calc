import type { ResourceDefinition } from "../types/skill";

/**
 * ナイト（PLD）リソース定義
 *
 * 攻撃に効くリソースが無いので空。オウスゲージは防御系スキル（シェルトロン・かばう・インターベンション）にしか使わず、
 * MP は他ジョブと同じく扱わないため定義しない
 */
export const PLD_RESOURCES: ResourceDefinition[] = [];
