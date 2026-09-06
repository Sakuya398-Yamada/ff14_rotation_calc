// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Timeline } from "../Timeline";
import { resolveTimeline } from "../../logic/resolve-timeline";
import { calcEntryExpectedPotency } from "../../logic/expected-potency";
import type {
  Skill,
  TimelineEntry,
  CharacterStats,
  ResolvedTimelineEntry,
} from "../../types/skill";

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

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

const defaultStats: CharacterStats = {
  critical: 3000,
  directHit: 2000,
  determination: 2500,
  speed: 800,
};

const gcdSkill = makeSkill({ id: "test-gcd", name: "テストGCD", potency: 300 });
const ogcdSkill = makeSkill({
  id: "test-ogcd",
  name: "テストoGCD",
  potency: 150,
  type: "ogcd",
});
const jobASkills = [gcdSkill, ogcdSkill];
const jobASkillMap = new Map(jobASkills.map((s) => [s.id, s]));

const jobBSkill = makeSkill({ id: "other-gcd", name: "別ジョブGCD", potency: 250 });
const jobBSkills = [jobBSkill];
const jobBSkillMap = new Map(jobBSkills.map((s) => [s.id, s]));

function resolve(
  entries: TimelineEntry[],
  skillMap: Map<string, Skill> = jobASkillMap
): ResolvedTimelineEntry[] {
  return resolveTimeline(entries, skillMap, [], defaultStats, [], []).entries;
}

/**
 * HTML5 DnD の DataTransfer モック。jsdom は DataTransfer 未実装のため、
 * fireEvent に渡すオブジェクトで setData/getData/types を最小再現する。
 * DnD の追加・並び替え自体のテストはスコープ外（Issue #341）で、
 * ここでは削除ハンドラの検証にのみ使う。
 */
function makeDataTransfer() {
  const store = new Map<string, string>();
  return {
    effectAllowed: "",
    dropEffect: "",
    setData: (key: string, value: string) => {
      store.set(key, value);
    },
    getData: (key: string) => store.get(key) ?? "",
    get types() {
      return Array.from(store.keys());
    },
  };
}

function renderTimeline(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
  const props = {
    skills: jobASkills,
    allSkillMap: jobASkillMap,
    resolvedEntries: [] as ResolvedTimelineEntry[],
    onAddEntry: vi.fn(),
    onRemoveEntry: vi.fn(),
    onMoveEntry: vi.fn(),
    resources: [],
    buffs: [],
    totalExpectedPotency: 0,
    dotExpectedPotency: 0,
    stats: defaultStats,
    dotTicks: [],
    activeDoTs: [],
    untargetableWindows: [],
    onUntargetableWindowsChange: vi.fn(),
    multiTargetWindows: [],
    onMultiTargetWindowsChange: vi.fn(),
    overallPps: null,
    rangePps: null,
    ppsRange: null,
    onPpsRangeChange: vi.fn(),
    lastGcdEndTime: 0,
    selectedEntryUid: null,
    onSelectEntry: vi.fn(),
    ...overrides,
  };
  const utils = render(<Timeline {...props} />);
  return { props, ...utils };
}

afterEach(cleanup);

