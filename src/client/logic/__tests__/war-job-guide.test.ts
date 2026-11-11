import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { WAR_ATTACK_SKILLS } from "../../data/war-skills";
import { WAR_BUFFS } from "../../data/war-buffs";
import { WAR_RESOURCES } from "../../data/war-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(WAR_BUFFS, level);
  const resources = getResourcesForLevel(WAR_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(WAR_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(WAR_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (ids: (string | TimelineEntry)[]) =>
    resolveTimeline(
      ids.map((id) => (typeof id === "string" ? entry(id) : id)),
      skillMap,
      resources,
      undefined,
      buffs,
    ).entries;
  return { skills, resolve };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const gauge = (e: ResolvedTimelineEntry) => e.resourceSnapshot["beast-gauge"];
const buffOf = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.find((b) => b.buffId === buffId);
const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => buffOf(e, buffId) !== undefined;
const last = <T>(xs: T[]) => xs[xs.length - 1];

/** コンボ 2 周でビーストゲージを 60 にする（ヘヴィスウィング → メイム +10 → シュトルムヴィント +20） */
const GAUGE_60 = ["heavy-swing", "maim", "storms-path", "heavy-swing", "maim", "storms-path"];

/**
 * 公式ジョブガイド（戦士、Patch 7.5 表記、PvE 欄）と、特性修得前の値（consolegameswiki の Notes で照合）
 * - アクション威力アップ（Lv84）: ヘヴィスウィング 200、メイム 150（コンボ 300）、シュトルムヴィント／ブレハ 160（コンボ 440）。
 *   Lv84 未満は 150、100（250）、100（380）
 * - アクション威力アップII（Lv94）: ヘヴィスウィング 240、メイム 190（340）、シュトルムヴィント／ブレハ 220（500）、
 *   フェルクリーヴ 580（Lv94 未満は 520）、アップヒーバル 420（同 400）
 */
describe("WAR: レベルごとの威力", () => {
  it.each<[PlayerLevel, number, number, number]>([
    [70, 150, 250, 380],
    [80, 150, 250, 380],
    [90, 200, 300, 440],
    [100, 240, 340, 500],
  ])("Lv%i のコンボはヘヴィスウィング %i → メイム %i → シュトルムヴィント／シュトルムブレハ %i", (level, heavySwing, maim, finisher) => {
    const { resolve } = setup(level);
    for (const third of ["storms-path", "storms-eye"]) {
      const e = resolve(["heavy-swing", "maim", third]);
      e.forEach(expectNoError);
      expect(e.map((x) => x.wsComboError)).toEqual([false, false, false]);
      expect(e.map((x) => x.resolvedPotency)).toEqual([heavySwing, maim, finisher]);
    }
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "maim", 100], [90, "maim", 150], [100, "maim", 190],
    [70, "storms-eye", 100], [90, "storms-eye", 160], [100, "storms-eye", 220],
  ])("Lv%i でコンボ不成立の %s は %i", (level, skillId, potency) => {
    const [e] = setup(level).resolve([skillId]);
    expect(e.wsComboError).toBe(true);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "fell-cleave", 520], [90, "fell-cleave", 520], [100, "fell-cleave", 580],
    [70, "decimate", 180], [100, "decimate", 180],
  ])("Lv%i の %s は %i", (level, skillId, potency) => {
    const e = last(setup(level).resolve([...GAUGE_60, skillId]));
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "upheaval", 400], [90, "upheaval", 400], [100, "upheaval", 420],
    [90, "orogeny", 150], [70, "onslaught", 150], [70, "tomahawk", 150], [70, "overpower", 110],
  ])("Lv%i の %s は %i", (level, skillId, potency) => {
    const [e] = setup(level).resolve([skillId]);
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it("パレットには上位版だけが並び、変化先は出ない", () => {
    const ids = setup(100).skills.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["fell-cleave", "decimate", "inner-release", "primal-rend", "infuriate", "orogeny"]));
    for (const id of ["inner-beast", "steel-cyclone", "berserk", "inner-chaos", "chaotic-cyclone", "primal-wrath", "primal-ruination"]) {
      expect(ids).not.toContain(id);
    }
    // オロジェネシス（Lv86）・プライマルレンド（Lv90）は Lv80 には無い
    expect(setup(80).skills.map((s) => s.id)).not.toEqual(expect.arrayContaining(["orogeny"]));
    expect(setup(80).skills.map((s) => s.id)).not.toContain("primal-rend");
  });
});

