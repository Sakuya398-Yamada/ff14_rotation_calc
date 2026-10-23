import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSharedTimelineId, loadSharedTimeline, type TimelineResponse } from "../shared-timeline";
import { SCHEMA_VERSION, type PersistedAppState } from "../timeline-storage";

const ID = "V1StGXR8_Z5jdHi6B-myT";

function savedState(): PersistedAppState {
  return {
    version: SCHEMA_VERSION,
    selectedJob: "blm",
    level: 90,
    entries: [
      { uid: "entry-1", skillId: "fire-3" },
      { uid: "entry-7", skillId: "fire-4", manualStartTime: 2.5 },
    ],
    stats: { critical: 3000, directHit: 2000, determination: 2500, speed: 528 },
    untargetableWindows: [{ startTime: 30, endTime: 45 }],
    multiTargetWindows: [{ startTime: 0, endTime: 20, targetCount: 3 }],
  };
}

function timelineResponse(overrides: Partial<TimelineResponse> = {}): TimelineResponse {
  return {
    id: ID,
    parentId: null,
    schemaVer: SCHEMA_VERSION,
    data: savedState(),
    title: null,
    contentId: null,
    createdAt: "2026-10-23T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

function deps(overrides: { hasWorkingEntries?: () => boolean; confirmOverwrite?: () => boolean; signal?: AbortSignal } = {}) {
  return {
    hasWorkingEntries: vi.fn(overrides.hasWorkingEntries ?? (() => false)),
    confirmOverwrite: vi.fn(overrides.confirmOverwrite ?? (() => true)),
    signal: overrides.signal,
  };
}

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse(timelineResponse()));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSharedTimelineId", () => {
  it.each([`/t/${ID}`, `/t/${ID}/`])("%s から id を取り出す", (pathname) => {
    expect(getSharedTimelineId(pathname)).toBe(ID);
  });

  it.each(["/", "/t/", `/t/${ID}/extra`, `/x/${ID}`])("%s は共有 URL ではない", (pathname) => {
    expect(getSharedTimelineId(pathname)).toBeNull();
  });
});

describe("loadSharedTimeline", () => {
  it("/api/timelines/<id> を取得し、作業中が空なら確認せずに読み込む", async () => {
    const d = deps();
    const outcome = await loadSharedTimeline(ID, d);

    expect(fetchMock).toHaveBeenCalledWith(`/api/timelines/${ID}`, expect.anything());
    expect(outcome).toEqual({ kind: "apply", id: ID, state: savedState() });
    expect(d.confirmOverwrite).not.toHaveBeenCalled();
  });

  it("作業中にエントリがあり、確認で OK なら読み込む", async () => {
    const d = deps({ hasWorkingEntries: () => true, confirmOverwrite: () => true });
    const outcome = await loadSharedTimeline(ID, d);

    expect(outcome).toEqual({ kind: "apply", id: ID, state: savedState() });
    expect(d.confirmOverwrite).toHaveBeenCalledTimes(1);
  });

  it("作業中にエントリがあり、確認でキャンセルなら読み込まない", async () => {
    const d = deps({ hasWorkingEntries: () => true, confirmOverwrite: () => false });

    expect(await loadSharedTimeline(ID, d)).toEqual({ kind: "cancelled" });
  });

  it("作業中のエントリの有無は、取得が終わってから判定する（読み込み中に足したエントリも確認の対象にする）", async () => {
    const res = deferred<Response>();
    fetchMock.mockReturnValue(res.promise);
    const d = deps();
    const pending = loadSharedTimeline(ID, d);

    await Promise.resolve();
    expect(d.hasWorkingEntries).not.toHaveBeenCalled();
    res.resolve(jsonResponse(timelineResponse()));
    await pending;
    expect(d.hasWorkingEntries).toHaveBeenCalledTimes(1);
  });

  it("deserializeAppState を通し、選択ジョブに無いスキルのエントリは除いて読み込む", async () => {
    const data = { ...savedState(), entries: [...savedState().entries, { uid: "entry-9", skillId: "no-such-skill" }] };
    fetchMock.mockResolvedValue(jsonResponse(timelineResponse({ data })));

    expect(await loadSharedTimeline(ID, deps())).toEqual({ kind: "apply", id: ID, state: savedState() });
  });

  it.each([
    ["404", "not_found", () => Promise.resolve(jsonResponse({ error: "not_found" }, 404))],
    ["500", "network", () => Promise.resolve(jsonResponse({ error: "internal" }, 500))],
    ["通信断（fetch が reject する）", "network", () => Promise.reject(new TypeError("Failed to fetch"))],
    [
      "schemaVer が今の版と違う",
      "unsupported_version",
      () =>
        Promise.resolve(
          jsonResponse(
            timelineResponse({ schemaVer: SCHEMA_VERSION + 1, data: { ...savedState(), version: SCHEMA_VERSION + 1 } }),
          ),
        ),
    ],
    [
      "data の形が不正（level が 75）",
      "invalid_data",
      () => Promise.resolve(jsonResponse(timelineResponse({ data: { ...savedState(), level: 75 } }))),
    ],
    ["本文が JSON でない", "invalid_data", () => Promise.resolve(new Response("<!DOCTYPE html>", { status: 200 }))],
  ] as const)("%s → エラー（%s）で、確認も出さない", async (_label, error, respond) => {
    fetchMock.mockImplementation(respond);
    const d = deps({ hasWorkingEntries: () => true });

    expect(await loadSharedTimeline(ID, d)).toEqual({ kind: "error", error });
    expect(d.hasWorkingEntries).not.toHaveBeenCalled();
    expect(d.confirmOverwrite).not.toHaveBeenCalled();
  });

  it("取得中に中断されたら、通信エラーにせず、確認も出さない", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const controller = new AbortController();
    const d = deps({ hasWorkingEntries: () => true, signal: controller.signal });
    const pending = loadSharedTimeline(ID, d);
    controller.abort();

    expect(await pending).toEqual({ kind: "cancelled" });
    expect(d.confirmOverwrite).not.toHaveBeenCalled();
  });

  it("取得が終わった後に中断されていたら、確認も読み込みもしない", async () => {
    const res = deferred<Response>();
    fetchMock.mockReturnValue(res.promise);
    const controller = new AbortController();
    const d = deps({ hasWorkingEntries: () => true, signal: controller.signal });
    const pending = loadSharedTimeline(ID, d);
    controller.abort();
    res.resolve(jsonResponse(timelineResponse()));

    expect(await pending).toEqual({ kind: "cancelled" });
    expect(d.confirmOverwrite).not.toHaveBeenCalled();
  });
});
