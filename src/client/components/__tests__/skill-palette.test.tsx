// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SkillPalette } from "../SkillPalette";
import type { Skill, CharacterStats, PlayerLevel } from "../../types/skill";
import type { JobId } from "../App";

function makeSkill(overrides: Partial<Skill> & { id: string; name: string }): Skill {
  return {
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: "/icons/dummy.png",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  } as Skill;
}

const whmSkills: Skill[] = [
  makeSkill({ id: "glare-3", name: "グレア", potency: 340 }),
  makeSkill({ id: "assize", name: "アサイズ", potency: 400, type: "ogcd" }),
  makeSkill({ id: "hidden-skill", name: "非表示スキル", hidden: true }),
];

const blmSkills: Skill[] = [
  makeSkill({ id: "fire-4", name: "ファイジャ", potency: 300 }),
];

const defaultStats: CharacterStats = {
  critical: 3000,
  directHit: 2000,
  determination: 2500,
  speed: 800,
};

function renderPalette(overrides: Partial<Parameters<typeof SkillPalette>[0]> = {}) {
  const props = {
    skills: whmSkills,
    stats: defaultStats,
    onStatsChange: vi.fn(),
    level: 100 as PlayerLevel,
    onLevelChange: vi.fn(),
    selectedJob: "whm" as JobId,
    onJobChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<SkillPalette {...props} />);
  return { props, ...utils };
}

// CollapsibleSection の h3 タイトルを特定する。タイトルは複数ノードに分割され得るため
// textContent（先頭に ▼/▶ アイコンを含む）へ正規表現でマッチさせる。
// 例: "GCD" セクションは "▼GCD"、"oGCD" セクションは "▼oGCD" となり部分一致では区別できない
function getSectionTitle(pattern: RegExp): HTMLElement {
  return screen.getByText(
    (_, el) => el?.tagName === "H3" && pattern.test(el.textContent ?? "")
  );
}

afterEach(cleanup);

describe("SkillPalette", () => {
  it("ジョブセレクタに全7ジョブが表示され、selectedJob が反映される", () => {
    renderPalette();
    const jobSelect = screen.getByRole("combobox") as HTMLSelectElement;
    const labels = Array.from(jobSelect.options).map((o) => o.textContent);
    expect(labels).toEqual([
      "白魔道士",
      "竜騎士",
      "詩人",
      "ピクトマンサー",
      "黒魔道士",
      "侍",
      "モンク",
    ]);
    expect(jobSelect.value).toBe("whm");
  });

  it("ジョブ切替で onJobChange が選択したジョブIDで呼ばれる", () => {
    const { props } = renderPalette();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "blm" } });
    expect(props.onJobChange).toHaveBeenCalledExactlyOnceWith("blm");
  });

  it("GCD/oGCDスキルが表示され、hiddenスキルは表示されない", () => {
    renderPalette();
    expect(screen.getByText("グレア")).toBeInTheDocument();
    expect(screen.getByText("アサイズ")).toBeInTheDocument();
    expect(screen.queryByText("非表示スキル")).not.toBeInTheDocument();
  });

  it("skills prop の変更（ジョブ切替相当）でスキル一覧が更新される", () => {
    const { props, rerender } = renderPalette();
    expect(screen.getByText("グレア")).toBeInTheDocument();

    rerender(<SkillPalette {...props} skills={blmSkills} selectedJob="blm" />);
    expect(screen.getByText("ファイジャ")).toBeInTheDocument();
    expect(screen.queryByText("グレア")).not.toBeInTheDocument();
  });

  it("ステータス入力の変更で onStatsChange が数値で呼ばれる", () => {
    const { props } = renderPalette();
    // spinbutton は CRT / DH / DET / SS の表示順
    const [crtInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(crtInput, { target: { value: "3200" } });
    expect(props.onStatsChange).toHaveBeenCalledExactlyOnceWith({
      ...defaultStats,
      critical: 3200,
    });
  });

  it("ステータス入力に数値以外を入れても onStatsChange は呼ばれない", () => {
    const { props } = renderPalette();
    const [crtInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(crtInput, { target: { value: "abc" } });
    expect(props.onStatsChange).not.toHaveBeenCalled();
  });

  it("レベルセクションを開いてレベルを切り替えると onLevelChange が数値で呼ばれる", () => {
    const { props } = renderPalette();
    fireEvent.click(getSectionTitle(/^[▼▶]レベル/));

    // セクション展開後はジョブセレクタとレベルセレクタの2つになる
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    fireEvent.change(selects[1], { target: { value: "90" } });
    expect(props.onLevelChange).toHaveBeenCalledExactlyOnceWith(90);
  });

  it("Lv100未満のとき警告が表示され、Lv100では表示されない", () => {
    const { props, rerender } = renderPalette({ level: 90 });
    fireEvent.click(getSectionTitle(/^[▼▶]レベル/));
    expect(
      screen.getByText("Lv90の威力値は正確でない可能性があります")
    ).toBeInTheDocument();

    rerender(<SkillPalette {...props} level={100} />);
    expect(
      screen.queryByText(/威力値は正確でない可能性があります/)
    ).not.toBeInTheDocument();
  });

  it("折りたたみセクションのタイトルクリックで中身が非表示になる", () => {
    renderPalette();
    expect(screen.getByText("グレア")).toBeInTheDocument();
    fireEvent.click(getSectionTitle(/^[▼▶]GCD$/));
    expect(screen.queryByText("グレア")).not.toBeInTheDocument();
  });
});
