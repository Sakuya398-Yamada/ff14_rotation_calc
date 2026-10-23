import { SCHEMA_VERSION, deserializeAppState, type PersistedAppState } from "./timeline-storage";

/** GET /api/timelines/:id の応答（サーバーも satisfies でこの形に合わせる） */
export interface TimelineResponse {
  id: string;
  parentId: string | null;
  schemaVer: number;
  data: unknown;
  title: string | null;
  contentId: string | null;
  /** ISO 8601（UTC） */
  createdAt: string;
}

export type SharedLoadError = "not_found" | "unsupported_version" | "invalid_data" | "network";

export type SharedLoadOutcome =
  | { kind: "apply"; id: string; state: PersistedAppState }
  | { kind: "cancelled" }
  | { kind: "error"; error: SharedLoadError };

const KEPT_NOTE = "作業中のタイムラインはそのまま残っています。";

export const SHARED_LOAD_ERROR_MESSAGES: Record<SharedLoadError, string> = {
  not_found: `共有タイムラインが見つかりませんでした。URL が正しいか確認してください。${KEPT_NOTE}`,
  unsupported_version: `この共有タイムラインは、今のバージョンでは読み込めない形式で保存されています。${KEPT_NOTE}`,
  invalid_data: `共有タイムラインのデータを読み込めませんでした。${KEPT_NOTE}`,
  network: `共有タイムラインを読み込めませんでした。通信状況を確かめて、ページを再読み込みしてください。${KEPT_NOTE}`,
};

const SHARED_PATH_RE = /^\/t\/([^/]+)\/?$/;

/** 共有 URL（/t/<id>）のパスから id を取り出す。共有 URL でなければ null */
export function getSharedTimelineId(pathname: string): string | null {
  return SHARED_PATH_RE.exec(pathname)?.[1] ?? null;
}

const CANCELLED: SharedLoadOutcome = { kind: "cancelled" };

function failed(error: SharedLoadError): SharedLoadOutcome {
  return { kind: "error", error };
}

/**
 * 共有タイムラインを取得し、作業中のタイムラインを置き換えてよいかまで判定する。
 * 置き換えるのは結果が apply のときだけ（失敗・キャンセル・中断では作業中を残す）。
 */
export async function loadSharedTimeline(
  id: string,
  deps: { signal?: AbortSignal; hasWorkingEntries: () => boolean; confirmOverwrite: () => boolean },
): Promise<SharedLoadOutcome> {
  let text: string;
  try {
    const res = await fetch(`/api/timelines/${encodeURIComponent(id)}`, { signal: deps.signal });
    if (res.status === 404) return failed("not_found");
    if (!res.ok) return failed("network");
    text = await res.text();
  } catch {
    return deps.signal?.aborted ? CANCELLED : failed("network");
  }
  // StrictMode の 1 回目の effect のように、取得後に中断されていたら確認を出さない
  if (deps.signal?.aborted) return CANCELLED;

  let body: Partial<TimelineResponse>;
  try {
    body = JSON.parse(text) as Partial<TimelineResponse>;
  } catch {
    return failed("invalid_data");
  }
  if (typeof body?.schemaVer !== "number") return failed("invalid_data");
  // 旧版からの変換は、SCHEMA_VERSION を上げる Issue で足す
  if (body.schemaVer !== SCHEMA_VERSION) return failed("unsupported_version");
  const state = deserializeAppState(JSON.stringify(body.data));
  if (!state) return failed("invalid_data");

  if (deps.hasWorkingEntries() && !deps.confirmOverwrite()) return CANCELLED;
  return { kind: "apply", id, state };
}
