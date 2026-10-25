import type { ActiveBuff, BuffDefinition, BuffEffect, ResolvedTimelineEntry } from "../types/skill";

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

/** 発動確率を小数第1位までの % にする */
export function formatProcRate(rate: number): string {
  // 1 − 0.65² = 0.5774999999999999 を 57.7 にしないよう、浮動小数の誤差を落としてから四捨五入する
  return `${(Math.round(Number((rate * 1000).toPrecision(12))) / 10).toFixed(1)}%`;
}

/** 期待値の補正に使った発動確率。例: "ホークアイ発動確率 35.0%" */
export function formatConsumedProc(
  consumedProc: NonNullable<ResolvedTimelineEntry["consumedProc"]>,
  buffDefMap: Map<string, BuffDefinition>,
): string {
  const name = buffDefMap.get(consumedProc.buffId)?.name ?? consumedProc.buffId;
  return `${name}発動確率 ${formatProcRate(consumedProc.procRate)}`;
}
