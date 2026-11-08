// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import i18next from "i18next";
import { AccountControl } from "../AccountControl";

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AccountControl", () => {
  it("ログインできない環境では何も出さない", () => {
    const { container } = render(<AccountControl status="unavailable" returnTo="/" onLoggedOut={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ログインしていなければ、戻るパスを付けたログインのリンクと、プライバシーポリシーのリンクを出す", () => {
    render(<AccountControl status="loggedOut" returnTo="/t/V1StGXR8_Z5jdHi6B-myT" onLoggedOut={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Discord でログイン" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2Ft%2FV1StGXR8_Z5jdHi6B-myT"
    );
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
  });

  it("ログイン中は、ログイン中の表示とログアウトのボタンを出し、ログインのリンクは出さない", () => {
    render(<AccountControl status="loggedIn" returnTo="/" onLoggedOut={vi.fn()} />);

    expect(screen.getByText("ログイン中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Discord でログイン" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
  });

  it("ログアウトを押すと、送信中はボタンを無効にし、ログアウトできたら onLoggedOut を呼ぶ", async () => {
    let respond!: (res: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));
    const onLoggedOut = vi.fn();
    render(<AccountControl status="loggedIn" returnTo="/" onLoggedOut={onLoggedOut} />);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(screen.getByRole("button", { name: "ログアウト中…" })).toBeDisabled();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/logout");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(onLoggedOut).not.toHaveBeenCalled();

    await act(async () => respond(new Response(null, { status: 204 })));
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
  });

  it("ログアウトしてログインのリンクに切り替わったら、そのリンクにフォーカスを移す", async () => {
    const { rerender } = render(<AccountControl status="loggedIn" returnTo="/" onLoggedOut={() => {}} />);
    const button = screen.getByRole("button", { name: "ログアウト" });
    button.focus();
    await act(async () => fireEvent.click(button));
    rerender(<AccountControl status="loggedOut" returnTo="/" onLoggedOut={() => {}} />);

    expect(screen.getByRole("link", { name: "Discord でログイン" })).toHaveFocus();
  });

  it("ログアウトの前からログインしていない表示なら、ログインのリンクにフォーカスを移さない", () => {
    render(<AccountControl status="loggedOut" returnTo="/" onLoggedOut={() => {}} />);
    expect(screen.getByRole("link", { name: "Discord でログイン" })).not.toHaveFocus();
  });

  it("ログアウトに失敗したら、エラーを出してボタンを押せるように戻し、onLoggedOut は呼ばない", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const onLoggedOut = vi.fn();
    render(<AccountControl status="loggedIn" returnTo="/" onLoggedOut={onLoggedOut} />);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログアウトできませんでした。通信状況を確かめて、もう一度試してください。"
    );
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeEnabled();
    expect(onLoggedOut).not.toHaveBeenCalled();
  });

  it("ログアウトに失敗したら、押せるようになったログアウトのボタンにフォーカスを戻す", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<AccountControl status="loggedIn" returnTo="/" onLoggedOut={vi.fn()} />);
    const button = screen.getByRole("button", { name: "ログアウト" });
    fireEvent.click(button);
    // 無効にしたボタンからは、ブラウザがフォーカスを外す
    button.blur();

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "ログアウト" })).toHaveFocus();
  });
});

describe("AccountControl（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("ログインしていなければ、ログインと英語のプライバシーポリシーのリンクを英語で出す", () => {
    render(<AccountControl status="loggedOut" returnTo="/en/" onLoggedOut={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Log in with Discord" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2Fen%2F"
    );
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/en/privacy");
  });

  it("ログイン中の表示・ログアウトのボタン・エラーを英語で出す", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    render(<AccountControl status="loggedIn" returnTo="/en/" onLoggedOut={vi.fn()} />);

    expect(screen.getByText("Logged in")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(screen.getByRole("button", { name: "Logging out…" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't log out. Check your connection and try again.");
  });
});
