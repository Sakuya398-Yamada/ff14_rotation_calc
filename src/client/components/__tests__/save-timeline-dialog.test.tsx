// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { SaveTimelineDialog } from "../SaveTimelineDialog";
import { CONTENT_CATALOG } from "../../data/content-catalog";
import { SAVE_ERROR_MESSAGES, type SaveError } from "../../logic/shared-timeline";
import type { AppStateSnapshot } from "../../logic/timeline-storage";

// jsdom は HTMLDialogElement の showModal / close を実装していないため最小限の代替を入れる
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const ID = "V1StGXR8_Z5jdHi6B-myT";
const PARENT_ID = "abcdefghijklmnopqrstu";
const SHARE_URL = `${window.location.origin}/t/${ID}`;

const SNAPSHOT: AppStateSnapshot = {
  selectedJob: "blm",
  level: 100,
  entries: [{ uid: "entry-1", skillId: "fire-3" }],
  stats: { critical: 3000, directHit: 2000, determination: 2500, speed: 528 },
  untargetableWindows: [],
  multiTargetWindows: [],
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

interface TurnstileOptions {
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

// window.turnstile の代わり。既定では描画したその場でトークンを渡し、描画のたびに別のトークンにする
let turnstile: {
  render: ReturnType<typeof vi.fn<(container: HTMLElement, options: TurnstileOptions) => string>>;
  remove: ReturnType<typeof vi.fn<(widgetId: string) => void>>;
};

function renderedOptions(index = 0): TurnstileOptions {
  return turnstile.render.mock.calls[index][1];
}

function sentToken(index = 0): string | null {
  return new Headers(fetchMock.mock.calls[index][1]?.headers).get("X-Turnstile-Token");
}

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse({ id: ID }, 201));
  vi.stubGlobal("fetch", fetchMock);
  turnstile = {
    render: vi.fn((_container, options) => {
      const n = turnstile.render.mock.calls.length;
      options.callback(`token-${n}`);
      return `widget-${n}`;
    }),
    remove: vi.fn(),
  };
  vi.stubGlobal("turnstile", turnstile);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
});

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

function renderDialog(overrides: Partial<Parameters<typeof SaveTimelineDialog>[0]> = {}) {
  const props = {
    open: true,
    snapshot: SNAPSHOT,
    parentId: null,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    returnFocusRef: createRef<HTMLElement>(),
    ...overrides,
  };
  const result = render(<SaveTimelineDialog {...props} />);
  return { props, ...result };
}

function sentBody(): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as Record<string, unknown>;
}

async function saveAndWaitForUrl() {
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  return screen.findByLabelText("共有 URL");
}

