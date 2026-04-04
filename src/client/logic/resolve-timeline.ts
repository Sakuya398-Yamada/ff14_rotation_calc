import type {
  Skill,
  TimelineEntry,
  ResolvedTimelineEntry,
  ResourceDefinition,
  ResourceSnapshot,
  CharacterStats,
  BuffDefinition,
  ActiveBuff,
  DoTTick,
  ActiveDoT,
  TimelineResult,
  BossUntargetableWindow,
} from "../types/skill";
import { calcGcd, calcExpectedMultiplier } from "./stat-calc";

/** DoTティック間隔（秒） */
const DOT_TICK_INTERVAL = 3;

/** コンボタイマー（秒）。この時間以上経過するとコンボがリセットされる */
const COMBO_TIMER = 15;

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

/**
 * アクティブなバフからクリティカル発生率ボーナスを計算する。
 */
function getCritRateBonus(
  activeBuffs: ActiveBuff[],
  buffDefMap: Map<string, BuffDefinition>
): number {
  let bonus = 0;
  for (const ab of activeBuffs) {
    const def = buffDefMap.get(ab.buffId);
    if (!def) continue;
    for (const effect of def.effects) {
      if (effect.type === "critRate") {
        bonus += effect.value;
      }
    }
  }
  return bonus;
}

/**
 * アクティブなバフからダイレクトヒット発生率ボーナスを計算する。
 */
function getDhRateBonus(
  activeBuffs: ActiveBuff[],
  buffDefMap: Map<string, BuffDefinition>
): number {
  let bonus = 0;
  for (const ab of activeBuffs) {
    const def = buffDefMap.get(ab.buffId);
    if (!def) continue;
    for (const effect of def.effects) {
      if (effect.type === "dhRate") {
        bonus += effect.value;
      }
    }
  }
  return bonus;
}

/**
 * アクティブなバフに確定クリティカル（guaranteedCrit）効果があるか判定する。
 */
function hasGuaranteedCrit(
  activeBuffs: ActiveBuff[],
  buffDefMap: Map<string, BuffDefinition>
): boolean {
  for (const ab of activeBuffs) {
    const def = buffDefMap.get(ab.buffId);
    if (!def) continue;
    for (const effect of def.effects) {
      if (effect.type === "guaranteedCrit") {
        return true;
      }
    }
  }
  return false;
}

/**
 * アクティブなバフからguaranteedCrit効果を持つバフを自動消費する。
 * スタック付きバフの場合はスタックを1減算し、0になったら除去する。
 * スタックなしバフの場合は直接除去する。
 */
function consumeGuaranteedCritBuffs(
  activeBuffs: ActiveBuff[],
  buffDefMap: Map<string, BuffDefinition>
): void {
  for (let i = activeBuffs.length - 1; i >= 0; i--) {
    const def = buffDefMap.get(activeBuffs[i].buffId);
    if (!def) continue;
    if (def.effects.some((e) => e.type === "guaranteedCrit")) {
      const ab = activeBuffs[i];
      if (ab.stacks !== undefined) {
        ab.stacks = Math.max(0, ab.stacks - 1);
        if (ab.stacks === 0) {
          activeBuffs.splice(i, 1);
        }
      } else {
        activeBuffs.splice(i, 1);
      }
    }
  }
}


/**
 * アクティブなバフから威力バフの合成倍率を計算する。
 */
function getPotencyMultiplier(
  activeBuffs: ActiveBuff[],
  buffDefMap: Map<string, BuffDefinition>
): number {
  let multiplier = 1;
  for (const ab of activeBuffs) {
    const def = buffDefMap.get(ab.buffId);
    if (!def) continue;
    for (const effect of def.effects) {
      if (effect.type === "potency") {
        multiplier *= effect.value;
      }
    }
  }
  return multiplier;
}

/**
 * DoTストリーム: 同一スキルIDのDoTの適用履歴を管理する。
 * FF14のDoTはサーバーティック（3秒間隔）で発動し、再適用時にティックタイマーはリセットされない。
 * 再適用時は持続時間（endTime）とバフスナップショットのみ更新される。
 */
interface DoTStream {
  skillId: string;
  icon: string;
  dotPotency: number;
  /** 最初の適用時刻（ティックタイマーの基準） */
  firstAppliedAt: number;
  /** 現在の終了時刻（再適用で延長される） */
  currentEndTime: number;
  /** 適用セグメント: 各適用時点のバフスナップショットを記録 */
  segments: Array<{
    appliedAt: number;
    endTime: number;
    buffMultiplier: number;
    critRateBonus: number;
    dhRateBonus: number;
  }>;
}

