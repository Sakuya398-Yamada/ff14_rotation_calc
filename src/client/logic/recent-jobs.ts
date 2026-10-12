import type { JobId } from "../data/job-registry";
import { isImplementedJob } from "../data/job-catalog";

export const RECENT_JOBS_STORAGE_KEY = "ff14-rotation-calc:recent-jobs";
export const MAX_RECENT_JOBS = 3;

/** 先頭に追加し、重複を除いて上限件数に切り詰める */
export function pushRecentJob(recent: JobId[], jobId: JobId): JobId[] {
  return [jobId, ...recent.filter((id) => id !== jobId)].slice(0, MAX_RECENT_JOBS);
}

export function deserializeRecentJobs(json: string | null): JobId[] {
  if (json === null) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  // 未実装になった・不正な ID は捨てる
  const valid = raw.filter((id): id is JobId => typeof id === "string" && isImplementedJob(id));
  return [...new Set(valid)].slice(0, MAX_RECENT_JOBS);
}

export function loadRecentJobs(): JobId[] {
  try {
    return deserializeRecentJobs(window.localStorage.getItem(RECENT_JOBS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecentJobs(recent: JobId[]): void {
  try {
    window.localStorage.setItem(RECENT_JOBS_STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // 保存できない環境ではセッション中のみ有効
  }
}
