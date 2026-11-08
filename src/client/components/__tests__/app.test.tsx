// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from "vitest";
import i18next from "i18next";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "../App";
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

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App の見出し", () => {
  it("日本語では FF14 表記", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("FF14 Rotation Calculator");
  });

  describe("英語", () => {
    beforeEach(() => i18next.changeLanguage("en"));
    afterEach(() => i18next.changeLanguage("ja"));

    it("英語の <title> と同じ FFXIV 表記", () => {
      render(<App />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("FFXIV Rotation Calculator");
    });
  });
});

describe("App の言語の切り替え", () => {
  it("ヘッダーに言語のリンクが無く、設定ダイアログから英語版に移れる", () => {
    render(<App />);
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/");
  });

  describe("英語", () => {
    beforeEach(() => {
      window.history.replaceState(null, "", "/en/");
      return i18next.changeLanguage("en");
    });
    afterEach(() => {
      window.history.replaceState(null, "", "/");
      return i18next.changeLanguage("ja");
    });

    it("ヘッダーに言語のリンクが無く、設定ダイアログから日本語版に移れる", () => {
      render(<App />);
      expect(screen.queryByRole("link", { name: "日本語" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute("href", "/");
    });
  });
});

describe("App のヘッダーの保存・共有", () => {
  const SAVED_ID = "id0000000000000000002";

  function item(id: string, title: string): MyTimelineItem {
    return { id, title, job: "blm", level: 100, contentId: null, createdAt: "2026-10-23T03:04:05.000Z" };
  }

  function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  // 保存すると、一覧の先頭に保存したものが出る
  let saved: MyTimelineItem[];

  beforeEach(() => {
    saved = [item("id0000000000000000001", "前に保存したもの")];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/me") return jsonResponse({ loginAvailable: false, loggedIn: false }, 200);
        if (url === "/api/me/timelines") return jsonResponse({ items: saved, nextCursor: null }, 200);
        if (url === "/api/timelines" && init?.method === "POST") {
          saved = [item(SAVED_ID, "今保存したもの"), ...saved];
          return jsonResponse({ id: SAVED_ID }, 201);
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    // window.turnstile の代わり。描画したその場でトークンを渡す
    vi.stubGlobal("turnstile", {
      render: (_container: HTMLElement, options: { callback: (token: string) => void }) => {
        options.callback("token");
        return "widget";
      },
      remove: () => {},
    });
  });

  it("保存関係のボタンは「保存・共有」の 1 つだけで、押すと保存したタイムラインの一覧が開く", async () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "保存したタイムライン" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存・共有" }));

    const list = screen.getByRole("dialog", { name: "保存したタイムライン" });
    expect(await within(list).findByRole("link", { name: /前に保存したもの/ })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "タイムラインを保存して共有" })).not.toBeInTheDocument();
  });

  it("一覧の「今のタイムラインを保存」から保存すると共有 URL が出て、閉じると一覧に戻り、保存したものが先頭に出る", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "保存・共有" }));
    const list = screen.getByRole("dialog", { name: "保存したタイムライン" });
    await within(list).findByRole("link", { name: /前に保存したもの/ });

    const saveNewButton = within(list).getByRole("button", { name: "今のタイムラインを保存" });
    fireEvent.click(saveNewButton);
    const saveDialog = screen.getByRole("dialog", { name: "タイムラインを保存して共有" });
    fireEvent.click(within(saveDialog).getByRole("button", { name: "保存" }));
    expect(await within(saveDialog).findByRole("textbox", { name: "共有 URL" })).toHaveValue(
      `${window.location.origin}/t/${SAVED_ID}`,
    );

    fireEvent.click(within(saveDialog).getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog", { name: "タイムラインを保存して共有" })).not.toBeInTheDocument();
    expect(saveNewButton).toHaveFocus();
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("今保存したもの");
  });
});

describe("App のヘッダーの Mint Leaf への書き出し", () => {
  it("「Mint Leaf に書き出す」で書き出しのダイアログが開き、閉じるとボタンにフォーカスが戻る", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: "Mint Leaf に書き出す" });
    fireEvent.click(button);

    const dialog = screen.getByRole("dialog", { name: "Mint Leaf に書き出す" });
    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog", { name: "Mint Leaf に書き出す" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});

describe("App のフッター", () => {
  it("日本語では日本語のプライバシーポリシーにリンクする", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
  });

  describe("英語", () => {
    beforeEach(() => i18next.changeLanguage("en"));
    afterEach(() => i18next.changeLanguage("ja"));

    it("英語のプライバシーポリシーにリンクする", () => {
      render(<App />);
      expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/en/privacy");
    });
  });
});

