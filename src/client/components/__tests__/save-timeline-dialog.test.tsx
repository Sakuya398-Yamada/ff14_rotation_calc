// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { SaveTimelineDialog } from "../SaveTimelineDialog";
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

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse({ id: ID }, 201));
  vi.stubGlobal("fetch", fetchMock);
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
    ["通信エラー", "network", () => Promise.reject(new TypeError("Failed to fetch"))],
  ] as const)("%s のときはメッセージを出し、もう一度保存できる", async (_label, error: SaveError, respond) => {
    fetchMock.mockImplementation(respond);
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_ERROR_MESSAGES[error]);
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
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
