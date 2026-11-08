// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import i18next from "i18next";
import { MintLeafExportDialog } from "../MintLeafExportDialog";
import { resolveTimeline } from "../../logic/resolve-timeline";
import { JOB_DATA, type JobId } from "../../data/job-registry";

// jsdom は HTMLDialogElement の showModal / close を実装していないため最小限の代替を入れる
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "clipboard");
});

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

function renderDialog(jobId: JobId, skillIds: string[]) {
  const { skills, resources, buffs } = JOB_DATA[jobId];
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  const { entries } = resolveTimeline(
    skillIds.map((skillId, i) => ({ uid: `entry-${i}`, skillId })),
    skillMap,
    resources,
    undefined,
    buffs,
  );
  const onClose = vi.fn();
  render(
    <MintLeafExportDialog
      open
      onClose={onClose}
      returnFocusRef={createRef<HTMLElement>()}
      jobId={jobId}
      entries={entries}
      skillMap={skillMap}
    />,
  );
  return { onClose };
}

describe("MintLeafExportDialog", () => {
  it("書き出したテキストを出し、ジョブ・レベルを Mint Leaf で選ぶことと、書き出さない情報を説明する", () => {
    renderDialog("blm", ["fire-3", "manafont"]);
    const dialog = screen.getByRole("dialog", { name: "Mint Leaf に書き出す" });
    expect(screen.getByLabelText("Mint Leaf に貼るテキスト")).toHaveValue("152 GCD 2.5 3.5\n158 oGCD normal");
    expect(dialog).toHaveTextContent("ジョブ・レベル・タイトルはテキストに入りません");
    expect(dialog).toHaveTextContent("開始時刻の指定・oGCD を挟むタイミング・バフは書き出しません");
    expect(screen.getByRole("link", { name: "Mint Leaf" })).toHaveAttribute("href", "https://mint-leaf.thebalanceffxiv.com/");
  });

  it("コピーするとテキストをクリップボードに書き、コピーしたことを表示する", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    renderDialog("blm", ["fire-3"]);
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    expect(await screen.findByRole("button", { name: "コピーしました" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("152 GCD 2.5 3.5");
  });

  it("コピーできないときは、手でコピーするよう案内してテキストを選択する", async () => {
    stubClipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    renderDialog("blm", ["fire-3"]);
    fireEvent.click(screen.getByRole("button", { name: "コピー" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("テキストを選択してコピーしてください");
    expect(screen.getByLabelText("Mint Leaf に貼るテキスト")).toHaveFocus();
  });

  it("対応の無いスキルは名前を並べ、書き出すものが無ければコピーできない", () => {
    renderDialog("whm", ["glare3", "assize", "glare3"]);
    expect(screen.getByLabelText("Mint Leaf に貼るテキスト")).toHaveValue("");
    expect(
      screen.getByText("Mint Leaf のアクションとの対応が無いため、次のスキルは書き出していません: グレアガ, アサイズ"),
    ).toBeInTheDocument();
    expect(screen.getByText("書き出せるスキルがありません。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "コピー" })).toBeDisabled();
  });

  it("閉じるボタンで onClose を呼ぶ", () => {
    const { onClose } = renderDialog("blm", []);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });

  describe("英語", () => {
    afterEach(async () => {
      await i18next.changeLanguage("ja");
    });

    it("見出しと、飛ばしたスキルの名前が英語で出る", async () => {
      await i18next.changeLanguage("en");
      renderDialog("whm", ["glare3"]);
      expect(screen.getByRole("dialog", { name: "Export to Mint Leaf" })).toBeInTheDocument();
      expect(
        screen.getByText("These actions have no matching Mint Leaf action and were not exported: Glare III"),
      ).toBeInTheDocument();
    });
  });
});
