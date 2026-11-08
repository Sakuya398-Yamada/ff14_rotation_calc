// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach, onTestFinished } from "vitest";
import i18next from "i18next";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import {
  DndContext,
  MouseSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { Timeline } from "../Timeline";
import { DELETE_ZONE_ID } from "../timeline/dnd-types";
import { resolveTimeline } from "../../logic/resolve-timeline";
import { calcEntryExpectedPotency } from "../../logic/expected-potency";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../../logic/skill-level";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import { GNB_ATTACK_SKILLS } from "../../data/gnb-skills";
import { GNB_BUFFS } from "../../data/gnb-buffs";
import { GNB_RESOURCES } from "../../data/gnb-resources";
import { WAR_ATTACK_SKILLS } from "../../data/war-skills";
import { WAR_BUFFS } from "../../data/war-buffs";
import { WAR_RESOURCES } from "../../data/war-resources";
import { PX_PER_SEC } from "../timeline/constants";
import type {
  Skill,
  TimelineEntry,
  CharacterStats,
  ResolvedTimelineEntry,
} from "../../types/skill";
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

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

const defaultStats: CharacterStats = {
  critical: 3000,
  directHit: 2000,
  determination: 2500,
  speed: 800,
};

const gcdSkill = makeSkill({ id: "test-gcd", potency: 300 });
const ogcdSkill = makeSkill({
  id: "test-ogcd",
  potency: 150,
  type: "ogcd",
});
const jobASkills = [gcdSkill, ogcdSkill];
const jobASkillMap = new Map(jobASkills.map((s) => [s.id, s]));

const jobBSkill = makeSkill({ id: "other-gcd", potency: 250 });
const jobBSkills = [jobBSkill];
const jobBSkillMap = new Map(jobBSkills.map((s) => [s.id, s]));

function resolve(
  entries: TimelineEntry[],
  skillMap: Map<string, Skill> = jobASkillMap
): ResolvedTimelineEntry[] {
  return resolveTimeline(entries, skillMap, [], defaultStats, [], []).entries;
}

/**
 * jsdom はレイアウトを持たず全要素の矩形が 0 のため、App.tsx の pointerWithin では
 * どのドロップ先にも当たらない。削除ゾーンが登録されていれば常にそこへ当たる判定に差し替える。
 * DnD の追加・並び替え自体のテストはスコープ外（Issue #341）で、削除ハンドラの検証にのみ使う。
 */
const collideWithDeleteZone: CollisionDetection = ({ droppableContainers }) =>
  droppableContainers
    .filter((container) => container.id === DELETE_ZONE_ID)
    .map((container) => ({ id: container.id }));

/** Timeline は内部で useDndMonitor を使うため DndContext 配下で描画する（App.tsx と同じ構成） */
function TestDndProvider({ children }: { children: ReactNode }) {
  // activationConstraint なし: mousedown 即ドラッグ開始（distance 制約は jsdom で再現する意味がない）
  const sensors = useSensors(useSensor(MouseSensor));
  return (
    <DndContext sensors={sensors} collisionDetection={collideWithDeleteZone}>
      {children}
    </DndContext>
  );
}

function renderTimeline(overrides: Partial<Parameters<typeof Timeline>[0]> = {}) {
  const props = {
    jobId: "whm" as JobId,
    skills: jobASkills,
    allSkillMap: jobASkillMap,
    resolvedEntries: [] as ResolvedTimelineEntry[],
    onAddEntry: vi.fn(),
    onRemoveEntry: vi.fn(),
    onMoveEntry: vi.fn(),
    resources: [],
    buffs: [],
    stats: defaultStats,
    dotTicks: [],
    resourceTicks: [],
    activeDoTs: [],
    untargetableWindows: [],
    onUntargetableWindowsChange: vi.fn(),
    multiTargetWindows: [],
    onMultiTargetWindowsChange: vi.fn(),
    rangePps: null,
    ppsRange: null,
    onPpsRangeChange: vi.fn(),
    lastGcdEndTime: 0,
    selectedEntryUid: null,
    onSelectEntry: vi.fn(),
    ...overrides,
  };
  const utils = render(<Timeline {...props} />, { wrapper: TestDndProvider });
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
    expect(screen.getByAltText("test-gcd")).toBeInTheDocument();
    expect(screen.getByAltText("test-ogcd")).toBeInTheDocument();
    expect(screen.getByTitle(/^test-gcd \(威力: 300/)).toBeInTheDocument();
    expect(screen.getByTitle(/^test-ogcd \(威力: 150/)).toBeInTheDocument();

    // 威力表示はステータス補正込みの期待値（SkillLanes 内で計算される値と同じ式で導出）
    const gcdExpected = calcEntryExpectedPotency(resolvedEntries[0], gcdSkill, defaultStats);
    const ogcdExpected = calcEntryExpectedPotency(resolvedEntries[1], ogcdSkill, defaultStats);
    expect(screen.getByText(String(gcdExpected))).toBeInTheDocument();
    expect(screen.getByText(String(ogcdExpected))).toBeInTheDocument();
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

    // MouseSensor はドラッグの開始で document にクリックの伝播を止めるリスナーを付け、終了の 50ms 後に外す。
    // 外れるまで待たないと、このファイルで後に続くテストのクリックが React に届かないので、テストの終わりに（途中で落ちても）待つ（#884）
    onTestFinished(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    // dnd-kit の MouseSensor は mousedown を要素で、move/up を document で購読する
    fireEvent.mouseDown(entryEl!, { button: 0, clientX: 10, clientY: 10 });
    expect(screen.getByText("ここにドロップして削除")).toBeInTheDocument();

    fireEvent.mouseMove(document, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(document, { clientX: 20, clientY: 20 });

    expect(props.onRemoveEntry).toHaveBeenCalledExactlyOnceWith(targetUid);
    // ドロップ後は削除ゾーンが消える
    expect(screen.queryByText("ここにドロップして削除")).not.toBeInTheDocument();
  });

  // 合計期待威力の表示は #385 で SummaryBar に移した（summary-bar.test.tsx）
  it("エントリ削除の反映（props更新）で当該エントリが消える", () => {
    // Timeline は制御コンポーネントで、エントリ削除の実体は親側の state 更新。
    // onRemoveEntry 後に親が渡し直す props をシミュレートして表示追従を検証する
    const twoEntries = resolve([makeEntry(gcdSkill.id), makeEntry(ogcdSkill.id)]);
    const { props, rerender } = renderTimeline({ resolvedEntries: twoEntries });
    expect(screen.getByAltText("test-ogcd")).toBeInTheDocument();

    const remaining = resolve([makeEntry(gcdSkill.id)]);
    rerender(
      <Timeline {...props} resolvedEntries={remaining} />
    );
    expect(screen.queryByAltText("test-ogcd")).not.toBeInTheDocument();
    expect(screen.getByAltText("test-gcd")).toBeInTheDocument();
  });

  it("ジョブ切替相当のprops更新で表示が追従する（タイムライン全消去→別ジョブのエントリ）", () => {
    const { props, rerender } = renderTimeline({
      resolvedEntries: resolve([makeEntry(gcdSkill.id)]),
    });
    expect(screen.getByAltText("test-gcd")).toBeInTheDocument();

    // App.handleJobChange はジョブ切替時に entries を全消去する（App.tsx）
    rerender(
      <Timeline
        {...props}
        skills={jobBSkills}
        allSkillMap={jobBSkillMap}
        resolvedEntries={[]}
      />
    );
    expect(screen.queryByAltText("test-gcd")).not.toBeInTheDocument();
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
    expect(screen.getByAltText("other-gcd")).toBeInTheDocument();
  });
});

const brdBuffIds = new Set(BRD_BUFFS.map((b) => b.id));
const brdResourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
const brdSkills = getSkillsForLevel(BRD_ATTACK_SKILLS, 100, brdBuffIds, brdResourceIds);
const brdSkillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, brdSkills, 100, brdBuffIds, brdResourceIds);

function renderBrd(skillIds: string[]) {
  const resolvedEntries = resolveTimeline(
    skillIds.map(makeEntry),
    brdSkillMap,
    BRD_RESOURCES,
    defaultStats,
    BRD_BUFFS
  ).entries;
  renderTimeline({
    jobId: "brd",
    skills: brdSkills,
    allSkillMap: brdSkillMap,
    resolvedEntries,
    resources: BRD_RESOURCES,
    buffs: BRD_BUFFS,
  });
}

describe("Timeline: ホークアイの発動確率 (#615)", () => {
  it("バーストショット → リフルジェントアローは、リフルジェントアローのツールチップに 35.0% が出る", () => {
    renderBrd(["burst-shot", "refulgent-arrow"]);

    expect(
      screen.getByTitle(/^リフルジェントアロー \(威力: .* \/ ホークアイ発動確率 35\.0%（不発時はバーストショット）\)/)
    ).toBeInTheDocument();
  });

  // 消費後は、出なかった分岐のバーストショットが (1 − 0.5775) × 0.35 で付け直したバーが続く (#842)
  it("バーストショット ×2 は、リフルジェントアローが 57.8%、ホークアイのバーが付与時点の 35.0%・57.8% と消費後の 14.8% になる", () => {
    renderBrd(["burst-shot", "burst-shot", "refulgent-arrow"]);

    expect(
      screen.getByTitle(/^リフルジェントアロー \(威力: .* \/ ホークアイ発動確率 57\.8%（不発時はバーストショット）\)/)
    ).toBeInTheDocument();
    const bars = screen.getAllByTitle(/^ホークアイ x1 /);
    expect(bars.map((bar) => bar.getAttribute("title"))).toEqual([
      expect.stringMatching(/\) 発動確率 35\.0%（付与時点）$/),
      expect.stringMatching(/\) 発動確率 57\.8%（付与時点）$/),
      expect.stringMatching(/\) 発動確率 14\.8%（付与時点）$/),
    ]);
    expect(bars.map((bar) => bar.textContent)).toEqual(["x1 (35%)", "x1 (58%)", "x1 (15%)"]);
  });

  it("ストームバイト → コースティックバイトは、コースティックバイトのツールチップに上書き確率 12.3% が出る", () => {
    renderBrd(["stormbite", "caustic-bite"]);

    expect(screen.getByTitle(/^コースティックバイト \(威力: .* \/ ホークアイ上書き確率 12\.3%\)/)).toBeInTheDocument();
    expect(screen.getByTitle(/^ストームバイト \(/)).not.toHaveAttribute("title", expect.stringMatching(/上書き確率/));
  });

  it("乱れ撃ちを優先消費したリフルジェントアローと、乱れ撃ちのバーには発動確率が出ない", () => {
    renderBrd(["barrage", "burst-shot", "refulgent-arrow"]);

    expect(screen.getByTitle(/^リフルジェントアロー \(威力: /)).not.toHaveAttribute(
      "title",
      expect.stringContaining("発動確率")
    );
    expect(screen.getByTitle(/^乱れ撃ち x1 /)).toHaveAttribute(
      "title",
      expect.stringMatching(/^乱れ撃ち x1 \([^)]*\)$/)
    );
    expect(screen.getByTitle(/^乱れ撃ち x1 /)).toHaveTextContent(/^x1$/);
  });
});

