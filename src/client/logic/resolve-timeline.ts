import type {
  Skill,
  TimelineEntry,
  ResolvedTimelineEntry,
  ResourceDefinition,
  ResourceSnapshot,
  CharacterStats,
  BuffDefinition,
  ActiveBuff,
} from "../types/skill";
import { calcGcd } from "./stat-calc";

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
/**
 * 指定時刻にアクティブなバフから速度バフの合成倍率を計算する。
 */
function getSpeedMultiplier(
  activeBuffs: ActiveBuff[],
  buffDefMap: Map<string, BuffDefinition>
): number {
  let multiplier = 1;
  for (const ab of activeBuffs) {
    const def = buffDefMap.get(ab.buffId);
    if (!def) continue;
    for (const effect of def.effects) {
      if (effect.type === "speed") {
        multiplier *= effect.value;
      }
    }
  }
  return multiplier;
}

export function resolveTimeline(
  entries: TimelineEntry[],
  skillMap: Map<string, Skill>,
  resources: ResourceDefinition[],
  stats?: CharacterStats,
  buffs?: BuffDefinition[]
): ResolvedTimelineEntry[] {
  const resolved: ResolvedTimelineEntry[] = [];
  const resourceDefMap = new Map(resources.map((r) => [r.id, r]));
  const buffDefMap = new Map((buffs ?? []).map((b) => [b.id, b]));

  /** 次のGCDが使用可能になる時刻 */
  let gcdAvailableAt = 0;
  /** 次のアクション（GCD/oGCD問わず）が使用可能になる時刻 */
  let actionAvailableAt = 0;

  // リソース状態: 現在値を追跡
  const resourceState: ResourceSnapshot = {};
  // 自動生成タイマー状態
  const autoGenTimers: Record<string, AutoGenTimer> = {};
  // アクティブなバフのリスト
  const currentActiveBuffs: ActiveBuff[] = [];

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
      const baseRecast = stats ? calcGcd(skill.recastTime, stats) : skill.recastTime;
      startTime = Math.max(gcdAvailableAt, actionAvailableAt);
      startTime = Math.round(startTime * 1000) / 1000;

      // 期限切れバフを除去
      for (let i = currentActiveBuffs.length - 1; i >= 0; i--) {
        if (currentActiveBuffs[i].endTime <= startTime) {
          currentActiveBuffs.splice(i, 1);
        }
      }

      // 速度バフを適用してリキャスト計算
      const speedMul = getSpeedMultiplier(currentActiveBuffs, buffDefMap);
      const recastTime = Math.round(baseRecast * speedMul * 1000) / 1000;

      gcdAvailableAt = startTime + recastTime;
      actionAvailableAt = startTime + skill.animationLock;
    } else {
      startTime = actionAvailableAt;
      startTime = Math.round(startTime * 1000) / 1000;

      // 期限切れバフを除去
      for (let i = currentActiveBuffs.length - 1; i >= 0; i--) {
        if (currentActiveBuffs[i].endTime <= startTime) {
          currentActiveBuffs.splice(i, 1);
        }
      }

      actionAvailableAt = startTime + skill.animationLock;
    }

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

    // バフスタック消費チェック & 適用
    const comboErrors: string[] = [];
    if (skill.buffConsumptions) {
      for (const consumption of skill.buffConsumptions) {
        const activeBuff = currentActiveBuffs.find((ab) => ab.buffId === consumption.buffId);
        if (!activeBuff || (activeBuff.stacks ?? 0) < consumption.stacks) {
          comboErrors.push(consumption.buffId);
        }
      }
    }

    // バフスタック消費を適用（エラー時でも適用、0以下にはしない）
    if (skill.buffConsumptions) {
      for (const consumption of skill.buffConsumptions) {
        const activeBuff = currentActiveBuffs.find((ab) => ab.buffId === consumption.buffId);
        if (activeBuff && activeBuff.stacks !== undefined) {
          activeBuff.stacks = Math.max(0, activeBuff.stacks - consumption.stacks);
          // スタック0になったらバフを除去
          if (activeBuff.stacks === 0) {
            const idx = currentActiveBuffs.indexOf(activeBuff);
            if (idx >= 0) currentActiveBuffs.splice(idx, 1);
          }
        }
      }
    }

    // バフ適用: スキルにbuffApplicationsがあればアクティブバフに追加
    if (skill.buffApplications) {
      for (const buffId of skill.buffApplications) {
        const buffDef = buffDefMap.get(buffId);
        if (!buffDef) continue;

        // 同じバフが既にアクティブなら上書き（リフレッシュ）
        const existingIdx = currentActiveBuffs.findIndex((ab) => ab.buffId === buffId);
        const newBuff: ActiveBuff = {
          buffId,
          startTime,
          endTime: Math.round((startTime + buffDef.duration) * 1000) / 1000,
          stacks: buffDef.maxStacks,
        };
        if (existingIdx >= 0) {
          currentActiveBuffs[existingIdx] = newBuff;
        } else {
          currentActiveBuffs.push(newBuff);
        }
      }
    }

    resolved.push({
      uid: entry.uid,
      skillId: entry.skillId,
      startTime,
      resourceSnapshot: snapshot,
      resourceErrors,
      comboErrors,
      activeBuffs: [...currentActiveBuffs],
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
