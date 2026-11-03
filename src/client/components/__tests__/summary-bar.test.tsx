// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import i18next from "i18next";
import { SummaryBar } from "../SummaryBar";

afterEach(cleanup);

const PPS = (pps: number) => ({ pps, totalPotency: 0, directPotency: 0, dotPotency: 0 });

function cellOf(label: string): HTMLElement {
  return screen.getByText(label).closest("div") as HTMLElement;
}

const baseProps = {
  totalExpectedPotency: 0,
  dotExpectedPotency: 0,
  overallPps: null,
  rangePps: null,
  ppsRange: null,
  duration: 0,
  lastDotTickTime: null,
};

describe("SummaryBar", () => {
  it("5つの指標を表示し、値がある項目は数値で出す", () => {
    render(
      <SummaryBar
        totalExpectedPotency={5377}
        dotExpectedPotency={1120}
        overallPps={PPS(175.5)}
        rangePps={PPS(320.7)}
        ppsRange={{ startTime: 0, endTime: 10 }}
        duration={30.64}
        lastDotTickTime={null}
      />
    );
    expect(within(cellOf("合計期待威力")).getByText("5,377")).toBeInTheDocument();
    expect(within(cellOf("PPS 全体")).getByText("175.50")).toBeInTheDocument();
    expect(within(cellOf("PPS 区間")).getByText("320.70")).toBeInTheDocument();
    expect(within(cellOf("PPS 区間")).getByText("0.0–10.0s")).toBeInTheDocument();
    expect(within(cellOf("DoT 期待威力")).getByText("1,120")).toBeInTheDocument();
    expect(within(cellOf("所要時間")).getByText("30.6s")).toBeInTheDocument();
    expect(within(cellOf("所要時間")).queryByText(/DoT 最終ティック/)).not.toBeInTheDocument();
  });

  it("DoT が所要時間より後まで続くときは、所要時間の欄に最後の DoT ティックの時刻を添える（#835）", () => {
    render(<SummaryBar {...baseProps} totalExpectedPotency={500} overallPps={PPS(100)} duration={7.5} lastDotTickTime={30} />);
    expect(within(cellOf("所要時間")).getByText("7.5s")).toBeInTheDocument();
    expect(within(cellOf("所要時間")).getByText("DoT 最終ティック 30.0s")).toBeInTheDocument();
  });

  it("スキルが無いときは各値を「—」にする（旧ヘッダー表示の「0 のとき非表示」に相当）", () => {
    render(<SummaryBar {...baseProps} />);
    for (const label of ["合計期待威力", "PPS 全体", "PPS 区間", "DoT 期待威力", "所要時間"]) {
      expect(within(cellOf(label)).getByText("—")).toBeInTheDocument();
    }
  });

  it("PPS 区間が未指定なら指定方法を案内する", () => {
    render(<SummaryBar {...baseProps} totalExpectedPotency={500} overallPps={PPS(100)} duration={5} />);
    expect(within(cellOf("PPS 区間")).getByText("PPS範囲で指定")).toBeInTheDocument();
  });

  it("props 更新（エントリ削除相当）で合計期待威力が追従する", () => {
    const { rerender } = render(<SummaryBar {...baseProps} totalExpectedPotency={500} />);
    expect(screen.getByText("500")).toBeInTheDocument();
    rerender(<SummaryBar {...baseProps} totalExpectedPotency={350} />);
    expect(screen.getByText("350")).toBeInTheDocument();
    expect(screen.queryByText("500")).not.toBeInTheDocument();
  });
});

describe("SummaryBar（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("見出しと案内を英語で出し、数値を英語の書式で出す", () => {
    render(
      <SummaryBar {...baseProps} totalExpectedPotency={5377} dotExpectedPotency={1120} overallPps={PPS(100)} duration={5} />
    );
    expect(screen.getByRole("region", { name: "Summary" })).toBeInTheDocument();
    expect(within(cellOf("Total expected potency")).getByText("5,377")).toBeInTheDocument();
    expect(within(cellOf("DoT expected potency")).getByText("1,120")).toBeInTheDocument();
    expect(within(cellOf("PPS (overall)")).getByText("100.00")).toBeInTheDocument();
    expect(within(cellOf("PPS (range)")).getByText("Set via PPS range")).toBeInTheDocument();
    expect(within(cellOf("Duration")).getByText("5.0s")).toBeInTheDocument();
    expect(screen.queryByText("合計期待威力")).not.toBeInTheDocument();
  });

  it("所要時間の注記（最後の DoT ティックの時刻）を英語で出す", () => {
    render(<SummaryBar {...baseProps} totalExpectedPotency={500} overallPps={PPS(100)} duration={7.5} lastDotTickTime={30} />);
    expect(within(cellOf("Duration")).getByText("Last DoT tick 30.0s")).toBeInTheDocument();
  });
});
