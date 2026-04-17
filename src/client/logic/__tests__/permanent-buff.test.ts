import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, BuffDefinition } from "../../types/skill";

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

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("永続バフ（duration: null）", () => {
  const permanentBuff: BuffDefinition = {
    id: "perma-buff",
    name: "永続バフ",
    shortName: "永続",
    icon: "",
    duration: null,
    effects: [{ type: "potency", value: 1.2 }],
    color: "#00ff00",
  };

  const finiteBuff: BuffDefinition = {
    id: "finite-buff",
    name: "有限バフ",
    shortName: "有限",
    icon: "",
    duration: 5,
    effects: [{ type: "potency", value: 1.1 }],
    color: "#ff0000",
  };

  it("永続バフは endTime が Infinity で、時間経過では失効しない", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["perma-buff"] });
    const check = makeSkill({ id: "check" });
    const skillMap = new Map([[grant.id, grant], [check.id, check]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("check"), makeEntry("check"), makeEntry("check"), makeEntry("check")],
      skillMap,
      [],
      undefined,
      [permanentBuff]
    );

    // 最終エントリ（約10秒後）でも永続バフがアクティブであること
    const lastEntry = result.entries[result.entries.length - 1];
    const ab = lastEntry.activeBuffs.find((b) => b.buffId === "perma-buff");
    expect(ab).toBeDefined();
    expect(ab!.endTime).toBe(Number.POSITIVE_INFINITY);
  });

  it("永続バフは buffConsumptions により正しく消費・解除される", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["perma-buff"] });
    const consume = makeSkill({
      id: "consume",
      requiredBuff: "perma-buff",
      buffConsumptions: [{ buffId: "perma-buff", stacks: 1 }],
    });
    const check = makeSkill({ id: "check" });
    const skillMap = new Map([[grant.id, grant], [consume.id, consume], [check.id, check]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("consume"), makeEntry("check")],
      skillMap,
      [],
      undefined,
      [permanentBuff]
    );

    // consume 直後の check エントリではバフが消えていること
    const checkEntry = result.entries[2];
    const ab = checkEntry.activeBuffs.find((b) => b.buffId === "perma-buff");
    expect(ab).toBeUndefined();
    // consume 自身はバフ適用中の扱いでエラーなし
    expect(result.entries[1].comboErrors).toEqual([]);
  });

  it("永続バフの威力倍率は後続スキルに正しく適用される", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["perma-buff"] });
    const attack = makeSkill({ id: "attack", potency: 100 });
    const skillMap = new Map([[grant.id, grant], [attack.id, attack]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("attack"), makeEntry("attack")],
      skillMap,
      [],
      undefined,
      [permanentBuff]
    );

    // 有限バフと違い、何秒経過しても倍率が掛かり続ける
    expect(result.entries[1].buffMultiplier).toBeCloseTo(1.2, 5);
    expect(result.entries[2].buffMultiplier).toBeCloseTo(1.2, 5);
  });

  it("有限バフと永続バフが共存しても相互干渉しない", () => {
    const grantBoth = makeSkill({
      id: "grant-both",
      buffApplications: ["perma-buff", "finite-buff"],
    });
    const idle = makeSkill({ id: "idle" });
    const skillMap = new Map([[grantBoth.id, grantBoth], [idle.id, idle]]);

    const result = resolveTimeline(
      // 5秒以上経過させて有限バフだけ失効させる
      [makeEntry("grant-both"), makeEntry("idle"), makeEntry("idle"), makeEntry("idle")],
      skillMap,
      [],
      undefined,
      [permanentBuff, finiteBuff]
    );

    // 最終エントリ: 永続バフのみアクティブ
    const lastEntry = result.entries[result.entries.length - 1];
    expect(lastEntry.activeBuffs.find((b) => b.buffId === "perma-buff")).toBeDefined();
    expect(lastEntry.activeBuffs.find((b) => b.buffId === "finite-buff")).toBeUndefined();
  });
});
