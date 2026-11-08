// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, beforeAll, vi } from "vitest";
import i18next from "i18next";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "../App";

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
afterEach(cleanup);

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

  it("ログインしていなければ、ヘッダーに今のパスへ戻るログインのリンクを出す", async () => {
    render(<App />);
    expect(await screen.findByRole("link", { name: "Discord でログイン" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2F"
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.anything());
  });

  it("共有 URL の画面では、そのパスに戻るログインのリンクにする", async () => {
    window.history.replaceState(null, "", "/t/V1StGXR8_Z5jdHi6B-myT");
    render(<App />);
    expect(await screen.findByRole("link", { name: "Discord でログイン" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2Ft%2FV1StGXR8_Z5jdHi6B-myT"
    );
  });

  it("ログインできない環境では、ログインのリンクを出さない", async () => {
    me = { loginAvailable: false, loggedIn: false };
    render(<App />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.anything()));
    // 応答を反映するまで待ってから、出ていないことを見る
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("link", { name: "Discord でログイン" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
  });

  it("ログイン中はログアウトのボタンを出し、ログアウトするとログインのリンクに戻る", async () => {
    me = { loginAvailable: true, loggedIn: true };
    render(<App />);
    expect(await screen.findByText("ログイン中")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(await screen.findByRole("link", { name: "Discord でログイン" })).toBeInTheDocument();
    expect(screen.queryByText("ログイン中")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });

  it("保存したタイムラインの一覧に、ログインの状態を渡す", async () => {
    // jsdom は HTMLDialogElement の showModal を実装していないため最小限の代替を入れる
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    me = { loginAvailable: true, loggedIn: true };
    render(<App />);
    await screen.findByText("ログイン中");
    fireEvent.click(screen.getByRole("button", { name: "保存したタイムライン" }));

    expect(screen.getByText(/^ログイン中のアカウントで保存したタイムラインを/)).toBeInTheDocument();
  });

  describe("英語", () => {
    beforeEach(() => i18next.changeLanguage("en"));
    afterEach(() => i18next.changeLanguage("ja"));

    it("ログインのリンクを英語で出す", async () => {
      window.history.replaceState(null, "", "/en/");
      render(<App />);
      expect(await screen.findByRole("link", { name: "Log in with Discord" })).toHaveAttribute(
        "href",
        "/api/auth/discord?returnTo=%2Fen%2F"
      );
    });
  });
});
