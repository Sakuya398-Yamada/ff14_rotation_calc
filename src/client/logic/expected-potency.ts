import type { CharacterStats, DelayedHitArea, ResolvedDelayedHit, ResolvedTimelineEntry, Skill } from "../types/skill";
import { calcExpectedMultiplier } from "./stat-calc";

/**
 * 1 エントリ分の期待威力（クリ/DH 期待値・バフ倍率・複数体合計を全て反映した値）。
 * 集計行の合計期待威力（`calcTimelineSummary`）と `calcPps` の `directPotency` で共有するヘルパー。
 *
 * 計算規則:
 * - `hasError`（resourceErrors / comboErrors / untargetableError / recastError）のエントリは 0
 * - 着弾時にボスが離脱中（`untargetableHit`。ゴースト）のエントリも 0（#950）
 * - 単体スキル（`maxTargets` 未設定 or ≤1）または `entry.targetCount` ≤1 のとき 1 体分のみ
 * - 複数体時は `min(targetCount, maxTargets)` 体まで、`falloffStartTarget` (default 2) 以降は `(1 - falloffRate)` (default 0) 倍に減衰
 * - 時間差の攻撃（`entry.delayedHits`）は含めない。着弾時刻ごとに `calcDelayedHitBreakdown` で数える（#957）
 */
export function calcEntryExpectedPotency(
  entry: ResolvedTimelineEntry,
  skill: Skill | undefined,
  stats: CharacterStats
): number {
  return calcEntryPotencyBreakdown(entry, skill, stats).total;
}

/**
 * 期待威力の内訳（ツールチップ表示用）。
 * - `singleTargetPotency`: 1 体目の期待威力（複数体ヒットでも非減衰の基準値）
 * - `targets`: 各体ごとの期待威力配列（長さ = effectiveTargets）。単体 or 複数体ウィンドウ外なら長さ 1
 * - `total`: 配列合計
 *
 * `hasError` 時とゴースト（`untargetableHit`）時は全フィールドを 0 / 空配列で返す。
 */
export function calcEntryPotencyBreakdown(
  entry: ResolvedTimelineEntry,
  skill: Skill | undefined,
  stats: CharacterStats
): { total: number; targets: number[]; singleTargetPotency: number } {
  const hasError =
    entry.resourceErrors.length > 0 ||
    entry.comboErrors.length > 0 ||
    entry.untargetableError ||
    entry.recastError;
  if (hasError || entry.untargetableHit === true) {
    return { total: 0, targets: [], singleTargetPotency: 0 };
  }

  return calcHitBreakdown(entry.resolvedPotency, entry.buffMultiplier, entry.critRateBonus, entry.dhRateBonus, entry.targetCount ?? 1, skill, stats);
}

/**
 * 時間差の攻撃 1 回分の期待威力の内訳（#957）。計算規則は `calcEntryPotencyBreakdown` と同じで、バフ倍率・クリ/DH・敵の数は
 * 着弾時刻の値を使う。対象数の上限と減衰は、攻撃が `maxTargets` を持てば攻撃のもの、持たなければ使ったスキル（`skill`）のもの（#977）。
 * ハードエラーのエントリは時間差の攻撃を持たない
 */
export function calcDelayedHitBreakdown(
  hit: ResolvedDelayedHit,
  skill: Skill | undefined,
  stats: CharacterStats
): { total: number; targets: number[]; singleTargetPotency: number } {
  const area = hit.maxTargets !== undefined ? hit : skill;
  return calcHitBreakdown(hit.potency, hit.buffMultiplier, hit.critRateBonus, hit.dhRateBonus, hit.targetCount, area, stats);
}

/** エントリの時間差の攻撃（`entry.delayedHits`）の期待威力の合計。持たなければ 0（#957） */
export function calcEntryDelayedHitsExpectedPotency(
  entry: ResolvedTimelineEntry,
  skill: Skill | undefined,
  stats: CharacterStats
): number {
  return (entry.delayedHits ?? []).reduce((sum, hit) => sum + calcDelayedHitBreakdown(hit, skill, stats).total, 0);
}

function calcHitBreakdown(
  potency: number,
  buffMultiplier: number,
  critRateBonus: number,
  dhRateBonus: number,
  targetCount: number,
  area: DelayedHitArea | undefined,
  stats: CharacterStats
): { total: number; targets: number[]; singleTargetPotency: number } {
  const buffedPotency = Math.floor(potency * buffMultiplier);
  const entryMul = calcExpectedMultiplier(stats, critRateBonus, dhRateBonus);
  const singleTargetPotency = Math.floor(buffedPotency * entryMul);

  const maxTargets = area?.maxTargets ?? 1;
  if (maxTargets <= 1 || targetCount <= 1) {
    return { total: singleTargetPotency, targets: [singleTargetPotency], singleTargetPotency };
  }

  const effectiveTargets = Math.min(maxTargets, targetCount);
  const falloffRate = area?.falloffRate ?? 0;
  const falloffStart = area?.falloffStartTarget ?? 2;
  const reducedPotency = Math.floor(singleTargetPotency * (1 - falloffRate));

  const targets: number[] = [];
  for (let n = 1; n <= effectiveTargets; n++) {
    targets.push(n < falloffStart ? singleTargetPotency : reducedPotency);
  }
  return {
    total: targets.reduce((sum, p) => sum + p, 0),
    targets,
    singleTargetPotency,
  };
}
