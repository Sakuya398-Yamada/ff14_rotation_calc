// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, beforeAll } from "vitest";
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
