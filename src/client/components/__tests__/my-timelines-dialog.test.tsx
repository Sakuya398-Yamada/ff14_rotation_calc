// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import i18next from "i18next";
import { MyTimelinesDialog } from "../MyTimelinesDialog";
import type { MyTimelineItem } from "../../logic/my-timelines";

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

    expect(await screen.findByRole("alert")).toHaveTextContent(i18next.t("myTimelines.loadError"));
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

  it("「もっと見る」で最後のページを読み込むと、ボタンは消え、足した先頭の行にフォーカスを移す", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(3)], nextCursor: "cursor-1" }))
      .mockResolvedValueOnce(jsonResponse({ items: [item(2), item(1)], nextCursor: null }));
    renderDialog();
    const button = await screen.findByRole("button", { name: "もっと見る" });
    button.focus();
    fireEvent.click(button);

    await vi.waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(3));
    expect(screen.getAllByRole("link")[1]).toHaveFocus();
  });

  it("「もっと見る」に失敗しても、読み込んだ一覧は残し、もう一度押せる", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(2)], nextCursor: "cursor-1" }))
      .mockResolvedValueOnce(jsonResponse({ error: "internal" }, 500));
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "もっと見る" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(i18next.t("myTimelines.loadError"));
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

describe("MyTimelinesDialog: 削除", () => {
  let confirmMock: ReturnType<typeof vi.fn<(message?: string) => boolean>>;

  beforeEach(() => {
    // jsdom は window.confirm を実装していないため差し替える
    confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
  });

  function deleteButton(title: string) {
    return screen.getByRole("button", { name: `「${title}」を削除` });
  }

  it("各行の削除ボタンで確認を出し、OK なら DELETE を送って行を一覧から外し、次の行にフォーカスを移す", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(2), item(1)], nextCursor: null }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(deleteButton("タイムライン 2"));

    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining("「タイムライン 2」を削除しますか？"));
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/timelines/${item(2).id}`);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");
    await vi.waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(1));
    expect(screen.getByRole("link")).toHaveTextContent("タイムライン 1");
    expect(screen.getByRole("link")).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("最後の行を削除すると前の行に、全部削除すると無いことを表示して閉じるボタンにフォーカスを移す", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(2), item(1)], nextCursor: null }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(deleteButton("タイムライン 1"));

    await vi.waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(1));
    expect(screen.getByRole("link")).toHaveTextContent("タイムライン 2");
    expect(screen.getByRole("link")).toHaveFocus();

    fireEvent.click(deleteButton("タイムライン 2"));
    expect(await screen.findByText("このブラウザで保存したタイムラインはありません。")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "閉じる" }).at(-1)).toHaveFocus();
  });

  it("タイトルの無い行は「（無題）」として確認する", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item(1, { title: null })], nextCursor: null }));
    confirmMock.mockReturnValue(false);
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(deleteButton("（無題）"));

    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining("「（無題）」を削除しますか？"));
  });

  it("確認でキャンセルしたら送らず、行も残す", async () => {
    confirmMock.mockReturnValue(false);
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(deleteButton("タイムライン 1"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("削除中はどの行の削除ボタンも押せず、応答が届いたら押せるようにする", async () => {
    let respond!: (res: Response) => void;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(2), item(1)], nextCursor: null }))
      .mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(deleteButton("タイムライン 2"));

    expect(deleteButton("タイムライン 2")).toBeDisabled();
    expect(deleteButton("タイムライン 2")).toHaveTextContent("削除中…");
    expect(deleteButton("タイムライン 1")).toBeDisabled();
    await act(async () => respond(new Response(null, { status: 204 })));
    expect(deleteButton("タイムライン 1")).toBeEnabled();
  });

  it.each([
    ["429", () => Promise.resolve(jsonResponse({ error: "rate_limited" }, 429)), "短時間に続けて保存・削除したため"],
    ["通信断", () => Promise.reject(new TypeError("Failed to fetch")), "削除できませんでした。通信状況を確かめて"],
  ] as const)("削除に失敗したら（%s）行を残してエラーを出し、押せるようにした削除ボタンにフォーカスを戻す", async (_label, respond, message) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item(1)], nextCursor: null })).mockImplementationOnce(respond);
    renderDialog();
    await screen.findAllByRole("link");
    const button = deleteButton("タイムライン 1");
    button.focus();
    fireEvent.click(button);
    // ブラウザは無効にしたボタンからフォーカスを外す。jsdom は外さず、無効なボタンの blur() も効かないので、ほかの要素に移して同じく外れた状態にする
    expect(button).toBeDisabled();
    screen.getByRole("link").focus();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(deleteButton("タイムライン 1")).toBeEnabled();
    expect(deleteButton("タイムライン 1")).toHaveFocus();
  });

  it("削除のエラーは、閉じて開き直すと消す", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(1)], nextCursor: null }))
      .mockResolvedValueOnce(jsonResponse({ error: "internal" }, 500));
    const { props, rerender } = renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(deleteButton("タイムライン 1"));
    await screen.findByRole("alert");
    rerender(<MyTimelinesDialog {...props} open={false} />);
    rerender(<MyTimelinesDialog {...props} open={true} />);

    await screen.findAllByRole("link");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("削除中に閉じると送信を中断し、閉じた後に応答が届いても、開き直したときに削除中の表示やエラーを残さない", async () => {
    let respond!: (res: Response) => void;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(1)], nextCursor: null }))
      .mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));
    const { props, rerender } = renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(deleteButton("タイムライン 1"));
    rerender(<MyTimelinesDialog {...props} open={false} />);

    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => respond(jsonResponse({ error: "internal" }, 500)));
    rerender(<MyTimelinesDialog {...props} open={true} />);
    await screen.findAllByRole("link");
    expect(deleteButton("タイムライン 1")).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("MyTimelinesDialog: 共有 URL のコピー", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  function stubClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  }

  function copyButton(title: string) {
    return screen.getByRole("button", { name: `「${title}」の共有 URL をコピー` });
  }

  it("各行のコピーボタンで、その行の共有 URL をクリップボードに書き、その行だけにコピーしたことを表示する", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item(2), item(1)], nextCursor: null }));
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(copyButton("タイムライン 1"));

    const copied = await screen.findByRole("button", { name: "「タイムライン 1」の共有 URL をコピーしました" });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/t/${item(1).id}`);
    expect(copied).toHaveTextContent("コピーしました");
    expect(copyButton("タイムライン 2")).toHaveTextContent(/^コピー$/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // 別の行をコピーすると、前の行の表示は戻す
    fireEvent.click(copyButton("タイムライン 2"));
    expect(await screen.findByRole("button", { name: "「タイムライン 2」の共有 URL をコピーしました" })).toBeInTheDocument();
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/t/${item(2).id}`);
    expect(copyButton("タイムライン 1")).toHaveTextContent(/^コピー$/);
  });

  it("タイトルの無い行は「（無題）」としてボタンの名前を付ける", async () => {
    stubClipboard(vi.fn(async () => {}));
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item(1, { title: null })], nextCursor: null }));
    renderDialog();
    await screen.findAllByRole("link");

    expect(copyButton("（無題）")).toBeInTheDocument();
  });

  it.each([
    ["書き込みが拒否される", () => stubClipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")))],
    ["クリップボードが使えない", () => {}],
  ])("コピーできないとき（%s）は、手でコピーするよう案内し、その行の共有 URL を出して選択する", async (_label, setup) => {
    setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [item(2), item(1)], nextCursor: null }));
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(copyButton("タイムライン 1"));

    expect(await screen.findByRole("alert")).toHaveTextContent("URL を選択してコピーしてください");
    const urlInput = screen.getByRole("textbox", { name: "「タイムライン 1」の共有 URL" });
    expect(urlInput).toHaveValue(`${window.location.origin}/t/${item(1).id}`);
    expect(urlInput).toHaveFocus();
    expect(copyButton("タイムライン 1")).toHaveTextContent(/^コピー$/);
  });

  it("コピーに失敗した行を削除すると、出していた URL と案内も消す", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(2), item(1)], nextCursor: null }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(copyButton("タイムライン 1"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "「タイムライン 1」を削除" }));

    await vi.waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(1));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("コピーしたことの表示とコピーに失敗した案内は、閉じて開き直すと消す", async () => {
    stubClipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    const { props, rerender } = renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(copyButton("タイムライン 1"));
    await screen.findByRole("alert");
    rerender(<MyTimelinesDialog {...props} open={false} />);
    rerender(<MyTimelinesDialog {...props} open={true} />);

    await screen.findAllByRole("link");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("書き込みを待つ間に閉じたら、開き直したときにコピーしたことを表示しない", async () => {
    let resolveWrite!: () => void;
    stubClipboard(() => new Promise<void>((resolve) => (resolveWrite = resolve)));
    const { props, rerender } = renderDialog();
    await screen.findAllByRole("link");
    fireEvent.click(copyButton("タイムライン 1"));
    rerender(<MyTimelinesDialog {...props} open={false} />);
    await act(async () => resolveWrite());
    rerender(<MyTimelinesDialog {...props} open={true} />);

    await screen.findAllByRole("link");
    expect(copyButton("タイムライン 1")).toHaveTextContent(/^コピー$/);
  });
});

describe("MyTimelinesDialog（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("共有 URL を /en/t/<id> にし、作成日時を英語の書式で出す", async () => {
    renderDialog();
    const [link] = await screen.findAllByRole("link");

    expect(link).toHaveAttribute("href", `${window.location.origin}/en/t/${item(1).id}`);
    // 日付はテストを動かす環境のタイムゾーンで 22 日か 23 日になる
    expect(link.querySelector("time")).toHaveTextContent(/^Oct 2[23], 2026, \d{1,2}:\d{2}\s?[AP]M$/);
  });

  it("ジョブ名を英語で出す", async () => {
    renderDialog();
    const [link] = await screen.findAllByRole("link");

    expect(link).toHaveTextContent("Black Mage Lv100");
  });

  it("見出し・案内・ボタンと読み込みエラーを英語で出す", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderDialog();

    expect(screen.getByRole("heading", { name: "Saved timelines" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your saved timelines could not be loaded. Check your connection and try again."
    );
    expect(screen.getByRole("button", { name: "Close saved timelines" })).toBeInTheDocument();
  });

  it("削除ボタン・確認・削除のエラーを英語で出す", async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [item(1)], nextCursor: null }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderDialog();
    await screen.findAllByRole("link");
    const button = screen.getByRole("button", { name: 'Delete "タイムライン 1"' });
    expect(button).toHaveTextContent("Delete");
    fireEvent.click(button);

    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('Delete "タイムライン 1"?'));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The timeline could not be deleted. Check your connection and try again."
    );
  });

  it("コピーボタンと、コピーした・できなかったときの表示を英語で出し、/en/t/<id> をコピーする", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      renderDialog();
      await screen.findAllByRole("link");
      const button = screen.getByRole("button", { name: 'Copy the share URL of "タイムライン 1"' });
      expect(button).toHaveTextContent(/^Copy$/);
      fireEvent.click(button);

      expect(await screen.findByRole("button", { name: 'Copied the share URL of "タイムライン 1"' })).toHaveTextContent("Copied");
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/en/t/${item(1).id}`);

      writeText.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
      fireEvent.click(screen.getByRole("button", { name: 'Copied the share URL of "タイムライン 1"' }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy. Select the URL and copy it.");
      expect(screen.getByRole("textbox", { name: 'Share URL of "タイムライン 1"' })).toHaveValue(
        `${window.location.origin}/en/t/${item(1).id}`
      );
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});