/**
 * 指定時刻がボス離脱ウィンドウ内にあるかどうかを判定する。
 */
function isInUntargetableWindow(
  time: number,
  windows: BossUntargetableWindow[]
): boolean {
  for (const w of windows) {
    if (time >= w.startTime && time < w.endTime) {
      return true;
    }
  }
  return false;
}

export function resolveTimeline(
  entries: TimelineEntry[],
  skillMap: Map<string, Skill>,
  resources: ResourceDefinition[],
  stats?: CharacterStats,
  buffs?: BuffDefinition[],
  untargetableWindows?: BossUntargetableWindow[]
): TimelineResult {
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
  // DoTストリームのマップ（skillId → DoTStream）
  const dotStreams: Map<string, DoTStream> = new Map();
  // チャージ状態追跡: skillId → { charges: 残りチャージ数, nextChargeAt: 次のチャージ回復時刻 }
  const skillChargeState: Map<string, { charges: number; nextChargeAt: number | null }> = new Map();

  // コンボ状態追跡
  let lastComboSkillId: string | null = null;
  let lastComboTime = -Infinity;

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
    const originalSkill = skillMap.get(entry.skillId);
    if (!originalSkill) continue;

    let startTime: number;

    if (originalSkill.type === "gcd") {
      const baseRecast = stats ? calcGcd(originalSkill.recastTime, stats) : originalSkill.recastTime;
      startTime = Math.max(gcdAvailableAt, actionAvailableAt);
      startTime = Math.round(startTime * 1000) / 1000;

      // 期限切れバフを除去
      for (let i = currentActiveBuffs.length - 1; i >= 0; i--) {
        if (currentActiveBuffs[i].endTime <= startTime) {
          currentActiveBuffs.splice(i, 1);
        }
      }

      // 速度バフを適用してリキャスト・詠唱時間計算
      const speedMul = getSpeedMultiplier(currentActiveBuffs, buffDefMap);
      const recastTime = Math.round(baseRecast * speedMul * 1000) / 1000;
      const castTime = originalSkill.castTime
        ? Math.round(originalSkill.castTime * speedMul * 1000) / 1000
        : 0;

      gcdAvailableAt = startTime + recastTime;
      // 詠唱中はoGCDを挟めない: actionAvailableAtは詠唱完了時刻かアニメーションロック完了時刻の遅い方
      actionAvailableAt = startTime + Math.max(castTime, originalSkill.animationLock);
    } else {
      startTime = actionAvailableAt;
      startTime = Math.round(startTime * 1000) / 1000;

      // 期限切れバフを除去
      for (let i = currentActiveBuffs.length - 1; i >= 0; i--) {
        if (currentActiveBuffs[i].endTime <= startTime) {
          currentActiveBuffs.splice(i, 1);
        }
      }

      actionAvailableAt = startTime + originalSkill.animationLock;
    }

    // 自動変化チェック: バフ条件を満たす場合、変化先スキルに差し替え
    let skill = originalSkill;
    let resolvedSkillId = entry.skillId;
    if (originalSkill.autoTransform) {
      const transformBuff = currentActiveBuffs.find(
        (ab) => ab.buffId === originalSkill.autoTransform!.buffId
      );
      if (transformBuff) {
        const transformedSkill = skillMap.get(originalSkill.autoTransform.skillId);
        if (transformedSkill) {
          skill = transformedSkill;
          resolvedSkillId = transformedSkill.id;
        }
      }
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

    // バフスタック消費チェック
    const comboErrors: string[] = [];
    if (skill.buffConsumptions) {
      for (const consumption of skill.buffConsumptions) {
        const activeBuff = currentActiveBuffs.find((ab) => ab.buffId === consumption.buffId);
        if (!activeBuff || (activeBuff.stacks ?? 0) < consumption.stacks) {
          comboErrors.push(consumption.buffId);
        }
      }
    }

    // WSコンボ判定: comboFromが設定されているGCDスキルのコンボ成否を判定
    let wsComboError = false;
    if (skill.comboFrom && skill.type === "gcd") {
      const comboTimerExpired = (startTime - lastComboTime) >= COMBO_TIMER;
      const comboMatch = lastComboSkillId !== null && skill.comboFrom.includes(lastComboSkillId);
      wsComboError = comboTimerExpired || !comboMatch;
    }

    // コンボ成否に基づく威力決定
    let resolvedPotency = skill.potency;
    if (wsComboError && skill.nonComboPotency !== undefined) {
      resolvedPotency = skill.nonComboPotency;
    }

    // ボス離脱中チェック（敵対象スキルのみ。味方対象・自己対象はボス離脱中でも実行可）
    const untargetableError = skill.target === "enemy" && untargetableWindows
      ? isInUntargetableWindow(startTime, untargetableWindows)
      : false;

    // チャージ回復処理 & リキャストチェック
    let recastError = false;
    if (skill.cooldown !== undefined) {
      const maxCharges = skill.maxCharges ?? 1;
      const state = skillChargeState.get(skill.id);
      if (state) {
        // チャージ回復: nextChargeAtからcooldown間隔で回復
        while (state.nextChargeAt !== null && state.charges < maxCharges && state.nextChargeAt <= startTime) {
          state.charges++;
          if (state.charges < maxCharges) {
            state.nextChargeAt = Math.round((state.nextChargeAt + skill.cooldown) * 1000) / 1000;
          } else {
            state.nextChargeAt = null;
          }
        }
        recastError = state.charges <= 0;
      }
      // state未登録 = 初回使用 → エラーなし
    }

    // GCDスキル実行前に、consumeOnGcd対象のバフIDを記録しておく
    // （スキル実行中に新たに付与されたバフは消費対象外）
    const consumeOnGcdTargets: string[] = [];
    if (skill.type === "gcd") {
      for (const ab of currentActiveBuffs) {
        const def = buffDefMap.get(ab.buffId);
        if (def?.effects.some((e) => e.type === "consumeOnGcd")) {
          consumeOnGcdTargets.push(ab.buffId);
        }
      }
    }

    // ハードエラー判定: リソース不足・バフスタック不足・ボス離脱・リキャスト中
    // （wsComboErrorはハードエラーではない: スキルは実行されるが非コンボ威力になる）
    const hasError = resourceErrors.length > 0 || comboErrors.length > 0 || untargetableError || recastError;

    // 威力倍率・クリティカル判定をバフ適用前に計算（スキル自身が付与するバフは自分には適用されない）
    const buffMultiplierBeforeApply = hasError ? 1 : getPotencyMultiplier(currentActiveBuffs, buffDefMap);
    const guaranteedCritBeforeApply = !hasError && skill.type === "gcd" && hasGuaranteedCrit(currentActiveBuffs, buffDefMap);
    // バフによるCRT率ボーナス（guaranteedCritとは別に計算。DoTスナップショットでも使用）
    const baseCritRateBonus = hasError ? 0 : getCritRateBonus(currentActiveBuffs, buffDefMap);
    // 直接ダメージ用: guaranteedCritの場合は100%に上書き
    const critRateBonusBeforeApply = guaranteedCritBeforeApply ? 1 : baseCritRateBonus;
    const dhRateBonusBeforeApply = hasError ? 0 : getDhRateBonus(currentActiveBuffs, buffDefMap);

    if (!hasError) {
      // リソース変動を適用
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

      // コンボ成立時のみのリソース変動を適用
      if (!wsComboError && skill.comboResourceChanges) {
        for (const change of skill.comboResourceChanges) {
          const def = resourceDefMap.get(change.resourceId);
          if (!def) continue;
          const prevValue = resourceState[change.resourceId];
          resourceState[change.resourceId] = Math.max(
            0,
            Math.min(prevValue + change.amount, def.maxStacks)
          );

          if (
            def.autoGenerateInterval &&
            resourceState[change.resourceId] < def.maxStacks &&
            autoGenTimers[change.resourceId].startedAt === null
          ) {
            autoGenTimers[change.resourceId].startedAt = startTime;
          }
        }
      }

      // バフスタック消費を適用
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

      // コンボ成立時のみのバフ適用
      if (!wsComboError && skill.comboBuffApplications) {
        for (const buffId of skill.comboBuffApplications) {
          const buffDef = buffDefMap.get(buffId);
          if (!buffDef) continue;

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

      // チャージ消費 & クールダウン開始
      if (skill.cooldown !== undefined) {
        const maxCharges = skill.maxCharges ?? 1;
        const state = skillChargeState.get(skill.id);
        if (state) {
          state.charges--;
          // チャージが最大から減った場合、回復タイマーを開始
          if (state.nextChargeAt === null) {
            state.nextChargeAt = Math.round((startTime + skill.cooldown) * 1000) / 1000;
          }
        } else {
          // 初回使用: チャージ状態を初期化（maxCharges - 1 残り）
          skillChargeState.set(skill.id, {
            charges: maxCharges - 1,
            nextChargeAt: Math.round((startTime + skill.cooldown) * 1000) / 1000,
          });
        }
      }

      // DoT適用: スキルにdotPotency/dotDurationがあればDoTを適用
      // コンボ不成立時はDoTを適用しない（コンボ成立時の追加効果扱い）
      if (skill.dotPotency && skill.dotDuration && !wsComboError) {
        const buffMultiplier = buffMultiplierBeforeApply;
        const dotCritRateBonus = baseCritRateBonus;
        const dotDhRateBonus = dhRateBonusBeforeApply;
        const endTime = Math.round((startTime + skill.dotDuration) * 1000) / 1000;

        const existing = dotStreams.get(skill.id);
        if (existing) {
          // 再適用: endTimeとバフスナップショットを更新、ティックタイマーはリセットしない
          existing.currentEndTime = endTime;
          existing.segments.push({ appliedAt: startTime, endTime, buffMultiplier, critRateBonus: dotCritRateBonus, dhRateBonus: dotDhRateBonus });
        } else {
          // 初回適用: 新規DoTストリーム作成
          dotStreams.set(skill.id, {
            skillId: skill.id,
            icon: skill.icon,
            dotPotency: skill.dotPotency,
            firstAppliedAt: startTime,
            currentEndTime: endTime,
            segments: [{ appliedAt: startTime, endTime, buffMultiplier, critRateBonus: dotCritRateBonus, dhRateBonus: dotDhRateBonus }],
          });
        }
      }
    }

    // バフ適用前に計算済みの値を使用（スキル自身が付与するバフは自分の威力に含めない）
    const buffMultiplier = buffMultiplierBeforeApply;
    const guaranteedCrit = guaranteedCritBeforeApply;
    const critRateBonus = critRateBonusBeforeApply;
    const dhRateBonus = dhRateBonusBeforeApply;

    // GCDスキル実行後、確定クリティカルバフを自動消費
    if (!hasError && skill.type === "gcd" && guaranteedCrit) {
      consumeGuaranteedCritBuffs(currentActiveBuffs, buffDefMap);
    }

    // GCDスキル実行後、スキル実行前にアクティブだったconsumeOnGcdバフを消費（竜眼等）
    // スキル実行中に新規付与されたバフは消費しない
    if (!hasError && consumeOnGcdTargets.length > 0) {
      for (const buffId of consumeOnGcdTargets) {
        const idx = currentActiveBuffs.findIndex((ab) => ab.buffId === buffId);
        if (idx >= 0) {
          const ab = currentActiveBuffs[idx];
          if (ab.stacks !== undefined) {
            ab.stacks = Math.max(0, ab.stacks - 1);
            if (ab.stacks === 0) {
              currentActiveBuffs.splice(idx, 1);
            }
          } else {
            currentActiveBuffs.splice(idx, 1);
          }
        }
      }
    }

    // コンボ状態更新: GCDスキルを使用した場合、コンボ状態を更新
    // comboFromを持つスキルまたはコンボ系スキルの起点となるスキルはコンボ状態を更新する
    if (skill.type === "gcd" && !hasError) {
      lastComboSkillId = resolvedSkillId;
      lastComboTime = startTime;
    }

    resolved.push({
      uid: entry.uid,
      skillId: entry.skillId,
      resolvedSkillId,
      resolvedPotency,
      startTime,
      resourceSnapshot: snapshot,
      resourceErrors,
      comboErrors,
      untargetableError,
      recastError,
      wsComboError,
      activeBuffs: [...currentActiveBuffs],
      buffMultiplier,
      critRateBonus,
      dhRateBonus,
    });
  }

  // DoTティックを計算 & activeDoTsを生成
  const dotTicks: DoTTick[] = [];
  let dotTotalPotency = 0;
  const allDoTs: ActiveDoT[] = [];

  for (const stream of dotStreams.values()) {
    // activeDoTs生成（タイムライン表示用: 各セグメントをActiveDoTとして記録）
    for (const seg of stream.segments) {
      allDoTs.push({
        skillId: stream.skillId,
        startTime: seg.appliedAt,
        endTime: seg.endTime,
        potency: stream.dotPotency,
        icon: stream.icon,
        buffMultiplier: seg.buffMultiplier,
      });
    }

    // ティック生成: サーバーティック（3の倍数秒）に合わせて生成、最終endTimeまで
    // 付与時刻の直後の3の倍数秒から開始（付与時刻ちょうどは含めない）
    let tickTime = Math.ceil(stream.firstAppliedAt / DOT_TICK_INTERVAL) * DOT_TICK_INTERVAL;
    if (tickTime <= stream.firstAppliedAt) {
      tickTime += DOT_TICK_INTERVAL;
    }
    while (tickTime <= stream.currentEndTime) {
      // このティック時点で有効なセグメントのバフ倍率を取得
      // （最後に適用されたセグメントで appliedAt <= tickTime のもの）
      let activeSegment = stream.segments[0];
      for (const seg of stream.segments) {
        if (seg.appliedAt <= tickTime) {
          activeSegment = seg;
        } else {
          break;
        }
      }

      // ボス離脱中のティックはスキップ
      if (!untargetableWindows || !isInUntargetableWindow(tickTime, untargetableWindows)) {
        const potency = Math.floor(stream.dotPotency * activeSegment.buffMultiplier);
        dotTicks.push({
          time: Math.round(tickTime * 1000) / 1000,
          potency,
          skillId: stream.skillId,
          icon: stream.icon,
          critRateBonus: activeSegment.critRateBonus,
          dhRateBonus: activeSegment.dhRateBonus,
        });
        dotTotalPotency += potency;
      }
      tickTime += DOT_TICK_INTERVAL;
    }
  }

  // ティックを時刻順にソート
  dotTicks.sort((a, b) => a.time - b.time);

  // 最後のGCDのリキャスト完了時刻を算出
  let lastGcdEndTime = 0;
  for (const entry of resolved) {
    const skill = skillMap.get(entry.resolvedSkillId);
    if (!skill || skill.type !== "gcd") continue;
    const baseRecast = stats ? calcGcd(skill.recastTime, stats) : skill.recastTime;
    const speedMul = getSpeedMultiplier(entry.activeBuffs, buffDefMap);
    const recastTime = Math.round(baseRecast * speedMul * 1000) / 1000;
    const endTime = entry.startTime + recastTime;
    if (endTime > lastGcdEndTime) lastGcdEndTime = endTime;
  }

  return {
    entries: resolved,
    dotTicks,
    dotTotalPotency,
    activeDoTs: allDoTs,
    lastGcdEndTime,
  };
}

/**
 * 指定範囲内のPPS（Power Per Second）を計算する。
 * - 直接威力: startTime が範囲内にあるスキルの威力を合算（resolvedPotencyを使用）
 * - DoT威力: time が範囲内にあるDoTティックの威力を合算
 * - PPS = 合計威力 / 範囲の秒数
 */
export function calcPps(
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>,
  dotTicks: DoTTick[],
  rangeStart: number,
  rangeEnd: number,
  stats: CharacterStats
): { pps: number; totalPotency: number; directPotency: number; dotPotency: number } {
  const duration = rangeEnd - rangeStart;
  if (duration <= 0) return { pps: 0, totalPotency: 0, directPotency: 0, dotPotency: 0 };

  let directPotency = 0;
  for (const entry of resolvedEntries) {
    if (entry.startTime >= rangeStart && entry.startTime < rangeEnd) {
      // ハードエラーのあるスキルはダメージ計算対象外
      const hasError = entry.resourceErrors.length > 0 || entry.comboErrors.length > 0 || entry.untargetableError || entry.recastError;
      if (hasError) continue;
      // resolvedPotencyを使用（コンボ成否・自動変化を反映済み）
      const buffedPotency = Math.floor(entry.resolvedPotency * entry.buffMultiplier);
      const entryMul = calcExpectedMultiplier(stats, entry.critRateBonus, entry.dhRateBonus);
      directPotency += Math.floor(buffedPotency * entryMul);
    }
  }

  let dotPotency = 0;
  for (const tick of dotTicks) {
    if (tick.time >= rangeStart && tick.time < rangeEnd) {
      const dotMul = calcExpectedMultiplier(stats, tick.critRateBonus, tick.dhRateBonus);
      dotPotency += Math.floor(tick.potency * dotMul);
    }
  }

  const totalPotency = directPotency + dotPotency;
  const pps = totalPotency / duration;

  return { pps, totalPotency, directPotency, dotPotency };
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
  const skill = skillMap.get(last.resolvedSkillId);
  const state: ResourceSnapshot = { ...last.resourceSnapshot };

  // エラーのあるスキルはリソース変動を適用しない
  const hasError = last.resourceErrors.length > 0 || last.comboErrors.length > 0 || last.untargetableError || last.recastError;
  if (!hasError && skill?.resourceChanges) {
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