describe("Timeline: ホークアイの発生の有無の指定 (#838)", () => {
  function renderBrdEntries(entries: TimelineEntry[]) {
    const resolvedEntries = resolveTimeline(entries, brdSkillMap, BRD_RESOURCES, defaultStats, BRD_BUFFS).entries;
    renderTimeline({
      jobId: "brd",
      skills: brdSkills,
      allSkillMap: brdSkillMap,
      resolvedEntries,
      resources: BRD_RESOURCES,
      buffs: BRD_BUFFS,
    });
  }

  it.each([
    [true, "ホークアイ: 発生"],
    [false, "ホークアイ: 不発"],
  ])("procOccurred = %s の付与元は、ツールチップとバッジに「%s」が出る", (procOccurred, label) => {
    renderBrdEntries([{ ...makeEntry("burst-shot"), procOccurred }]);

    expect(screen.getByTitle(/^バーストショット \(威力: /)).toHaveAttribute("title", expect.stringContaining(` ${label}`));
    expect(screen.getByTitle(label)).toBeInTheDocument();
  });

  it("指定の無い付与元には、ツールチップにもバッジにも出ない", () => {
    renderBrdEntries([makeEntry("burst-shot")]);

    expect(screen.getByTitle(/^バーストショット \(威力: /)).not.toHaveAttribute(
      "title",
      expect.stringContaining("ホークアイ: ")
    );
    expect(screen.queryByTitle(/^ホークアイ: /)).not.toBeInTheDocument();
  });

  it("付与元でない GCD に指定が残っていても出さない", () => {
    renderBrdEntries([makeEntry("barrage"), { ...makeEntry("refulgent-arrow"), procOccurred: false }]);

    expect(screen.queryByTitle(/^ホークアイ: /)).not.toBeInTheDocument();
  });
});

describe("Timeline: リソースのゲージ表示 (#632)", () => {
  const burstShots = (count: number) => Array.from({ length: count }, () => "burst-shot");
  const SONGS_ROTATION = [
    "wanderers-minuet", ...burstShots(6),
    "armys-paeon", ...burstShots(8),
    "mages-ballad", ...burstShots(2),
  ];

  /** リソースマーカー（title が「名前: 値/上限」）の中のゲージの数字ラベルと塗りの幅 */
  function readGauge(marker: HTMLElement) {
    const label = marker.querySelector("span");
    const fill = label?.previousElementSibling as HTMLElement | null | undefined;
    return { label: label?.textContent, width: fill?.style.width };
  }

  it("詩心はゲージで描き、塗りの分母をその時点の歌の上限（メヌエット 3／パイオン 4）にする", () => {
    renderBrd(SONGS_ROTATION);

    expect(readGauge(screen.getAllByTitle(/^詩心: 3\/3$/)[0])).toEqual({ label: "3", width: "100%" });
    expect(readGauge(screen.getAllByTitle(/^詩心: 3\/4$/)[0])).toEqual({ label: "3", width: "75%" });
    expect(readGauge(screen.getAllByTitle(/^詩心: 4\/4$/)[0])).toEqual({ label: "4", width: "100%" });
    // 賢人のバラード中（上限 0）のマーカーは描かない
    expect(screen.queryAllByTitle(/^詩心: \d+\/0$/)).toEqual([]);
  });

  it("ソウルボイスは、これまでどおり上限 100 に対する割合のゲージで描く", () => {
    renderBrd(SONGS_ROTATION);

    expect(readGauge(screen.getAllByTitle(/^ソウルボイス: 5\/100$/)[0])).toEqual({ label: "5", width: "5%" });
  });

  // 計算はソイルの獲得（実行時）に合わせて上限を実行時から上げるので、表示も着弾を待つ間から上げた上限で出す（#948）
  it("ブラッドファイアに遅れを設定しても、着弾前のソイルの上限は上げた上限（6）で出す", () => {
    const level = 100;
    const buffs = getBuffsForLevel(GNB_BUFFS, level);
    const resources = getResourcesForLevel(GNB_RESOURCES, level);
    const buffIds = new Set(buffs.map((b) => b.id));
    const resourceIds = new Set(resources.map((r) => r.id));
    const skills = getSkillsForLevel(GNB_ATTACK_SKILLS, level, buffIds, resourceIds);
    const skillMap = getAllSkillMapForLevel(GNB_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
    const resolvedEntries = resolveTimeline(
      ["bloodfest", "burst-strike"].map(makeEntry),
      skillMap,
      resources,
      defaultStats,
      buffs,
      undefined,
      undefined,
      { bloodfest: 1 },
    ).entries;
    // 前提: バーストストライク（0.65 秒）は、ブラッドファイアの着弾（1 秒）より前
    expect(resolvedEntries[1].startTime).toBeLessThan(resolvedEntries[0].hitTime!);
    renderTimeline({ jobId: "gnb", skills, allSkillMap: skillMap, resolvedEntries, resources, buffs });

    expect(screen.getByTitle("ソイル: 3/6")).toBeInTheDocument();
    expect(screen.getByTitle("ソイル: 2/6")).toBeInTheDocument();
  });
});

describe("Timeline: PPS 範囲選択を開いたときの初期区間 (#884)", () => {
  /** PPS 範囲選択を開いた直後の区間と、続けて「全体」ボタンを押した後の区間を返す */
  function openPpsRangeAndReset(entries: TimelineEntry[]) {
    const result = resolveTimeline(entries, jobASkillMap, [], defaultStats, [], []);
    const { props } = renderTimeline({
      resolvedEntries: result.entries,
      lastGcdEndTime: result.lastGcdEndTime,
    });

    fireEvent.click(screen.getByTitle("PPS範囲選択"));
    fireEvent.click(screen.getByTitle("全体範囲にリセット"));

    const calls = vi.mocked(props.onPpsRangeChange).mock.calls;
    expect(calls).toHaveLength(2);
    return { lastGcdEndTime: result.lastGcdEndTime, opened: calls[0][0], reset: calls[1][0] };
  }

  it("最後の GCD のリキャスト完了が 10 秒未満なら、0 〜 最後の GCD のリキャスト完了にし、「全体」ボタンと同じ区間にする", () => {
    const { lastGcdEndTime, opened, reset } = openPpsRangeAndReset([
      makeEntry(gcdSkill.id),
      makeEntry(gcdSkill.id),
      makeEntry(gcdSkill.id),
    ]);

    expect(lastGcdEndTime).toBeGreaterThan(0);
    expect(lastGcdEndTime).toBeLessThan(10);
    expect(opened).toEqual({ startTime: 0, endTime: lastGcdEndTime });
    expect(opened).toEqual(reset);
  });

  it.each([
    ["エントリが無い", []],
    ["GCD リキャストを発生させない oGCD だけの", [makeEntry(ogcdSkill.id)]],
  ])("%sタイムラインでは、「全体」ボタンと同じ 0 〜 0 にする", (_, entries) => {
    const { lastGcdEndTime, opened, reset } = openPpsRangeAndReset(entries);

    expect(lastGcdEndTime).toBe(0);
    expect(opened).toEqual({ startTime: 0, endTime: 0 });
    expect(opened).toEqual(reset);
  });
});

describe("Timeline: リキャストのレーンの区間は、リキャストの短縮を反映して終わる (#898)", () => {
  it("戦士 Lv70 でフェルクリーヴ 2 回で縮めると、最初のウォークライの区間は 50 秒で終わり、次の区間はそこからリキャスト分の 110 秒で終わる (#924)", () => {
    const level = 70;
    const buffs = getBuffsForLevel(WAR_BUFFS, level);
    const resources = getResourcesForLevel(WAR_RESOURCES, level);
    const buffIds = new Set(buffs.map((b) => b.id));
    const resourceIds = new Set(resources.map((r) => r.id));
    const skills = getSkillsForLevel(WAR_ATTACK_SKILLS, level, buffIds, resourceIds);
    const skillMap = getAllSkillMapForLevel(WAR_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
    const resolvedEntries = resolveTimeline(
      ["infuriate", "infuriate", "fell-cleave", "fell-cleave"].map(makeEntry),
      skillMap,
      resources,
      defaultStats,
      buffs
    ).entries;
    renderTimeline({ jobId: "war", skills, allSkillMap: skillMap, resolvedEntries, resources, buffs });

    const first = screen.getByTitle("ウォークライ リキャスト (0.00s - 50.00s / 60s)");
    expect(first.style.width).toBe(`${50 * PX_PER_SEC}px`);
    expect(screen.getByTitle("ウォークライ リキャスト (0.65s - 110.00s / 60s)")).toBeInTheDocument();
  });
});

describe("Timeline（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("見出し・切り替えボタン・案内を英語で出す", () => {
    renderTimeline();

    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByText("Drag and drop actions from the palette to add them")).toBeInTheDocument();
    expect(screen.getByText(/^Drag actions on the timeline to reorder them/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Untargetable ▶" })).toHaveAttribute("title", "Boss untargetable windows");
    expect(screen.getByRole("button", { name: "Multi-target ▶" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PPS range ▶" })).toHaveAttribute("title", "Select PPS range");
  });

  it("スキルのツールチップを英語で出す", () => {
    renderTimeline({ resolvedEntries: resolve([makeEntry(gcdSkill.id)]) });

    expect(screen.getByTitle(/^test-gcd \(Potency: 300 \/ Expected: \d+\) \[0\.00s\] (Cast: [\d.]+s|Instant)$/)).toBeInTheDocument();
    expect(screen.getByTitle(/^Recast: [\d.]+s$/)).toBeInTheDocument();
  });

  // 名前はジョブの名前空間から引く（#846）
  it("スキル・バフ・リソースのレーンの名前を英語で出す", () => {
    renderBrd(["wanderers-minuet", "barrage", "burst-shot", "refulgent-arrow"]);

    expect(screen.getByAltText("Burst Shot")).toBeInTheDocument();
    expect(screen.getByTitle(/^Refulgent Arrow \(Potency: /)).toBeInTheDocument();
    // レーンのラベルは英語の略称、title は正式名。略称と正式名が違うもので見る
    expect(screen.getByTitle("The Wanderer's Minuet").textContent).toBe("Minuet");
    expect(screen.getByTitle(/^Barrage x1 /)).toBeInTheDocument();
    expect(screen.getByTitle("Repertoire").textContent).toBe("Reper-\ntoire");
  });
});
