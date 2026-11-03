import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMyTimeline, fetchMyTimelines, type MyTimelinesResponse } from "../my-timelines";

const RESPONSE: MyTimelinesResponse = {
  items: [
    { id: "V1StGXR8_Z5jdHi6B-myT", title: "零式4層", job: "blm", level: 100, contentId: null, createdAt: "2026-10-23T00:00:00.000Z" },
  ],
  nextCursor: "1761177600.V1StGXR8_Z5jdHi6B-myT",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse(RESPONSE));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMyTimelines", () => {
  it("1 ページ目は /api/me/timelines を取得し、items と nextCursor を返す", async () => {
    const controller = new AbortController();
    const outcome = await fetchMyTimelines(null, { signal: controller.signal });

    expect(outcome).toEqual({ kind: "loaded", ...RESPONSE });
    expect(fetchMock).toHaveBeenCalledWith("/api/me/timelines", { signal: controller.signal });
  });

  it("続きは cursor を URL エンコードして ?cursor= に付ける（cursor の中身は解釈しない）", async () => {
    await fetchMyTimelines("1761177600.a+b");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/me/timelines?cursor=1761177600.a%2Bb");
  });

  it.each([
    ["400", () => Promise.resolve(jsonResponse({ error: "invalid_request" }, 400))],
    ["500", () => Promise.resolve(jsonResponse({ error: "internal" }, 500))],
    ["通信断（fetch が reject する）", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["200 だが本文が JSON でない", () => Promise.resolve(new Response("<!DOCTYPE html>", { status: 200 }))],
    ["200 だが items が無い", () => Promise.resolve(jsonResponse({ nextCursor: null }))],
    ["200 だが nextCursor が無い", () => Promise.resolve(jsonResponse({ items: [] }))],
  ] as const)("%s → エラー", async (_label, respond) => {
    fetchMock.mockImplementation(respond);

    expect(await fetchMyTimelines(null)).toEqual({ kind: "error" });
  });

  it("取得中に中断されたら、通信エラーにしない", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const controller = new AbortController();
    const pending = fetchMyTimelines(null, { signal: controller.signal });
    controller.abort();

    expect(await pending).toEqual({ kind: "cancelled" });
  });
});

describe("deleteMyTimeline", () => {
  const ID = "V1StGXR8_Z5jdHi6B-myT";

  it("DELETE /api/timelines/<id> を送り、204 なら deleted を返す", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const controller = new AbortController();
    const outcome = await deleteMyTimeline(ID, { signal: controller.signal });

    expect(outcome).toEqual({ kind: "deleted" });
    expect(fetchMock).toHaveBeenCalledWith(`/api/timelines/${ID}`, { method: "DELETE", signal: controller.signal });
  });

  it("id を URL エンコードする", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await deleteMyTimeline("a/b");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/timelines/a%2Fb");
  });

  it("404（別のタブで削除済みなど）も、一覧から外せるよう deleted を返す", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "not_found" }, 404));

    expect(await deleteMyTimeline(ID)).toEqual({ kind: "deleted" });
  });

  it.each([
    ["429", "rate_limited", () => Promise.resolve(jsonResponse({ error: "rate_limited" }, 429))],
    ["403", "network", () => Promise.resolve(new Response("Forbidden", { status: 403 }))],
    ["500", "network", () => Promise.resolve(jsonResponse({ error: "internal" }, 500))],
    ["通信断（fetch が reject する）", "network", () => Promise.reject(new TypeError("Failed to fetch"))],
  ] as const)("%s → エラー（%s）", async (_label, error, respond) => {
    fetchMock.mockImplementation(respond);

    expect(await deleteMyTimeline(ID)).toEqual({ kind: "error", error });
  });

  it("送信中に中断されたら、通信エラーにしない", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const controller = new AbortController();
    const pending = deleteMyTimeline(ID, { signal: controller.signal });
    controller.abort();

    expect(await pending).toEqual({ kind: "cancelled" });
  });
});
