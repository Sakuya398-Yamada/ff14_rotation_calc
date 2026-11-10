import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { calcDelayedHitBreakdown } from "../expected-potency";
import { DEFAULT_STATS, calcDetMultiplier } from "../stat-calc";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { MCH_ATTACK_SKILLS } from "../../data/mch-skills";
import { MCH_BUFFS, MCH_OVERHEATED_POTENCY_TARGET_IDS, MCH_REASSEMBLE_TARGET_IDS } from "../../data/mch-buffs";
import { MCH_RESOURCES } from "../../data/mch-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(MCH_BUFFS, level);
  const resources = getResourcesForLevel(MCH_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(MCH_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(MCH_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
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

const heat = (e: ResolvedTimelineEntry) => e.resourceSnapshot["heat"];
const battery = (e: ResolvedTimelineEntry) => e.resourceSnapshot["battery"];
const buffOf = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.find((b) => b.buffId === buffId);
const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => buffOf(e, buffId) !== undefined;
const last = <T>(xs: T[]) => xs[xs.length - 1];

const COMBO = ["heated-split-shot", "heated-slug-shot", "heated-clean-shot"];
const combos = (n: number) => Array.from({ length: n }, () => COMBO).flat();

/**
 * 公式ジョブガイド（機工士、Patch 7.5・7.55 表記、PvE 欄）と、特性修得前の値（パッチノートの「修得時の威力」・consolegameswiki の Notes）
 * - ヒートスプリットショット 180（Lv84 200、Lv94 220）、ヒートスラッグショット 100 / コンボ 280（Lv84 120 / 300、Lv94 140 / 320）、
 *   ヒートクリーンショット 100 / コンボ 360（Lv84 120 / 380、Lv94 160 / 420）
 * - ドリル・エアアンカー・回転のこぎり 620（Lv94 660）、エクスカベーター 660、フルメタルバースト 900（確定クリ・DH）
 * - ブレイズショット 220（Lv94 240）、オートボウガン 140（Lv94 180）。オーバーヒート中の単体 WS は威力 +20
 * - ワイルドファイア: WS 1 回ごとに 100（Lv78 240）、6 回まで
 * - クイーン: アームパンチ 120〜240、ローラーダッシュ 240〜480、パイルバンカー 340〜680、クイーン・コレダー 390〜780（バッテリー 50〜100）
 */
describe("MCH: レベルごとの威力", () => {
  it.each<[PlayerLevel, number, number, number]>([
    [70, 180, 280, 360],
    [80, 180, 280, 360],
    [90, 200, 300, 380],
    [100, 220, 320, 420],
  ])("Lv%i のコンボはヒートスプリットショット %i → ヒートスラッグショット %i → ヒートクリーンショット %i", (level, split, slug, clean) => {
    const e = setup(level).resolve(COMBO);
    e.forEach(expectNoError);
    expect(e.map((x) => x.wsComboError)).toEqual([false, false, false]);
    expect(e.map((x) => x.resolvedPotency)).toEqual([split, slug, clean]);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "hot-shot", 240],
    [80, "air-anchor", 620],
    [90, "drill", 620],
    [90, "chain-saw", 620],
    [100, "air-anchor", 660],
    [100, "drill", 660],
    [100, "chain-saw", 660],
  ])("Lv%i の %s は %i", (level, skillId, potency) => {
    const [e] = setup(level).resolve([skillId]);
    expectNoError(e);
    expect(e.resolvedSkillId).toBe(skillId);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, number]>([
    [70, 2],
    [80, 3],
  ])("Lv%i のガウスラウンドは %i チャージ", (level, charges) => {
    const e = setup(level).resolve(Array.from({ length: charges + 1 }, () => "gauss-round"));
    e.slice(0, charges).forEach(expectNoError);
    expect(last(e).recastError).toBe(true);
  });
});

describe("MCH: ヒートとハイパーチャージ", () => {
  it("コンボでヒートが 5 ずつ溜まり、ハイパーチャージで 50 使ってオーバーヒートが 5 スタック付く", () => {
    const e = setup(100).resolve([...combos(4), "heated-split-shot", "hypercharge"]);
    e.forEach(expectNoError);
    expect(heat(e[2])).toBe(15);
    expect(heat(e[12])).toBe(65);
    expect(heat(e[13])).toBe(15);
    expect(buffOf(e[13], "overheated")?.stacks).toBe(5);
  });

  it("ヒートが 50 未満ならハイパーチャージは使えない", () => {
    const [e] = setup(100).resolve(["hypercharge"]);
    expect(e.resourceErrors.map((x) => x.resourceId)).toContain("heat");
    expect(hasBuff(e, "overheated")).toBe(false);
  });

  it("バレルヒーターのハイパーチャージ実行可があれば、ヒートを使わずにハイパーチャージでき、実行可は消える", () => {
    const e = setup(100).resolve(["barrel-stabilizer", "hypercharge"]);
    e.forEach(expectNoError);
    expect(heat(e[1])).toBe(0);
    expect(hasBuff(e[0], "hypercharged")).toBe(true);
    expect(hasBuff(e[1], "hypercharged")).toBe(false);
    expect(buffOf(e[1], "overheated")?.stacks).toBe(5);
  });

  it("ブレイズショットはオーバーヒートが無いと使えず、1.5 秒おきに 5 回撃つと 6 回目は使えない", () => {
    const [alone] = setup(100).resolve(["blazing-shot"]);
    expect(alone.comboErrors.map((x) => x.buffId)).toContain("overheated");

    const e = setup(100).resolve(["barrel-stabilizer", "hypercharge", ...Array.from({ length: 6 }, () => "blazing-shot")]);
    const shots = e.slice(2);
    shots.slice(0, 5).forEach(expectNoError);
    expect(shots.slice(1, 5).map((x, i) => Math.round((x.startTime - shots[i].startTime) * 1000) / 1000)).toEqual([1.5, 1.5, 1.5, 1.5]);
    // オーバーヒートの +20 が乗る
    expect(shots.slice(0, 5).map((x) => x.resolvedPotency)).toEqual([260, 260, 260, 260, 260]);
    expect(shots.slice(0, 5).map((x) => buffOf(x, "overheated")?.stacks ?? 0)).toEqual([4, 3, 2, 1, 0]);
    expect(shots[5].comboErrors.map((x) => x.buffId)).toContain("overheated");
  });

  it("オーバーヒート中は単体の WS（ドリル）に +20 が乗ってスタックを使い、範囲の WS（回転のこぎり）には乗らずスタックも使わない", () => {
    const e = setup(100).resolve(["barrel-stabilizer", "hypercharge", "chain-saw", "drill"]);
    e.forEach(expectNoError);
    expect(e[2].resolvedPotency).toBe(660);
    expect(buffOf(e[2], "overheated")?.stacks).toBe(5);
    expect(e[3].resolvedPotency).toBe(680);
    expect(buffOf(e[3], "overheated")?.stacks).toBe(4);
  });

  it("オートボウガンはオーバーヒートのスタックを使うが、+20 は乗らない（範囲の WS）", () => {
    const e = setup(100).resolve(["barrel-stabilizer", "hypercharge", "auto-crossbow"]);
    e.forEach(expectNoError);
    expect(e[2].resolvedPotency).toBe(180);
    expect(buffOf(e[2], "overheated")?.stacks).toBe(4);
  });

  // 系統横断: 単体の WS はすべて +20 の対象で、範囲の WS は対象にしない
  it("+20 の対象は、機工士の GCD のうち範囲を持たないものと一致する", () => {
    const singleTargetGcds = MCH_ATTACK_SKILLS.filter((s) => s.type === "gcd" && s.maxTargets === undefined).map((s) => s.id);
    expect(new Set(MCH_OVERHEATED_POTENCY_TARGET_IDS)).toEqual(new Set(singleTargetGcds));
  });
});

describe("MCH: ブレイズショットのリキャスト短縮", () => {
  it.each<[PlayerLevel, string, string]>([
    [100, "double-check", "checkmate"],
    [90, "gauss-round", "ricochet"],
  ])("Lv%i: ブレイズショット 2 回で %s・%s のリキャストが 30 秒縮み、使い切った 4 回目を使える", (level, a, b) => {
    const { resolve } = setup(level);
    const uses = [a, a, a, b, b, b];
    const two = resolve([...uses, "barrel-stabilizer", "hypercharge", "blazing-shot", "blazing-shot", a, b]);
    two.forEach(expectNoError);

    // 1 回だけなら 15 秒しか縮まず、まだ使えない
    const one = resolve([...uses, "barrel-stabilizer", "hypercharge", "blazing-shot", a, b]);
    expect(last(one).startTime).toBeLessThan(15);
    expect(one[one.length - 2].recastError).toBe(true);
    expect(last(one).recastError).toBe(true);
  });
});

describe("MCH: 整備", () => {
  it("次の WS が確定クリティカル・ダイレクトヒットになり、整備は消える", () => {
    const e = setup(100).resolve(["reassemble", "drill", "air-anchor"]);
    e.forEach(expectNoError);
    expect([e[1].critRateBonus, e[1].dhRateBonus]).toEqual([1, 1]);
    expect(hasBuff(e[1], "reassembled")).toBe(false);
    expect([e[2].critRateBonus, e[2].dhRateBonus]).toEqual([0, 0]);
  });

  it("フルメタルバーストは自分で確定クリ・DH になり、整備を使わない（次の WS に残る）", () => {
    const e = setup(100).resolve(["barrel-stabilizer", "reassemble", "full-metal-field", "drill"]);
    e.forEach(expectNoError);
    expect(e[2].resolvedPotency).toBe(900);
    expect([e[2].critRateBonus, e[2].dhRateBonus]).toEqual([1, 1]);
    expect(hasBuff(e[2], "reassembled")).toBe(true);
    expect([e[3].critRateBonus, e[3].dhRateBonus]).toEqual([1, 1]);
  });

  it("Lv80 は 1 チャージ、Lv84 から 2 チャージ", () => {
    const lv80 = setup(80).resolve(["reassemble", "reassemble"]);
    expect(lv80[1].recastError).toBe(true);
    setup(90).resolve(["reassemble", "reassemble"]).forEach(expectNoError);
  });

  // 系統横断: フルメタルバースト以外の WS はすべて整備の対象
  it("整備の対象は、機工士の GCD のうちフルメタルバースト以外のすべて", () => {
    const gcds = MCH_ATTACK_SKILLS.filter((s) => s.type === "gcd" && s.id !== "full-metal-field").map((s) => s.id);
    expect(new Set(MCH_REASSEMBLE_TARGET_IDS)).toEqual(new Set(gcds));
  });
});

describe("MCH: 回転のこぎり → エクスカベーター、バレルヒーター → フルメタルバースト", () => {
  it("Lv100: 回転のこぎりでエクスカベーター実行可が付き、次の回転のこぎりがエクスカベーターに変わる", () => {
    const e = setup(100).resolve(["chain-saw", "chain-saw"]);
    e.forEach(expectNoError);
    expect(hasBuff(e[0], "excavator-ready")).toBe(true);
    expect(e[1].resolvedSkillId).toBe("excavator");
    expect(e[1].resolvedPotency).toBe(660);
    expect(hasBuff(e[1], "excavator-ready")).toBe(false);
    expect(battery(e[1])).toBe(40);
  });

  it("Lv90 ではエクスカベーター実行可が付かない", () => {
    const e = setup(90).resolve(["chain-saw", "chain-saw"]);
    expect(hasBuff(e[0], "excavator-ready")).toBe(false);
    expect(e[1].resolvedSkillId).toBe("chain-saw");
    expect(e[1].recastError).toBe(true);
  });

  it("Lv100: バレルヒーターのフルメタルバースト実行可が無いとフルメタルバーストは使えない", () => {
    const [alone] = setup(100).resolve(["full-metal-field"]);
    expect(alone.comboErrors.map((x) => x.buffId)).toContain("full-metal-machinist");
    const e = setup(100).resolve(["barrel-stabilizer", "full-metal-field", "full-metal-field"]);
    e.slice(0, 2).forEach(expectNoError);
    expect(e[2].comboErrors.map((x) => x.buffId)).toContain("full-metal-machinist");
  });

  it("Lv90 ではバレルヒーターでフルメタルバースト実行可が付かない", () => {
    const [e] = setup(90).resolve(["barrel-stabilizer"]);
    expect(hasBuff(e, "hypercharged")).toBe(true);
    expect(hasBuff(e, "full-metal-machinist")).toBe(false);
  });
});

describe("MCH: バッテリーとオートマトン・クイーン", () => {
  /** バッテリー 100: エアアンカー・回転のこぎり・エクスカベーター（各 +20）とコンボ 4 回（各 +10） */
  const BATTERY_100 = ["air-anchor", "chain-saw", "chain-saw", ...combos(4)];
  /** バッテリー 60: エアアンカー（+20）とコンボ 4 回 */
  const BATTERY_60 = ["air-anchor", ...combos(4)];
  const QUEEN_DELAYS = [5.6, 8.6, 10.1, 11.6, 13.6, 16.1];

  it.each<[string, string[], number, number[]]>([
    ["100", BATTERY_100, 100, [480, 240, 240, 240, 680, 780]],
    ["60", BATTERY_60, 60, [288, 144, 144, 144, 408, 468]],
  ])("Lv100・バッテリー %s: クイーンはバッテリーを全部使い、各攻撃は消費したバッテリーに応じた威力で決まった時刻に入る", (_label, prep, amount, potencies) => {
    const e = setup(100).resolve([...prep, "automaton-queen"]);
    e.forEach(expectNoError);
    const queen = last(e);
    expect(battery(e[e.length - 2])).toBe(amount);
    expect(battery(queen)).toBe(0);
    expect(queen.resolvedPotency).toBe(0);
    expect(queen.delayedHits?.map((h) => Math.round((h.time - queen.startTime) * 1000) / 1000)).toEqual(QUEEN_DELAYS);
    expect(queen.delayedHits?.map((h) => h.potency)).toEqual(potencies);
  });

  it("バッテリーは HCS のコンボ（+10）とエアアンカー・回転のこぎり・エクスカベーター（各 +20）で溜まる", () => {
    const e = setup(100).resolve(BATTERY_100);
    expect([battery(e[0]), battery(e[1]), battery(e[2]), battery(e[5])]).toEqual([20, 40, 60, 70]);
  });

  it("バッテリーが 50 未満ならクイーンは使えず、攻撃も入らない", () => {
    const e = setup(100).resolve(["air-anchor", "automaton-queen"]);
    const queen = last(e);
    expect(queen.resourceErrors.map((x) => x.resourceId)).toContain("battery");
    expect(queen.delayedHits).toBeUndefined();
    expect(battery(queen)).toBe(20);
  });

  it("既知の制限: クイーンが動いている間でも、バッテリーが 50 あれば再召喚でき、両方の攻撃が入る（リキャスト 6 秒のまま）", () => {
    const e = setup(100).resolve([...combos(5), "automaton-queen", "air-anchor", "chain-saw", "chain-saw", "automaton-queen"]);
    e.forEach(expectNoError);
    const first = e[15];
    const second = last(e);
    expect(second.startTime).toBeLessThan(first.delayedHits![first.delayedHits!.length - 1].time);
    expect(battery(e[e.length - 2])).toBe(60);
    expect(second.delayedHits).toHaveLength(6);
  });

  it("Lv80: クイーン・コレダーは入らない（Lv86 から）", () => {
    const e = setup(80).resolve([...combos(5), "automaton-queen"]);
    e.forEach(expectNoError);
    expect(last(e).delayedHits?.map((h) => h.potency)).toEqual([240, 120, 120, 120, 340]);
  });

  it.each<[string, number, number[]]>([
    ["50", 3, [35, 35, 35, 35, 160]],
    ["100", 8, [70, 70, 70, 70, 320]],
  ])("Lv70・バッテリー %s: オートタレット・ルークはボレーファイア 4 回とオーバーロード・ルークを 2・4・6・8・9 秒後に撃つ", (_label, n, potencies) => {
    const e = setup(70).resolve(["hot-shot", ...combos(n), "rook-autoturret"]);
    e.forEach(expectNoError);
    const rook = last(e);
    expect(rook.resolvedSkillId).toBe("rook-autoturret");
    expect(rook.delayedHits?.map((h) => Math.round((h.time - rook.startTime) * 1000) / 1000)).toEqual([2, 4, 6, 8, 9]);
    expect(rook.delayedHits?.map((h) => h.potency)).toEqual(potencies);
  });
});

describe("MCH: ワイルドファイア", () => {
  it("Lv100: 効果中（10 秒）に当てた WS の回数 × 240 が、使用の 10 秒後に入る", () => {
    // ワイルドファイアは 0s、WS は 0.65・3.15・5.65・8.15s（4 回）。10.65s の WS は効果の後
    const e = setup(100).resolve(["wildfire", ...combos(1), "heated-split-shot", "heated-slug-shot"]);
    e.forEach(expectNoError);
    const [hit] = e[0].delayedHits!;
    expect(e[5].startTime).toBe(10.65);
    expect(hit.time).toBe(10);
    expect(hit.potency).toBe(960);
    expect(hasBuff(e[0], "wildfire")).toBe(true);
  });

  it("ハイパーチャージ中に使うと、効果中に 6 回（上限）当たって 1440", () => {
    // ハイパーチャージ・ワイルドファイアのあと、ブレイズショット 5 回（1.5 秒おき）とドリル。エアアンカーは効果の後。
    // 実際の回しでは 10 秒に 7 回は入らないので、上限で止まることはエンジンのテスト（delayed-hits.test.ts）で確かめる
    const e = setup(100).resolve([
      "barrel-stabilizer",
      "hypercharge",
      "wildfire",
      ...Array.from({ length: 5 }, () => "blazing-shot"),
      "drill",
      "air-anchor",
    ]);
    e.forEach(expectNoError);
    const wildfire = e[2];
    const landed = e.slice(3).filter((x) => x.startTime < wildfire.startTime + 10);
    expect(landed.length).toBe(6);
    expect(wildfire.delayedHits?.map((h) => h.potency)).toEqual([1440]);
  });

  it("Lv70 は 1 回ごとに 100", () => {
    const e = setup(70).resolve(["wildfire", ...combos(1), "heated-split-shot"]);
    e.forEach(expectNoError);
    expect(e[0].delayedHits?.map((h) => h.potency)).toEqual([400]);
  });

  it("クリ/DH は乗らず（整備も使わない）、期待値は DET の倍率だけ", () => {
    const { resolve, skillMap } = setup(100);
    const e = resolve(["reassemble", "wildfire", "drill"]);
    e.forEach(expectNoError);
    const [hit] = e[1].delayedHits!;
    expect(hit.noCritDh).toBe(true);
    expect([hit.critRateBonus, hit.dhRateBonus]).toEqual([0, 0]);
    // 整備はドリルが使う
    expect([e[2].critRateBonus, e[2].dhRateBonus]).toEqual([1, 1]);
    expect(calcDelayedHitBreakdown(hit, skillMap.get("wildfire"), DEFAULT_STATS).total).toBe(
      Math.floor(240 * calcDetMultiplier(DEFAULT_STATS)),
    );
  });
});
