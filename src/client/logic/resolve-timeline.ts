import type {
  Skill,
  TimelineEntry,
  ResolvedTimelineEntry,
  ResourceDefinition,
  ResourceSnapshot,
} from "../types/skill";

/**
 * 自動生成タイマーの状態。
 * リソースが最大未満になった時点からタイマーが開始し、
 * interval秒経過ごとに1つ生成される。最大に達するとタイマー停止。
 */
interface AutoGenTimer {
  /** タイマー開始時刻（null = タイマー停止中） */
  startedAt: number | null;
}

/**
 * 指定時刻時点で、自動生成タイマーにより追加されるリソース量を計算し、
 * タイマー状態を更新する。
 */
function processAutoGen(
  currentTime: number,
  currentValue: number,
  maxStacks: number,
  interval: number,
  timer: AutoGenTimer
): number {
  if (timer.startedAt === null) return currentValue;

  let value = currentValue;
  let timerTime = timer.startedAt;

  while (value < maxStacks) {
    const nextTick = timerTime + interval;
    if (nextTick > currentTime) break;
    value = Math.min(value + 1, maxStacks);
    timerTime = nextTick;
  }

  if (value >= maxStacks) {
    // 最大に達したらタイマー停止
    timer.startedAt = null;
  } else {
    // タイマー継続（次のtick待ち）
    timer.startedAt = timerTime;
  }

  return value;
}

/**
 * タイムラインエントリにリキャスト・アニメーションロックに基づく開始時刻を計算し、
 * 各エントリ時点でのリソース状態を追跡する。
 *
 * ルール:
 * - GCDスキル: 前のGCDのリキャスト完了後 かつ 前のアクションのアニメーションロック完了後
 * - oGCDスキル: 前のアクションのアニメーションロック完了後（GCDリキャスト中に使用可能）
 * - リソース自動生成: スタックが最大未満になった時点から20秒後に1つ追加（最大まで繰り返し）
 */
export function resolveTimeline(
  entries: TimelineEntry[],
  skillMap: Map<string, Skill>,
  resources: ResourceDefinition[]
): ResolvedTimelineEntry[] {
  const resolved: ResolvedTimelineEntry[] = [];
  const resourceDefMap = new Map(resources.map((r) => [r.id, r]));

  /** 次のGCDが使用可能になる時刻 */
  let gcdAvailableAt = 0;
  /** 次のアクション（GCD/oGCD問わず）が使用可能になる時刻 */
  let actionAvailableAt = 0;

  // リソース状態: 現在値を追跡
  const resourceState: ResourceSnapshot = {};
  // 自動生成タイマー状態
  const autoGenTimers: Record<string, AutoGenTimer> = {};

  // リソース初期化
  for (const res of resources) {
    const initial = res.initialStacks ?? 0;
    resourceState[res.id] = initial;
    autoGenTimers[res.id] = {
      // 初期値が最大未満ならタイマー開始（t=0から）
      startedAt: res.autoGenerateInterval && initial < res.maxStacks ? 0 : null,
    };
  }

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

    startTime = Math.round(startTime * 1000) / 1000;

    // 自動生成リソースを時刻に応じて加算
    for (const res of resources) {
      if (res.autoGenerateInterval) {
        resourceState[res.id] = processAutoGen(
          startTime,
          resourceState[res.id],
          res.maxStacks,
          res.autoGenerateInterval,
          autoGenTimers[res.id]
        );
      }
    }

    // スキル実行前のリソーススナップショット
    const snapshot: ResourceSnapshot = { ...resourceState };

    // リソース不足チェック
    const resourceErrors: string[] = [];
    if (skill.resourceChanges) {
      for (const change of skill.resourceChanges) {
        if (change.amount < 0) {
          const required = Math.abs(change.amount);
          if (resourceState[change.resourceId] < required) {
            resourceErrors.push(change.resourceId);
          }
        }
      }
    }

    // リソース変動を適用（不足時でも適用し、0でクランプ）
    if (skill.resourceChanges) {
      for (const change of skill.resourceChanges) {
        const def = resourceDefMap.get(change.resourceId);
        if (!def) continue;
        const prevValue = resourceState[change.resourceId];
        resourceState[change.resourceId] = Math.max(
          0,
          Math.min(prevValue + change.amount, def.maxStacks)
        );

        // リソースが最大未満になったら自動生成タイマーを開始
        if (
          def.autoGenerateInterval &&
          resourceState[change.resourceId] < def.maxStacks &&
          autoGenTimers[change.resourceId].startedAt === null
        ) {
          autoGenTimers[change.resourceId].startedAt = startTime;
        }
      }
    }

    resolved.push({
      uid: entry.uid,
      skillId: entry.skillId,
      startTime,
      resourceSnapshot: snapshot,
      resourceErrors,
    });
  }

  return resolved;
}

/**
 * タイムライン末尾（最後のスキル実行後）のリソース状態を計算する。
 */
export function getFinalResourceState(
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>,
  resources: ResourceDefinition[]
): ResourceSnapshot {
  if (resolvedEntries.length === 0) {
    const snapshot: ResourceSnapshot = {};
    for (const res of resources) {
      snapshot[res.id] = res.initialStacks ?? 0;
    }
    return snapshot;
  }

  // 最後のエントリのスナップショットにそのスキルの変動を適用したものが最終状態
  const last = resolvedEntries[resolvedEntries.length - 1];
  const skill = skillMap.get(last.skillId);
  const state: ResourceSnapshot = { ...last.resourceSnapshot };

  if (skill?.resourceChanges) {
    const resourceDefMap = new Map(resources.map((r) => [r.id, r]));
    for (const change of skill.resourceChanges) {
      const def = resourceDefMap.get(change.resourceId);
      if (!def) continue;
      state[change.resourceId] = Math.max(
        0,
        Math.min(state[change.resourceId] + change.amount, def.maxStacks)
      );
    }
  }

  return state;
}
