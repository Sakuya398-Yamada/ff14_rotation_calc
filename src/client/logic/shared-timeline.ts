import { SCHEMA_VERSION, deserializeAppState, type AppStateSnapshot, type PersistedAppState } from "./timeline-storage";

/** 保存できるタイトルの最大長（サーバーの検証も同じ値を使う） */
export const MAX_TITLE_LENGTH = 100;

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
  | { kind: "apply"; id: string; state: PersistedAppState; title: string | null; contentId: string | null }
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
  return {
    kind: "apply",
    id,
    state,
    title: typeof body.title === "string" ? body.title : null,
    contentId: typeof body.contentId === "string" ? body.contentId : null,
  };
}

/** 共有 URL（/t/<id>）を作る。getSharedTimelineId の逆 */
export function buildShareUrl(origin: string, id: string): string {
  return `${origin}/t/${id}`;
}

export type SaveError = "invalid" | "too_large" | "rate_limited" | "verification_failed" | "network";

export type SaveOutcome = { kind: "saved"; id: string } | { kind: "cancelled" } | { kind: "error"; error: SaveError };

export const SAVE_ERROR_MESSAGES: Record<SaveError, string> = {
  invalid: "タイムラインに保存できない内容が含まれているため、保存できませんでした。",
  too_large: "タイムラインが大きすぎて保存できません。エントリを減らしてから保存してください。",
  rate_limited: "短時間に続けて保存したため、保存できませんでした。1 分ほど待ってから、もう一度保存してください。",
  verification_failed:
    "ボット対策の確認ができなかったため、保存できませんでした。確認が終わってから、もう一度保存してください（続くときは、ページを再読み込みしてください）。",
  network: "保存できませんでした。通信状況を確かめて、もう一度保存してください。",
};

function saveFailed(error: SaveError): SaveOutcome {
  return { kind: "error", error };
}

/** タイムラインをサーバーに保存する（POST /api/timelines）。保存した行は書き換えられない。turnstileToken は 1 回しか使えない */
export async function saveTimeline(
  request: {
    state: AppStateSnapshot;
    title: string;
    parentId: string | null;
    contentId: string | null;
    turnstileToken: string;
  },
  deps: { signal?: AbortSignal } = {},
): Promise<SaveOutcome> {
  const data: PersistedAppState = { version: SCHEMA_VERSION, ...request.state };
  const title = request.title.trim();
  const body = {
    data,
    ...(title !== "" && { title }),
    ...(request.parentId !== null && { parentId: request.parentId }),
    ...(request.contentId !== null && { contentId: request.contentId }),
  };

  let id: unknown;
  try {
    const res = await fetch("/api/timelines", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Turnstile-Token": request.turnstileToken },
      body: JSON.stringify(body),
      signal: deps.signal,
    });
    // 400 は invalid_request と parent_not_found のどちらも、利用者にはタイムラインの内容の問題として伝える
    if (res.status === 400) return saveFailed("invalid");
    // csrf の 403 は別オリジンのフォーム送信だけで、このアプリからは起きない
    if (res.status === 403) return saveFailed("verification_failed");
    if (res.status === 413) return saveFailed("too_large");
    if (res.status === 429) return saveFailed("rate_limited");
    if (res.status !== 201) return saveFailed("network");
    id = ((await res.json()) as { id?: unknown }).id;
  } catch {
    return deps.signal?.aborted ? { kind: "cancelled" } : saveFailed("network");
  }
  return typeof id === "string" ? { kind: "saved", id } : saveFailed("network");
}
