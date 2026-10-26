import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { AST_ATTACK_SKILLS } from "../../data/ast-skills";
import { AST_BUFFS } from "../../data/ast-buffs";
import { AST_RESOURCES } from "../../data/ast-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(AST_BUFFS, level);
  const resources = getResourcesForLevel(AST_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(AST_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(AST_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (ids: (string | TimelineEntry)[]) =>
    resolveTimeline(
      ids.map((id) => (typeof id === "string" ? entry(id) : id)),
      skillMap,
      resources,
      undefined,
      buffs,
    );
  return { skills, resolve };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.some((ab) => ab.buffId === buffId);
const lord = (e: ResolvedTimelineEntry) => e.resourceSnapshot["lord-of-crowns"];
const umbralNext = (e: ResolvedTimelineEntry) => e.resourceSnapshot["umbral-draw-next"];

/**
 * 公式ジョブガイド（占星術師、Patch 7.5、7.55 表記、PvE 欄）と、特性習得前の値（パッチノート 7.x の変更履歴と consolegameswiki で照合）
 * - アクション威力アップ（Lv94）: コンバガの継続ダメージ 70、フォールマレフィク 270、グラビラ 140、マクロコスモス 270
 *   （Lv94 未満は 65 / 250 / 130 / 250）
 */
describe("AST: レベルごとの威力", () => {
  it.each<[PlayerLevel, string, number]>([
    [70, "malefic3", 190], [80, "malefic4", 230], [90, "fall-malefic", 250], [100, "fall-malefic", 270],
    [70, "gravity", 120], [80, "gravity", 120], [90, "gravity2", 130], [100, "gravity2", 140],
    [90, "macrocosmos", 250], [100, "macrocosmos", 270],
    [70, "lord-of-crowns", 400], [100, "lord-of-crowns", 400],
  ])("Lv%i ではパレットに %s が並び、タイムライン上の威力は %i", (level, skillId, potency) => {
    const { skills, resolve } = setup(level);
    expect(skills.map((s) => s.id)).toContain(skillId);
    const [e] = resolve([skillId]).entries;
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "combust2", 60],
    [80, "combust3", 65],
    [90, "combust3", 65],
    [100, "combust3", 70],
  ])("Lv%i の %s の DoT は 30 秒で 10 ティック、ティック威力 %i", (level, skillId, dotPotency) => {
    const { skills, resolve } = setup(level);
    expect(skills.map((s) => s.id)).toContain(skillId);
    const result = resolve([skillId]);
    expectNoError(result.entries[0]);
    const ticks = result.dotTicks.filter((t) => t.skillId === skillId);
    expect(ticks).toHaveLength(10);
    expect(ticks.every((t) => t.potency === dotPotency)).toBe(true);
  });
});

describe("AST: ディヴィネーションの与ダメージ上昇", () => {
  it("ディヴィネーションの後の攻撃に与ダメージ +6% が乗る", () => {
    const [, malefic] = setup().resolve(["divination", "fall-malefic"]).entries;
    expectNoError(malefic);
    expect(malefic.resolvedPotency).toBe(270);
    expect(malefic.buffMultiplier).toBeCloseTo(1.06);
  });

  it("ディヴィネーションの後に付与したコンバガは、ディヴィネーションが切れた後のティックも +6% のまま（スナップショット）", () => {
    const result = setup().resolve(["divination", "combust3"]);
    expectNoError(result.entries[1]);
    const ticks = result.dotTicks.filter((t) => t.skillId === "combust3");
    expect(ticks).toHaveLength(10);
    // ディヴィネーション（20 秒）が切れた後のティックが含まれていることを確かめてから全ティックを見る
    expect(ticks[ticks.length - 1].time).toBeGreaterThan(result.entries[0].startTime + 20);
    expect(ticks.every((t) => t.potency === Math.floor(70 * 1.06))).toBe(true);
  });

  it("ディヴィネーションが無ければコンバガのティック威力は 70 のまま", () => {
    const result = setup().resolve(["combust3"]);
    expectNoError(result.entries[0]);
    const ticks = result.dotTicks.filter((t) => t.skillId === "combust3");
    expect(ticks).toHaveLength(10);
    expect(ticks.every((t) => t.potency === 70)).toBe(true);
  });
});

describe("AST: オラクル", () => {
  it("ディヴィネーションの後はオラクル（威力 860）が使え、ディヴィネーションの与ダメージ上昇も乗る", () => {
    const [, oracle] = setup().resolve(["divination", "oracle"]).entries;
    expectNoError(oracle);
    expect(oracle.resolvedPotency).toBe(860);
    expect(oracle.buffMultiplier).toBeCloseTo(1.06);
  });

  it("ディヴィネーションを使っていなければ、オラクルは「オラクル実行可」不足のエラーになる", () => {
    const [oracle] = setup().resolve(["oracle"]).entries;
    expect(oracle.comboErrors).toEqual([{ buffId: "divining", kind: "missing" }]);
  });

  it("オラクルを 1 回使うと「オラクル実行可」は消え、2 回目はエラーになる", () => {
    const entries = setup().resolve(["divination", "oracle", "fall-malefic", "oracle"]).entries;
    expectNoError(entries[1]);
    expect(entries[3].recastError).toBeFalsy();
    expect(entries[3].comboErrors).toEqual([{ buffId: "divining", kind: "missing" }]);
  });

  it("Lv90 ではパレットにオラクルが無く、ディヴィネーションで「オラクル実行可」も付かない", () => {
    const { skills, resolve } = setup(90);
    expect(skills.map((s) => s.id)).not.toContain("oracle");
    const [divination] = resolve(["divination"]).entries;
    expectNoError(divination);
    expect(hasBuff(divination, "divination")).toBe(true);
    expect(hasBuff(divination, "divining")).toBe(false);
  });
});

describe("AST: アーサリースターとステラデトネーション", () => {
  it.each<[number, number]>([
    [5, 205],
    [9.9, 205],
    [10, 310],
    [19.9, 310],
  ])("設置から %s 秒後のステラデトネーションの威力は %i", (time, potency) => {
    const [, detonation] = setup().resolve(["earthly-star", entry("stellar-detonation", time)]).entries;
    expectNoError(detonation);
    expect(detonation.resolvedPotency).toBe(potency);
  });

  it("設置から 20 秒経つとアーサリースターは消え、ステラデトネーションはエラーになる（自動爆発は数えない）", () => {
    const [, detonation] = setup().resolve(["earthly-star", entry("stellar-detonation", 20)]).entries;
    expect(detonation.recastError).toBeFalsy();
    expect(detonation.comboErrors).toEqual([{ buffId: "earthly-star", kind: "missing" }]);
  });

  it("アーサリースターを設置していなければ、ステラデトネーションはエラーになる", () => {
    const [detonation] = setup().resolve(["stellar-detonation"]).entries;
    expect(detonation.comboErrors).toEqual([{ buffId: "earthly-star", kind: "missing" }]);
  });

  it("成熟前にステラデトネーションを使うと、アーサリースターと星の支配者の両方が消える", () => {
    const [star, detonation] = setup().resolve(["earthly-star", entry("stellar-detonation", 5)]).entries;
    expect(hasBuff(star, "earthly-star")).toBe(true);
    expect(hasBuff(star, "earthly-dominance")).toBe(true);
    expectNoError(detonation);
    expect(hasBuff(detonation, "earthly-star")).toBe(false);
    expect(hasBuff(detonation, "earthly-dominance")).toBe(false);
  });
});

describe("AST: ドローとクラウンロード", () => {
  it("パレットにはアストラルドローだけが並び、アンブラルドローは並ばない", () => {
    const ids = setup().skills.map((s) => s.id);
    expect(ids).toContain("astral-draw");
    expect(ids).not.toContain("umbral-draw");
  });

  it("開幕はアストラルドローを引いた状態で、クラウンロードが使える（使うと消える）", () => {
    const [first, second] = setup().resolve(["lord-of-crowns", "lord-of-crowns"]).entries;
    expectNoError(first);
    expect(first.resolvedPotency).toBe(400);
    expect(lord(first)).toBe(0);
    expect(second.resourceErrors).toEqual([{ resourceId: "lord-of-crowns", kind: "insufficient" }]);
  });

  it("開幕に置いたドローはアンブラルドローになり、使わずにいたクラウンロードも消える", () => {
    const [draw, crowns] = setup().resolve(["astral-draw", "lord-of-crowns"]).entries;
    expectNoError(draw);
    expect(draw.resolvedSkillId).toBe("umbral-draw");
    expect(lord(draw)).toBe(0);
    expect(umbralNext(draw)).toBe(0);
    expect(crowns.resourceErrors).toEqual([{ resourceId: "lord-of-crowns", kind: "insufficient" }]);
  });

  it("アンブラルドローの次のドローはアストラルドローになり、クラウンロードがまた使える", () => {
    const [, draw, crowns] = setup().resolve(["astral-draw", entry("astral-draw", 60), "lord-of-crowns"]).entries;
    expectNoError(draw);
    expect(draw.resolvedSkillId).toBe("astral-draw");
    expect(lord(draw)).toBe(1);
    expect(umbralNext(draw)).toBe(1);
    expectNoError(crowns);
    expect(crowns.resolvedPotency).toBe(400);
  });

  it("アンブラルドローとアストラルドローはリキャストを共有する", () => {
    const [umbral, astral] = setup().resolve(["astral-draw", "astral-draw"]).entries;
    expectNoError(umbral);
    expect(umbral.resolvedSkillId).toBe("umbral-draw");
    // 自動配置なのでアニメーションロックは明けている。残る原因は共有リキャストだけ
    expect(astral.resolvedSkillId).toBe("astral-draw");
    expect(astral.recastError).toBe(true);
  });
});

describe("AST: ライトスピード", () => {
  it("ライトスピード中の魔法は詠唱なしになり、ライトスピードは消費されない", () => {
    const [, first, second] = setup().resolve(["lightspeed", "fall-malefic", "fall-malefic"]).entries;
    expectNoError(first);
    expectNoError(second);
    expect(first.castTime).toBe(0);
    expect(second.castTime).toBe(0);
    expect(hasBuff(second, "lightspeed")).toBe(true);
  });

  it("ライトスピードが無ければフォールマレフィクの詠唱は 1.5 秒", () => {
    const [malefic] = setup().resolve(["fall-malefic"]).entries;
    expectNoError(malefic);
    expect(malefic.castTime).toBe(1.5);
  });

  it.each<[number, number]>([
    [14.9, 0],
    [15, 1.5],
  ])("ライトスピードから %s 秒後のフォールマレフィクの詠唱は %s 秒", (time, castTime) => {
    const [, malefic] = setup().resolve(["lightspeed", entry("fall-malefic", time)]).entries;
    expectNoError(malefic);
    expect(malefic.castTime).toBe(castTime);
  });

  it("ライトスピードは 2 チャージで、3 回続けて使うと 3 回目はリキャストエラーになる", () => {
    const entries = setup().resolve(["lightspeed", "lightspeed", "lightspeed"]).entries;
    expectNoError(entries[0]);
    expectNoError(entries[1]);
    expect(entries[2].recastError).toBe(true);
  });

  it("ライトスピード中の魔法では迅速魔が消費されない", () => {
    const [, , malefic] = setup().resolve(["swiftcast", "lightspeed", "fall-malefic"]).entries;
    expectNoError(malefic);
    expect(malefic.castTime).toBe(0);
    expect(hasBuff(malefic, "swiftcast")).toBe(true);
  });

  it("ライトスピードが無ければ、迅速魔は詠唱のある魔法で消費される", () => {
    const [, malefic] = setup().resolve(["swiftcast", "fall-malefic"]).entries;
    expectNoError(malefic);
    expect(malefic.castTime).toBe(0);
    expect(hasBuff(malefic, "swiftcast")).toBe(false);
  });
});
