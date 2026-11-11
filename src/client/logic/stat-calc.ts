import type { CharacterStats } from "../types/skill";

/** Lv.100 のサブステータス基準値 */
const SUB = 420;
/** Lv.100 のメインステータス基準値 */
const MAIN = 440;
/** Lv.100 の除数 */
const DIV = 2780;

/** DH発生時のダメージ倍率（固定 1.25） */
const DH_DAMAGE_MULTIPLIER = 1.25;

/**
 * クリティカル発生率を計算する。
 * p(CRIT) = floor(200 * (CRIT - SUB) / DIV + 50) / 1000
 */
export function calcCritRate(stats: CharacterStats): number {
  return (Math.floor(200 * (stats.critical - SUB) / DIV) + 50) / 1000;
}

/**
 * クリティカルダメージ倍率を計算する。
 * f(CRIT) = (floor(200 * (CRIT - SUB) / DIV) + 1400) / 1000
 */
export function calcCritMultiplier(stats: CharacterStats): number {
  return (Math.floor(200 * (stats.critical - SUB) / DIV) + 1400) / 1000;
}

/**
 * ダイレクトヒット発生率を計算する。
 * p(DH) = floor(550 * (DH - SUB) / DIV) / 1000
 */
export function calcDhRate(stats: CharacterStats): number {
  return Math.floor(550 * (stats.directHit - SUB) / DIV) / 1000;
}

/**
 * 意志力によるダメージ倍率を計算する。
 * f(DET) = (floor(140 * (DET - MAIN) / DIV) + 1000) / 1000
 */
export function calcDetMultiplier(stats: CharacterStats): number {
  return (Math.floor(140 * (stats.determination - MAIN) / DIV) + 1000) / 1000;
}

/**
 * SS（スキルスピード/スペルスピード）によるGCD短縮を計算する。
 * 入力: ベースGCD（秒）、出力: 短縮後GCD（秒）
 *
 * f(GCD) = floor(baseGCD_ms * (1000 + ceil(130 * (SUB - Speed) / DIV)) / 10000) / 100
 */
export function calcGcd(baseGcdSec: number, stats: CharacterStats): number {
  const baseGcdMs = baseGcdSec * 1000;
  const speedMod = Math.ceil(130 * (SUB - stats.speed) / DIV);
  return Math.floor(baseGcdMs * (1000 + speedMod) / 10000) / 100;
}

/**
 * 確定ダイレクトヒットのアクションで、意志力の倍率に足す DH のステータスによる倍率（6.2 から）。
 * f(autoDH) = floor(140 * (DH - SUB) / DIV) / 1000（xivgear の autoDhitBonusDmg）
 */
export function calcAutoDhBonus(stats: CharacterStats): number {
  return Math.floor(140 * (stats.directHit - SUB) / DIV) / 1000;
}

/** 小数 3 桁で切り捨てる。0.29 * 100 = 28.999… のような浮動小数の誤差で 1 つ下に落ちないよう、許容値を足してから切る */
function floor3(value: number): number {
  return Math.floor(value * 1000 + 1e-6) / 1000;
}

/**
 * ステータスを考慮した期待威力倍率を計算する。
 * クリティカルとDHの期待値を掛け合わせた倍率。
 *
 * = detMul * (1 + critRate * (critMultiplier - 1)) * (1 + dhRate * (DH_DAMAGE_MULTIPLIER - 1))
 *
 * 確定クリティカル・ダイレクトヒットでは、率の上昇がダメージの上昇に換算される（6.2 から。#1004。式は xivgear の
 * autoCritBuffDmg / autoDhitBuffDmg / autoDhitBonusDmg）:
 * - 確定クリ: critMultiplier * floor3(1 + (critMultiplier - 1) * critRateBonus)
 * - 確定 DH: DH_DAMAGE_MULTIPLIER * floor3(1 + (DH_DAMAGE_MULTIPLIER - 1) * dhRateBonus)。意志力の倍率に calcAutoDhBonus を足す
 *
 * @param critRateBonus バフによるクリティカル発生率加算（例: バトルリタニー +0.1）
 * @param dhRateBonus バフによるダイレクトヒット発生率加算
 * @param guaranteed 確定クリティカル（crit）・確定ダイレクトヒット（dh）か
 */
export function calcExpectedMultiplier(
  stats: CharacterStats,
  critRateBonus = 0,
  dhRateBonus = 0,
  guaranteed: { crit?: boolean; dh?: boolean } = {}
): number {
  const critMul = calcCritMultiplier(stats);
  const critFactor = guaranteed.crit
    ? critMul * floor3(1 + (critMul - 1) * critRateBonus)
    : 1 + Math.min(calcCritRate(stats) + critRateBonus, 1) * (critMul - 1);
  const dhFactor = guaranteed.dh
    ? DH_DAMAGE_MULTIPLIER * floor3(1 + (DH_DAMAGE_MULTIPLIER - 1) * dhRateBonus)
    : 1 + Math.min(calcDhRate(stats) + dhRateBonus, 1) * (DH_DAMAGE_MULTIPLIER - 1);
  const detMul = guaranteed.dh ? floor3(calcDetMultiplier(stats) + calcAutoDhBonus(stats)) : calcDetMultiplier(stats);
  return detMul * critFactor * dhFactor;
}

/** デフォルトのステータス値（Lv.100基準値 = 補正なし） */
export const DEFAULT_STATS: CharacterStats = {
  critical: SUB,
  directHit: SUB,
  determination: MAIN,
  speed: SUB,
};
