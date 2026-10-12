// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
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
