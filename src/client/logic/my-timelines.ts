/** GET /api/me/timelines の 1 件（サーバーも satisfies でこの形に合わせる） */
export interface MyTimelineItem {
  id: string;
  title: string | null;
  job: string;
  level: number;
  contentId: string | null;
  /** ISO 8601（UTC） */
  createdAt: string;
}

/** GET /api/me/timelines の応答。nextCursor を ?cursor= に渡すと続きを返す（無ければ null） */
export interface MyTimelinesResponse {
  items: MyTimelineItem[];
  nextCursor: string | null;
}

export type MyTimelinesOutcome =
  | { kind: "loaded"; items: MyTimelineItem[]; nextCursor: string | null }
  | { kind: "cancelled" }
  | { kind: "error" };

const FAILED: MyTimelinesOutcome = { kind: "error" };

/**
 * この Cookie（匿名トークン）で保存したタイムラインを、新しい順に 1 ページ分取得する。
 * cursor は前のページの nextCursor（1 ページ目は null）
 */
export async function fetchMyTimelines(
  cursor: string | null,
  deps: { signal?: AbortSignal } = {},
): Promise<MyTimelinesOutcome> {
  const url = cursor === null ? "/api/me/timelines" : `/api/me/timelines?cursor=${encodeURIComponent(cursor)}`;
  try {
    const res = await fetch(url, { signal: deps.signal });
    // 400 はサーバーが発行したカーソルが壊れたときだけなので、利用者には通信の失敗と同じに見せる
    if (!res.ok) return FAILED;
    const body = (await res.json()) as Partial<MyTimelinesResponse>;
    if (!Array.isArray(body.items) || (typeof body.nextCursor !== "string" && body.nextCursor !== null)) return FAILED;
    return { kind: "loaded", items: body.items, nextCursor: body.nextCursor };
  } catch {
    return deps.signal?.aborted ? { kind: "cancelled" } : FAILED;
  }
}

export type DeleteMyTimelineError = "rate_limited" | "network";

export type DeleteMyTimelineOutcome =
  | { kind: "deleted" }
  | { kind: "cancelled" }
  | { kind: "error"; error: DeleteMyTimelineError };

/** この Cookie（匿名トークン）で保存したタイムラインを削除する */
export async function deleteMyTimeline(
  id: string,
  deps: { signal?: AbortSignal } = {},
): Promise<DeleteMyTimelineOutcome> {
  try {
    const res = await fetch(`/api/timelines/${encodeURIComponent(id)}`, { method: "DELETE", signal: deps.signal });
    // 404 は、別のタブで削除済みのときなど。どちらにしても、もう開けないので一覧から外す
    if (res.status === 204 || res.status === 404) return { kind: "deleted" };
    if (res.status === 429) return { kind: "error", error: "rate_limited" };
    return { kind: "error", error: "network" };
  } catch {
    return deps.signal?.aborted ? { kind: "cancelled" } : { kind: "error", error: "network" };
  }
}
