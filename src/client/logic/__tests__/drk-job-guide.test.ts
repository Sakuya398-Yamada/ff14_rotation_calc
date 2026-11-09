import { describe, it, expect } from "vitest";
import { calcPps, resolveTimeline } from "../resolve-timeline";
import { calcDelayedHitBreakdown } from "../expected-potency";
import { DEFAULT_STATS } from "../stat-calc";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { DRK_ATTACK_SKILLS } from "../../data/drk-skills";
import { DRK_BUFFS } from "../../data/drk-buffs";
import { DRK_RESOURCES } from "../../data/drk-resources";
import type { MultiTargetWindow, PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(DRK_BUFFS, level);
  const resources = getResourcesForLevel(DRK_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(DRK_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(DRK_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolveFull = (ids: (string | TimelineEntry)[], multiTargetWindows?: MultiTargetWindow[]) =>
    resolveTimeline(
      ids.map((id) => (typeof id === "string" ? entry(id) : id)),
      skillMap,
      resources,
      undefined,
      buffs,
      undefined,
      multiTargetWindows,
    );
  const resolve = (ids: (string | TimelineEntry)[]) => resolveFull(ids).entries;
  return { skills, skillMap, resolve, resolveFull };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const mp = (e: ResolvedTimelineEntry) => e.resourceSnapshot["mp"];
const blood = (e: ResolvedTimelineEntry) => e.resourceSnapshot["blackblood"];
const buffOf = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.find((b) => b.buffId === buffId);
const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => buffOf(e, buffId) !== undefined;
const last = <T>(xs: T[]) => xs[xs.length - 1];

const COMBO = ["hard-slash", "syphon-strike", "souleater"];
/** コンボ 3 周でブラックブラッドを 60 にする（ソウルイーターのコンボ成立で +20） */
const BLOOD_60 = [...COMBO, ...COMBO, ...COMBO];

/**
 * 公式ジョブガイド（暗黒騎士、Patch 7.5 表記、PvE 欄）と、特性修得前の値（中国版クライアントのレベル条件付きの説明文・consolegameswiki の Notes で照合）
 * - アクション威力アップ（Lv84）: ハードスラッシュ 180、サイフォンストライク 120（コンボ 260）、ソウルイーター 140（コンボ 360）。
 *   Lv84 未満は 150、100（240）、100（320）
 * - アクション威力アップII（Lv94）: ハードスラッシュ 300、サイフォンストライク 240（380）、ソウルイーター 260（480）、ストルワートソウル 120（160）、
 *   ブラッドスピラー 600、クワイタス 240、カーヴ・アンド・スピット 540。Lv94 未満は ストルワートソウル 100（140）、ブラッドスピラー 500、
 *   クワイタス 200、カーヴ・アンド・スピット 510
 */
describe("DRK: レベルごとの威力", () => {
  it.each<[PlayerLevel, number, number, number]>([
    [70, 150, 240, 320],
    [80, 150, 240, 320],
    [90, 180, 260, 360],
    [100, 300, 380, 480],
  ])("Lv%i のコンボはハードスラッシュ %i → サイフォンストライク %i → ソウルイーター %i", (level, hardSlash, syphon, souleater) => {
    const e = setup(level).resolve(COMBO);
    e.forEach(expectNoError);
    expect(e.map((x) => x.wsComboError)).toEqual([false, false, false]);
    expect(e.map((x) => x.resolvedPotency)).toEqual([hardSlash, syphon, souleater]);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "syphon-strike", 100], [90, "syphon-strike", 120], [100, "syphon-strike", 240],
    [70, "souleater", 100], [90, "souleater", 140], [100, "souleater", 260],
    [90, "stalwart-soul", 100], [100, "stalwart-soul", 120],
  ])("Lv%i でコンボ不成立の %s は %i", (level, skillId, potency) => {
    const [e] = setup(level).resolve([skillId]);
    expect(e.wsComboError).toBe(true);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, number]>([[90, 140], [100, 160]])("Lv%i のアンリーシュ → ストルワートソウルは %i", (level, potency) => {
    const e = setup(level).resolve(["unleash", "stalwart-soul"]);
    e.forEach(expectNoError);
    expect(e.map((x) => x.resolvedPotency)).toEqual([120, potency]);
  });

  it.each<[PlayerLevel, string, number]>([
    [90, "bloodspiller", 500], [100, "bloodspiller", 600],
    [90, "quietus", 200], [100, "quietus", 240],
  ])("Lv%i の %s は %i", (level, skillId, potency) => {
    const e = last(setup(level).resolve([...BLOOD_60, skillId]));
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "carve-and-spit", 510], [90, "carve-and-spit", 510], [100, "carve-and-spit", 540],
    [70, "edge-of-darkness", 300], [70, "flood-of-darkness", 100],
    [80, "edge-of-shadow", 460], [100, "flood-of-shadow", 160],
    [100, "abyssal-drain", 240], [100, "salted-earth", 50], [100, "unmend", 150], [100, "unleash", 120],
  ])("Lv%i の %s は %i", (level, skillId, potency) => {
    const [e] = setup(level).resolve([skillId]);
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it("パレットには上位版だけが並び、変化先は出ない", () => {
    const ids = setup(100).skills.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([
      "edge-of-shadow", "flood-of-shadow", "living-shadow", "disesteem", "shadowbringer", "salt-and-darkness", "delirium",
    ]));
    for (const id of ["edge-of-darkness", "flood-of-darkness", "scarlet-delirium", "comeuppance", "torcleaver", "impalement"]) {
      expect(ids).not.toContain(id);
    }
    // 漆黒の剣（Lv74）・影身具現（Lv80）・シャドウブリンガー（Lv90）・ディセスティーム（Lv100）
    const lv70 = setup(70).skills.map((s) => s.id);
    expect(lv70).toEqual(expect.arrayContaining(["edge-of-darkness", "flood-of-darkness"]));
    for (const id of ["edge-of-shadow", "living-shadow", "shadowbringer", "salt-and-darkness"]) {
      expect(lv70).not.toContain(id);
    }
    expect(setup(90).skills.map((s) => s.id)).not.toContain("disesteem");
  });
});

describe("DRK: MP と暗黒", () => {
  it("漆黒の剣は MP を 3000 消費して暗黒（30 秒）を付け、次の攻撃の与ダメージが 10% 上がる（剣自身には乗らない）", () => {
    const e = setup(100).resolve(["edge-of-shadow", "hard-slash"]);
    e.forEach(expectNoError);
    expect(mp(e[0])).toBe(7000);
    expect(e[0].buffMultiplier).toBe(1);
    expect(buffOf(e[0], "darkside")?.endTime).toBe(30);
    expect(e[1].buffMultiplier).toBeCloseTo(1.1);
  });

  it("効果中の漆黒の剣・漆黒の波動は暗黒を 30 秒延長し、付与時刻から 60 秒で止まる。MP が 3000 未満だと使えない", () => {
    // 剣と波動は 1 秒のリキャストを共有し、自動配置はリキャストの明けを待たないので、1 秒おきに手で置く
    const e = setup(100).resolve([
      "edge-of-shadow", entry("flood-of-shadow", 1), entry("edge-of-shadow", 2), entry("flood-of-shadow", 3),
    ]);
    e.slice(0, 3).forEach(expectNoError);
    expect(e[3].recastError).toBe(false);
    expect(e.map((x) => x.startTime)).toEqual([0, 1, 2, 3]);
    // 0 秒: 30。1 秒: 30 + 30 = 60。2 秒: 60 + 30 = 90 は 2 + 60 = 62 で止まる
    expect(e.slice(0, 3).map((x) => buffOf(x, "darkside")?.endTime)).toEqual([30, 60, 62]);
    expect(e.slice(0, 3).map(mp)).toEqual([7000, 4000, 1000]);
    // 3 秒の自然回復（+200）を足しても 1200 で足りない
    expect(e[3].resourceErrors.map((x) => x.resourceId)).toContain("mp");
  });

  it("MP は 3 秒ごとに 200 自然回復する（満タンから減った時刻から数える）", () => {
    const e = setup(100).resolve(["edge-of-shadow", entry("hard-slash", 9.5)]);
    e.forEach(expectNoError);
    // 3・6・9 秒の 3 回
    expect(mp(e[1])).toBe(7600);
  });

  it("サイフォンストライク・ストルワートソウルのコンボ成立とカーヴ・アンド・スピット・アビサルドレインで MP 600 を得る", () => {
    const { resolve } = setup(100);
    const twoEdges = ["edge-of-shadow", entry("edge-of-shadow", 1)];
    const combo = resolve([...twoEdges, "hard-slash", "syphon-strike", "unleash", "stalwart-soul"]);
    combo.forEach(expectNoError);
    const syphon = combo[3];
    const stalwart = combo[5];
    expect(mp(combo[1])).toBe(4000);
    // サイフォンストライク 4.15 秒（3 秒の回復 +200）・ストルワートソウル 9.15 秒（6・9 秒の回復 +400）
    expect([combo[2], syphon, combo[4], stalwart].map((x) => x.startTime)).toEqual([1.65, 4.15, 6.65, 9.15]);
    expect(mp(syphon)).toBe(4000 + 200 + 600);
    expect(mp(stalwart)).toBe(4000 + 600 + 200 * 3 + 600);

    const ogcd = resolve([...twoEdges, "carve-and-spit"]);
    ogcd.forEach(expectNoError);
    expect(mp(ogcd[2])).toBe(4600);
    const drain = resolve([...twoEdges, "abyssal-drain"]);
    drain.forEach(expectNoError);
    expect(mp(drain[2])).toBe(4600);
  });

  it("シャドウブリンガーは暗黒の効果中だけ使え、暗黒が乗る", () => {
    const { resolve } = setup(100);
    const [alone] = resolve(["shadowbringer"]);
    expect(alone.comboErrors.map((x) => x.buffId)).toContain("darkside");

    const e = resolve(["edge-of-shadow", "shadowbringer"]);
    e.forEach(expectNoError);
    expect(e[1].resolvedPotency).toBe(600);
    expect(e[1].buffMultiplier).toBeCloseTo(1.1);
  });

  it("影身具現（英雄の影身の攻撃）には暗黒が乗らない", () => {
    const e = setup(100).resolve(["edge-of-shadow", "living-shadow", "carve-and-spit"]);
    e.forEach(expectNoError);
    expect(hasBuff(e[1], "darkside")).toBe(true);
    // 暗黒は 0s から 30s まで。分身の攻撃（最後は 0.65 + 17.7 秒）はすべてその中
    expect(buffOf(e[0], "darkside")?.endTime).toBe(30);
    expect(e[1].delayedHits?.at(-1)?.time).toBeLessThan(30);
    expect(e[1].delayedHits?.map((h) => h.buffMultiplier)).toEqual([1, 1, 1, 1, 1]);
    expect(e[2].buffMultiplier).toBeCloseTo(1.1);
  });

  it.each(DRK_ATTACK_SKILLS.filter((s) => s.potency > 0 && s.id !== "living-shadow").map((s) => s.id))(
    "暗黒の対象に %s が入っている",
    (skillId) => {
      const darkside = DRK_BUFFS.find((b) => b.id === "darkside")!;
      const potencyEffect = darkside.effects.find((x) => x.type === "potency")!;
      expect(potencyEffect.appliesToSkillIds).toContain(skillId);
    },
  );
});

describe("DRK: ブラックブラッド", () => {
  it("ソウルイーターのコンボ成立で +20 を得て、ブラッドスピラーで 50 消費する", () => {
    const e = setup(100).resolve([...BLOOD_60, "bloodspiller"]);
    e.forEach(expectNoError);
    expect(e.map(blood)).toEqual([0, 0, 20, 20, 20, 40, 40, 40, 60, 10]);
  });

  it("ストルワートソウルのコンボ成立で +20 を得る。コンボ不成立のソウルイーターでは得ない", () => {
    const { resolve } = setup(100);
    expect(resolve(["unleash", "stalwart-soul"]).map(blood)).toEqual([0, 20]);
    const [souleater] = resolve(["souleater"]);
    expect(souleater.wsComboError).toBe(true);
    expect(blood(souleater)).toBe(0);
  });

  it("50 未満ではブラッドスピラー・クワイタスを使えない", () => {
    const { resolve } = setup(100);
    for (const skillId of ["bloodspiller", "quietus"]) {
      const e = last(resolve([...COMBO, ...COMBO, skillId]));
      expect(e.resourceErrors.map((x) => x.resourceId)).toContain("blackblood");
    }
  });

  it("ブラッドスピラーを挟んでもコンボは途切れない", () => {
    const e = setup(100).resolve([...BLOOD_60, "hard-slash", "syphon-strike", "bloodspiller", "souleater"]);
    e.forEach(expectNoError);
    expect(last(e).wsComboError).toBe(false);
    expect(last(e).resolvedPotency).toBe(480);
  });
});

describe("DRK: ブラッドデリリアム", () => {
  it("Lv100: ブラッドスピラーがレッドデリリアム（620）→ カマパンス（720）→ トアクリーバー（820）に変化し、ブラックブラッドを使わない", () => {
    const e = setup(100).resolve(["delirium", "bloodspiller", "bloodspiller", "bloodspiller", "bloodspiller"]);
    e.slice(0, 4).forEach(expectNoError);
    expect(e.slice(1, 4).map((x) => x.resolvedSkillId)).toEqual(["scarlet-delirium", "comeuppance", "torcleaver"]);
    expect(e.slice(1, 4).map((x) => x.resolvedPotency)).toEqual([620, 720, 820]);
    expect(e.slice(1, 4).map((x) => x.wsComboError)).toEqual([false, false, false]);
    // デリリアムは 1 回ごとに 1 スタック減り、使い切ると外れる
    expect(e.slice(1, 4).map((x) => buffOf(x, "delirium")?.stacks)).toEqual([2, 1, undefined]);
    // ブラッドウェポンで +10 ずつ。4 回目は変化せず、ブラックブラッドが 50 未満なので使えない
    expect(e.slice(1, 4).map(blood)).toEqual([10, 20, 30]);
    expect(e[4].resolvedSkillId).toBe("bloodspiller");
    expect(e[4].resourceErrors.map((x) => x.resourceId)).toContain("blackblood");
  });

  it("Lv100: クワイタスはインペイルメント（300）に変化し、デリリアムのコンボを途切れさせる", () => {
    const e = setup(100).resolve(["delirium", "bloodspiller", "quietus", "bloodspiller"]);
    e.forEach(expectNoError);
    expect(e.slice(1).map((x) => x.resolvedSkillId)).toEqual(["scarlet-delirium", "impalement", "scarlet-delirium"]);
    expect(e[2].resolvedPotency).toBe(300);
  });

  it("Lv100: デリリアムが切れたあとは、段のバフが残っていてもブラッドスピラーのまま", () => {
    const e = setup(100).resolve(["delirium", "bloodspiller", entry("bloodspiller", 20)]);
    expectNoError(e[1]);
    expect(e[1].resolvedSkillId).toBe("scarlet-delirium");
    expect(hasBuff(e[2], "comeuppance-ready")).toBe(true);
    expect(e[2].resolvedSkillId).toBe("bloodspiller");
  });

  it("ブラッドウェポン: GCD 1 回ごとに 1 スタック消費し、MP 600・ブラックブラッド 10 を得る（アビリティでは消費しない）", () => {
    const e = setup(100).resolve(["edge-of-shadow", "delirium", "hard-slash", "carve-and-spit", "syphon-strike"]);
    e.forEach(expectNoError);
    expect(e[2].startTime).toBe(1.3);
    expect(mp(e[2])).toBe(7600);
    expect(blood(e[2])).toBe(10);
    expect(buffOf(e[2], "blood-weapon")?.stacks).toBe(2);
    expect(buffOf(e[3], "blood-weapon")?.stacks).toBe(2);
    expect(blood(e[3])).toBe(10);
  });

  it("レッドデリリアムは MP 200 を回復する（ブラッドウェポンの 600 と合わせて 800）", () => {
    const e = setup(100).resolve(["edge-of-shadow", "delirium", "bloodspiller"]);
    e.forEach(expectNoError);
    expect(e[2].resolvedSkillId).toBe("scarlet-delirium");
    expect(mp(e[2])).toBe(7800);
  });

  it.each(DRK_ATTACK_SKILLS.filter((s) => s.type === "gcd").map((s) => s.id))(
    "ブラッドウェポンの対象に GCD の %s が入っている",
    (skillId) => {
      const bloodWeapon = DRK_BUFFS.find((b) => b.id === "blood-weapon")!;
      expect(bloodWeapon.effects.length).toBe(3);
      for (const effect of bloodWeapon.effects) {
        expect(effect.appliesToSkillIds).toContain(skillId);
      }
    },
  );

  it("Lv90: ブラッドスピラーは変化せず、デリリアムの 3 回はブラックブラッドを使わずに使える", () => {
    const e = setup(90).resolve(["delirium", "bloodspiller", "bloodspiller", "bloodspiller", "bloodspiller"]);
    e.slice(0, 4).forEach(expectNoError);
    expect(e.slice(1).map((x) => x.resolvedSkillId)).toEqual(Array(4).fill("bloodspiller"));
    expect(e.slice(1, 4).map((x) => x.resolvedPotency)).toEqual([500, 500, 500]);
    expect(e.slice(1, 4).map(blood)).toEqual([10, 20, 30]);
    expect(e[4].resourceErrors.map((x) => x.resourceId)).toContain("blackblood");
  });
});

describe("DRK: 影身具現", () => {
  it("Lv100: ディセスティーム実行可が付き、ディセスティーム（1000）を使える。無いと使えない", () => {
    const { resolve } = setup(100);
    const [alone] = resolve(["disesteem"]);
    expect(alone.comboErrors.map((x) => x.buffId)).toContain("scorn");

    const e = resolve(["living-shadow", "disesteem", "disesteem"]);
    e.slice(0, 2).forEach(expectNoError);
    expect(e[0].delayedHits?.reduce((sum, h) => sum + h.potency, 0)).toBe(2450);
    expect(buffOf(e[0], "scorn")?.endTime).toBe(30);
    expect(e[1].resolvedPotency).toBe(1000);
    expect(e[2].comboErrors.map((x) => x.buffId)).toContain("scorn");
  });

  it("Lv90 ではディセスティーム実行可が付かない", () => {
    const [e] = setup(90).resolve(["living-shadow"]);
    expectNoError(e);
    expect(hasBuff(e, "scorn")).toBe(false);
  });

  it.each<[PlayerLevel, number[], number]>([
    [80, [340, 340, 340, 340, 340], 1700],
    // Lv88 はパレットのレベルに無いが、特性（分身の攻撃 340 → 420）の境目なので確かめる
    [88 as PlayerLevel, [420, 420, 420, 420, 420], 2100],
    [90, [420, 570, 420, 420, 420], 2250],
    [100, [420, 570, 420, 420, 620], 2450],
  ])("Lv%i: 分身の攻撃は使用の 6.8・11.16・13.34・15.52・17.7 秒後に %j の威力で入り、合計は %i", (level, potencies, total) => {
    const { resolve, skillMap } = setup(level);
    const [shadow] = resolve(["living-shadow"]);
    expectNoError(shadow);
    // 使ったときの威力は無く、威力はすべて時間差の攻撃で入る
    expect(shadow.resolvedPotency).toBe(0);
    expect(shadow.delayedHits?.map((h) => h.time)).toEqual([6.8, 11.16, 13.34, 15.52, 17.7]);
    expect(shadow.delayedHits?.map((h) => h.potency)).toEqual(potencies);
    expect(potencies.reduce((sum, p) => sum + p, 0)).toBe(total);
    // 敵が 1 体なら、範囲攻撃の攻撃も 1 体分（#977）
    const skill = skillMap.get("living-shadow");
    expect(shadow.delayedHits?.map((h) => calcDelayedHitBreakdown(h, skill, DEFAULT_STATS).targets.length)).toEqual([1, 1, 1, 1, 1]);
  });

  // 分身の攻撃は、アビサルドレイン・漆黒の波動（Lv90 からシャドウブリンガー）・漆黒の剣・ブラッドスピラー・
  // カーヴ・アンド・スピット（Lv100 からディセスティーム）の順（#977）
  it.each<[PlayerLevel, ("全体" | "全体・2 体目以降 25% 減" | "単体")[]]>([
    [80, ["全体", "全体", "単体", "単体", "単体"]],
    [88 as PlayerLevel, ["全体", "全体", "単体", "単体", "単体"]],
    [90, ["全体", "全体・2 体目以降 25% 減", "単体", "単体", "単体"]],
    [100, ["全体", "全体・2 体目以降 25% 減", "単体", "単体", "全体・2 体目以降 25% 減"]],
  ])("Lv%i: 3 体の区間では、分身の各攻撃が %j の範囲で入る（#977）", (level, areas) => {
    const { resolveFull, skillMap } = setup(level);
    const result = resolveFull(["living-shadow"], [{ startTime: 0, endTime: 30, targetCount: 3 }]);
    const [shadow] = result.entries;
    expectNoError(shadow);
    expect(shadow.delayedHits?.map((h) => h.targetCount)).toEqual([3, 3, 3, 3, 3]);

    const skill = skillMap.get("living-shadow");
    const breakdowns = shadow.delayedHits!.map((h) => calcDelayedHitBreakdown(h, skill, DEFAULT_STATS));
    const expected = breakdowns.map(({ singleTargetPotency: s }, i) => {
      if (areas[i] === "全体") return [s, s, s];
      if (areas[i] === "全体・2 体目以降 25% 減") return [s, Math.floor(s * 0.75), Math.floor(s * 0.75)];
      return [s];
    });
    expect(breakdowns.map((b) => b.targets)).toEqual(expected);
    // 集計（PPS）にも、各攻撃の複数体分の合計が入る
    const total = expected.flat().reduce((sum, p) => sum + p, 0);
    expect(calcPps(result.entries, skillMap, result.dotTicks, 0, 30, DEFAULT_STATS).directPotency).toBe(total);
  });
});

describe("DRK: ソルトアース", () => {
  it("置いた瞬間の 50 と、3 秒おきの 5 回（各 50）の DoT。暗黒が乗る", () => {
    const { resolveFull } = setup(100);
    const plain = resolveFull(["salted-earth"]);
    expectNoError(plain.entries[0]);
    expect(plain.entries[0].resolvedPotency).toBe(50);
    expect(plain.dotTicks.map((t) => [t.time, t.potency])).toEqual([[3, 50], [6, 50], [9, 50], [12, 50], [15, 50]]);

    const buffed = resolveFull(["edge-of-shadow", "salted-earth"]);
    expect(buffed.entries[1].buffMultiplier).toBeCloseTo(1.1);
    expect(buffed.dotTicks.map((t) => t.potency)).toEqual([55, 55, 55, 55, 55]);
  });

  it("ソルト・アンド・ダーク（500）はソルトアースの効果中だけ使える", () => {
    const { resolve } = setup(100);
    const [alone] = resolve(["salt-and-darkness"]);
    expect(alone.comboErrors.map((x) => x.buffId)).toContain("salted-earth");

    const e = resolve(["salted-earth", "salt-and-darkness"]);
    e.forEach(expectNoError);
    expect(e[1].resolvedPotency).toBe(500);

    const expired = resolve(["salted-earth", entry("salt-and-darkness", 16)]);
    expect(expired[1].comboErrors.map((x) => x.buffId)).toContain("salted-earth");
  });
});

describe("DRK: チャージと共有リキャスト", () => {
  it("カーヴ・アンド・スピットとアビサルドレインはリキャストを共有する", () => {
    const e = setup(100).resolve(["carve-and-spit", "abyssal-drain"]);
    expectNoError(e[0]);
    expect(e[1].recastError).toBe(true);
  });

  it("シャドウブリンガーは 2 チャージ", () => {
    const e = setup(100).resolve(["edge-of-shadow", "shadowbringer", "shadowbringer", "shadowbringer"]);
    e.slice(0, 3).forEach(expectNoError);
    expect(e[3].recastError).toBe(true);
  });

  it("漆黒の剣と漆黒の波動は 1 秒のリキャストを共有する", () => {
    const { resolve } = setup(100);
    // 0.65 秒（剣のアニメーションロックの明け）では、波動は共有のリキャストでエラーになり、共有しないカーヴ・アンド・スピットはならない
    const early = resolve(["edge-of-shadow", "flood-of-shadow"]);
    expect(early[1].startTime).toBe(0.65);
    expect(early[1].recastError).toBe(true);
    const control = resolve(["edge-of-shadow", "carve-and-spit"]);
    expect(control[1].startTime).toBe(0.65);
    expect(control[1].recastError).toBe(false);
    const e = resolve(["edge-of-shadow", entry("flood-of-shadow", 1)]);
    e.forEach(expectNoError);
  });
});
