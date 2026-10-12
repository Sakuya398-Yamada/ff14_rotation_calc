import type { ActiveBuff, BuffDefinition, BuffEffect, CharacterStats } from "../types/skill";

const STAT_LABELS: Record<keyof CharacterStats, string> = {
  critical: "CRT",
  directHit: "DH",
  determination: "DET",
  speed: "SS",
};

function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function describeEffectBody(effect: BuffEffect): string | null {
  switch (effect.type) {
    case "potency":
      return `威力×${effect.value.toFixed(2)}`;
    case "critRate":
      return `CRT+${formatRate(effect.value)}`;
    case "dhRate":
      return `DH+${formatRate(effect.value)}`;
    case "speed":
      return `GCD×${effect.value}`;
    case "guaranteedCrit":
      return "確定CRT";
    case "guaranteedDh":
      return "確定DH";
    case "instantCast":
      return "即時詠唱";
    case "stat":
      return effect.statKey ? `${STAT_LABELS[effect.statKey]}+${effect.value}` : null;
    default:
      // コンボ判定・リソース操作など計算の内部挙動を表す種別は、利用者向けの要約に出さない
      return null;
  }
}

function describeEffect(effect: BuffEffect): string | null {
  const body = describeEffectBody(effect);
  if (body === null) return null;
  return effect.appliesToSkillIds ? `${body}（一部スキル）` : body;
}

/** バフ効果の利用者向け要約（重複は除く）。表示できる効果が無ければ空配列 */
export function describeBuffEffects(def: BuffDefinition): string[] {
  const labels = def.effects.map(describeEffect).filter((label): label is string => label !== null);
  return [...new Set(labels)];
}

/** スキル使用時点での残り時間。永続バフは "∞" */
export function formatBuffRemaining(activeBuff: ActiveBuff, useTime: number): string {
  if (!Number.isFinite(activeBuff.endTime)) return "∞";
  return `${Math.max(0, activeBuff.endTime - useTime).toFixed(1)}s`;
}
