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
 * ステータスを考慮した期待威力倍率を計算する。
 * クリティカルとDHの期待値を掛け合わせた倍率。
 *
 * = detMul * (1 + critRate * (critMultiplier - 1)) * (1 + dhRate * (DH_DAMAGE_MULTIPLIER - 1))
 *
 * @param critRateBonus バフによるクリティカル発生率加算（例: バトルリタニー +0.1）
 */
export function calcExpectedMultiplier(stats: CharacterStats, critRateBonus = 0): number {
  const critRate = Math.min(calcCritRate(stats) + critRateBonus, 1);
  const critMul = calcCritMultiplier(stats);
  const dhRate = calcDhRate(stats);
  const detMul = calcDetMultiplier(stats);
  return detMul * (1 + critRate * (critMul - 1)) * (1 + dhRate * (DH_DAMAGE_MULTIPLIER - 1));
}

/** デフォルトのステータス値（Lv.100基準値 = 補正なし） */
export const DEFAULT_STATS: CharacterStats = {
  critical: SUB,
  directHit: SUB,
  determination: MAIN,
  speed: SUB,
};
