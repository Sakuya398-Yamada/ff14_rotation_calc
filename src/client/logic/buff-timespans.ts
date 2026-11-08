import type { ActiveBuff, BuffDefinition, ResolvedTimelineEntry } from "../types/skill";

/**
 * タイムライン上のバフ表示スパンを算出する。
 *
 * 各 `ResolvedTimelineEntry.activeBuffs`（と着弾で付いた `hitAppliedBuffs`）のスナップショットから、`(buffId, startTime)` ごとに
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
    // 着弾まで待たせて付けたバフ（#948）は付けたエントリの activeBuffs に無く、最後のエントリより後に着弾したものは
    // どのエントリにも出ないので、hitAppliedBuffs も材料にする
    for (const ab of [...entry.activeBuffs, ...(entry.hitAppliedBuffs ?? [])]) {
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
  const exclusiveGroups = new Map(buffs.map((b) => [b.id, b.exclusiveGroup]));
  // 着弾で付いたバフ（#948）。同じバフの付け直しと排他グループの上書きは、エントリの間のこの時刻に前のバフを外す
  const hitApplied = resolvedEntries.flatMap((e) => e.hitAppliedBuffs ?? []);

  // スタック消費・排他解除・消費スキルによる実際の終了時刻へスパンを詰める
  for (const spanList of spans.values()) {
    for (const span of spanList) {
      let lastSeenTime = span.startTime;
      let seen = false;
      for (const entry of resolvedEntries) {
        const match = entry.activeBuffs.find(
          (ab) => ab.buffId === span.buffId && ab.startTime === span.startTime,
        );
        if (match) {
          lastSeenTime = entry.startTime;
          seen = true;
        }
      }
      if (lastSeenTime >= span.endTime) continue;

      // どのエントリの activeBuffs にも出ない、着弾で付いたバフは、着弾時刻ちょうどに始まったエントリが
      // 消費・解除したことがある（詠唱がリキャスト以上の GCD の次の GCD）ので、そのエントリから探す（#948）
      const nextTimeIdx = allTimes.findIndex((t) => (seen ? t > lastSeenTime : t >= span.startTime));
      const nextTime = nextTimeIdx < 0 ? Number.POSITIVE_INFINITY : allTimes[nextTimeIdx];
      const nextEntry = nextTimeIdx < 0 ? undefined : resolvedEntries.find((e) => e.startTime === nextTime);
      const stillActive = nextEntry?.activeBuffs.some(
        (ab) => ab.buffId === span.buffId && ab.startTime === span.startTime,
      );
      if (stillActive) continue;

      // 最後に見えたエントリと次のエントリの間に、このバフを外す着弾があれば、その時刻で終える
      const group = exclusiveGroups.get(span.buffId);
      const removedAt = Math.min(
        nextTime,
        ...hitApplied
          .filter((ab) => ab.startTime > lastSeenTime && ab.startTime > span.startTime && ab.startTime < nextTime)
          .filter((ab) => ab.buffId === span.buffId || (group !== undefined && exclusiveGroups.get(ab.buffId) === group))
          .map((ab) => ab.startTime),
      );
      if (!Number.isFinite(removedAt)) continue;

      // クランプ: 次のエントリ時刻が自然終了時刻より後ろにある場合でも、スパンを延長しない。
      // これをしないと、バフ消費前に自然失効ポイントを跨ぐエントリ間ギャップがあると
      // スパンが `startTime + duration` を超えて描画される（#159）。
      span.endTime = Math.min(span.endTime, removedAt);
    }
  }

  return spans;
}
