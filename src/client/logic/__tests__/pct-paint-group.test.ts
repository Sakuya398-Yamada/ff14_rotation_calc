import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, ResourceDefinition, BuffDefinition } from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
    potency: 100,
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

describe("ピクトマンサー ペイントゲージ（WP/BP 共有5スロット）", () => {
  it("WP=5 時に BP+1 を試みても groupMaxStacks=5 により BP は 0 のまま（グループキャップ）", () => {
    const fillWp = makeSkill({ id: "fill-wp", resourceChanges: [{ resourceId: "white-paint", amount: 5 }] });
    const addBp = makeSkill({ id: "add-bp", resourceChanges: [{ resourceId: "black-paint", amount: 1 }] });

    const skillMap = new Map([[fillWp.id, fillWp], [addBp.id, addBp]]);
    const result = resolveTimeline(
      [makeEntry("fill-wp"), makeEntry("add-bp"), makeEntry("add-bp")],
      skillMap,
      PAINT_RESOURCES
    );

    // fill-wp 実行後: WP=5, BP=0
    expect(result.entries[0].resourceSnapshot["white-paint"]).toBe(5);
    expect(result.entries[0].resourceSnapshot["black-paint"]).toBe(0);
    // 1 回目の add-bp 実行後: groupMaxStacks=5 に到達しているため、BP は 0 のまま
    expect(result.entries[1].resourceSnapshot["white-paint"]).toBe(5);
    expect(result.entries[1].resourceSnapshot["black-paint"]).toBe(0);
    // 2 回目の add-bp 実行後: 同じくキャップされ BP は 0
    expect(result.entries[2].resourceSnapshot["white-paint"]).toBe(5);
    expect(result.entries[2].resourceSnapshot["black-paint"]).toBe(0);
  });

  it("WP 3, BP 0 から +1 WP したら WP=4 になる（合計 4 <= 5）", () => {
    const setup = makeSkill({ id: "setup", resourceChanges: [{ resourceId: "white-paint", amount: 3 }] });
    const addWp = makeSkill({ id: "add-wp", resourceChanges: [{ resourceId: "white-paint", amount: 1 }] });
    const skillMap = new Map([[setup.id, setup], [addWp.id, addWp]]);
    const result = resolveTimeline(
      [makeEntry("setup"), makeEntry("add-wp"), makeEntry("add-wp")],
      skillMap,
      PAINT_RESOURCES
    );
    // setup 実行後: WP=3
    expect(result.entries[0].resourceSnapshot["white-paint"]).toBe(3);
    // 1回目 add-wp 実行後: WP=4 (キャップにひっかからない)
    expect(result.entries[1].resourceSnapshot["white-paint"]).toBe(4);
    // 2回目 add-wp 実行後: WP=5
    expect(result.entries[2].resourceSnapshot["white-paint"]).toBe(5);
  });

  it("サブトラクティブパレット的 WP→BP 転送（WP -1, BP +1）は合計を維持する", () => {
    const setup = makeSkill({ id: "setup", resourceChanges: [{ resourceId: "white-paint", amount: 5 }] });
    const subtract = makeSkill({
      id: "subtract",
      resourceChanges: [
        { resourceId: "white-paint", amount: -1 },
        { resourceId: "black-paint", amount: 1 },
      ],
    });
    const skillMap = new Map([[setup.id, setup], [subtract.id, subtract]]);
    const result = resolveTimeline(
      [makeEntry("setup"), makeEntry("subtract"), makeEntry("subtract")],
      skillMap,
      PAINT_RESOURCES
    );
    // 1回目のsubtract実行後: WP=4, BP=1
    expect(result.entries[1].resourceSnapshot["white-paint"]).toBe(4);
    expect(result.entries[1].resourceSnapshot["black-paint"]).toBe(1);
    // 2回目のsubtract実行後: WP=3, BP=2
    expect(result.entries[2].resourceSnapshot["white-paint"]).toBe(3);
    expect(result.entries[2].resourceSnapshot["black-paint"]).toBe(2);
  });

  it("WP=0 で [{WP:-1},{BP:+1}] を実行すると resourceError で両方とも変化しない", () => {
    const subtract = makeSkill({
      id: "subtract",
      resourceChanges: [
        { resourceId: "white-paint", amount: -1 },
        { resourceId: "black-paint", amount: 1 },
      ],
    });
    const skillMap = new Map([[subtract.id, subtract]]);
    const result = resolveTimeline([makeEntry("subtract"), makeEntry("subtract")], skillMap, PAINT_RESOURCES);

    expect(result.entries[0].resourceErrors).toContain("white-paint");
    // 1 回目がエラーなのでリソースは変化していないまま 2 回目の実行に到達する
    expect(result.entries[1].resourceSnapshot["white-paint"]).toBe(0);
    expect(result.entries[1].resourceSnapshot["black-paint"]).toBe(0);
  });

  it("resourceChanges の並び順に結果が依存しない（負→正の2パス適用）", () => {
    const fillWp = makeSkill({ id: "fill-wp", resourceChanges: [{ resourceId: "white-paint", amount: 5 }] });
    const normalOrder = makeSkill({
      id: "normal",
      resourceChanges: [
        { resourceId: "white-paint", amount: -1 },
        { resourceId: "black-paint", amount: 1 },
      ],
    });
    const reversedOrder = makeSkill({
      id: "reversed",
      resourceChanges: [
        { resourceId: "black-paint", amount: 1 },
        { resourceId: "white-paint", amount: -1 },
      ],
    });
    const skillMap = new Map([[fillWp.id, fillWp], [normalOrder.id, normalOrder], [reversedOrder.id, reversedOrder]]);

    const r1 = resolveTimeline(
      [makeEntry("fill-wp"), makeEntry("normal"), makeEntry("normal")],
      skillMap,
      PAINT_RESOURCES
    );
    const r2 = resolveTimeline(
      [makeEntry("fill-wp"), makeEntry("reversed"), makeEntry("reversed")],
      skillMap,
      PAINT_RESOURCES
    );
    // 2 回 subtract 実行後の snapshot で比較
    expect(r1.entries[2].resourceSnapshot).toEqual(r2.entries[2].resourceSnapshot);
  });

  it("onExpireResourceTransfer: バフ消失時に BP を WP へ戻す", () => {
    const grantBuff = makeSkill({
      id: "grant",
      type: "gcd",
      resourceChanges: [
        { resourceId: "white-paint", amount: 3 },
        { resourceId: "black-paint", amount: 2 },
      ],
      buffApplications: ["test-inversion"],
    });
    // 十分な時間経過のため、GCDスキルを多数打つ
    const idle = makeSkill({ id: "idle", type: "gcd", recastTime: 2.5 });
    const check = makeSkill({ id: "check", type: "gcd", recastTime: 2.5 });
    const skillMap = new Map([[grantBuff.id, grantBuff], [idle.id, idle], [check.id, check]]);

    const buffs: BuffDefinition[] = [
      {
        id: "test-inversion",
        name: "test-inversion",
        shortName: "TI",
        icon: "",
        duration: 5, // 5秒で切れる
        effects: [],
        color: "#000",
        onExpireResourceTransfer: {
          fromResourceId: "black-paint",
          toResourceId: "white-paint",
        },
      },
    ];

    // grant → idle x3（約7.5秒経過）→ check（バフ消失後）
    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("idle"), makeEntry("idle"), makeEntry("idle"), makeEntry("check")],
      skillMap,
      PAINT_RESOURCES,
      undefined,
      buffs
    );

    const checkEntry = result.entries[4];
    // バフが切れている時点のスナップショットでは、BP→WP が転送済みのはず
    expect(checkEntry.resourceSnapshot["black-paint"]).toBe(0);
    expect(checkEntry.resourceSnapshot["white-paint"]).toBe(5); // 3 + 2 = 5
  });
});