describe("App のログイン", () => {
  let me: { loginAvailable: boolean; loggedIn: boolean };
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

  // jsdom は HTMLDialogElement の showModal を実装していないため最小限の代替を入れる
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  });

  beforeEach(() => {
    me = { loginAvailable: true, loggedIn: false };
    fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/me") return Response.json(me);
      if (url === "/api/auth/logout") return new Response(null, { status: 204 });
      // 共有タイムラインの取得は返さず、読み込み中のままにする
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  function openSettings(name = "設定") {
    fireEvent.click(screen.getByRole("button", { name }));
    return screen.getByRole("dialog", { name });
  }

  it.each([
    [{ loginAvailable: true, loggedIn: false }, "Discord でログイン"],
    [{ loginAvailable: true, loggedIn: true }, "ログアウト"],
  ])("/api/me が %o でも、ヘッダーにはログイン・ログアウトとプライバシーポリシーのリンクを出さない", async (body, shownInSettings) => {
    me = body;
    render(<App />);
    // 応答を反映したことを、設定ダイアログに出たことで確かめてから、ヘッダーを見る
    await within(openSettings()).findByText(shownInSettings);
    // 設定ダイアログは歯車のボタンと一緒にヘッダーの中に描かれるので、ダイアログの外だけを見る
    const header = screen.getByRole("banner");
    const outsideDialog = (elements: HTMLElement[]) => elements.filter((el) => el.closest("dialog") === null);
    expect(outsideDialog(within(header).queryAllByRole("link", { name: "Discord でログイン" }))).toEqual([]);
    expect(outsideDialog(within(header).queryAllByRole("button", { name: "ログアウト" }))).toEqual([]);
    expect(outsideDialog(within(header).queryAllByRole("link", { name: "プライバシーポリシー" }))).toEqual([]);
  });

  it("ログインしていなければ、設定ダイアログに今のパスへ戻るログインのリンクを出す", async () => {
    render(<App />);
    expect(await within(openSettings()).findByRole("link", { name: "Discord でログイン" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2F"
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.anything());
  });

  it("共有 URL の画面では、設定ダイアログのログインのリンクをそのパスに戻す", async () => {
    window.history.replaceState(null, "", "/t/V1StGXR8_Z5jdHi6B-myT");
    render(<App />);
    expect(await within(openSettings()).findByRole("link", { name: "Discord でログイン" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2Ft%2FV1StGXR8_Z5jdHi6B-myT"
    );
  });

  it("ログインできない環境では、設定ダイアログにアカウントの欄を出さない", async () => {
    me = { loginAvailable: false, loggedIn: false };
    render(<App />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.anything()));
    // 応答を反映するまで待ってから、出ていないことを見る
    await new Promise((resolve) => setTimeout(resolve, 0));
    const dialog = openSettings();
    expect(within(dialog).queryByRole("heading", { name: "アカウント" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Discord でログイン" })).not.toBeInTheDocument();
  });

  it("ログイン中は設定ダイアログにログアウトのボタンを出し、ログアウトするとログインのリンクに戻る", async () => {
    me = { loginAvailable: true, loggedIn: true };
    render(<App />);
    const dialog = openSettings();
    fireEvent.click(await within(dialog).findByRole("button", { name: "ログアウト" }));

    expect(await within(dialog).findByRole("link", { name: "Discord でログイン" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });

  it("保存したタイムラインの一覧に、ログインの状態を渡す", async () => {
    me = { loginAvailable: true, loggedIn: true };
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "保存・共有" }));

    expect(await screen.findByText(/^ログイン中のアカウントで保存したタイムラインを/)).toBeInTheDocument();
  });

  describe("英語", () => {
    beforeEach(() => i18next.changeLanguage("en"));
    afterEach(() => i18next.changeLanguage("ja"));

    it("設定ダイアログのログインのリンクを英語で出す", async () => {
      window.history.replaceState(null, "", "/en/");
      render(<App />);
      expect(await within(openSettings("Settings")).findByRole("link", { name: "Log in with Discord" })).toHaveAttribute(
        "href",
        "/api/auth/discord?returnTo=%2Fen%2F"
      );
    });
  });
});
