import type { Skill, BuffDefinition, ResourceDefinition, PlayerLevel } from "../types/skill";

/**
 * 特性による威力変動を適用したスキルを返す
 */
function applyTraitOverrides(skill: Skill, level: number): Skill {
  if (!skill.traitPotencyOverrides || skill.traitPotencyOverrides.length === 0) {
    return skill;
  }

  let potency = skill.potency;
  let dotPotency = skill.dotPotency;
  let maxCharges = skill.maxCharges;

  // traitLevelの昇順で適用（低い方から順に上書き）
  const sorted = [...skill.traitPotencyOverrides].sort((a, b) => a.traitLevel - b.traitLevel);
  for (const override of sorted) {
    if (level >= override.traitLevel) {
      if (override.potency !== undefined) potency = override.potency;
      if (override.dotPotency !== undefined) dotPotency = override.dotPotency;
      if (override.maxCharges !== undefined) maxCharges = override.maxCharges;
    }
  }

  if (potency === skill.potency && dotPotency === skill.dotPotency && maxCharges === skill.maxCharges) {
    return skill;
  }

  return { ...skill, potency, dotPotency, maxCharges };
}

/**
 * プレイヤーレベルに応じたスキル一覧を返す
 * - 習得レベル以下のスキルのみ表示
 * - 置き換えチェーンでは最上位のスキルのみ表示
 * - 特性による威力変動を適用
 * - レベル未満のリソースを参照するresourceChangesを除外
 */
export function getSkillsForLevel(
  allSkills: Skill[],
  level: PlayerLevel,
  availableBuffIds: Set<string>,
  availableResourceIds: Set<string>,
): Skill[] {
  // 1. 習得レベルでフィルタ
  const available = allSkills.filter((s) => s.acquiredLevel <= level);

  // 2. 置き換え済みスキルを除外（replacedByが存在するスキルを非表示）
  const replacedIds = new Set(
    available
      .filter((s) => s.replacesSkillId)
      .map((s) => s.replacesSkillId!),
  );

  // 3. autoTransformの変換先スキルを除外（パレットには変換元のみ表示）
  const autoTransformTargetIds = new Set(
    available
      .filter((s) => s.autoTransform)
      .map((s) => s.autoTransform!.skillId),
  );

  const filtered = available.filter((s) => !replacedIds.has(s.id) && !autoTransformTargetIds.has(s.id));

  // 3. 特性による威力変動を適用
  // 4. レベル未満のバフ・リソースへの参照を除外
  return filtered.map((skill) => {
    let adjusted = applyTraitOverrides(skill, level);

    // バフ付与: レベル未満のバフを除外
    if (adjusted.buffApplications) {
      const filteredBuffs = adjusted.buffApplications.filter((id) => availableBuffIds.has(id));
      if (filteredBuffs.length !== adjusted.buffApplications.length) {
        adjusted = { ...adjusted, buffApplications: filteredBuffs.length > 0 ? filteredBuffs : undefined };
      }
    }

    // リソース変動: レベル未満のリソースを除外
    if (adjusted.resourceChanges) {
      const filteredResources = adjusted.resourceChanges.filter((rc) => availableResourceIds.has(rc.resourceId));
      if (filteredResources.length !== adjusted.resourceChanges.length) {
        adjusted = { ...adjusted, resourceChanges: filteredResources.length > 0 ? filteredResources : undefined };
      }
    }

    // バフ消費: レベル未満のバフを除外
    if (adjusted.buffConsumptions) {
      const filteredConsumptions = adjusted.buffConsumptions.filter((bc) => availableBuffIds.has(bc.buffId));
      if (filteredConsumptions.length !== adjusted.buffConsumptions.length) {
        adjusted = { ...adjusted, buffConsumptions: filteredConsumptions.length > 0 ? filteredConsumptions : undefined };
      }
    }

    return adjusted;
  });
}

/**
 * プレイヤーレベルに応じたバフ一覧を返す
 */
export function getBuffsForLevel(allBuffs: BuffDefinition[], level: PlayerLevel): BuffDefinition[] {
  return allBuffs.filter((b) => !b.acquiredLevel || b.acquiredLevel <= level);
}

/**
 * プレイヤーレベルに応じたリソース一覧を返す
 */
export function getResourcesForLevel(allResources: ResourceDefinition[], level: PlayerLevel): ResourceDefinition[] {
  return allResources.filter((r) => !r.acquiredLevel || r.acquiredLevel <= level);
}
