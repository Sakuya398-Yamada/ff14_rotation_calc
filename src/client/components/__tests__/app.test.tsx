// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from "vitest";
import i18next from "i18next";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "../App";

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
    const header = screen.getByRole("banner");
    expect(within(header).queryByRole("link", { name: "Discord でログイン" })).not.toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    expect(within(header).queryByText("ログイン中")).not.toBeInTheDocument();
    expect(within(header).queryByRole("link", { name: "プライバシーポリシー" })).not.toBeInTheDocument();
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
    expect(await within(dialog).findByText("ログイン中")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "ログアウト" }));

    expect(await within(dialog).findByRole("link", { name: "Discord でログイン" })).toBeInTheDocument();
    expect(within(dialog).queryByText("ログイン中")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });

  it("保存したタイムラインの一覧に、ログインの状態を渡す", async () => {
    me = { loginAvailable: true, loggedIn: true };
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "保存したタイムライン" }));

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
