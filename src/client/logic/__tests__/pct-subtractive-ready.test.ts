import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type {
  Skill,
  TimelineEntry,
  ResourceDefinition,
  BuffDefinition,
} from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: "",
    recastTime: 0.65,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

function makeEntry(skillId: string, uid?: string): TimelineEntry {
  return { uid: uid ?? `${skillId}-${Math.random()}`, skillId };
}

const PCT_RESOURCES: ResourceDefinition[] = [
  {
    id: "palette-gauge",
    name: "PG",
    shortName: "PG",
    maxStacks: 100,
    color: "#eee",
  },
  {
    id: "white-paint",
    name: "WP",
    shortName: "WP",
    maxStacks: 5,
    color: "#fff",
    displayGroup: "paint",
    groupMaxStacks: 5,
    displayGroupPriority: 2,
  },
  {
    id: "black-paint",
    name: "BP",
    shortName: "BP",
    maxStacks: 5,
    color: "#000",
    displayGroup: "paint",
    groupMaxStacks: 5,
    displayGroupPriority: 1,
  },
];

const SUBTRACTIVE_READY_BUFF: BuffDefinition = {
  id: "subtractive-ready",
  name: "サブトラクティブパレット実行可",
  shortName: "SR",
  icon: "",
  duration: 30,
  effects: [],
  color: "#90a4ae",
};

/** サブトラクティブパレットを模したスキル */
const SUBTRACTIVE_PALETTE = makeSkill({
  id: "subtractive-palette",
  resourceChanges: [
    { resourceId: "palette-gauge", amount: -50 },
    // WP→BP は枠内の色変化。WP=0 でも両方スキップでエラー化しない
    { resourceId: "white-paint", amount: -1, skipIfInsufficient: true },
    { resourceId: "black-paint", amount: 1, skipIfInsufficient: true },
  ],
  buffSkippableResource: { buffId: "subtractive-ready", resourceId: "palette-gauge" },
});

/** subtractive-ready を付与するスキル（イマジンスカイ相当） */
const GRANT_READY = makeSkill({
  id: "grant-ready",
  buffApplications: ["subtractive-ready"],
});

/** WPを補充するスキル（セットアップ用） */
const FILL_WP = makeSkill({ id: "fill-wp", resourceChanges: [{ resourceId: "white-paint", amount: 5 }] });

/** PGを補充するスキル（セットアップ用） */
const FILL_PG = makeSkill({ id: "fill-pg", resourceChanges: [{ resourceId: "palette-gauge", amount: 50 }] });

describe("サブトラReady によるサブトラクティブパレット発動条件緩和", () => {
  it("subtractive-ready なし・PG50未満 → resourceError（従来動作）", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_WP.id, FILL_WP],
    ]);

    const result = resolveTimeline(
      [makeEntry("fill-wp"), makeEntry("subtractive-palette")],
      skillMap,
      PCT_RESOURCES,
      undefined,
      [SUBTRACTIVE_READY_BUFF]
    );

    expect(result.entries[1].resourceErrors).toContain("palette-gauge");
  });

  it("subtractive-ready なし・PG50以上 → 正常実行（PG=-50, WP=-1, BP=+1）", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_WP.id, FILL_WP],
      [FILL_PG.id, FILL_PG],
      [makeSkill({ id: "noop" }).id, makeSkill({ id: "noop" })],
    ]);

    const result = resolveTimeline(
      [makeEntry("fill-wp"), makeEntry("fill-pg"), makeEntry("subtractive-palette"), makeEntry("noop")],
      skillMap,
      PCT_RESOURCES,
      undefined,
      [SUBTRACTIVE_READY_BUFF]
    );

    expect(result.entries[2].resourceErrors).toEqual([]);
    // 直後のエントリのスナップショットで検証: PG=0, WP=4, BP=1
    const after = result.entries[3].resourceSnapshot;
    expect(after["palette-gauge"]).toBe(0);
    expect(after["white-paint"]).toBe(4);
    expect(after["black-paint"]).toBe(1);
  });

  it("subtractive-ready あり・PG0 → エラーなしで実行・バフ消費・WP→BP変換は維持", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_WP.id, FILL_WP],
      [GRANT_READY.id, GRANT_READY],
      [makeSkill({ id: "noop" }).id, makeSkill({ id: "noop" })],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("fill-wp"),
        makeEntry("grant-ready"),
        makeEntry("subtractive-palette"),
        makeEntry("noop"),
      ],
      skillMap,
      PCT_RESOURCES,
      undefined,
      [SUBTRACTIVE_READY_BUFF]
    );

    // エラーなし
    expect(result.entries[2].resourceErrors).toEqual([]);
    // 実行後スナップショット: PG温存（=0のまま）・WP=4・BP=1
    const after = result.entries[3].resourceSnapshot;
    expect(after["palette-gauge"]).toBe(0);
    expect(after["white-paint"]).toBe(4);
    expect(after["black-paint"]).toBe(1);
    // バフは消費済（次エントリ時点で無い）
    expect(
      result.entries[3].activeBuffs.some((b) => b.buffId === "subtractive-ready")
    ).toBe(false);
  });

  it("subtractive-ready あり・PG50以上 → バフ優先消費・PGは温存（Ready優先仕様）", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_WP.id, FILL_WP],
      [FILL_PG.id, FILL_PG],
      [GRANT_READY.id, GRANT_READY],
      [makeSkill({ id: "noop" }).id, makeSkill({ id: "noop" })],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("fill-wp"),
        makeEntry("fill-pg"),
        makeEntry("grant-ready"),
        makeEntry("subtractive-palette"),
        makeEntry("noop"),
      ],
      skillMap,
      PCT_RESOURCES,
      undefined,
      [SUBTRACTIVE_READY_BUFF]
    );

    expect(result.entries[3].resourceErrors).toEqual([]);
    const after = result.entries[4].resourceSnapshot;
    // PGは温存される（=50のまま）
    expect(after["palette-gauge"]).toBe(50);
    // WP→BP変換は実行
    expect(after["white-paint"]).toBe(4);
    expect(after["black-paint"]).toBe(1);
    // バフ消費
    expect(
      result.entries[4].activeBuffs.some((b) => b.buffId === "subtractive-ready")
    ).toBe(false);
  });

  it("subtractive-ready あり・WP0 → エラーなしで実行・WP/BP とも変動なし（色変化対象なし）", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [GRANT_READY.id, GRANT_READY],
      [makeSkill({ id: "noop" }).id, makeSkill({ id: "noop" })],
    ]);

    const result = resolveTimeline(
      [makeEntry("grant-ready"), makeEntry("subtractive-palette"), makeEntry("noop")],
      skillMap,
      PCT_RESOURCES,
      undefined,
      [SUBTRACTIVE_READY_BUFF]
    );

    // WP=0 でもエラーなし（skipIfInsufficient により WP-1/BP+1 がアトミックにスキップ）
    expect(result.entries[1].resourceErrors).toEqual([]);
    const after = result.entries[2].resourceSnapshot;
    expect(after["white-paint"]).toBe(0);
    expect(after["black-paint"]).toBe(0);
  });
});
