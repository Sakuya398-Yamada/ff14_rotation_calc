// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from "vitest";
import i18next from "i18next";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { SettingsDialog } from "../SettingsDialog";
import type { AppSettings } from "../../logic/app-settings";

// jsdom は HTMLDialogElement の showModal / close を実装していないため最小限の代替を入れる
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(cleanup);

const SETTINGS: AppSettings = { theme: "dark", accent: "blue" };

function renderDialog(overrides: Partial<Parameters<typeof SettingsDialog>[0]> = {}) {
  const props = {
    open: true,
    settings: SETTINGS,
    onChange: vi.fn(),
    onClose: vi.fn(),
    returnFocusRef: createRef<HTMLElement>(),
    accountStatus: "unavailable" as const,
    returnTo: "/",
    onLoggedOut: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SettingsDialog {...props} />) };
}

describe("SettingsDialog", () => {
  it("テーマを選ぶと他の設定を保ったまま onChange される", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText("ライト"));
    expect(props.onChange).toHaveBeenCalledWith({ theme: "light", accent: "blue" });
  });

  it("アクセント色を選ぶと onChange される", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText("緑"));
    expect(props.onChange).toHaveBeenCalledWith({ theme: "dark", accent: "green" });
  });

  it("現在の設定が選択状態になっている", () => {
    renderDialog({ settings: { theme: "system", accent: "purple" } });
    expect(screen.getByLabelText("OS に合わせる")).toBeChecked();
    expect(screen.getByLabelText("紫")).toBeChecked();
  });

  it("閉じるボタン・× ボタン・Esc（cancel）で onClose される", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(screen.getByRole("button", { name: "設定を閉じる" }));
    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("cancel", { cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("表示密度は未対応として操作できない", () => {
    renderDialog();
    expect(screen.getByText("未対応")).toBeInTheDocument();
    expect(screen.getByLabelText("コンパクト")).toBeDisabled();
  });

  it("閉じたら returnFocusRef の要素にフォーカスを戻す", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    const returnFocusRef = { current: button };
    const { rerender, props } = renderDialog({ returnFocusRef });
    rerender(<SettingsDialog {...props} open={false} />);
    expect(document.activeElement).toBe(button);
    button.remove();
  });
});

describe("SettingsDialog（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("見出しと選択肢を英語で出し、選んだ値はコードのまま渡す", () => {
    const { props } = renderDialog();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Match OS"));
    expect(props.onChange).toHaveBeenCalledWith({ theme: "system", accent: "blue" });
    expect(screen.getByLabelText("Green")).toBeInTheDocument();
    expect(screen.getByLabelText("Compact")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close settings" })).toBeInTheDocument();
  });
});

describe("SettingsDialog: アカウント", () => {
  it("ログインしていなければ、アカウントの欄に戻るパスを付けたログインのリンクとプライバシーポリシーのリンクを出す", () => {
    renderDialog({ accountStatus: "loggedOut", returnTo: "/t/V1StGXR8_Z5jdHi6B-myT" });

    expect(screen.getByRole("heading", { name: "アカウント" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discord でログイン" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2Ft%2FV1StGXR8_Z5jdHi6B-myT"
    );
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
  });

  it("ログイン中は、ログイン中の表示とログアウトのボタンを出す", () => {
    renderDialog({ accountStatus: "loggedIn" });

    expect(screen.getByRole("heading", { name: "アカウント" })).toBeInTheDocument();
    expect(screen.getByText("ログイン中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });

  it("ログインできない環境では、アカウントの欄を見出しごと出さない", () => {
    renderDialog({ accountStatus: "unavailable" });

    expect(screen.queryByRole("heading", { name: "アカウント" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Discord でログイン" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "プライバシーポリシー" })).not.toBeInTheDocument();
  });

  it("ログアウトに失敗した表示は、閉じて開き直すと消えている", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    try {
      const { props, rerender } = renderDialog({ accountStatus: "loggedIn" });
      fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      rerender(<SettingsDialog {...props} open={false} />);
      rerender(<SettingsDialog {...props} open={true} />);
      expect(screen.getByRole("button", { name: "ログアウト" })).toBeEnabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("下の注記は、表示の設定がこのブラウザに保存されることを書く", () => {
    renderDialog({ accountStatus: "loggedIn" });
    expect(screen.getByText("表示の設定はこのブラウザに保存されます")).toBeInTheDocument();
  });
});

describe("SettingsDialog: アカウント（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("アカウントの欄と下の注記を英語で出す", () => {
    renderDialog({ accountStatus: "loggedOut", returnTo: "/en/" });

    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in with Discord" })).toHaveAttribute(
      "href",
      "/api/auth/discord?returnTo=%2Fen%2F"
    );
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/en/privacy");
    expect(screen.getByText("Display settings are saved in this browser")).toBeInTheDocument();
  });
});
