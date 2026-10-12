// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
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
      />
    );
    expect(within(cellOf("合計期待威力")).getByText("5,377")).toBeInTheDocument();
    expect(within(cellOf("PPS 全体")).getByText("175.50")).toBeInTheDocument();
    expect(within(cellOf("PPS 区間")).getByText("320.70")).toBeInTheDocument();
    expect(within(cellOf("PPS 区間")).getByText("0.0–10.0s")).toBeInTheDocument();
    expect(within(cellOf("DoT 期待威力")).getByText("1,120")).toBeInTheDocument();
    expect(within(cellOf("所要時間")).getByText("30.6s")).toBeInTheDocument();
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
