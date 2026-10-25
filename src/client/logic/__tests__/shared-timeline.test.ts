import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildShareUrl,
  getSharedTimelineId,
  loadSharedTimeline,
  saveTimeline,
  type TimelineResponse,
} from "../shared-timeline";
import { SCHEMA_VERSION, type AppStateSnapshot, type PersistedAppState } from "../timeline-storage";

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
    expect(outcome).toEqual({ kind: "apply", id: ID, state: savedState(), title: null, contentId: null });
    expect(d.confirmOverwrite).not.toHaveBeenCalled();
  });

  it("作業中にエントリがあり、確認で OK なら読み込む", async () => {
    const d = deps({ hasWorkingEntries: () => true, confirmOverwrite: () => true });
    const outcome = await loadSharedTimeline(ID, d);

    expect(outcome).toEqual({ kind: "apply", id: ID, state: savedState(), title: null, contentId: null });
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

    expect(await loadSharedTimeline(ID, deps())).toEqual({ kind: "apply", id: ID, state: savedState(), title: null, contentId: null });
  });

  it("タイトルとコンテンツの ID を一緒に返す", async () => {
    fetchMock.mockResolvedValue(jsonResponse(timelineResponse({ title: "零式4層 2分", contentId: "m4s" })));

    expect(await loadSharedTimeline(ID, deps())).toMatchObject({ kind: "apply", title: "零式4層 2分", contentId: "m4s" });
  });

  it.each<[string, Record<string, unknown>]>([
    ["数値", { title: 1, contentId: 4 }],
    ["オブジェクト", { title: {}, contentId: {} }],
    ["キーが無い", { title: undefined, contentId: undefined }],
  ])("タイトル・コンテンツの ID が文字列でない（%s）なら null にする", async (_, overrides) => {
    fetchMock.mockResolvedValue(jsonResponse({ ...timelineResponse(), ...overrides }));

    expect(await loadSharedTimeline(ID, deps())).toMatchObject({ kind: "apply", title: null, contentId: null });
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

describe("buildShareUrl", () => {
  it("<origin>/t/<id> を作り、getSharedTimelineId で同じ id に戻る", () => {
    const url = buildShareUrl("https://example.com", ID);

    expect(url).toBe(`https://example.com/t/${ID}`);
    expect(getSharedTimelineId(new URL(url).pathname)).toBe(ID);
  });
});

describe("saveTimeline", () => {
  const TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

  function snapshot(): AppStateSnapshot {
    const { version: _version, ...rest } = savedState();
    return rest;
  }

  function sentBody(): Record<string, unknown> {
    const init = fetchMock.mock.calls[0][1];
    return JSON.parse(init?.body as string) as Record<string, unknown>;
  }

  beforeEach(() => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: ID }, 201));
  });

  it("POST /api/timelines に JSON で送り、201 の id を返す。data には version を付け、Turnstile のトークンはヘッダで送る", async () => {
    const outcome = await saveTimeline({ state: snapshot(), title: "零式 4 層", parentId: null, contentId: null, turnstileToken: TURNSTILE_TOKEN });

    expect(outcome).toEqual({ kind: "saved", id: ID });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/timelines");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(new Headers(init?.headers).get("X-Turnstile-Token")).toBe(TURNSTILE_TOKEN);
    expect(sentBody()).toEqual({ data: savedState(), title: "零式 4 層" });
  });

  it("タイトルは前後の空白を除いて送り、空なら title を送らない", async () => {
    await saveTimeline({ state: snapshot(), title: "  零式  ", parentId: null, contentId: null, turnstileToken: TURNSTILE_TOKEN });
    expect(sentBody().title).toBe("零式");

    fetchMock.mockClear();
    await saveTimeline({ state: snapshot(), title: "   ", parentId: null, contentId: null, turnstileToken: TURNSTILE_TOKEN });
    expect(sentBody()).not.toHaveProperty("title");
  });

  it("parentId があれば送り、null なら送らない", async () => {
    const parentId = "abcdefghijklmnopqrstu";
    await saveTimeline({ state: snapshot(), title: "", parentId, contentId: null, turnstileToken: TURNSTILE_TOKEN });
    expect(sentBody().parentId).toBe(parentId);

    fetchMock.mockClear();
    await saveTimeline({ state: snapshot(), title: "", parentId: null, contentId: null, turnstileToken: TURNSTILE_TOKEN });
    expect(sentBody()).not.toHaveProperty("parentId");
  });

  it("contentId があれば送り、null なら送らない", async () => {
    await saveTimeline({ state: snapshot(), title: "", parentId: null, contentId: "m4s", turnstileToken: TURNSTILE_TOKEN });
    expect(sentBody().contentId).toBe("m4s");

    fetchMock.mockClear();
    await saveTimeline({ state: snapshot(), title: "", parentId: null, contentId: null, turnstileToken: TURNSTILE_TOKEN });
    expect(sentBody()).not.toHaveProperty("contentId");
  });

  it.each([
    ["400（invalid_request）", "invalid", () => Promise.resolve(jsonResponse({ error: "invalid_request" }, 400))],
    ["400（parent_not_found）", "invalid", () => Promise.resolve(jsonResponse({ error: "parent_not_found" }, 400))],
    ["413", "too_large", () => Promise.resolve(new Response("Payload Too Large", { status: 413 }))],
    ["429", "rate_limited", () => Promise.resolve(jsonResponse({ error: "rate_limited" }, 429))],
    ["403（turnstile_failed）", "verification_failed", () => Promise.resolve(jsonResponse({ error: "turnstile_failed" }, 403))],
    ["415", "network", () => Promise.resolve(jsonResponse({ error: "unsupported_media_type" }, 415))],
    ["500", "network", () => Promise.resolve(jsonResponse({ error: "internal" }, 500))],
    ["通信断（fetch が reject する）", "network", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["201 だが本文が JSON でない", "network", () => Promise.resolve(new Response("<!DOCTYPE html>", { status: 201 }))],
    ["201 だが id が無い", "network", () => Promise.resolve(jsonResponse({}, 201))],
  ] as const)("%s → エラー（%s）", async (_label, error, respond) => {
    fetchMock.mockImplementation(respond);

    expect(await saveTimeline({ state: snapshot(), title: "", parentId: null, contentId: null, turnstileToken: TURNSTILE_TOKEN })).toEqual({ kind: "error", error });
  });

  it("送信中に中断されたら、通信エラーにしない", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const controller = new AbortController();
    const pending = saveTimeline({ state: snapshot(), title: "", parentId: null, contentId: null, turnstileToken: TURNSTILE_TOKEN }, { signal: controller.signal });
    controller.abort();

    expect(await pending).toEqual({ kind: "cancelled" });
  });
});
