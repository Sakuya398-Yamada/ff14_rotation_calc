import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { SGE_ATTACK_SKILLS } from "../../data/sge-skills";
import { SGE_BUFFS } from "../../data/sge-buffs";
import { SGE_RESOURCES } from "../../data/sge-resources";
import type {
  CharacterStats,
  MultiTargetWindow,
  PlayerLevel,
  ResolvedTimelineEntry,
  TimelineEntry,
} from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100, stats?: CharacterStats, multiTargetWindows?: MultiTargetWindow[]) {
  const buffs = getBuffsForLevel(SGE_BUFFS, level);
  const resources = getResourcesForLevel(SGE_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(SGE_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(SGE_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (ids: (string | TimelineEntry)[]) =>
    resolveTimeline(
      ids.map((id) => (typeof id === "string" ? entry(id) : id)),
      skillMap,
      resources,
      stats,
      buffs,
      [],
      multiTargetWindows,
    );
  return { skills, resolve };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.some((b) => b.buffId === buffId);
const addersting = (e: ResolvedTimelineEntry) => e.resourceSnapshot["addersting"];
const addersgall = (e: ResolvedTimelineEntry) => e.resourceSnapshot["addersgall"];
const interval = (a: ResolvedTimelineEntry, b: ResolvedTimelineEntry) =>
  Math.round((b.startTime - a.startTime) * 1000) / 1000;

/**
 * 公式ジョブガイド（賢者、Patch 7.5、7.55 表記、PvE 欄）と、特性習得前の値（パッチノート 7.x の変更履歴と consolegameswiki で照合）
 * - 賢学の誓い（Lv54/64）: ドシス 250/300、フレグマ 330/400、E.ドシス 35/40
 * - 攻撃魔法マスタリー（Lv72）: トキシコン 300（Lv72 未満は 240）
 * - アクション威力アップ（Lv94）: ドシスIII・トキシコンII・プネウマ 380、E.ドシスIII 90（Lv94 未満は 330 / 80）
 */
describe("SGE: レベルごとの威力", () => {
  it.each<[PlayerLevel, string, number]>([
    [70, "dosis", 300], [70, "phlegma", 400], [70, "toxikon", 240], [70, "dyskrasia", 160],
    [80, "dosis2", 320], [80, "phlegma2", 490], [80, "toxikon", 300], [80, "dyskrasia", 160],
    [90, "dosis3", 330], [90, "phlegma3", 690], [90, "toxikon2", 330], [90, "dyskrasia2", 170], [90, "pneuma", 330],
    [100, "dosis3", 380], [100, "phlegma3", 690], [100, "toxikon2", 380], [100, "dyskrasia2", 170], [100, "pneuma", 380],
    [100, "psyche", 690],
  ])("Lv%i ではパレットに %s が並び、タイムライン上の威力は %i", (level, skillId, potency) => {
    const { skills, resolve } = setup(level);
    expect(skills.map((s) => s.id)).toContain(skillId);
    const [e] = resolve([skillId]).entries;
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it("エウクラシア系の変化先はパレットに出ず、リゾーマタ（Lv74）・プネウマ（Lv90）・プシュケー（Lv92）は習得レベルまで出ない", () => {
    const at = (level: PlayerLevel) => setup(level).skills.map((s) => s.id);
    for (const level of [70, 80, 90, 100] as const) {
      expect(at(level).filter((id) => id.startsWith("eukrasian-"))).toEqual([]);
      expect(at(level)).toEqual(expect.arrayContaining(["eukrasia", "diagnosis", "druochole", "swiftcast"]));
    }
    expect(at(70)).not.toContain("rhizomata");
    expect(at(80)).toContain("rhizomata");
    expect(at(80)).not.toContain("pneuma");
    expect(at(90)).toContain("pneuma");
    expect(at(90)).not.toContain("psyche");
    expect(at(100)).toContain("psyche");
  });
});

describe("SGE: エウクラシア", () => {
  it.each<[PlayerLevel, string, string, number]>([
    [70, "dosis", "eukrasian-dosis", 40],
    [80, "dosis2", "eukrasian-dosis2", 60],
    [90, "dosis3", "eukrasian-dosis3", 80],
    [100, "dosis3", "eukrasian-dosis3", 90],
    [90, "dyskrasia2", "eukrasian-dyskrasia", 40],
    [100, "dyskrasia2", "eukrasian-dyskrasia", 40],
  ])("Lv%i でエウクラシアの後の %s は %s に変わり、DoT が 30 秒で 10 ティック・ティック威力 %i で入る", (level, sourceId, dotSkillId, dotPotency) => {
    const result = setup(level).resolve(["eukrasia", sourceId]);
    const [, dot] = result.entries;
    expectNoError(dot);
    expect(dot.resolvedSkillId).toBe(dotSkillId);
    const ticks = result.dotTicks.filter((t) => t.skillId === dotSkillId);
    expect(ticks).toHaveLength(10);
    expect(ticks.every((t) => t.potency === dotPotency)).toBe(true);
  });

  it("E.ドシスIII の実行でエウクラシアが外れ、次のドシスIII は詠唱 1.5 秒・威力 380 のドシスIII に戻る", () => {
    const [eukrasia, eDosis, dosis] = setup().resolve(["eukrasia", "dosis3", "dosis3"]).entries;
    expectNoError(eukrasia);
    expect(hasBuff(eukrasia, "eukrasia")).toBe(true);
    expectNoError(eDosis);
    expect(eDosis.resolvedSkillId).toBe("eukrasian-dosis3");
    expect(hasBuff(eDosis, "eukrasia")).toBe(false);
    expectNoError(dosis);
    expect(dosis.resolvedSkillId).toBe("dosis3");
    expect(dosis.castTime).toBe(1.5);
    expect(dosis.resolvedPotency).toBe(380);
  });

  it("Lv80 ではエウクラシア中でもディスクラシアは変化せず、エウクラシアは残る", () => {
    const [, dyskrasia] = setup(80).resolve(["eukrasia", "dyskrasia"]).entries;
    expectNoError(dyskrasia);
    expect(dyskrasia.resolvedSkillId).toBe("dyskrasia");
    expect(dyskrasia.resolvedPotency).toBe(160);
    expect(hasBuff(dyskrasia, "eukrasia")).toBe(true);
  });

  it.each([
    ["dosis3", "eukrasian-dosis3", "dyskrasia2", "eukrasian-dyskrasia"],
    ["dyskrasia2", "eukrasian-dyskrasia", "dosis3", "eukrasian-dosis3"],
  ])("先に %s（%s）、後から %s（%s）を付けると、先の DoT は後の付与で打ち切られる", (firstSource, firstDot, secondSource, secondDot) => {
    const result = setup().resolve(["eukrasia", firstSource, "eukrasia", secondSource]);
    result.entries.forEach(expectNoError);
    const overwrittenAt = result.entries[3].startTime;
    const firstTicks = result.dotTicks.filter((t) => t.skillId === firstDot);
    expect(firstTicks.length).toBeGreaterThan(0);
    expect(firstTicks.length).toBeLessThan(10);
    expect(firstTicks.every((t) => t.time <= overwrittenAt)).toBe(true);
    expect(result.dotTicks.filter((t) => t.skillId === secondDot)).toHaveLength(10);
  });

  it("E.ディスクラシアの DoT は、敵が 3 体いる時間帯でも 1 体分（10 ティック × 40 = 400）で数える", () => {
    const windows: MultiTargetWindow[] = [{ startTime: 0, endTime: 60, targetCount: 3 }];
    const result = setup(100, undefined, windows).resolve(["eukrasia", "dyskrasia2"]);
    const [, eDyskrasia] = result.entries;
    expectNoError(eDyskrasia);
    expect(eDyskrasia.resolvedSkillId).toBe("eukrasian-dyskrasia");
    expect(eDyskrasia.targetCount).toBe(3);
    expect(result.dotTotalPotency).toBe(400);
  });
});

describe("SGE: スピードで縮まない GCD", () => {
  // GCD 2.40（calcGcd(2.5) = 2.40）になるスピード
  const stats: CharacterStats = { critical: 420, directHit: 420, determination: 440, speed: 1280 };

  it("エウクラシアは 1.0 秒、E.ドシスIII は 1.5 秒のまま。続くドシスIII はスピードで 2.40 秒に縮む", () => {
    const e = setup(100, stats).resolve(["eukrasia", "dosis3", "dosis3", "dosis3"]).entries;
    e.forEach(expectNoError);
    expect(e[1].resolvedSkillId).toBe("eukrasian-dosis3");
    expect(interval(e[0], e[1])).toBe(1);
    expect(interval(e[1], e[2])).toBe(1.5);
    expect(interval(e[2], e[3])).toBe(2.4);
  });

  it.each([
    ["dyskrasia2", "eukrasian-dyskrasia"],
    ["diagnosis", "eukrasian-diagnosis"],
  ])("エウクラシアの後の %s（%s）も 1.5 秒のまま", (sourceId, transformedId) => {
    const e = setup(100, stats).resolve(["eukrasia", sourceId, "dosis3"]).entries;
    e.forEach(expectNoError);
    expect(e[1].resolvedSkillId).toBe(transformedId);
    expect(interval(e[1], e[2])).toBe(1.5);
  });
});

describe("SGE: 迅速魔", () => {
  it("迅速魔は詠唱の無いエウクラシア・E.ドシスIII では消費されず、次の詠唱のあるドシスIII で消費される", () => {
    const [, eukrasia, eDosis, dosis] = setup().resolve(["swiftcast", "eukrasia", "dosis3", "dosis3"]).entries;
    expectNoError(eukrasia);
    expect(hasBuff(eukrasia, "swiftcast")).toBe(true);
    expectNoError(eDosis);
    expect(hasBuff(eDosis, "swiftcast")).toBe(true);
    expectNoError(dosis);
    expect(dosis.castTime).toBe(0);
    expect(hasBuff(dosis, "swiftcast")).toBe(false);
  });
});

describe("SGE: フレグマ", () => {
  it("フレグマIII は 2 チャージ。続けて 3 回置くと 3 回目はチャージ切れになる", () => {
    const [first, second, third] = setup().resolve(["phlegma3", "phlegma3", "phlegma3"]).entries;
    expectNoError(first);
    expect(first.resolvedPotency).toBe(690);
    expectNoError(second);
    expect(second.resolvedPotency).toBe(690);
    expect(third.recastError).toBe(true);
  });

  it("1 回目から 40 秒後にはチャージが 1 つ戻り、3 回目もエラーにならない", () => {
    const [, , third] = setup().resolve(["phlegma3", "phlegma3", entry("phlegma3", 40)]).entries;
    expectNoError(third);
    expect(third.resolvedPotency).toBe(690);
  });
});

describe("SGE: アダーステック", () => {
  it("開始時は 3。トキシコンII を使うたびに 1 減り、4 回目はアダーステック不足のエラーになる", () => {
    const e = setup().resolve(["toxikon2", "toxikon2", "toxikon2", "toxikon2"]).entries;
    e.slice(0, 3).forEach(expectNoError);
    expect(e.slice(0, 3).map(addersting)).toEqual([2, 1, 0]);
    expect(e[3].resourceErrors).toEqual([{ resourceId: "addersting", kind: "insufficient" }]);
  });

  it("エウクラシアの後のディアグノシスは E.ディアグノシスに変わり、アダーステックが 1 戻ってエウクラシアが外れる", () => {
    const [toxikon, , eDiagnosis] = setup().resolve(["toxikon2", "eukrasia", "diagnosis"]).entries;
    expect(addersting(toxikon)).toBe(2);
    expectNoError(eDiagnosis);
    expect(eDiagnosis.resolvedSkillId).toBe("eukrasian-diagnosis");
    expect(eDiagnosis.resolvedPotency).toBe(0);
    expect(addersting(eDiagnosis)).toBe(3);
    expect(hasBuff(eDiagnosis, "eukrasia")).toBe(false);
  });

  it("アダーステックが 3 のときに E.ディアグノシスを使っても 3 のままで、エラーにならない", () => {
    const [, eDiagnosis] = setup().resolve(["eukrasia", "diagnosis"]).entries;
    expectNoError(eDiagnosis);
    expect(addersting(eDiagnosis)).toBe(3);
  });

  it("Lv70 のトキシコンもアダーステックを 1 消費する", () => {
    const [toxikon] = setup(70).resolve(["toxikon"]).entries;
    expectNoError(toxikon);
    expect(addersting(toxikon)).toBe(2);
  });
});

describe("SGE: アダーガル", () => {
  it.each(["druochole", "kerachole", "ixochole", "taurochole"])("%s は威力 0 で、アダーガルを 3 → 2 に減らす", (skillId) => {
    const [e] = setup().resolve([skillId]).entries;
    expectNoError(e);
    expect(e.resolvedPotency).toBe(0);
    expect(addersgall(e)).toBe(2);
  });

  it("ドルオコレを 4 回使うと、4 回目はアダーガル不足のエラーになる", () => {
    // ドルオコレはリキャスト 1 秒なので、続けて置くとリキャストエラーになる。間にドシスIII を挟む
    const e = setup().resolve([
      "druochole", "dosis3", "druochole", "dosis3", "druochole", "dosis3", "druochole",
    ]).entries;
    expect([e[0], e[2], e[4]].map(addersgall)).toEqual([2, 1, 0]);
    expect(e[6].recastError).toBeFalsy();
    expect(e[6].resourceErrors).toEqual([{ resourceId: "addersgall", kind: "insufficient" }]);
  });

  it.each([[19, 1], [21, 2]])("最初の消費から %i 秒後に使うと、アダーガルは %i（20 秒ごとに 1 たまる）", (time, after) => {
    const [, second] = setup().resolve(["druochole", entry("druochole", time)]).entries;
    expectNoError(second);
    expect(addersgall(second)).toBe(after);
  });

  it("Lv80 のリゾーマタはアダーガルを 1 増やす", () => {
    const [druochole, rhizomata] = setup(80).resolve(["druochole", "rhizomata"]).entries;
    expect(addersgall(druochole)).toBe(2);
    expectNoError(rhizomata);
    expect(addersgall(rhizomata)).toBe(3);
  });
});
