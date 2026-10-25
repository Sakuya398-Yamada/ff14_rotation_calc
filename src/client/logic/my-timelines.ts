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

export const MY_TIMELINES_ERROR_MESSAGE =
  "保存したタイムラインを読み込めませんでした。通信状況を確かめて、もう一度試してください。";

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
