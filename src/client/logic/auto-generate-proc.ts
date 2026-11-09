import type { BuffDefinition, ResourceDefinition, Skill } from "../types/skill";

/** TimelineEntry.autoGenerateProcOccurred の長さの上限（詩人の歌の 45 秒で 3 秒ごとに 14 回） */
export const MAX_AUTO_GENERATE_PROCS = 14;

/**
 * 発生を指定していない確率の判定（ResourceDefinition.autoGenerateProcRate）の既定の結果。
 * n 回目までに発生した回数が round(確率 × n) になる並び（80% なら 3・8・13 回目が不発で、14 回中 11 回）。#900
 */
export function isDefaultAutoGenerateProc(tickNumber: number, rate: number): boolean {
  return Math.round(rate * tickNumber) > Math.round(rate * (tickNumber - 1));
}

/** 末尾の未指定（null）を切り詰める。指定が 1 つも残らなければ undefined（エントリからキーごと外す） */
export function normalizeAutoGenerateProcOccurred(spec: readonly (boolean | null)[]): (boolean | null)[] | undefined {
  let end = spec.length;
  while (end > 0 && spec[end - 1] === null) end--;
  return end > 0 ? spec.slice(0, end) : undefined;
}

/** n 回目（1 始まり）の判定が発生するか。指定があればそれ、無ければ既定の並びで決める */
export function isAutoGenerateProcOccurred(
  spec: readonly (boolean | null)[] | undefined,
  tickNumber: number,
  rate: number,
): boolean {
  const specified = spec?.[tickNumber - 1];
  return typeof specified === "boolean" ? specified : isDefaultAutoGenerateProc(tickNumber, rate);
}

/**
 * スキルが付ける条件バフの効果中にある、確率の判定。判定は条件バフが付いてから interval 秒ごとに tickCount 回ある
 * （効果が切れる時刻ちょうどは、autoGenerateIncludeBuffEnd が無ければ数えない）。duration は条件バフの効果時間。判定の無いスキルは undefined
 */
export function getAutoGenerateProcSource(
  skill: Skill,
  resources: readonly ResourceDefinition[],
  buffDefMap: ReadonlyMap<string, BuffDefinition>,
): { buffId: string; rate: number; interval: number; tickCount: number; duration: number } | undefined {
  for (const buffId of skill.buffApplications ?? []) {
    const resource = resources.find(
      (r) => r.autoGenerateProcRate !== undefined && r.autoGenerateInterval && r.autoGenerateWhileBuff?.includes(buffId),
    );
    const duration = buffDefMap.get(buffId)?.duration;
    if (!resource || typeof duration !== "number") continue;
    const interval = resource.autoGenerateInterval!;
    const ticks = Math.round((duration / interval) * 1000) / 1000;
    const tickCount = Number.isInteger(ticks) && !resource.autoGenerateIncludeBuffEnd ? ticks - 1 : Math.floor(ticks);
    return { buffId, rate: resource.autoGenerateProcRate!, interval, tickCount, duration };
  }
  return undefined;
}
