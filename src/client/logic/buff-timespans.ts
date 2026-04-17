import type { ActiveBuff, BuffDefinition, ResolvedTimelineEntry } from "../types/skill";

/**
 * タイムライン上のバフ表示スパンを算出する。
 *
 * 各 `ResolvedTimelineEntry.activeBuffs` のスナップショットから、`(buffId, startTime)` ごとに
 * 1本のスパンを構築する。スタック消費・排他解除・消費スキルなどにより自然終了時刻より早く
 * バフが消えた場合は、実際に消えたエントリの時刻まで `endTime` を詰める（クランプ）。
 *
 * 注意: この処理は表示用であり、ダメージ計算側の `ActiveBuff.endTime` をそのまま使うと
 * バフ消費後もスパンが `startTime + duration` まで描画されてしまう。
 */
export function computeBuffTimespans(
  resolvedEntries: ResolvedTimelineEntry[],
  buffs: BuffDefinition[],
): Map<string, ActiveBuff[]> {
  const spans: Map<string, ActiveBuff[]> = new Map();
  const stackableBuffIds = new Set(buffs.filter((b) => b.maxStacks).map((b) => b.id));

  for (const entry of resolvedEntries) {
    for (const ab of entry.activeBuffs) {
      if (!spans.has(ab.buffId)) {
        spans.set(ab.buffId, []);
      }
      const list = spans.get(ab.buffId)!;

      if (stackableBuffIds.has(ab.buffId)) {
        if (!list.some((s) => s.startTime === ab.startTime)) {
          list.push({ ...ab });
        }
      } else {
        if (!list.some((s) => s.startTime === ab.startTime && s.endTime === ab.endTime)) {
          // resolver 側のスナップショット参照をそのまま保持するとスパン調整が副作用になるので clone
          list.push({ ...ab });
        }
      }
    }
  }

  const allTimes = resolvedEntries.map((e) => e.startTime).sort((a, b) => a - b);

  // スタック消費・排他解除・消費スキルによる実際の終了時刻へスパンを詰める
  for (const spanList of spans.values()) {
    for (const span of spanList) {
      let lastSeenTime = span.startTime;
      for (const entry of resolvedEntries) {
        const match = entry.activeBuffs.find(
          (ab) => ab.buffId === span.buffId && ab.startTime === span.startTime,
        );
        if (match) {
          lastSeenTime = entry.startTime;
        }
      }
      if (lastSeenTime >= span.endTime) continue;

      const nextTimeIdx = allTimes.findIndex((t) => t > lastSeenTime);
      if (nextTimeIdx < 0) continue;

      const nextTime = allTimes[nextTimeIdx];
      const nextEntry = resolvedEntries.find((e) => e.startTime === nextTime);
      const stillActive = nextEntry?.activeBuffs.some(
        (ab) => ab.buffId === span.buffId && ab.startTime === span.startTime,
      );
      if (stillActive) continue;

      // クランプ: 次のエントリ時刻が自然終了時刻より後ろにある場合でも、スパンを延長しない。
      // これをしないと、バフ消費前に自然失効ポイントを跨ぐエントリ間ギャップがあると
      // スパンが `startTime + duration` を超えて描画される（#159）。
      span.endTime = Math.min(span.endTime, nextTime);
    }
  }

  return spans;
}
