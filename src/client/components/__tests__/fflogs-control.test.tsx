// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import i18next from "i18next";
import { FflogsControl } from "../FflogsControl";
import { FFLOGS_PENDING_LOGIN_STORAGE_KEY, FFLOGS_SESSION_STORAGE_KEY } from "../../logic/fflogs-auth";

function storeSession(expiresAt: number) {
  localStorage.setItem(FFLOGS_SESSION_STORAGE_KEY, JSON.stringify({ accessToken: "access-1", expiresAt, userName: "Sakuya" }));
}

beforeEach(() => {
  vi.stubEnv("VITE_FFLOGS_CLIENT_ID", "client-1");
  // jsdom の crypto には subtle が無い
  vi.stubGlobal("crypto", webcrypto);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("FflogsControl", () => {
  it("クライアント ID の無い環境では、押せないログインのボタンと、ログインできない旨を出す", () => {
    vi.stubEnv("VITE_FFLOGS_CLIENT_ID", "");
    render(<FflogsControl returnTo="/" />);

    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toHaveAccessibleDescription(
      "この環境では FF Logs にログインできません。"
    );
  });

  it("ログインしていなければ、押せるログインのボタンだけを出す", () => {
    render(<FflogsControl returnTo="/" />);

    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toBeEnabled();
    expect(screen.queryByText("この環境では FF Logs にログインできません。")).not.toBeInTheDocument();
    expect(screen.queryByText(/期限が切れました/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toHaveAccessibleDescription("");
    expect(screen.queryByRole("button", { name: "FF Logs からログアウト" })).not.toBeInTheDocument();
  });

  it("ログインのボタンを押すと、戻るパスを控えて FF Logs の認可画面へ移る", async () => {
    const navigate = vi.fn();
    render(<FflogsControl returnTo="/en/" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "FF Logs でログイン" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    const url = new URL(navigate.mock.calls[0][0] as string);
    const pending = JSON.parse(sessionStorage.getItem(FFLOGS_PENDING_LOGIN_STORAGE_KEY) ?? "") as Record<string, string>;
    expect(url.origin + url.pathname).toBe("https://www.fflogs.com/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe(window.location.origin);
    expect(url.searchParams.get("state")).toBe(pending.state);
    expect(pending.returnTo).toBe("/en/");
  });

  it("ログインを始められなければ（sessionStorage に書けない等）、移らずにその旨を出し、もう一度押せる", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const navigate = vi.fn();
    render(<FflogsControl returnTo="/" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "FF Logs でログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("FF Logs のログインを始められませんでした。");
    expect(navigate).not.toHaveBeenCalled();

    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "FF Logs でログイン" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ログイン中は、連携中の表示と FF Logs のユーザー名、ログアウトのボタンを出す", () => {
    storeSession(Date.now() + 60_000);
    render(<FflogsControl returnTo="/" />);

    expect(screen.getByText("連携中: Sakuya")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FF Logs からログアウト" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "FF Logs でログイン" })).not.toBeInTheDocument();
  });

  it("ログアウトを押すと、保存したトークンを消し、ログインのボタンに戻してフォーカスを移す", () => {
    storeSession(Date.now() + 60_000);
    render(<FflogsControl returnTo="/" />);
    fireEvent.click(screen.getByRole("button", { name: "FF Logs からログアウト" }));

    expect(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText("連携中: Sakuya")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toHaveFocus();
  });

  it("トークンの期限が切れていたら、連携中とは出さず、再ログインを促してログインのボタンを出す", () => {
    storeSession(Date.now() - 1);
    render(<FflogsControl returnTo="/" />);

    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toHaveAccessibleDescription(
      "FF Logs のログインの期限が切れました。もう一度ログインしてください。"
    );
    expect(screen.queryByText("連携中: Sakuya")).not.toBeInTheDocument();
  });

  it("期限が切れたトークンも、ログアウトのボタンでブラウザから消せる", () => {
    storeSession(Date.now() - 1);
    render(<FflogsControl returnTo="/" />);
    expect(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "FF Logs からログアウト" }));

    expect(localStorage.getItem(FFLOGS_SESSION_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(/期限が切れました/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "FF Logs からログアウト" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FF Logs でログイン" })).toHaveFocus();
  });
});

describe("FflogsControl（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("ログイン中の表示を英語で出す", () => {
    storeSession(Date.now() + 60_000);
    render(<FflogsControl returnTo="/en/" />);

    expect(screen.getByText("Connected as Sakuya")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out of FF Logs" })).toBeInTheDocument();
  });

  it("期限切れと、ログインできない環境の表示を英語で出す", () => {
    storeSession(Date.now() - 1);
    const { unmount } = render(<FflogsControl returnTo="/en/" />);
    expect(screen.getByText("Your FF Logs login has expired. Log in again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in with FF Logs" })).toBeEnabled();
    unmount();

    vi.stubEnv("VITE_FFLOGS_CLIENT_ID", "");
    render(<FflogsControl returnTo="/en/" />);
    expect(screen.getByRole("button", { name: "Log in with FF Logs" })).toBeDisabled();
    expect(screen.getByText("FF Logs login isn't available in this environment.")).toBeInTheDocument();
  });
});
