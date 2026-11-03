import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import {
  getAllSkillMapForLevel,
  getBuffsForLevel,
  getResourcesForLevel,
  getSkillsForLevel,
} from "../skill-level";
import { PLD_ATTACK_SKILLS } from "../../data/pld-skills";
import { PLD_BUFFS } from "../../data/pld-buffs";
import { PLD_RESOURCES } from "../../data/pld-resources";
import type { PlayerLevel, ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function setup(level: PlayerLevel = 100) {
  const buffs = getBuffsForLevel(PLD_BUFFS, level);
  const resources = getResourcesForLevel(PLD_RESOURCES, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(PLD_ATTACK_SKILLS, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(PLD_ATTACK_SKILLS, skills, level, buffIds, resourceIds);
  const resolve = (ids: string[]) => resolveTimeline(ids.map(entry), skillMap, resources, undefined, buffs, []);
  return { skills, resolve };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

const hasBuff = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.some((b) => b.buffId === buffId);
const stacksOf = (e: ResolvedTimelineEntry, buffId: string) => e.activeBuffs.find((b) => b.buffId === buffId)?.stacks;
const missingBuffIds = (e: ResolvedTimelineEntry) =>
  e.comboErrors.filter((c) => c.kind === "missing").map((c) => c.buffId);

const WS_COMBO = ["fast-blade", "riot-blade", "royal-authority"];

/**
 * 公式ジョブガイド（ナイト、Patch 7.5、7.55 表記、PvE 欄）と、特性習得前の値（パッチノート 7.05・7.2 の変更履歴と consolegameswiki の Notes で照合）
 * - アクション威力アップ（Lv84）／II（Lv94）: ファストブレード 150 → 200 → 220、ホーリースピリット 300 → 350 → 400
 * - スピリッツウィズイン（270）は Lv86 でエクスピアシオン（450）に、レクイエスカット（320）は Lv96 でインペラトル（580）に置き換わる
 */
describe("PLD: レベルごとの威力", () => {
  it.each<[PlayerLevel, string, number]>([
    [70, "fast-blade", 150], [70, "total-eclipse", 120], [70, "shield-lob", 100], [70, "holy-spirit", 300],
    [70, "spirits-within", 270], [70, "circle-of-scorn", 140], [70, "intervene", 150], [70, "requiescat", 320],
    [80, "fast-blade", 150], [80, "holy-spirit", 300], [80, "holy-circle", 100], [80, "spirits-within", 270],
    [90, "fast-blade", 200], [90, "holy-spirit", 350], [90, "expiacion", 450], [90, "requiescat", 320],
    [100, "fast-blade", 220], [100, "holy-spirit", 400], [100, "holy-circle", 100], [100, "expiacion", 450],
    [100, "imperator", 580],
  ])("Lv%i ではパレットに %s が並び、タイムライン上の威力は %i", (level, skillId, potency) => {
    const { skills, resolve } = setup(level);
    expect(skills.map((s) => s.id)).toContain(skillId);
    const [e] = resolve([skillId]).entries;
    expectNoError(e);
    expect(e.resolvedPotency).toBe(potency);
  });

  it("置き換わったスキルと変化先はパレットに出ない", () => {
    const at = (level: PlayerLevel) => setup(level).skills.map((s) => s.id);
    expect(at(80)).not.toContain("expiacion");
    expect(at(90)).not.toContain("spirits-within");
    expect(at(90)).not.toContain("imperator");
    expect(at(100)).not.toContain("requiescat");
    for (const level of [70, 80, 90, 100] as const) {
      const ids = at(level);
      for (const hiddenId of PLD_ATTACK_SKILLS.filter((s) => s.hidden).map((s) => s.id)) {
        expect(ids).not.toContain(hiddenId);
      }
    }
  });

  it.each<[PlayerLevel, number, number, number]>([
    [70, 150, 260, 360],
    [80, 150, 260, 360],
    [90, 200, 300, 400],
    [100, 220, 330, 460],
  ])("Lv%i の WS コンボはファストブレード %i → ライオットソード %i → ロイヤルアソリティ %i", (level, fast, riot, royal) => {
    const result = setup(level).resolve(WS_COMBO);
    result.entries.forEach(expectNoError);
    expect(result.entries.map((e) => e.wsComboError)).toEqual([false, false, false]);
    expect(result.entries.map((e) => e.resolvedPotency)).toEqual([fast, riot, royal]);
  });
});

describe("PLD: ファイト・オア・フライトとゴアブレード", () => {
  it("ファイト・オア・フライト中は与ダメージが 1.25 倍になり、サークル・オブ・ドゥームの DoT にも乗る", () => {
    const result = setup(100).resolve(["fight-or-flight", "fast-blade", "circle-of-scorn"]);
    const [, fast, circle] = result.entries;
    expectNoError(fast);
    expectNoError(circle);
    expect(fast.buffMultiplier).toBe(1.25);
    expect(circle.buffMultiplier).toBe(1.25);
    const ticks = result.dotTicks.filter((t) => t.skillId === "circle-of-scorn");
    expect(ticks).toHaveLength(5);
    expect(ticks.every((t) => t.potency === Math.floor(30 * 1.25))).toBe(true);
  });

  it("ゴアブレードはファイト・オア・フライトのあとに 1 回だけ使え、威力は 700", () => {
    const before = setup(100).resolve(["goring-blade"]).entries[0];
    expect(missingBuffIds(before)).toEqual(["goring-blade-ready"]);

    const [, goring, again] = setup(100).resolve(["fight-or-flight", "goring-blade", "goring-blade"]).entries;
    expectNoError(goring);
    expect(goring.resolvedPotency).toBe(700);
    expect(hasBuff(goring, "goring-blade-ready")).toBe(false);
    expect(missingBuffIds(again)).toEqual(["goring-blade-ready"]);
  });
});

describe("PLD: ロイヤルアソリティのあとのロイエ系", () => {
  it.each<[PlayerLevel, number, number, number]>([
    [80, 360, 380, 400],
    [90, 400, 420, 440],
    [100, 460, 500, 540],
  ])("Lv%i ではロイエ %i → ゲベート %i → グラブカッマー %i と変化し、4 回目は実行できない", (level, atonement, supplication, sepulchre) => {
    const result = setup(level).resolve([...WS_COMBO, "atonement", "atonement", "atonement", "atonement"]);
    const [, , , a1, a2, a3, a4] = result.entries;
    [a1, a2, a3].forEach(expectNoError);
    expect([a1, a2, a3].map((e) => e.resolvedSkillId)).toEqual(["atonement", "supplication", "sepulchre"]);
    expect([a1, a2, a3].map((e) => e.resolvedPotency)).toEqual([atonement, supplication, sepulchre]);
    expect(missingBuffIds(a4)).toEqual(["atonement-ready"]);
  });

  it("Lv76 未満ではロイヤルアソリティでロイエ実行可が付かない", () => {
    const royal = setup(70).resolve(WS_COMBO).entries[2];
    expectNoError(royal);
    expect(hasBuff(royal, "atonement-ready")).toBe(false);
    expect(hasBuff(royal, "divine-might")).toBe(true);
  });

  it("ロイエ系・ホーリースピリット・ゴアブレードを挟んでも WS コンボは途切れない", () => {
    const result = setup(100).resolve([
      ...WS_COMBO,
      "fight-or-flight",
      "fast-blade",
      "atonement",
      "holy-spirit",
      "goring-blade",
      "riot-blade",
    ]);
    const riot = result.entries[8];
    expectNoError(riot);
    expect(riot.wsComboError).toBe(false);
    expect(riot.resolvedPotency).toBe(330);
  });

  it("詠唱するホーリースピリット・ホーリーサークル（神聖魔法効果アップ無し）を挟んでも WS コンボは途切れない", () => {
    const result = setup(100).resolve(["fast-blade", "holy-spirit", "holy-circle", "riot-blade"]);
    const [, spirit, circle, riot] = result.entries;
    expect([spirit.resolvedSkillId, circle.resolvedSkillId]).toEqual(["holy-spirit", "holy-circle"]);
    expect([spirit.castTime, circle.castTime]).toEqual([1.5, 1.5]);
    expectNoError(riot);
    expect(riot.wsComboError).toBe(false);
    expect(riot.resolvedPotency).toBe(330);
  });
});

describe("PLD: レクイエスカット・インペラトルのあとのコンフィテオル系", () => {
  it("Lv100 ではインペラトルのあと、コンフィテオル → フェイス → トゥルース → ヴァラーと変化し、ブレード・オブ・オナーが使える", () => {
    const result = setup(100).resolve([
      "imperator",
      "confiteor",
      "confiteor",
      "confiteor",
      "confiteor",
      "blade-of-honor",
    ]);
    const [imperator, c1, c2, c3, c4, honor] = result.entries;
    [imperator, c1, c2, c3, c4, honor].forEach(expectNoError);
    expect([c1, c2, c3, c4].map((e) => e.resolvedSkillId)).toEqual([
      "confiteor-requiescat",
      "blade-of-faith-requiescat",
      "blade-of-truth-requiescat",
      "blade-of-valor-requiescat",
    ]);
    expect([c1, c2, c3, c4].map((e) => e.resolvedPotency)).toEqual([1000, 760, 880, 1000]);
    // レクイエスカットは 4 スタックで、コンフィテオル系が 1 つずつ消費する
    expect(stacksOf(imperator, "requiescat")).toBe(4);
    expect([c1, c2, c3].map((e) => stacksOf(e, "requiescat"))).toEqual([3, 2, 1]);
    expect(hasBuff(c4, "requiescat")).toBe(false);
    expect(hasBuff(c4, "blade-of-honor-ready")).toBe(true);
    expect(honor.resolvedPotency).toBe(1000);
    expect(hasBuff(honor, "blade-of-honor-ready")).toBe(false);
  });

  it("Lv90 ではレクイエスカット中のコンフィテオル系が 920 → 720 → 820 → 920 で、ブレード・オブ・オナー実行可は付かない", () => {
    const result = setup(90).resolve(["requiescat", "confiteor", "confiteor", "confiteor", "confiteor"]);
    const [, c1, c2, c3, c4] = result.entries;
    [c1, c2, c3, c4].forEach(expectNoError);
    expect([c1, c2, c3, c4].map((e) => e.resolvedPotency)).toEqual([920, 720, 820, 920]);
    expect(hasBuff(c4, "blade-of-honor-ready")).toBe(false);
  });

  it("Lv80 ではコンフィテオルのあとに続く段が無く、Lv70 ではレクイエスカットでコンフィテオル実行可が付かない", () => {
    const [, c1, c2] = setup(80).resolve(["requiescat", "confiteor", "confiteor"]).entries;
    expectNoError(c1);
    expect(c1.resolvedPotency).toBe(920);
    expect(missingBuffIds(c2)).toEqual(["confiteor-ready"]);

    const [requiescat] = setup(70).resolve(["requiescat"]).entries;
    expect(hasBuff(requiescat, "requiescat")).toBe(true);
    expect(hasBuff(requiescat, "confiteor-ready")).toBe(false);
  });

  it("レクイエスカットが無ければコンフィテオル系は通常の威力になる", () => {
    // ホーリースピリット 4 回でスタックを使い切ってからコンフィテオル系を使う
    const result = setup(100).resolve([
      "imperator",
      "holy-spirit",
      "holy-spirit",
      "holy-spirit",
      "holy-spirit",
      "confiteor",
      "confiteor",
      "confiteor",
      "confiteor",
    ]);
    const chain = result.entries.slice(5);
    expect(hasBuff(result.entries[4], "requiescat")).toBe(false);
    chain.forEach(expectNoError);
    expect(chain.map((e) => e.resolvedSkillId)).toEqual(["confiteor", "blade-of-faith", "blade-of-truth", "blade-of-valor"]);
    expect(chain.map((e) => e.resolvedPotency)).toEqual([500, 260, 380, 500]);
  });

  it("コンフィテオル系を挟んでも WS コンボは途切れない", () => {
    const result = setup(100).resolve(["imperator", "fast-blade", "confiteor", "confiteor", "riot-blade"]);
    const riot = result.entries[4];
    expectNoError(riot);
    expect(riot.wsComboError).toBe(false);
    expect(riot.resolvedPotency).toBe(330);
  });

  it("WS コンボのスキルを使うと、コンフィテオルからの魔法コンボが途切れる", () => {
    const result = setup(100).resolve(["imperator", "confiteor", "fast-blade", "confiteor"]);
    const [, , fast, next] = result.entries;
    expect(hasBuff(fast, "blade-of-faith-ready")).toBe(false);
    // ブレード・オブ・フェイスに変化せず、（レクイエスカットは残っているので）レクイエスカット中のコンフィテオルとして実行できない
    expect(next.resolvedSkillId).toBe("confiteor-requiescat");
    expect(missingBuffIds(next)).toEqual(["confiteor-ready"]);
  });
});

describe("PLD: ホーリー系の神聖魔法効果アップとレクイエスカット", () => {
  it("詠唱 1.5 秒のホーリースピリットは、神聖魔法効果アップ中・レクイエスカット中は詠唱なしになる", () => {
    const result = setup(100).resolve(["holy-spirit", ...WS_COMBO, "holy-spirit", "imperator", "holy-spirit"]);
    const [plain, , , , dm, , req] = result.entries;
    expect(plain.castTime).toBe(1.5);
    expect(dm.resolvedSkillId).toBe("holy-spirit-divine-might");
    expect(dm.castTime).toBe(0);
    expect(req.resolvedSkillId).toBe("holy-spirit-requiescat");
    expect(req.castTime).toBe(0);
  });

  it("両方付いているときは神聖魔法効果アップを優先して消費し、レクイエスカットのスタックは減らない", () => {
    const result = setup(100).resolve([...WS_COMBO, "imperator", "holy-spirit", "holy-spirit"]);
    const [, , , , dm, req] = result.entries;
    [dm, req].forEach(expectNoError);
    expect(dm.resolvedSkillId).toBe("holy-spirit-divine-might");
    expect(dm.resolvedPotency).toBe(500);
    expect(hasBuff(dm, "divine-might")).toBe(false);
    expect(stacksOf(dm, "requiescat")).toBe(4);
    expect(req.resolvedSkillId).toBe("holy-spirit-requiescat");
    expect(req.resolvedPotency).toBe(700);
    expect(stacksOf(req, "requiescat")).toBe(3);
  });

  it.each<[PlayerLevel, number, number]>([
    [70, 400, 600],
    [90, 450, 650],
  ])("Lv%i のホーリースピリットは神聖魔法効果アップ中 %i・レクイエスカット中 %i", (level, dmPotency, reqPotency) => {
    const result = setup(level).resolve([...WS_COMBO, "requiescat", "holy-spirit", "holy-spirit"]);
    const [, , , , dm, req] = result.entries;
    [dm, req].forEach(expectNoError);
    expect([dm.resolvedSkillId, req.resolvedSkillId]).toEqual(["holy-spirit-divine-might", "holy-spirit-requiescat"]);
    expect([dm.resolvedPotency, req.resolvedPotency]).toEqual([dmPotency, reqPotency]);
  });

  it("ホーリーサークルも神聖魔法効果アップ中 250・レクイエスカット中 350 になる", () => {
    const result = setup(100).resolve(["total-eclipse", "prominence", "holy-circle", "imperator", "holy-circle"]);
    const [, , dm, , req] = result.entries;
    [dm, req].forEach(expectNoError);
    expect([dm.resolvedSkillId, req.resolvedSkillId]).toEqual(["holy-circle-divine-might", "holy-circle-requiescat"]);
    expect([dm.resolvedPotency, req.resolvedPotency]).toEqual([250, 350]);
    expect(stacksOf(req, "requiescat")).toBe(3);
  });

  it.each<[PlayerLevel, boolean]>([
    [70, false],
    [80, true],
  ])("Lv%i のプロミネンスのコンボで神聖魔法効果アップが付くか: %s（Lv72 特性から）", (level, expected) => {
    const [, prominence] = setup(level).resolve(["total-eclipse", "prominence"]).entries;
    expectNoError(prominence);
    expect(prominence.wsComboError).toBe(false);
    expect(prominence.resolvedPotency).toBe(220);
    expect(hasBuff(prominence, "divine-might")).toBe(expected);
  });
});

describe("PLD: インターヴィーン", () => {
  it("2 チャージあり、3 回目はチャージ切れになる", () => {
    const [i1, i2, i3] = setup(100).resolve(["intervene", "intervene", "intervene"]).entries;
    [i1, i2].forEach(expectNoError);
    expect(i3.recastError).toBe(true);
  });
});