describe("WAR: ビーストゲージ", () => {
  it("コンボ成立でメイム +10・シュトルムヴィント +20・シュトルムブレハ +10、ウォークライで +50 を得る", () => {
    const e = setup(100).resolve(["heavy-swing", "maim", "storms-path", "heavy-swing", "maim", "storms-eye", "infuriate"]);
    e.forEach(expectNoError);
    expect(e.map(gauge)).toEqual([0, 10, 30, 30, 40, 50, 100]);
  });

  it("コンボ不成立のメイムではゲージを得ない", () => {
    const [e] = setup(100).resolve(["maim"]);
    expect(e.wsComboError).toBe(true);
    expect(gauge(e)).toBe(0);
  });

  it.each<[PlayerLevel, number]>([[70, 0], [80, 20]])(
    "Lv%i のミスリルテンペストのコンボで得るゲージは %i（インナービーストマスタリーは Lv74）",
    (level, amount) => {
      const e = setup(level).resolve(["overpower", "mythril-tempest"]);
      e.forEach(expectNoError);
      expect(gauge(e[1])).toBe(amount);
    },
  );

  it("フェルクリーヴはゲージを 50 消費し、50 未満では使えない", () => {
    const { resolve } = setup(70);
    const ok = resolve([...GAUGE_60, "fell-cleave"]);
    expectNoError(last(ok));
    expect(gauge(last(ok))).toBe(10);

    const ng = last(resolve(["heavy-swing", "maim", "storms-path", "fell-cleave"]));
    expect(ng.resourceErrors).toEqual([{ resourceId: "beast-gauge", kind: "insufficient" }]);
  });
});

describe("WAR: 戦嵐", () => {
  it("シュトルムブレハのコンボで付き、次の攻撃の与ダメージが 10% 上がる", () => {
    const e = setup(100).resolve(["heavy-swing", "maim", "storms-eye", "heavy-swing"]);
    e.forEach(expectNoError);
    expect(e[2].buffMultiplier).toBe(1);
    expect(buffOf(e[2], "surging-tempest")?.endTime).toBe(35);
    expect(e[3].buffMultiplier).toBeCloseTo(1.1);
  });

  it("効果中のシュトルムブレハは 30 秒延長し、上限 60 秒で止まる", () => {
    const combo = ["heavy-swing", "maim", "storms-eye"];
    const e = setup(100).resolve([...combo, ...combo, ...combo]);
    e.forEach(expectNoError);
    // 5 秒: 35。12.5 秒: 35 + 30 = 65。20 秒: 65 + 30 = 95 は 20 + 60 = 80 で止まる
    expect([e[2], e[5], e[8]].map((x) => buffOf(x, "surging-tempest")?.endTime)).toEqual([35, 65, 80]);
  });

  it("原初の解放は効果中の戦嵐を 10 秒延長し、戦嵐が無ければ付けない", () => {
    const { resolve } = setup(100);
    const e = resolve(["heavy-swing", "maim", "storms-eye", "inner-release"]);
    e.forEach(expectNoError);
    expect(buffOf(e[3], "surging-tempest")?.endTime).toBe(45);

    const [alone] = resolve(["inner-release"]);
    expectNoError(alone);
    expect(hasBuff(alone, "surging-tempest")).toBe(false);
  });
});

