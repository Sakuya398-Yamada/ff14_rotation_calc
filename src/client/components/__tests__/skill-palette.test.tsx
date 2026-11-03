// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import i18next from "i18next";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SkillPalette } from "../SkillPalette";
import type { Skill, CharacterStats } from "../../types/skill";
import type { JobId } from "../../data/job-registry";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
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
  makeSkill({ id: "glare", potency: 340 }),
  makeSkill({ id: "assize", potency: 400, type: "ogcd" }),
  makeSkill({ id: "hidden-skill", hidden: true }),
];

const blmSkills: Skill[] = [
  makeSkill({ id: "fire-4", potency: 300 }),
];

const defaultStats: CharacterStats = {
  critical: 3000,
  directHit: 2000,
  determination: 2500,
  speed: 800,
};

function renderPalette(overrides: Partial<Parameters<typeof SkillPalette>[0]> = {}) {
  const props = {
    jobId: "whm" as JobId,
    skills: whmSkills,
    stats: defaultStats,
    onStatsChange: vi.fn(),
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
  it("GCD/oGCDスキルが表示され、hiddenスキルは表示されない", () => {
    renderPalette();
    expect(screen.getByText("グレア")).toBeInTheDocument();
    expect(screen.getByText("アサイズ")).toBeInTheDocument();
    // 辞書に無い ID は ID のまま出るので、ID で探す
    expect(screen.queryByText("hidden-skill")).not.toBeInTheDocument();
  });

  it("skills prop の変更（ジョブ切替相当）でスキル一覧が更新される", () => {
    const { props, rerender } = renderPalette();
    expect(screen.getByText("グレア")).toBeInTheDocument();

    rerender(<SkillPalette {...props} jobId="blm" skills={blmSkills} />);
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

  it("折りたたみセクションのタイトルクリックで中身が非表示になる", () => {
    renderPalette();
    expect(screen.getByText("グレア")).toBeInTheDocument();
    fireEvent.click(getSectionTitle(/^[▼▶]GCD$/));
    expect(screen.queryByText("グレア")).not.toBeInTheDocument();
  });
});

describe("SkillPalette（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("見出し・ステータス・威力・スキル名を英語で出す", () => {
    renderPalette();

    expect(screen.getByRole("heading", { name: "Job palette" })).toBeInTheDocument();
    expect(getSectionTitle(/Stats$/)).toBeInTheDocument();
    expect(screen.getByText("Critical Hit")).toBeInTheDocument();
    expect(screen.getByText(/^Rate \d+\.\d% \/ Multiplier x\d\.\d{3}$/)).toBeInTheDocument();
    expect(screen.getByText("Potency 340")).toBeInTheDocument();
    expect(screen.getByText("Glare")).toBeInTheDocument();
    expect(screen.getByTitle("Glare (Potency: 340)")).toBeInTheDocument();
    expect(screen.queryByText("ジョブパレット")).not.toBeInTheDocument();
  });
});