describe("Timeline", () => {
  it("空ローテーションのときプレースホルダーが表示される", () => {
    renderTimeline();
    expect(
      screen.getByText("スキルパレットからドラッグ＆ドロップしてスキルを追加")
    ).toBeInTheDocument();
  });

  it("エントリがあるときプレースホルダーは表示されない", () => {
    renderTimeline({ resolvedEntries: resolve([makeEntry(gcdSkill.id)]) });
    expect(
      screen.queryByText("スキルパレットからドラッグ＆ドロップしてスキルを追加")
    ).not.toBeInTheDocument();
  });

  it("GCD/oGCDエントリのスキル名と期待威力が描画される", () => {
    const resolvedEntries = resolve([
      makeEntry(gcdSkill.id),
      makeEntry(ogcdSkill.id),
    ]);
    renderTimeline({ resolvedEntries });

    // スキル名はアイコンの alt と title 属性に反映される
    expect(screen.getByAltText("テストGCD")).toBeInTheDocument();
    expect(screen.getByAltText("テストoGCD")).toBeInTheDocument();
    expect(screen.getByTitle(/^テストGCD \(威力: 300/)).toBeInTheDocument();
    expect(screen.getByTitle(/^テストoGCD \(威力: 150/)).toBeInTheDocument();

    // 威力表示はステータス補正込みの期待値（SkillLanes 内で計算される値と同じ式で導出）
    const gcdExpected = calcEntryExpectedPotency(resolvedEntries[0], gcdSkill, defaultStats);
    const ogcdExpected = calcEntryExpectedPotency(resolvedEntries[1], ogcdSkill, defaultStats);
    expect(screen.getByText(String(gcdExpected))).toBeInTheDocument();
    expect(screen.getByText(String(ogcdExpected))).toBeInTheDocument();
  });

  it("合計期待威力がヘッダーに表示され、0のときは非表示", () => {
    const { props, rerender } = renderTimeline({ totalExpectedPotency: 1234 });
    expect(screen.getByText(/期待威力:/)).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();

    rerender(<Timeline {...props} totalExpectedPotency={0} />);
    expect(screen.queryByText(/期待威力:/)).not.toBeInTheDocument();
  });

  it("エントリのドラッグ開始で削除ゾーンが出現し、ドロップで onRemoveEntry が呼ばれる", () => {
    const resolvedEntries = resolve([
      makeEntry(gcdSkill.id),
      makeEntry(ogcdSkill.id),
    ]);
    const targetUid = resolvedEntries[0].uid;
    const { props, container } = renderTimeline({ resolvedEntries });

    // ドラッグ開始前は削除ゾーンが無い
    expect(screen.queryByText("ここにドロップして削除")).not.toBeInTheDocument();

    const entryEl = container.querySelector(`[data-skill-entry-uid="${targetUid}"]`);
    expect(entryEl).not.toBeNull();

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(entryEl!, { dataTransfer });
    expect(dataTransfer.getData("application/timeline-entry-uid")).toBe(targetUid);

    const deleteZoneLabel = screen.getByText("ここにドロップして削除");
    fireEvent.drop(deleteZoneLabel, { dataTransfer });

    expect(props.onRemoveEntry).toHaveBeenCalledExactlyOnceWith(targetUid);
    // ドロップ後は削除ゾーンが消える
    expect(screen.queryByText("ここにドロップして削除")).not.toBeInTheDocument();
  });

  it("エントリ削除の反映（props更新）で当該エントリが消え、合計威力表示が更新される", () => {
    // Timeline は制御コンポーネントで、エントリ削除の実体は親側の state 更新。
    // onRemoveEntry 後に親が渡し直す props をシミュレートして表示追従を検証する
    const twoEntries = resolve([makeEntry(gcdSkill.id), makeEntry(ogcdSkill.id)]);
    const { props, rerender } = renderTimeline({
      resolvedEntries: twoEntries,
      totalExpectedPotency: 500,
    });
    expect(screen.getByAltText("テストoGCD")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();

    const remaining = resolve([makeEntry(gcdSkill.id)]);
    rerender(
      <Timeline {...props} resolvedEntries={remaining} totalExpectedPotency={350} />
    );
    expect(screen.queryByAltText("テストoGCD")).not.toBeInTheDocument();
    expect(screen.getByAltText("テストGCD")).toBeInTheDocument();
    expect(screen.getByText("350")).toBeInTheDocument();
    expect(screen.queryByText("500")).not.toBeInTheDocument();
  });

  it("ジョブ切替相当のprops更新で表示が追従する（タイムライン全消去→別ジョブのエントリ）", () => {
    const { props, rerender } = renderTimeline({
      resolvedEntries: resolve([makeEntry(gcdSkill.id)]),
    });
    expect(screen.getByAltText("テストGCD")).toBeInTheDocument();

    // App.handleJobChange はジョブ切替時に entries を全消去する（App.tsx）
    rerender(
      <Timeline
        {...props}
        skills={jobBSkills}
        allSkillMap={jobBSkillMap}
        resolvedEntries={[]}
      />
    );
    expect(screen.queryByAltText("テストGCD")).not.toBeInTheDocument();
    expect(
      screen.getByText("スキルパレットからドラッグ＆ドロップしてスキルを追加")
    ).toBeInTheDocument();

    // 切替後のジョブでエントリを追加した状態
    rerender(
      <Timeline
        {...props}
        skills={jobBSkills}
        allSkillMap={jobBSkillMap}
        resolvedEntries={resolve([makeEntry(jobBSkill.id)], jobBSkillMap)}
      />
    );
    expect(screen.getByAltText("別ジョブGCD")).toBeInTheDocument();
  });
});