describe("WAR: 原初の解放", () => {
  it("フェルクリーヴをゲージ 0 でも消費なしで使え、必ずクリティカル・ダイレクトヒットになり、1 回ごとに 1 スタック減る", () => {
    const e = setup(100).resolve(["inner-release", "fell-cleave", "fell-cleave", "fell-cleave"]);
    e.forEach(expectNoError);
    expect(e.slice(1).map(gauge)).toEqual([0, 0, 0]);
    expect(e.slice(1).map((x) => [x.guaranteedCrit, x.guaranteedDh])).toEqual([[true, true], [true, true], [true, true]]);
    expect(e.slice(1).map((x) => buffOf(x, "inner-release")?.stacks)).toEqual([2, 1, undefined]);
  });

  it("対象外のウェポンスキル（ヘヴィスウィング）は確定にならず、スタックも減らない", () => {
    const e = setup(100).resolve(["inner-release", "heavy-swing"]);
    e.forEach(expectNoError);
    expect(e[1].critRateBonus).toBe(0);
    expect(e[1].dhRateBonus).toBe(0);
    expect(e[1].guaranteedCrit).toBeUndefined();
    expect(e[1].guaranteedDh).toBeUndefined();
    expect(buffOf(e[1], "inner-release")?.stacks).toBe(3);
  });

  it("Lv96 以降はスタックを使い切ると原初の激震実行可が付き、原初の解放が原初の激震（700）に変化する", () => {
    const e = setup(100).resolve(["inner-release", "fell-cleave", "fell-cleave", "fell-cleave", "inner-release"]);
    e.forEach(expectNoError);
    expect(hasBuff(e[3], "wrathful")).toBe(true);
    expect(e[4].resolvedSkillId).toBe("primal-wrath");
    expect(e[4].resolvedPotency).toBe(700);
    expect(hasBuff(e[4], "wrathful")).toBe(false);
  });

  it("Lv90 ではスタックを使い切っても原初の激震実行可は付かない", () => {
    const e = setup(90).resolve(["inner-release", "fell-cleave", "fell-cleave", "fell-cleave"]);
    e.forEach(expectNoError);
    expect(hasBuff(e[3], "wrathful")).toBe(false);
  });

  it("近似: 解放が使い残しで切れると、次の解放でも 3 回目のフェルクリーヴまで原初の激震実行可が付かない", () => {
    // 実機では 1 回目の解放の 2 スタック分の原初の鼓動が残り、2 回目の解放の 1 回目のフェルクリーヴで実行可になる
    const e = setup(100).resolve([
      "inner-release", "fell-cleave", "fell-cleave",
      entry("inner-release", 60), "fell-cleave", "fell-cleave", "fell-cleave",
    ]);
    e.forEach(expectNoError);
    expect(hasBuff(e[2], "inner-release")).toBe(true);
    expect(hasBuff(e[4], "wrathful")).toBe(false);
    expect(hasBuff(e[5], "wrathful")).toBe(false);
    expect(hasBuff(e[6], "wrathful")).toBe(true);
  });
});

