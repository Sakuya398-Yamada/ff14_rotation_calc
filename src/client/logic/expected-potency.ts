import type { CharacterStats, ResolvedTimelineEntry, Skill } from "../types/skill";
import { calcExpectedMultiplier } from "./stat-calc";

/**
 * 1 エントリ分の期待威力（クリ/DH 期待値・バフ倍率・複数体合計を全て反映した値）。
 * App.tsx の `totalExpectedPotency` と `calcPps` の `directPotency` の重複計算を一本化するためのヘルパー。
 *
 * 計算規則:
 * - `hasError`（resourceErrors / comboErrors / untargetableError / recastError）のエントリは 0
 * - 単体スキル（`maxTargets` 未設定 or ≤1）または `entry.targetCount` ≤1 のとき 1 体分のみ
 * - 複数体時は `min(targetCount, maxTargets)` 体まで、`falloffStartTarget` (default 2) 以降は `(1 - falloffRate)` (default 0) 倍に減衰
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
 * `hasError` 時は全フィールドを 0 / 空配列で返す。
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
  if (hasError) {
    return { total: 0, targets: [], singleTargetPotency: 0 };
  }

  const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
  const entryMul = calcExpectedMultiplier(stats, entry.critRateBonus, entry.dhRateBonus);
  const singleTargetPotency = Math.floor(buffedPotency * entryMul);

  const targetCount = entry.targetCount ?? 1;
  const maxTargets = skill?.maxTargets ?? 1;
  if (maxTargets <= 1 || targetCount <= 1) {
    return { total: singleTargetPotency, targets: [singleTargetPotency], singleTargetPotency };
  }

  const effectiveTargets = Math.min(maxTargets, targetCount);
  const falloffRate = skill?.falloffRate ?? 0;
  const falloffStart = skill?.falloffStartTarget ?? 2;
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
