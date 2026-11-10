import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { DNC_ATTACK_SKILLS } from "../../data/dnc-skills";
import { DNC_BUFFS } from "../../data/dnc-buffs";
import { DNC_RESOURCES } from "../../data/dnc-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string, procOccurred?: boolean): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, ...(procOccurred !== undefined ? { procOccurred } : {}) };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(DNC_BUFFS, level);
  const resources = getResourcesForLevel(DNC_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(DNC_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(DNC_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (ids: (string | TimelineEntry)[]) =>
    resolveTimeline(ids.map((id) => (typeof id === "string" ? entry(id) : id)), skillMap, resources, undefined, buffs).entries;
  return { skills, skillMap, resolve };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const feather = (e: ResolvedTimelineEntry) => e.resourceSnapshot["dnc-feather"];
const esprit = (e: ResolvedTimelineEntry) => e.resourceSnapshot["esprit"];
const buffOf = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.find((b) => b.buffId === buffId);
const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => buffOf(e, buffId) !== undefined;
const last = <T>(xs: T[]) => xs[xs.length - 1];

const STEPS = ["emboite", "entrechat", "jete", "pirouette"];
/** スタンダードステップ → ステップ n 回 → フィニッシュ（スタンダードステップがダンス中に変化する） */
const standard = (steps: number) => ["standard-step", ...STEPS.slice(0, steps), "standard-step"];
const technical = (steps: number) => ["technical-step", ...STEPS.slice(0, steps), "technical-step"];

/**
 * 公式ジョブガイド（踊り子、Patch 7.5 表記、PvE 欄）と、特性修得前の値（consolegameswiki の Notes）
 * - カスケード 220（Lv94 未満 200）、ファウンテン 120 / コンボ 280（Lv94 未満 100 / 260）、リバースカスケード 280（260）、
 *   ファウンテンフォール 340（320）、扇の舞い【序】180（150）、扇の舞い【急】220（200）、扇の舞い【終】460（300）、剣の舞い 540（500）
 * - スタンダードフィニッシュ: ステップ 0 / 1 / 2 回で 360 / 540 / 850（Lv94 未満の 2 回は 800）、与ダメージ 0 / 2 / 5%
 * - テクニカルフィニッシュ: ステップ 0〜4 回で 350 / 540 / 720 / 900 / 1300（Lv94 未満の 4 回は 1200）、与ダメージ 0 / 1 / 2 / 3 / 5%
 * - ティラナ 600（エスプリ +50）、フィニシングムーブ 850、ラストダンス 540、流星の舞い 600（確定クリ・DH）、暁の舞い 1000
 * - エスプリ: 自分のエスプリ効果中、カスケード系 +5、リバースカスケード系 +10（Lv84 未満は +5）
 * - 0 回のフィニッシュは威力だけで、バフ・エスプリ・実行可のバフは付かない（ジョブガイドの「ステップ成功時」と xivintheshell の実装）
 */
describe("DNC: WS コンボと確率で付くバフ", () => {
  it.each<[PlayerLevel, number, number]>([
    [70, 200, 260],
    [90, 200, 260],
    [100, 220, 280],
  ])("Lv%i のカスケード %i → ファウンテン %i（コンボ）", (level, cascade, fountain) => {
    const e = setup(level).resolve(["cascade", "fountain"]);
    e.forEach(expectNoError);
    expect(e.map((x) => x.wsComboError)).toEqual([false, false]);
    expect(e.map((x) => x.resolvedPotency)).toEqual([cascade, fountain]);
  });

  it("カスケードは 50% で対称投擲を付け、リバースカスケードはそれを期待値で撃つ（出なかったときはカスケード）", () => {
    const e = setup().resolve(["cascade", "reverse-cascade"]);
    e.forEach(expectNoError);
    expect(buffOf(e[0], "silken-symmetry")?.procRate).toBe(0.5);
    // 220 + (280 − 220) × 0.5
    expect(e[1].resolvedPotency).toBe(250);
    expect(e[1].consumedProc).toEqual({ buffId: "silken-symmetry", procRate: 0.5, fallbackSkillId: "cascade" });
  });

  it("ファウンテンはコンボのときだけ 50% で非対称投擲を付け、ファウンテンフォールはそれを期待値で撃つ（出なかったときはファウンテン）", () => {
    const combo = setup().resolve(["cascade", "fountain", "fountainfall"]);
    expect(buffOf(combo[1], "silken-flow")?.procRate).toBe(0.5);
    // 280 + (340 − 280) × 0.5
    expect(combo[2].resolvedPotency).toBe(310);
    const noCombo = setup().resolve(["fountain"]);
    expect(noCombo[0].wsComboError).toBe(true);
    expect(hasBuff(noCombo[0], "silken-flow")).toBe(false);
  });

  it("フラリッシュで付く確定の対称投擲・非対称投擲で撃つリバースカスケード系は、期待値にしない", () => {
    const e = setup().resolve(["flourish", "reverse-cascade", "fountainfall"]);
    e.forEach(expectNoError);
    expect(e.slice(1).map((x) => x.resolvedPotency)).toEqual([280, 340]);
    expect(e[1].consumedProc).toBeUndefined();
  });
});

describe("DNC: フェザーと扇の舞い", () => {
  it("リバースカスケードで得るフェザーはレーンでは出た扱いで、扇の舞い【序】はフェザーがあった確率で撃ち、扇の舞い【急】も連なって期待値になる", () => {
    const e = setup().resolve(["cascade", "reverse-cascade", "fan-dance", "fan-dance-iii"]);
    e.forEach(expectNoError);
    expect(feather(e[1])).toBe(1);
    expect(feather(e[2])).toBe(0);
    // フェザーがある確率は 0.5（対称投擲があった）× 0.5（獲得）= 0.25
    expect(e[2].consumedResourceProc?.procRate).toBeCloseTo(0.25);
    expect(e[2].resolvedPotency).toBe(45);
    // 扇の舞い【急】実行可が付いている確率は 0.25（撃てた）× 0.5（付与）
    expect(e[3].consumedProc?.procRate).toBeCloseTo(0.125);
    expect(e[3].resolvedPotency).toBe(27);
  });

  it("発生したと指定すれば確定で数え、扇の舞い【序】は確定で撃つ", () => {
    const e = setup().resolve([entry("cascade", true), entry("reverse-cascade", true), "fan-dance", "fan-dance-iii"]);
    expect(e[2].resolvedPotency).toBe(180);
    expect(e[3].resolvedPotency).toBe(110);
  });

  it("扇の舞い【破】もフェザーを使い、フェザーが無ければ使えない", () => {
    const e = setup().resolve(["flourish", "fountainfall", "fan-dance-ii", "fan-dance-ii"]);
    expect(e[2].resolvedPotency).toBe(50);
    expect(e[3].resourceErrors).toEqual([{ resourceId: "dnc-feather", kind: "insufficient" }]);
  });

  it("フラリッシュの扇の舞い【急】実行可・【終】実行可は確定で、扇の舞い【序】の確率付与が重なっても確定のまま", () => {
    const e = setup().resolve([entry("flourish"), "reverse-cascade", "fan-dance", "fan-dance-iii", "fan-dance-iv"]);
    expect(e[3].resolvedPotency).toBe(220);
    expect(e[4].resolvedPotency).toBe(460);
  });

  it("既知の制限: 対称投擲がまったく無いリバースカスケードは、カスケードを撃つ扱い（フィラー）で、フェザーは得ないが、エスプリは +10 のまま数える", () => {
    const e = setup().resolve([...standard(2), "reverse-cascade"]);
    expectNoError(last(e));
    expect(last(e).resolvedPotency).toBe(220);
    expect(feather(last(e))).toBe(0);
    expect(esprit(last(e))).toBe(10);
  });

  it("既知の制限: 扇の舞い【急】実行可がまったく無い扇の舞い【急】は、エラーにせず威力 0（撃たなかった扱い）", () => {
    const [e] = setup().resolve(["fan-dance-iii"]);
    expectNoError(e);
    expect(e.resolvedPotency).toBe(0);
  });

  it("フェザーは 4 つまで", () => {
    const procs = Array.from({ length: 5 }, () => [entry("cascade", true), entry("reverse-cascade", true)]).flat();
    const e = setup().resolve(procs);
    expect(feather(last(e))).toBe(4);
  });
});

describe("DNC: エスプリ", () => {
  const ESPRIT_SOURCES: [string, string[], number, number][] = [
    ["cascade", [], 5, 5],
    ["fountain", [], 5, 5],
    ["windmill", [], 5, 5],
    ["bladeshower", [], 5, 5],
    ["reverse-cascade", ["flourish"], 5, 10],
    ["fountainfall", ["flourish"], 5, 10],
    ["rising-windmill", ["flourish"], 5, 10],
    ["bloodshower", ["flourish"], 5, 10],
  ];
  it.each(ESPRIT_SOURCES)("エスプリ効果中の %s でエスプリが増える（Lv80 は %i、Lv100 は %i）", (skillId, before, lv80, lv100) => {
    for (const [level, gain] of [[80, lv80], [100, lv100]] as const) {
      const e = setup(level).resolve([...standard(2), ...before, skillId]);
      expectNoError(last(e));
      expect(esprit(last(e))).toBe(gain);
    }
  });

  it("エスプリ効果が無ければ WS でエスプリは増えない（パートナー・パーティメンバーの分も入れない）", () => {
    const e = setup().resolve(["cascade", "fountain"]);
    expect(esprit(last(e))).toBe(0);
  });

  it("ティラナで 50 増え、剣の舞いで 50 使う。足りなければ剣の舞いは使えない", () => {
    const e = setup().resolve([...technical(4), "technical-step", "saber-dance", "saber-dance"]);
    const tillana = e[6];
    expect(tillana.resolvedSkillId).toBe("tillana");
    expectNoError(tillana);
    expect(tillana.resolvedPotency).toBe(600);
    expect(esprit(tillana)).toBe(50);
    // 暁の舞い実行可があるので 1 回目は暁の舞い
    expect(e[7].resolvedSkillId).toBe("dance-of-the-dawn");
    expect(e[7].resolvedPotency).toBe(1000);
    expect(esprit(e[7])).toBe(0);
    expect(e[8].resolvedSkillId).toBe("saber-dance");
    expect(e[8].resourceErrors).toEqual([{ resourceId: "esprit", kind: "insufficient" }]);
  });

  it("暁の舞い実行可が無ければ剣の舞いのまま（Lv90 の剣の舞いは 500）", () => {
    const e = setup(90).resolve([...technical(4), "technical-step", "saber-dance"]);
    expect(last(e).resolvedSkillId).toBe("saber-dance");
    expect(last(e).resolvedPotency).toBe(500);
  });
});

describe("DNC: ステップとフィニッシュ", () => {
  it.each<[number, string, number, string | undefined]>([
    [0, "standard-finish", 360, undefined],
    [1, "single-standard-finish", 540, "standard-finish-1"],
    [2, "double-standard-finish", 850, "standard-finish-2"],
  ])("スタンダードステップのあとステップ %i 回で %s（威力 %i）", (steps, finishId, potency, bonusBuffId) => {
    const e = setup().resolve(standard(steps));
    e.forEach(expectNoError);
    const fin = last(e);
    expect(fin.resolvedSkillId).toBe(finishId);
    expect(fin.resolvedPotency).toBe(potency);
    expect(fin.activeBuffs.map((b) => b.buffId).sort()).toEqual(
      bonusBuffId ? [bonusBuffId, "esprit-standard", "last-dance-ready"].sort() : [],
    );
  });

  it.each<[number, string, number, number | undefined]>([
    [0, "technical-finish", 350, undefined],
    [1, "single-technical-finish", 540, 1.01],
    [2, "double-technical-finish", 720, 1.02],
    [3, "triple-technical-finish", 900, 1.03],
    [4, "quadruple-technical-finish", 1300, 1.05],
  ])("テクニカルステップのあとステップ %i 回で %s（威力 %i）、次の WS の与ダメージは %s 倍", (steps, finishId, potency, multiplier) => {
    const e = setup().resolve([...technical(steps), "cascade"]);
    e.forEach(expectNoError);
    const fin = e[e.length - 2];
    expect(fin.resolvedSkillId).toBe(finishId);
    expect(fin.resolvedPotency).toBe(potency);
    expect(last(e).buffMultiplier).toBeCloseTo(multiplier ?? 1);
    expect(hasBuff(fin, "flourishing-finish")).toBe(multiplier !== undefined);
    expect(hasBuff(fin, "dance-of-the-dawn-ready")).toBe(multiplier !== undefined);
  });

  it("Lv94 未満のダブル・スタンダードフィニッシュは 800、クワッド・テクニカルフィニッシュは 1200", () => {
    expect(last(setup(90).resolve(standard(2))).resolvedPotency).toBe(800);
    expect(last(setup(90).resolve(technical(4))).resolvedPotency).toBe(1200);
  });

  it("ステップはどれを、どの順で置いても 1 回と数え、スタンダードステップ中は 2 回より後のステップを数えない", () => {
    const e = setup().resolve(["standard-step", "pirouette", "pirouette", "jete", "standard-step"]);
    e.forEach(expectNoError);
    expect(e[3].resourceSnapshot["dance-steps"]).toBe(2);
    expect(last(e).resolvedSkillId).toBe("double-standard-finish");
    expect(last(e).resourceSnapshot["dance-steps"]).toBe(0);
  });

  it.each<[number, number]>([
    [0, 1],
    [1, 1.02],
    [2, 1.05],
  ])("スタンダードステップのあとステップ %i 回のフィニッシュで、次の WS の与ダメージは %s 倍", (steps, multiplier) => {
    const e = setup().resolve([...standard(steps), "cascade"]);
    expectNoError(last(e));
    expect(last(e).buffMultiplier).toBeCloseTo(multiplier);
  });

  it("スタンダードフィニッシュとテクニカルフィニッシュの与ダメージ上昇は重なって乗る", () => {
    const e = setup().resolve([...standard(2), ...technical(4), "cascade"]);
    expect(last(e).buffMultiplier).toBeCloseTo(1.05 * 1.05);
  });

  it("ステップは 1.0 秒、スタンダードステップとフィニッシュは 1.5 秒の GCD", () => {
    const e = setup().resolve([...standard(2), "cascade"]);
    e.forEach(expectNoError);
    const gaps = e.slice(1).map((x, i) => Math.round((x.startTime - e[i].startTime) * 1000) / 1000);
    expect(gaps).toEqual([1.5, 1, 1, 1.5]);
  });

  it("ダンスの時間切れでステップの回数は 0 に戻る", () => {
    const e = setup().resolve(["standard-step", "emboite", { uid: "late", skillId: "cascade", manualStartTime: 20 }]);
    expectNoError(last(e));
    expect(last(e).resourceSnapshot["dance-steps"]).toBe(0);
  });

  it("ダンス中はステップとフィニッシュ以外のスキルを使えない", () => {
    const { resolve, skills } = setup();
    const dancers = new Set([...STEPS, "standard-step", "technical-step"]);
    const others = skills.filter((s) => !dancers.has(s.id)).map((s) => s.id);
    expect(others.length).toBeGreaterThan(15);
    for (const skillId of others) {
      const e = resolve(["standard-step", skillId]);
      expect(e[1].comboErrors.map((c) => c.buffId), skillId).toContain("dancing");
    }
    // テクニカルステップのダンス中は、スタンダードステップも使えない
    const crossed = resolve(["technical-step", "standard-step"]);
    expect(crossed[1].comboErrors.map((c) => c.buffId)).toContain("dancing");
  });

  it("ダンス中でなければ、ステップは使えない", () => {
    const [e] = setup().resolve(["emboite"]);
    expect(e.comboErrors.map((c) => c.buffId)).toContain("dancing");
  });
});

describe("DNC: 攻めのタンゴ・フラリッシュと実行可のバフ", () => {
  it("攻めのタンゴはクリティカル率とダイレクトヒット率を 20% 上げ、流星の舞いを使えるようにする", () => {
    const e = setup().resolve(["devilment", "cascade", "starfall-dance"]);
    e.forEach(expectNoError);
    expect(e[1].critRateBonus).toBeCloseTo(0.2);
    expect(e[1].dhRateBonus).toBeCloseTo(0.2);
    expect(e[2].resolvedPotency).toBe(600);
    expect(e[2].critRateBonus).toBe(1);
    expect(e[2].dhRateBonus).toBe(1);
  });

  it("スタンダードフィニッシュのあとはラストダンスを使える（Lv90 では付かない）", () => {
    const e = setup().resolve([...standard(2), "last-dance"]);
    expectNoError(last(e));
    expect(last(e).resolvedPotency).toBe(540);
    expect(hasBuff(last(setup(90).resolve(standard(2))), "last-dance-ready")).toBe(false);
  });

  it("フラリッシュのフィニシングムーブ実行可でスタンダードステップがフィニシングムーブになり、リキャストを共有する", () => {
    const e = setup().resolve(["flourish", "standard-step", "standard-step"]);
    const move = e[1];
    expectNoError(move);
    expect(move.resolvedSkillId).toBe("finishing-move");
    expect(move.resolvedPotency).toBe(850);
    expect(move.activeBuffs.map((b) => b.buffId)).toEqual(
      expect.arrayContaining(["standard-finish-2", "esprit-standard", "last-dance-ready"]),
    );
    expect(e[2].resolvedSkillId).toBe("standard-step");
    expect(e[2].recastError).toBe(true);
  });

  it("Lv96 未満のフラリッシュはフィニシングムーブ実行可を付けない", () => {
    const e = setup(90).resolve(["flourish", "standard-step"]);
    expect(e[1].resolvedSkillId).toBe("standard-step");
  });

  it("フィニッシュは回数ごとのゲームのアクションの ID で書き出せる", () => {
    const { resolve, skillMap } = setup();
    const ids = (steps: number) => skillMap.get(last(resolve(technical(steps))).resolvedSkillId)?.gameActionId;
    expect([0, 1, 2, 3, 4].map(ids)).toEqual([16004, 16193, 16194, 16195, 16196]);
  });
});
