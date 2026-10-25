// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { MyTimelinesDialog } from "../MyTimelinesDialog";
import { MY_TIMELINES_ERROR_MESSAGE, type MyTimelineItem } from "../../logic/my-timelines";

// jsdom は HTMLDialogElement の showModal / close を実装していないため最小限の代替を入れる
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

function item(n: number, overrides: Partial<MyTimelineItem> = {}): MyTimelineItem {
  return {
    id: `id${String(n).padStart(19, "0")}`,
    title: `タイムライン ${n}`,
    job: "blm",
    level: 100,
    contentId: null,
    createdAt: "2026-10-23T03:04:05.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse({ items: [item(1)], nextCursor: null }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDialog(overrides: Partial<Parameters<typeof MyTimelinesDialog>[0]> = {}) {
  const props = { open: true, onClose: vi.fn(), returnFocusRef: createRef<HTMLElement>(), ...overrides };
  const result = render(<MyTimelinesDialog {...props} />);
  return { props, ...result };
}

describe("MyTimelinesDialog", () => {
  it("開くと 1 ページ目を取得し、各行を共有 URL へのリンクにする（タイトルが無ければ「（無題）」）", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [item(1, { title: "零式4層" }), item(2, { title: null, job: "drg", level: 90 })], nextCursor: null }),
    );
    renderDialog();
    const links = await screen.findAllByRole("link");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/me/timelines");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", `${window.location.origin}/t/${item(1).id}`);
    expect(links[0]).toHaveTextContent("零式4層");
    expect(links[0]).toHaveTextContent("黒魔道士 Lv100");
    expect(links[0].querySelector("time")).toHaveAttribute("dateTime", "2026-10-23T03:04:05.000Z");
    expect(links[1]).toHaveAttribute("href", `${window.location.origin}/t/${item(2).id}`);
    expect(links[1]).toHaveTextContent("（無題）");
    expect(links[1]).toHaveTextContent("竜騎士 Lv90");
    expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
  });

  it("保存が無ければ、無いことを表示する", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], nextCursor: null }));
    renderDialog();

    expect(await screen.findByText("このブラウザで保存したタイムラインはありません。")).toBeInTheDocument();
  });

  it("取得に失敗したらメッセージを出す", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(MY_TIMELINES_ERROR_MESSAGE);
    expect(screen.queryByText("読み込み中…")).not.toBeInTheDocument();
  });

  it("「もっと見る」で nextCursor の続きを取得して後ろに足し、続きが無くなったらボタンを消す", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(2)], nextCursor: "cursor-1" }))
      .mockResolvedValueOnce(jsonResponse({ items: [item(1)], nextCursor: null }));
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "もっと見る" }));

    await vi.waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/me/timelines?cursor=cursor-1");
    expect(screen.getAllByRole("link").map((link) => within(link).getByText(/^タイムライン/).textContent)).toEqual([
      "タイムライン 2",
      "タイムライン 1",
    ]);
    expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
  });

  it("「もっと見る」に失敗しても、読み込んだ一覧は残し、もう一度押せる", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(2)], nextCursor: "cursor-1" }))
      .mockResolvedValueOnce(jsonResponse({ error: "internal" }, 500));
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "もっと見る" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MY_TIMELINES_ERROR_MESSAGE);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "もっと見る" })).toBeEnabled();
  });

  it("閉じると取得を中断し、閉じた後に応答が届いても一覧を出さない。開き直すと取り直す", async () => {
    let respond!: (res: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));
    const { props, rerender } = renderDialog();
    rerender(<MyTimelinesDialog {...props} open={false} />);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);

    await act(async () => respond(jsonResponse({ items: [item(9)], nextCursor: null })));
    rerender(<MyTimelinesDialog {...props} open={true} />);

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
    const links = await screen.findAllByRole("link");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("タイムライン 1");
  });

  it("開き直すと、前回の一覧と「もっと見る」を消してから 1 ページ目を取り直す", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item(2)], nextCursor: "cursor-1" }));
    const { props, rerender } = renderDialog();
    await screen.findAllByRole("link");
    rerender(<MyTimelinesDialog {...props} open={false} />);

    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    rerender(<MyTimelinesDialog {...props} open={true} />);

    expect(fetchMock.mock.calls[1][0]).toBe("/api/me/timelines");
    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
  });

  it("閉じるボタンと Esc（cancel）で onClose を呼び、閉じたら returnFocusRef の要素にフォーカスを戻す", async () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    const { props, rerender } = renderDialog({ returnFocusRef: { current: button } });
    await screen.findAllByRole("link");
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(2);

    rerender(<MyTimelinesDialog {...props} open={false} />);
    expect(button).toHaveFocus();
    button.remove();
  });
});
