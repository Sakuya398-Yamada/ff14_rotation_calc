import { JOB_DATA } from "../data/job-registry";
import type { JobId } from "../data/job-registry";
import type {
  TimelineEntry,
  CharacterStats,
  BossUntargetableWindow,
  MultiTargetWindow,
  PlayerLevel,
} from "../types/skill";

/** LocalStorage の保存キー */
export const STORAGE_KEY = "ff14-rotation-calc:app-state";

/**
 * 保存データのスキーマバージョン。
 * 保存対象の構造を変えるときはこの値を上げる（旧バージョンのデータは復元せず初期状態にフォールバックする）。
 */
export const SCHEMA_VERSION = 1;

/** LocalStorage に永続化するアプリ状態 */
export interface PersistedAppState {
  version: number;
  selectedJob: JobId;
  level: PlayerLevel;
  entries: TimelineEntry[];
  stats: CharacterStats;
  untargetableWindows: BossUntargetableWindow[];
  multiTargetWindows: MultiTargetWindow[];
}

/** version を除いた保存入力（version は serialize 時に自動付与する） */
export type AppStateSnapshot = Omit<PersistedAppState, "version">;

function isJobId(value: unknown): value is JobId {
  return typeof value === "string" && value in JOB_DATA;
}

function isPlayerLevel(value: unknown): value is PlayerLevel {
  return value === 70 || value === 80 || value === 90 || value === 100;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCharacterStats(value: unknown): value is CharacterStats {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    isFiniteNumber(obj.critical) &&
    isFiniteNumber(obj.directHit) &&
    isFiniteNumber(obj.determination) &&
    isFiniteNumber(obj.speed)
  );
}

function isUntargetableWindow(value: unknown): value is BossUntargetableWindow {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isFiniteNumber(obj.startTime) && isFiniteNumber(obj.endTime);
}

function isMultiTargetWindow(value: unknown): value is MultiTargetWindow {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    isFiniteNumber(obj.startTime) &&
    isFiniteNumber(obj.endTime) &&
    isFiniteNumber(obj.targetCount) &&
    obj.targetCount >= 2
  );
}

function hasEntryShape(value: unknown): value is { uid: string; skillId: string; manualStartTime?: unknown } {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.uid === "string" && typeof obj.skillId === "string";
}

/** アプリ状態を JSON 文字列にシリアライズする */
export function serializeAppState(state: AppStateSnapshot): string {
  const persisted: PersistedAppState = { version: SCHEMA_VERSION, ...state };
  return JSON.stringify(persisted);
}

/**
 * JSON 文字列からアプリ状態を復元する。
 * パース不能・スキーマバージョン不一致・型不正の場合は null を返す（呼び出し側で初期状態にフォールバック）。
 * 選択ジョブに存在しない skillId を参照するエントリは除外して復元する（スキルデータ改訂後の防御）。
 */
export function deserializeAppState(json: string | null): PersistedAppState | null {
  if (json === null || json === "") return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (obj.version !== SCHEMA_VERSION) return null;
  if (!isJobId(obj.selectedJob)) return null;
  if (!isPlayerLevel(obj.level)) return null;
  if (!isCharacterStats(obj.stats)) return null;
  if (!Array.isArray(obj.entries)) return null;
  if (!Array.isArray(obj.untargetableWindows) || !obj.untargetableWindows.every(isUntargetableWindow)) return null;
  if (!Array.isArray(obj.multiTargetWindows) || !obj.multiTargetWindows.every(isMultiTargetWindow)) return null;

  const validSkillIds = new Set(JOB_DATA[obj.selectedJob].skills.map((s) => s.id));
  const entries: TimelineEntry[] = [];
  for (const item of obj.entries) {
    if (!hasEntryShape(item) || !validSkillIds.has(item.skillId)) continue;
    const entry: TimelineEntry = { uid: item.uid, skillId: item.skillId };
    if (isFiniteNumber(item.manualStartTime)) {
      entry.manualStartTime = item.manualStartTime;
    }
    entries.push(entry);
  }

  return {
    version: SCHEMA_VERSION,
    selectedJob: obj.selectedJob,
    level: obj.level,
    entries,
    stats: {
      critical: obj.stats.critical,
      directHit: obj.stats.directHit,
      determination: obj.stats.determination,
      speed: obj.stats.speed,
    },
    untargetableWindows: obj.untargetableWindows.map((w) => ({ startTime: w.startTime, endTime: w.endTime })),
    multiTargetWindows: obj.multiTargetWindows.map((w) => ({
      startTime: w.startTime,
      endTime: w.endTime,
      targetCount: w.targetCount,
    })),
  };
}

/**
 * 復元した entries の uid（`entry-N` 形式）から、次に採番すべき N を求める。
 * uid 衝突による重複エントリ事故を防ぐため、復元後に App 側の uid カウンタへ反映する。
 */
export function computeNextUid(entries: TimelineEntry[]): number {
  let max = 0;
  for (const entry of entries) {
    const match = /^entry-(\d+)$/.exec(entry.uid);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

/** LocalStorage からアプリ状態を読み込む。利用不可・不正データ時は null */
export function loadAppState(): PersistedAppState | null {
  try {
    return deserializeAppState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage 無効環境（プライベートモード等）や SSR では復元しない
    return null;
  }
}

/** LocalStorage へアプリ状態を保存する。容量超過等の失敗は無視する（保存はベストエフォート） */
export function saveAppState(state: AppStateSnapshot): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeAppState(state));
  } catch {
    // 保存失敗でアプリ動作を止めない
  }
}
