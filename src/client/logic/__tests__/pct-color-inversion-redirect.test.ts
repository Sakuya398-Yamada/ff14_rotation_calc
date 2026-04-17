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
    type: "gcd",
    target: "enemy",
    icon: "",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

function makeEntry(skillId: string, uid?: string): TimelineEntry {
  return { uid: uid ?? `${skillId}-${Math.random()}`, skillId };
}

const PAINT_RESOURCES: ResourceDefinition[] = [
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

const COLOR_INVERSION: BuffDefinition = {
  id: "color-inversion",
  name: "色調反転",
  shortName: "色調\n反転",
  icon: "",
  duration: null,
  effects: [],
  color: "#546e7a",
  redirectResourceGain: { fromResourceId: "white-paint", toResourceId: "black-paint" },
  onExpireResourceTransfer: { fromResourceId: "black-paint", toResourceId: "white-paint" },
};

const SUBTRACTIVE_PALETTE = makeSkill({
  id: "subtractive-palette",
  type: "ogcd",
  target: "self",
  recastTime: 0.65,
  resourceChanges: [
    { resourceId: "palette-gauge", amount: -50 },
    { resourceId: "white-paint", amount: -1, skipIfInsufficient: true },
    { resourceId: "black-paint", amount: 1, skipIfInsufficient: true },
  ],
  buffApplications: ["color-inversion"],
});

/** 通常時に WP+1 するスキル（ファイアピグメント相当） */
const ADD_WP = makeSkill({
  id: "add-wp",
  resourceChanges: [{ resourceId: "white-paint", amount: 1 }],
});

/** パレットゲージ補充 */
const FILL_PG = makeSkill({
  id: "fill-pg",
  resourceChanges: [{ resourceId: "palette-gauge", amount: 50 }],
});

/** WP 1 つ補充 */
const FILL_WP1 = makeSkill({
  id: "fill-wp1",
  resourceChanges: [{ resourceId: "white-paint", amount: 1 }],
});

/** 何もしないプレースホルダ（状態確認用） */
const NOOP = makeSkill({ id: "noop" });

describe("Issue #157 サブトラクティブパレットのペイント色変化仕様", () => {
  it("WP=0 状態でサブトラクティブパレットを使用 → エラーなし・WP/BP とも 0 のまま", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_PG.id, FILL_PG],
      [NOOP.id, NOOP],
    ]);

    const result = resolveTimeline(
      [makeEntry("fill-pg"), makeEntry("subtractive-palette"), makeEntry("noop")],
      skillMap,
      PAINT_RESOURCES,
      undefined,
      [COLOR_INVERSION]
    );

    expect(result.entries[1].resourceErrors).toEqual([]);
    const after = result.entries[2].resourceSnapshot;
    expect(after["white-paint"]).toBe(0);
    expect(after["black-paint"]).toBe(0);
    // color-inversion バフは WP の有無に関わらず付与される
    expect(result.entries[2].activeBuffs.some((b) => b.buffId === "color-inversion")).toBe(true);
  });

  it("WP=1 状態でサブトラクティブパレットを使用 → WP→0, BP→1", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_PG.id, FILL_PG],
      [FILL_WP1.id, FILL_WP1],
      [NOOP.id, NOOP],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("fill-pg"),
        makeEntry("fill-wp1"),
        makeEntry("subtractive-palette"),
        makeEntry("noop"),
      ],
      skillMap,
      PAINT_RESOURCES,
      undefined,
      [COLOR_INVERSION]
    );

    expect(result.entries[2].resourceErrors).toEqual([]);
    const after = result.entries[3].resourceSnapshot;
    expect(after["white-paint"]).toBe(0);
    expect(after["black-paint"]).toBe(1);
  });

  it("色調反転非アクティブ時: WP生成スキルは通常どおり WP に加算される", () => {
    const skillMap = new Map([
      [ADD_WP.id, ADD_WP],
      [NOOP.id, NOOP],
    ]);

    const result = resolveTimeline(
      [makeEntry("add-wp"), makeEntry("noop")],
      skillMap,
      PAINT_RESOURCES,
      undefined,
      [COLOR_INVERSION]
    );

    const after = result.entries[1].resourceSnapshot;
    expect(after["white-paint"]).toBe(1);
    expect(after["black-paint"]).toBe(0);
  });

  it("色調反転アクティブ中: WP生成スキルは BP に振り替えられる", () => {
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_PG.id, FILL_PG],
      [FILL_WP1.id, FILL_WP1],
      [ADD_WP.id, ADD_WP],
      [NOOP.id, NOOP],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("fill-pg"),
        makeEntry("fill-wp1"),
        makeEntry("subtractive-palette"), // color-inversion 付与 & WP→BP 色変化
        makeEntry("add-wp"),               // color-inversion 中の WP+1 → BP+1 にリダイレクト
        makeEntry("noop"),
      ],
      skillMap,
      PAINT_RESOURCES,
      undefined,
      [COLOR_INVERSION]
    );

    // サブトラ後: WP=0, BP=1
    // add-wp 実行後: WP=0 のまま、BP が 1→2 にリダイレクト
    const after = result.entries[4].resourceSnapshot;
    expect(after["white-paint"]).toBe(0);
    expect(after["black-paint"]).toBe(2);
  });

  it("色調反転中に WP 複数生成: すべて BP 側へ積まれ、groupMaxStacks 上限でキャップされる", () => {
    const addWp3 = makeSkill({
      id: "add-wp3",
      resourceChanges: [{ resourceId: "white-paint", amount: 3 }],
    });
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_PG.id, FILL_PG],
      [FILL_WP1.id, FILL_WP1],
      [addWp3.id, addWp3],
      [NOOP.id, NOOP],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("fill-pg"),
        makeEntry("fill-wp1"),
        makeEntry("subtractive-palette"),
        makeEntry("add-wp3"),
        makeEntry("noop"),
      ],
      skillMap,
      PAINT_RESOURCES,
      undefined,
      [COLOR_INVERSION]
    );

    // サブトラ後: WP=0, BP=1 → add-wp3 で +3 を BP 側にリダイレクト → BP=4
    const after = result.entries[4].resourceSnapshot;
    expect(after["white-paint"]).toBe(0);
    expect(after["black-paint"]).toBe(4);
  });

  it("サブトラクティブパレット自身の BP+1 はバフ適用前に処理されるためリダイレクト対象にならない", () => {
    // サブトラクティブパレットを 2 回連続で使っても、1 回目の `color-inversion` 付与後、
    // 2 回目の black-paint +1 が white-paint にリダイレクトされることはない（fromResourceId が違うため）。
    const skillMap = new Map([
      [SUBTRACTIVE_PALETTE.id, SUBTRACTIVE_PALETTE],
      [FILL_PG.id, FILL_PG],
      [FILL_WP1.id, FILL_WP1],
      [NOOP.id, NOOP],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("fill-pg"),
        makeEntry("fill-wp1"),
        makeEntry("fill-wp1"),
        makeEntry("subtractive-palette"), // WP=2→1, BP=0→1, color-inversion 付与
        makeEntry("fill-pg"),
        makeEntry("subtractive-palette"), // 2回目: WP=1→0, BP=1→2
        makeEntry("noop"),
      ],
      skillMap,
      PAINT_RESOURCES,
      undefined,
      [COLOR_INVERSION]
    );

    expect(result.entries[5].resourceErrors).toEqual([]);
    const after = result.entries[6].resourceSnapshot;
    expect(after["white-paint"]).toBe(0);
    expect(after["black-paint"]).toBe(2);
  });
});
