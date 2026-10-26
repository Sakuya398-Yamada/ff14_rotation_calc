// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { JobPicker } from "../JobPicker";
import { RECENT_JOBS_STORAGE_KEY } from "../../logic/recent-jobs";
import type { PlayerLevel } from "../../types/skill";
import type { JobId } from "../App";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

function renderPicker(overrides: Partial<Parameters<typeof JobPicker>[0]> = {}) {
  const props = {
    selectedJob: "whm" as JobId,
    level: 100 as PlayerLevel,
    onJobChange: vi.fn(),
    onLevelChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<JobPicker {...props} />);
  return { props, ...utils };
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /ジョブとレベルを選択/ }));
  return screen.getByRole("dialog", { name: "ジョブとレベルを選択" });
}

describe("JobPicker", () => {
  it("ボタンに現在のジョブ・ロール・レベルを表示する", () => {
    renderPicker({ selectedJob: "blm", level: 90 });
    const button = screen.getByRole("button", { name: /ジョブとレベルを選択/ });
    expect(button).toHaveTextContent("黒魔道士");
    expect(button).toHaveTextContent("遠隔魔法DPS · Lv90");
  });

  it("実装済み9ジョブは選べ、未実装ジョブは「未対応」で選べない", () => {
    renderPicker();
    const dialog = openPicker();
    for (const name of ["白魔道士", "竜騎士", "詩人", "ピクトマンサー", "黒魔道士", "侍", "モンク", "学者", "占星術師"]) {
      expect(within(dialog).getByRole("button", { name: new RegExp(`^[A-Z]{3}\\s?${name}$`) })).toBeEnabled();
    }
    const paladin = within(dialog).getByRole("button", { name: /ナイト/ });
    expect(paladin).toBeDisabled();
    expect(paladin).toHaveTextContent("未対応");
  });

  it("ジョブを選ぶと onJobChange が選んだジョブIDで呼ばれ、パネルが閉じる", () => {
    const { props } = renderPicker();
    const dialog = openPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: /黒魔道士/ }));
    expect(props.onJobChange).toHaveBeenCalledExactlyOnceWith("blm");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("名前・略称で絞り込める（大文字小文字は区別しない）", () => {
    renderPicker();
    const dialog = openPicker();
    const search = within(dialog).getByRole("searchbox");
    fireEvent.change(search, { target: { value: "blm" } });
    expect(within(dialog).getByRole("button", { name: /黒魔道士/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /白魔道士/ })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "魔道士" } });
    expect(within(dialog).getByRole("button", { name: /赤魔道士/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^[A-Z]{3}\s?侍$/ })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(within(dialog).getByText("該当するジョブがありません")).toBeInTheDocument();
  });

  it("レベルを切り替えると onLevelChange が数値で呼ばれる", () => {
    const { props } = renderPicker();
    const dialog = openPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "90" }));
    expect(props.onLevelChange).toHaveBeenCalledExactlyOnceWith(90);
  });

  it("Lv100未満のとき警告が表示され、Lv100では表示されない", () => {
    const { props, rerender } = renderPicker({ level: 90 });
    openPicker();
    expect(screen.getByText("Lv90の威力値は正確でない可能性があります")).toBeInTheDocument();

    rerender(<JobPicker {...props} level={100} />);
    expect(screen.queryByText(/威力値は正確でない可能性があります/)).not.toBeInTheDocument();
  });

  it("選んだジョブを「最近使ったジョブ」として保存し、次回も表示する", () => {
    renderPicker();
    fireEvent.click(within(openPicker()).getByRole("button", { name: /黒魔道士/ }));
    expect(JSON.parse(window.localStorage.getItem(RECENT_JOBS_STORAGE_KEY)!)).toEqual(["blm"]);

    cleanup();
    renderPicker();
    const dialog = openPicker();
    expect(within(dialog).getByText("最近使ったジョブ")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: "黒魔道士" })).toHaveLength(1);
  });

  it("Esc でパネルを閉じ、フォーカスをボタンに戻す", () => {
    renderPicker();
    const dialog = openPicker();
    fireEvent.keyDown(within(dialog).getByRole("searchbox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ジョブとレベルを選択/ })).toHaveFocus();
  });
});