describe("WAR: ウォークライと原初の混沌", () => {
  it("Lv80 以降は、原初の混沌中かつゲージ 50 以上のフェルクリーヴがインナーカオス（700・確定）に変わり、ゲージ 50 と原初の混沌を消費する", () => {
    const e = setup(100).resolve(["infuriate", "fell-cleave"]);
    e.forEach(expectNoError);
    expect(hasBuff(e[0], "nascent-chaos")).toBe(true);
    expect(e[1].resolvedSkillId).toBe("inner-chaos");
    expect(e[1].resolvedPotency).toBe(700);
    expect([e[1].guaranteedCrit, e[1].guaranteedDh]).toEqual([true, true]);
    expect(gauge(e[1])).toBe(0);
    expect(hasBuff(e[1], "nascent-chaos")).toBe(false);
  });

  it("原初の解放中のインナーカオスはゲージを消費し、解放のスタックは減らさない", () => {
    const e = setup(100).resolve(["inner-release", "infuriate", "fell-cleave"]);
    e.forEach(expectNoError);
    expect(e[2].resolvedSkillId).toBe("inner-chaos");
    expect(gauge(e[2])).toBe(0);
    expect(buffOf(e[2], "inner-release")?.stacks).toBe(3);
  });

  it("デシメートはカオティックサイクロン（200・確定）に変わる", () => {
    const e = setup(80).resolve(["infuriate", "decimate"]);
    e.forEach(expectNoError);
    expect(e[1].resolvedSkillId).toBe("chaotic-cyclone");
    expect(e[1].resolvedPotency).toBe(200);
    expect(e[1].guaranteedCrit).toBe(true);
  });

  it("Lv70 では原初の混沌が付かず、フェルクリーヴのまま", () => {
    const e = setup(70).resolve(["infuriate", "fell-cleave"]);
    e.forEach(expectNoError);
    expect(hasBuff(e[0], "nascent-chaos")).toBe(false);
    expect(e[1].resolvedSkillId).toBe("fell-cleave");
  });

  it("フェルクリーヴ 2 回でウォークライのリキャストが 10 秒縮む", () => {
    const { resolve } = setup(70);
    // 0 秒と 0.65 秒にウォークライを使い切ると、次のチャージは 60 秒。フェルクリーヴ 2 回で 50 秒になる
    const reduced = resolve(["infuriate", "infuriate", "fell-cleave", "fell-cleave", entry("infuriate", 51)]);
    reduced.forEach(expectNoError);

    const control = resolve(["infuriate", "infuriate", "heavy-swing", "heavy-swing", entry("infuriate", 51)]);
    expect(control[4].recastError).toBe(true);
  });

  it("フェルクリーヴ 2 回で縮めると、最初のウォークライのリキャストのレーンの区間は 50 秒で終わる (#898)", () => {
    const { resolve } = setup(70);
    const reduced = resolve(["infuriate", "infuriate", "fell-cleave", "fell-cleave", entry("infuriate", 51)]);
    reduced.forEach(expectNoError);
    expect(reduced[0].cooldownEndTime).toBe(50);

    const control = resolve(["infuriate", "infuriate", "heavy-swing", "heavy-swing"]);
    expect(control[0].cooldownEndTime).toBe(60);
  });

  it("インナーカオスもウォークライのリキャストを 5 秒縮める", () => {
    const { resolve } = setup(100);
    // ゲージ 100 からインナーカオス（-50）→ フェルクリーヴ（-50）で、次のチャージは 60 秒から 50 秒になる
    const e = resolve(["infuriate", "infuriate", "fell-cleave", "fell-cleave", entry("infuriate", 51)]);
    e.forEach(expectNoError);
    expect(e.slice(2, 4).map((x) => x.resolvedSkillId)).toEqual(["inner-chaos", "fell-cleave"]);
  });
});

describe("WAR: プライマルレンド", () => {
  it("原初の解放で付くプライマルレンド実行可が無いと使えない", () => {
    const [e] = setup(100).resolve(["primal-rend"]);
    expect(e.comboErrors.map((x) => x.buffId)).toContain("primal-rend-ready");
  });

  it("原初の解放のあとに使え（720・確定）、Lv100 ではルイネーター（800・確定）に変わる", () => {
    const e = setup(100).resolve(["inner-release", "primal-rend", "primal-rend"]);
    e.forEach(expectNoError);
    expect(e[1].resolvedPotency).toBe(720);
    expect([e[1].guaranteedCrit, e[1].guaranteedDh]).toEqual([true, true]);
    expect(buffOf(e[1], "inner-release")?.stacks).toBe(3);
    expect(e[2].resolvedSkillId).toBe("primal-ruination");
    expect(e[2].resolvedPotency).toBe(800);
    expect([e[2].guaranteedCrit, e[2].guaranteedDh]).toEqual([true, true]);
  });

  it("Lv90 ではルイネーター実行可が付かず、2 回目のプライマルレンドは使えない", () => {
    const e = setup(90).resolve(["inner-release", "primal-rend", "primal-rend"]);
    expectNoError(e[1]);
    expect(e[2].resolvedSkillId).toBe("primal-rend");
    expect(e[2].comboErrors.map((x) => x.buffId)).toContain("primal-rend-ready");
  });
});

describe("WAR: チャージと共有リキャスト", () => {
  it.each<[PlayerLevel, boolean]>([[80, true], [90, false]])(
    "Lv%i で 3 回続けたオンスロートの 3 回目がリキャストエラーか: %s（Lv88 で 3 チャージ）",
    (level, error) => {
      const e = setup(level).resolve(["onslaught", "onslaught", "onslaught"]);
      expect(e[2].recastError).toBe(error);
    },
  );

  it("アップヒーバルとオロジェネシスはリキャストを共有する", () => {
    const e = setup(100).resolve(["upheaval", "orogeny"]);
    expectNoError(e[0]);
    expect(e[1].recastError).toBe(true);
  });
});
