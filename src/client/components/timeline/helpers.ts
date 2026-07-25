import type { Skill, ResolvedTimelineEntry } from "../../types/skill";
import { PX_PER_SEC, LANE_LABEL_WIDTH } from "./constants";

/**
 * 期待値ツールチップに付与する複数体ヒット内訳を整形する。
 * - 単体（`targets.length <= 1`）: 空文字
 * - 複数体（全て同値）: ` ×N体 (1体: X)`
 * - 複数体（減衰あり）: ` ×N体 (1体: X / 減衰時: Y)`
 */
export function formatTargetBreakdown(
  breakdown: { total: number; targets: number[]; singleTargetPotency: number } | null
): string {
  if (!breakdown || breakdown.targets.length <= 1) return "";
  const reduced = breakdown.targets.find((t) => t !== breakdown.singleTargetPotency);
  const reducedSuffix = reduced !== undefined ? ` / 減衰時: ${reduced}` : "";
  return ` ×${breakdown.targets.length}体 (1体: ${breakdown.singleTargetPotency}${reducedSuffix})`;
}

/**
 * ドラッグ中のマウスX座標から挿入インデックスを計算する。
 * resolvedEntriesの各エントリの中央位置と比較し、挿入位置を決定する。
 */
export function calcInsertIndex(
  mouseX: number,
  scrollLeft: number,
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>,
  recastFn: (entry: ResolvedTimelineEntry, skill: Skill) => number
): number {
  // タイムラインコンテンツ上の実際のX座標（スクロール考慮、レーンラベル分を引く）
  const contentX = mouseX + scrollLeft - LANE_LABEL_WIDTH;
  const time = contentX / PX_PER_SEC;

  if (resolvedEntries.length === 0) return 0;

  // 各エントリの中央時刻と比較して挿入位置を決定
  for (let i = 0; i < resolvedEntries.length; i++) {
    const entry = resolvedEntries[i];
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;
    const centerTime = entry.startTime + recastFn(entry, skill) / 2;
    if (time < centerTime) {
      return i;
    }
  }

  // 末尾に追加
  return resolvedEntries.length;
}
