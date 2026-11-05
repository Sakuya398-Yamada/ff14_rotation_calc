import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { GNB_ATTACK_SKILLS } from "../../data/gnb-skills";
import { GNB_BUFFS } from "../../data/gnb-buffs";
import { GNB_RESOURCES } from "../../data/gnb-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(GNB_BUFFS, level);
  const resources = getResourcesForLevel(GNB_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(GNB_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(GNB_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
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

const cartridges = (e: ResolvedTimelineEntry) => e.resourceSnapshot["cartridge"];
const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.some((b) => b.buffId === buffId);
const missingBuffIds = (e: ResolvedTimelineEntry) =>
  e.comboErrors.filter((c) => c.kind === "missing").map((c) => c.buffId);
const last = <T>(xs: T[]) => xs[xs.length - 1];

/** キーンエッジ → ブルータルシェル → ソリッドバレル（コンボ成立でソイル +1） */
const WS_COMBO = ["keen-edge", "brutal-shell", "solid-barrel"];

/**
 * 公式ジョブガイド（ガンブレイカー、Patch 7.5 表記、PvE 欄）と、特性修得前の値（consolegameswiki の Notes で照合）
 * - アクション威力アップ（Lv84）: キーンエッジ 200、ブルータルシェル 160（コンボ 300）、ソリッドバレル 140（コンボ 360）。
 *   Lv84 未満は 150、100（240）、100（320）
 * - アクション威力アップII（Lv94）: キーンエッジ 300、ブルータルシェル 240（380）、ソリッドバレル 240（460）、
 *   バーストストライク 420（Lv94 未満は 340）、ビートファング 440（330）、サベッジクロウ 500（410）、ウィケッドタロン 560（490）、
 *   ジャギュラーリップ 220（180）、アブドメンテアー 260（220）、アイガウジ 300（260）、ブラスティングゾーン 800（720）、
 *   ハイパーヴェロシティ 180（140）
 */
describe("GNB: レベルごとの威力", () => {
  it.each<[PlayerLevel, number, number, number]>([
    [70, 150, 240, 320],
    [80, 150, 240, 320],
    [90, 200, 300, 360],
    [100, 300, 380, 460],
  ])("Lv%i のコンボはキーンエッジ %i → ブルータルシェル %i → ソリッドバレル %i", (level, keen, brutal, solid) => {
    const e = setup(level).resolve(WS_COMBO).entries;
    e.forEach(expectNoError);
    expect(e.map((x) => x.wsComboError)).toEqual([false, false, false]);
    expect(e.map((x) => x.resolvedPotency)).toEqual([keen, brutal, solid]);
  });

  it.each<[PlayerLevel, string, number]>([
    [70, "brutal-shell", 100], [90, "brutal-shell", 160], [100, "brutal-shell", 240],
    [70, "solid-barrel", 100], [90, "solid-barrel", 140], [100, "solid-barrel", 240],
  ])("Lv%i でコンボ不成立の %s は %i", (level, skillId, potency) => {
    const [e] = setup(level).resolve([skillId]).entries;
    expect(e.wsComboError).toBe(true);
    expect(e.resolvedPotency).toBe(potency);
  });

  it.each<[PlayerLevel, number, number, number, number, number, number, number]>([
    [70, 340, 330, 180, 410, 220, 490, 260],
    [90, 340, 330, 180, 410, 220, 490, 260],
    [100, 420, 440, 220, 500, 260, 560, 300],
  ])(
    "Lv%i のバーストストライクは %i、ビートファング %i（ジャギュラーリップ %i）→ サベッジクロウ %i（アブドメンテアー %i）→ ウィケッドタロン %i（アイガウジ %i）",
    (level, burst, fang, rip, claw, tear, talon, gouge) => {
      const e = setup(level).resolve([
        ...WS_COMBO, ...WS_COMBO,
        "burst-strike", "gnashing-fang", "continuation", "gnashing-fang", "continuation", "gnashing-fang", "continuation",
      ]).entries.slice(6);
      e.forEach(expectNoError);
      expect(e.map((x) => x.resolvedSkillId)).toEqual([
        "burst-strike", "gnashing-fang", "jugular-rip", "savage-claw", "abdomen-tear", "wicked-talon", "eye-gouge",
      ]);
      expect(e.map((x) => x.resolvedPotency)).toEqual([burst, fang, rip, claw, tear, talon, gouge]);
    },
  );

  it.each<[PlayerLevel, string, number]>([
    [70, "danger-zone", 250], [80, "blasting-zone", 720], [90, "blasting-zone", 720], [100, "blasting-zone", 800],
    [70, "bow-shock", 150], [70, "lightning-shot", 150], [70, "demon-slice", 100],
  ])("Lv%i の %s は %i", (level, skillId, potency) => {
    const [e] = setup(level).resolve([skillId]).entries;
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it("デーモンスライス → デーモンスローターのコンボは 160、コンボ不成立なら 100", () => {
    const [, slaughter] = setup(100).resolve(["demon-slice", "demon-slaughter"]).entries;
    expect(slaughter.wsComboError).toBe(false);
    expect(slaughter.resolvedPotency).toBe(160);
    const [alone] = setup(100).resolve(["demon-slaughter"]).entries;
    expect(alone.wsComboError).toBe(true);
    expect(alone.resolvedPotency).toBe(100);
  });

  it("パレットには上位版と変化元だけが並び、変化先は出ない", () => {
    const ids = setup(100).skills.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([
      "gnashing-fang", "continuation", "reign-of-beasts", "blasting-zone", "double-down", "bloodfest", "fated-circle",
    ]));
    for (const id of [
      "savage-claw", "wicked-talon", "jugular-rip", "abdomen-tear", "eye-gouge", "hypervelocity", "fated-brand",
      "noble-blood", "lion-heart", "danger-zone",
    ]) {
      expect(ids).not.toContain(id);
    }
    // フェイテッドサークル（Lv72）・ブラッドソイル（Lv76）・ブラスティングゾーン（Lv80）は Lv70 には無い
    const lv70 = setup(70).skills.map((s) => s.id);
    expect(lv70).toContain("danger-zone");
    for (const id of ["fated-circle", "bloodfest", "blasting-zone", "double-down", "reign-of-beasts"]) {
      expect(lv70).not.toContain(id);
    }
    expect(setup(90).skills.map((s) => s.id)).not.toContain("reign-of-beasts");
  });
});

describe("GNB: ソイル", () => {
  it.each<[PlayerLevel, number[]]>([
    [80, [1, 2, 2]],
    [100, [1, 2, 3, 3]],
  ])("Lv%i ではソリッドバレルのコンボ成立で 1 ずつ得て、上限で止まる（%j）", (level, expected) => {
    const e = setup(level).resolve(expected.flatMap(() => WS_COMBO)).entries;
    e.forEach(expectNoError);
    expect(e.filter((x) => x.resolvedSkillId === "solid-barrel").map(cartridges)).toEqual(expected);
  });

  it("デーモンスローターのコンボ成立で 1 得て、コンボ不成立のソリッドバレル・デーモンスローターでは得ない", () => {
    const e = setup(100).resolve(["demon-slice", "demon-slaughter", "solid-barrel", "demon-slaughter"]).entries;
    expect(e.map(cartridges)).toEqual([0, 1, 1, 1]);
  });

  it.each<[PlayerLevel, number, number, number]>([
    // Lv88 未満は +2・ブラッドソイル中の上限 4。Lv88 から +3・上限 6
    [80, 1, 3, 4],
    [80, 2, 4, 4],
    [100, 2, 5, 6],
    [100, 3, 6, 6],
  ])("Lv%i でソイル %i からブラッドソイルを使うと %i になり、効果中の上限は %i", (level, before, after, cap) => {
    const e = setup(level).resolve([...Array.from({ length: before }, () => WS_COMBO).flat(), "bloodfest", ...WS_COMBO]).entries;
    e.forEach(expectNoError);
    const bloodfest = e[before * 3];
    expect(bloodfest.resolvedSkillId).toBe("bloodfest");
    expect(cartridges(e[before * 3 - 1])).toBe(before);
    expect(cartridges(bloodfest)).toBe(after);
    expect(hasBuff(bloodfest, "bloodfest")).toBe(true);
    // 効果中にもう 1 周すると、上限まで得る
    expect(cartridges(last(e))).toBe(Math.min(after + 1, cap));
  });

  it("バーストストライク・ビートファング・フェイテッドサークルは 1、ダブルダウンは 2 消費する", () => {
    const e = setup(100).resolve(["bloodfest", "burst-strike", "fated-circle", "gnashing-fang"]).entries;
    e.forEach(expectNoError);
    expect(e.map(cartridges)).toEqual([3, 2, 1, 0]);

    const d = setup(100).resolve(["bloodfest", "double-down"]).entries;
    expectNoError(d[1]);
    expect(cartridges(d[1])).toBe(1);
    expect(d[1].resolvedPotency).toBe(1000);
  });

  it.each(["burst-strike", "gnashing-fang", "fated-circle", "double-down"])("ソイルが足りないと %s は実行できない", (skillId) => {
    const [e] = setup(100).resolve([skillId]).entries;
    expect(e.resourceErrors.map((r) => r.resourceId)).toEqual(["cartridge"]);
  });

  it("ソイル 1 ではダブルダウンを実行できない", () => {
    const e = last(setup(100).resolve([...WS_COMBO, "double-down"]).entries);
    expect(e.resourceErrors.map((r) => r.resourceId)).toEqual(["cartridge"]);
  });
});

describe("GNB: ノー・マーシーと DoT", () => {
  it("ノー・マーシー中は与ダメージが 1.2 倍になり、ソニックブレイク（威力 340・DoT 120）とバウショック（威力 150・DoT 60）の DoT にも乗る", () => {
    const result = setup(100).resolve(["no-mercy", "sonic-break", "bow-shock"]);
    const [, sonic, bow] = result.entries;
    expectNoError(sonic);
    expectNoError(bow);
    expect(sonic.resolvedPotency).toBe(340);
    expect(bow.resolvedPotency).toBe(150);
    expect(sonic.buffMultiplier).toBe(1.2);
    expect(bow.buffMultiplier).toBe(1.2);
    const sonicTicks = result.dotTicks.filter((t) => t.skillId === "sonic-break");
    expect(sonicTicks).toHaveLength(5);
    expect(sonicTicks.every((t) => t.potency === Math.floor(120 * 1.2))).toBe(true);
    const bowTicks = result.dotTicks.filter((t) => t.skillId === "bow-shock");
    expect(bowTicks).toHaveLength(5);
    expect(bowTicks.every((t) => t.potency === Math.floor(60 * 1.2))).toBe(true);
  });

  it("ソニックブレイクはノー・マーシーのあとに 1 回だけ使える", () => {
    const [before] = setup(100).resolve(["sonic-break"]).entries;
    expect(missingBuffIds(before)).toEqual(["ready-to-break"]);

    const [, sonic, again] = setup(100).resolve(["no-mercy", "sonic-break", "sonic-break"]).entries;
    expectNoError(sonic);
    expect(missingBuffIds(again)).toEqual(["ready-to-break"]);
  });

  it("ノー・マーシーの効果が切れたあとは倍率が 1 に戻る", () => {
    const e = setup(100).resolve(["no-mercy", ...WS_COMBO, ...WS_COMBO, ...WS_COMBO, "keen-edge"]).entries;
    const lastEntry = last(e);
    expectNoError(lastEntry);
    expect(lastEntry.startTime).toBeGreaterThan(20);
    expect(lastEntry.buffMultiplier).toBe(1);
  });
});

describe("GNB: ビートファング系とコンティニュエーション", () => {
  it("ビートファング → サベッジクロウ → ウィケッドタロンの各段のあとにコンティニュエーションが変化し、挟んでもメインのコンボは途切れない", () => {
    const e = setup(100).resolve([
      ...WS_COMBO,
      "keen-edge",
      "gnashing-fang", "continuation",
      "brutal-shell",
      "gnashing-fang", "continuation",
      "solid-barrel",
      "gnashing-fang", "continuation",
    ]).entries.slice(3);
    e.forEach(expectNoError);
    expect(e.map((x) => x.resolvedSkillId)).toEqual([
      "keen-edge",
      "gnashing-fang", "jugular-rip",
      "brutal-shell",
      "savage-claw", "abdomen-tear",
      "solid-barrel",
      "wicked-talon", "eye-gouge",
    ]);
    expect(e.map((x) => x.wsComboError)).toEqual([false, false, false, false, false, false, false, false, false]);
    expect(e.find((x) => x.resolvedSkillId === "brutal-shell")!.resolvedPotency).toBe(380);
    expect(e.find((x) => x.resolvedSkillId === "solid-barrel")!.resolvedPotency).toBe(460);
    // ソイルはビートファングで 1 消費し、ソリッドバレルのコンボで 1 得る
    expect(e.map(cartridges)).toEqual([1, 0, 0, 0, 0, 0, 1, 1, 1]);
    // 変化中のサベッジクロウ・ウィケッドタロンはソイルを使わず、ウィケッドタロンで段のバフが外れる
    expect(hasBuff(e[7], "wicked-talon-ready")).toBe(false);
    expect(hasBuff(e[7], "savage-claw-ready")).toBe(false);
  });

  it("「〜実行可」は次のウェポンスキルで外れ、使わなかったコンティニュエーションは次の段のものに変わる", () => {
    const e = setup(100).resolve([...WS_COMBO, "gnashing-fang", "gnashing-fang", "continuation"]).entries.slice(3);
    e.forEach(expectNoError);
    expect(e.map((x) => x.resolvedSkillId)).toEqual(["gnashing-fang", "savage-claw", "abdomen-tear"]);
    expect(hasBuff(e[1], "ready-to-rip")).toBe(false);
  });

  it("ビートファングのあとに別のウェポンスキルを使うと、ジャギュラーリップ実行可が外れてコンティニュエーションは実行できない", () => {
    const e = last(setup(100).resolve([...WS_COMBO, "gnashing-fang", "keen-edge", "continuation"]).entries);
    expect(e.resolvedSkillId).toBe("continuation");
    expect(e.comboErrors.map((c) => c.anyOf)).toEqual([
      ["ready-to-rip", "ready-to-tear", "ready-to-gouge", "ready-to-blast", "ready-to-raze"],
    ]);
  });

  it("ビートファングは最大 2 チャージ・リキャスト 30 秒で、変化先のサベッジクロウ・ウィケッドタロンはチャージを使わない", () => {
    const e = setup(100).resolve([
      "bloodfest",
      "gnashing-fang", "gnashing-fang", "gnashing-fang",
      "gnashing-fang", "gnashing-fang", "gnashing-fang",
      "gnashing-fang",
    ]).entries;
    expect(e.slice(1).map((x) => x.resolvedSkillId)).toEqual([
      "gnashing-fang", "savage-claw", "wicked-talon",
      "gnashing-fang", "savage-claw", "wicked-talon",
      "gnashing-fang",
    ]);
    e.slice(0, 7).forEach(expectNoError);
    const third = last(e);
    expect(third.startTime).toBeLessThan(30);
    expect(third.recastError).toBe(true);
  });

  it.each<[PlayerLevel, string, string, number | null]>([
    [100, "burst-strike", "hypervelocity", 180],
    [90, "burst-strike", "hypervelocity", 140],
    [80, "burst-strike", "continuation", null],
    [100, "fated-circle", "fated-brand", 120],
    [90, "fated-circle", "continuation", null],
  ])("Lv%i で %s のあとのコンティニュエーションは %s（威力 %s）", (level, gcd, resolved, potency) => {
    const e = last(setup(level).resolve([...WS_COMBO, gcd, "continuation"]).entries);
    expect(e.resolvedSkillId).toBe(resolved);
    if (potency === null) {
      expect(e.comboErrors).not.toEqual([]);
    } else {
      expectNoError(e);
      expect(e.resolvedPotency).toBe(potency);
    }
  });
});

describe("GNB: ブラッドソイルとライズ・オブ・ハート系", () => {
  it("ブラッドソイルのあとにライズ・オブ・ハート → ルーラー・オブ・ハート → エンド・オブ・ハートと使え、挟んでもメインのコンボは途切れない", () => {
    const e = setup(100).resolve([
      "keen-edge", "bloodfest",
      "reign-of-beasts", "brutal-shell", "reign-of-beasts", "solid-barrel", "reign-of-beasts",
      "reign-of-beasts",
    ]).entries;
    e.slice(0, 7).forEach(expectNoError);
    expect(e.map((x) => x.resolvedSkillId)).toEqual([
      "keen-edge", "bloodfest",
      "reign-of-beasts", "brutal-shell", "noble-blood", "solid-barrel", "lion-heart",
      "reign-of-beasts",
    ]);
    expect(e.slice(2, 7).map((x) => x.resolvedPotency)).toEqual([800, 380, 900, 460, 1000]);
    expect(e.slice(2, 7).map((x) => x.wsComboError)).toEqual([false, false, false, false, false]);
    expect(hasBuff(e[6], "lion-heart-ready")).toBe(false);
    // ハートコンボ実行可は 1 回で使い切る
    expect(missingBuffIds(last(e))).toEqual(["ready-to-reign"]);
  });

  it("ブラッドソイルを使う前のライズ・オブ・ハートは実行できない", () => {
    const [e] = setup(100).resolve(["reign-of-beasts"]).entries;
    expect(missingBuffIds(e)).toEqual(["ready-to-reign"]);
  });

  it("Lv90 のブラッドソイルはハートコンボ実行可を付けない", () => {
    const [e] = setup(90).resolve(["bloodfest"]).entries;
    expectNoError(e);
    expect(hasBuff(e, "bloodfest")).toBe(true);
    expect(hasBuff(e, "ready-to-reign")).toBe(false);
  });
});

describe("GNB: 範囲攻撃のデータ", () => {
  const byId = new Map(GNB_ATTACK_SKILLS.map((s) => [s.id, s]));

  it.each<[string, number | undefined]>([
    ["demon-slice", undefined],
    ["demon-slaughter", undefined],
    ["fated-circle", undefined],
    ["fated-brand", undefined],
    ["bow-shock", undefined],
    ["double-down", 0.15],
    ["reign-of-beasts", 0.6],
    ["noble-blood", 0.6],
    ["lion-heart", 0.6],
  ])("%s は範囲攻撃で、2 体目以降の減衰率は %s", (id, falloffRate) => {
    const skill = byId.get(id)!;
    expect(skill.maxTargets).toBe(Infinity);
    expect(skill.falloffRate).toBe(falloffRate);
  });
});
