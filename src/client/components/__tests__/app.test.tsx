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
