import type { Skill, TimelineEntry, ResolvedTimelineEntry } from "../types/skill";

/**
 * タイムラインエントリにリキャスト・アニメーションロックに基づく開始時刻を計算する。
 *
 * ルール:
 * - GCDスキル: 前のGCDのリキャスト完了後 かつ 前のアクションのアニメーションロック完了後
 * - oGCDスキル: 前のアクションのアニメーションロック完了後（GCDリキャスト中に使用可能）
 */
export function resolveTimeline(
  entries: TimelineEntry[],
  skillMap: Map<string, Skill>
): ResolvedTimelineEntry[] {
  const resolved: ResolvedTimelineEntry[] = [];

  /** 次のGCDが使用可能になる時刻 */
  let gcdAvailableAt = 0;
  /** 次のアクション（GCD/oGCD問わず）が使用可能になる時刻 */
  let actionAvailableAt = 0;

  for (const entry of entries) {
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;

    let startTime: number;

    if (skill.type === "gcd") {
      startTime = Math.max(gcdAvailableAt, actionAvailableAt);
      gcdAvailableAt = startTime + skill.recastTime;
      actionAvailableAt = startTime + skill.animationLock;
    } else {
      startTime = actionAvailableAt;
      actionAvailableAt = startTime + skill.animationLock;
    }

    resolved.push({
      uid: entry.uid,
      skillId: entry.skillId,
      startTime: Math.round(startTime * 1000) / 1000,
    });
  }

  return resolved;
}