describe("SaveTimelineDialog", () => {
  it("タイトルの入力欄は 100 文字までで、保存後に変更できないことを書いている", () => {
    renderDialog();

    expect(screen.getByLabelText("タイトル（任意）")).toHaveAttribute("maxLength", "100");
    expect(screen.getByRole("dialog")).toHaveTextContent("保存後は変更できません");
  });

  it("保存すると、入力したタイトルと parentId を送り、共有 URL を表示して onSaved を呼ぶ", async () => {
    const { props } = renderDialog({ parentId: PARENT_ID });
    fireEvent.change(screen.getByLabelText("タイトル（任意）"), { target: { value: "零式 4 層" } });

    expect(await saveAndWaitForUrl()).toHaveValue(SHARE_URL);
    expect(sentBody()).toMatchObject({ title: "零式 4 層", parentId: PARENT_ID });
    expect(props.onSaved).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("status")).toHaveTextContent("保存しました");
    // 保存ボタンが消えてフォーカスを失わないよう、コピーボタンに移す
    expect(screen.getByRole("button", { name: "コピー" })).toHaveFocus();
  });

  it.each([
    ["400", "invalid", () => Promise.resolve(jsonResponse({ error: "invalid_request" }, 400))],
    ["413", "too_large", () => Promise.resolve(new Response("Payload Too Large", { status: 413 }))],
    ["429", "rate_limited", () => Promise.resolve(jsonResponse({ error: "rate_limited" }, 429))],
    ["403", "verification_failed", () => Promise.resolve(jsonResponse({ error: "turnstile_failed" }, 403))],
    ["通信エラー", "network", () => Promise.reject(new TypeError("Failed to fetch"))],
  ] as const)("%s のときはメッセージを出し、もう一度保存できる", async (_label, error: SaveError, respond) => {
    fetchMock.mockImplementation(respond);
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_ERROR_MESSAGES[error]);
    // 使ったトークンの代わりを取ってから押せるようになる
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it("保存中はボタンを押せず、続けて押しても 1 回しか送らない", async () => {
    let respond!: (res: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    renderDialog();
    const button = screen.getByRole("button", { name: "保存" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    respond(jsonResponse({ id: ID }, 201));
    await screen.findByLabelText("共有 URL");
  });

  it("コピーすると共有 URL をクリップボードに書き、コピーしたことを表示する", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    renderDialog();
    await saveAndWaitForUrl();
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    expect(await screen.findByRole("button", { name: "コピーしました" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(SHARE_URL);
  });

  it.each([
    ["書き込みが拒否される", () => stubClipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")))],
    ["クリップボードが使えない", () => {}],
  ])("コピーできないとき（%s）は、手でコピーするよう案内して URL を選択する", async (_label, setup) => {
    setup();
    renderDialog();
    const urlInput = await saveAndWaitForUrl();
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("URL を選択してコピーしてください");
    expect(urlInput).toHaveFocus();
  });

  it("閉じるボタンと Esc（cancel）で onClose を呼ぶ", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));

    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("開き直すと、前回の結果とエラーは消え、タイトルは残っている", async () => {
    const { props, rerender } = renderDialog();
    fireEvent.change(screen.getByLabelText("タイトル（任意）"), { target: { value: "零式 4 層" } });
    await saveAndWaitForUrl();

    rerender(<SaveTimelineDialog {...props} open={false} />);
    rerender(<SaveTimelineDialog {...props} open={true} />);

    expect(screen.queryByLabelText("共有 URL")).not.toBeInTheDocument();
    expect(screen.getByLabelText("タイトル（任意）")).toHaveValue("零式 4 層");
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("コンテンツの選択欄は「指定なし」が既定で、マスタを零式・絶の区分に分けて並べる", () => {
    renderDialog();
    const select = screen.getByLabelText("コンテンツ（任意）");

    expect(select).toHaveValue("");
    expect(within(select).getAllByRole("option")).toHaveLength(CONTENT_CATALOG.length + 1);
    expect(within(select).getAllByRole("group").map((g) => g.getAttribute("label"))).toEqual(["零式", "絶"]);
    expect(within(within(select).getByRole("group", { name: "絶" })).getByRole("option", { name: "絶妖星乱舞" })).toHaveValue(
      "dancing-mad"
    );
  });

  it("選んだコンテンツを contentId で送り、指定なしなら contentId を送らない", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("コンテンツ（任意）"), { target: { value: "m4s" } });
    await saveAndWaitForUrl();
    expect(sentBody().contentId).toBe("m4s");

    cleanup();
    fetchMock.mockClear();
    renderDialog();
    await saveAndWaitForUrl();
    expect(sentBody()).not.toHaveProperty("contentId");
  });

  it("開き直しても、コンテンツの選択は残っている", () => {
    const { props, rerender } = renderDialog();
    fireEvent.change(screen.getByLabelText("コンテンツ（任意）"), { target: { value: "fru" } });

    rerender(<SaveTimelineDialog {...props} open={false} />);
    rerender(<SaveTimelineDialog {...props} open={true} />);

    expect(screen.getByLabelText("コンテンツ（任意）")).toHaveValue("fru");
  });

  it("保存中に閉じたら送信を中断し、閉じた後に応答が届いても結果を出さない", async () => {
    let respond!: (res: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    const { props, rerender } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    rerender(<SaveTimelineDialog {...props} open={false} />);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);

    // サーバーが保存を終えて応答した後に、中断が間に合わなかった場合
    await act(async () => respond(jsonResponse({ id: ID }, 201)));
    rerender(<SaveTimelineDialog {...props} open={true} />);

    expect(screen.queryByLabelText("共有 URL")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });
});

describe("SaveTimelineDialog: Turnstile", () => {
  it("トークンを取るまで保存できず、期限が切れたらまた保存できなくなる。取れたトークンをヘッダで送る", async () => {
    turnstile.render.mockReturnValue("widget-1");
    renderDialog();
    const button = screen.getByRole("button", { name: "保存" });
    expect(button).toBeDisabled();

    act(() => renderedOptions().callback("token-a"));
    expect(button).toBeEnabled();
    act(() => renderedOptions()["expired-callback"]());
    expect(button).toBeDisabled();

    act(() => renderedOptions().callback("token-b"));
    await saveAndWaitForUrl();
    expect(sentToken()).toBe("token-b");
  });

  it("保存に失敗したら、使ったトークンの代わりを取るためにウィジェットを描画し直し、次は新しいトークンで送る", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "turnstile_failed" }, 403));
    renderDialog();
    // 描画し直したウィジェットは、まだトークンを渡さない
    turnstile.render.mockReturnValue("widget-2");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByRole("alert");
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(2));

    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
    // 使ったトークンでは押せない
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    act(() => renderedOptions(1).callback("token-2"));
    await saveAndWaitForUrl();
    expect(sentToken(0)).toBe("token-1");
    expect(sentToken(1)).toBe("token-2");
  });

  it("閉じている間はウィジェットを描画せず、閉じたら取り除いてトークンも捨てる", () => {
    const { props, rerender } = renderDialog({ open: false });
    expect(turnstile.render).not.toHaveBeenCalled();

    rerender(<SaveTimelineDialog {...props} open={true} />);
    expect(turnstile.render).toHaveBeenCalledTimes(1);
    rerender(<SaveTimelineDialog {...props} open={false} />);
    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");

    // 開き直して、新しいトークンがまだ来ていないとき
    turnstile.render.mockReturnValue("widget-2");
    rerender(<SaveTimelineDialog {...props} open={true} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("ウィジェットがエラーを知らせたら、メッセージを出して保存できなくする", () => {
    renderDialog();
    act(() => renderedOptions()["error-callback"]());

    expect(screen.getByRole("alert")).toHaveTextContent(SAVE_ERROR_MESSAGES.verification_failed);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("Turnstile のスクリプトを読み込めなかったら、メッセージを出し、次に開いたときに読み込み直す", async () => {
    vi.stubGlobal("turnstile", undefined);
    const scripts = () => document.head.querySelectorAll('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
    const { props, rerender } = renderDialog();
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute("src")).toContain("render=explicit");

    fireEvent.error(scripts()[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_ERROR_MESSAGES.verification_failed);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();

    rerender(<SaveTimelineDialog {...props} open={false} />);
    rerender(<SaveTimelineDialog {...props} open={true} />);
    expect(scripts()).toHaveLength(1);
    fireEvent.error(scripts()[0]);
    await screen.findByRole("alert");
  });
});
