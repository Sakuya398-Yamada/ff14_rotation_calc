import type { ActiveBuff, BuffDefinition } from "../types/skill";

/**
 * 詳細パネル表示用のバフ寄与情報。
 * 1 つの ActiveBuff から、そのスキルへ実際に効くエフェクトのみを抽出した結果。
 */
export interface BuffContribution {
  buffId: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  stacks?: number;
  /** 威力倍率寄与（potency effect の積。寄与なしは undefined） */
  potencyMultiplier?: number;
  /** クリティカル率ボーナス寄与（critRate effect の和。寄与なしは undefined） */
  critRateBonus?: number;
  /** ダイレクトヒット率ボーナス寄与（dhRate effect の和。寄与なしは undefined） */
  dhRateBonus?: number;
  /** guaranteedCrit を保有するか */
  guaranteedCrit?: boolean;
  /** guaranteedDh を保有するか */
  guaranteedDh?: boolean;
}

/**
 * 指定スキルに対する各 ActiveBuff の寄与を抽出する。
 * potency / critRate / dhRate / guaranteedCrit / guaranteedDh のいずれかに寄与するバフだけ返す。
 *
 * potency の appliesToSkillIds フィルタは resolve-timeline.ts:getPotencyMultiplier と同じロジック。
 */
export function getBuffContributions(
  activeBuffs: ActiveBuff[],
  buffDefMap: Map<string, BuffDefinition>,
  targetSkillId: string
): BuffContribution[] {
  const result: BuffContribution[] = [];
  for (const ab of activeBuffs) {
    const def = buffDefMap.get(ab.buffId);
    if (!def) continue;

    let potencyMul = 1;
    let hasPotency = false;
    let critBonus = 0;
    let hasCrit = false;
    let dhBonus = 0;
    let hasDh = false;
    let guaranteedCrit = false;
    let guaranteedDh = false;

    for (const effect of def.effects) {
      switch (effect.type) {
        case "potency":
          if (effect.appliesToSkillIds && !effect.appliesToSkillIds.includes(targetSkillId)) continue;
          potencyMul *= effect.value;
          hasPotency = true;
          break;
        case "critRate":
          critBonus += effect.value;
          hasCrit = true;
          break;
        case "dhRate":
          dhBonus += effect.value;
          hasDh = true;
          break;
        case "guaranteedCrit":
          guaranteedCrit = true;
          break;
        case "guaranteedDh":
          guaranteedDh = true;
          break;
      }
    }

    if (!hasPotency && !hasCrit && !hasDh && !guaranteedCrit && !guaranteedDh) continue;

    result.push({
      buffId: ab.buffId,
      name: def.name,
      shortName: def.shortName,
      icon: def.icon,
      color: def.color,
      stacks: ab.stacks,
      potencyMultiplier: hasPotency ? potencyMul : undefined,
      critRateBonus: hasCrit ? critBonus : undefined,
      dhRateBonus: hasDh ? dhBonus : undefined,
      guaranteedCrit: guaranteedCrit || undefined,
      guaranteedDh: guaranteedDh || undefined,
    });
  }
  return result;
}
