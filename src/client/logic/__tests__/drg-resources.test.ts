import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { DRG_ATTACK_SKILLS } from "../../data/drg-skills";
import { DRG_BUFFS } from "../../data/drg-buffs";
import { DRG_RESOURCES } from "../../data/drg-resources";

const skillMap = new Map(DRG_ATTACK_SKILLS.map((s) => [s.id, s]));

const FOCUS = "firstminds-focus";
const FOCUS_MAX = 2;

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(skillIds: string[]) {
  return resolveTimeline(skillIds.map(entry), skillMap, DRG_RESOURCES, undefined, DRG_BUFFS);
}

// 雲蒸竜変で竜眼を得て、トゥルースラストが竜眼雷電に自動変化する（天竜眼 +1）
const FIRST_RAIDEN = ["true-thrust", "vorpal-thrust", "full-thrust", "fang-and-claw", "drakesbane", "true-thrust"];
// 2 周目以降は竜眼雷電からコンボを繋ぐ
const NEXT_RAIDEN = ["vorpal-thrust", "full-thrust", "fang-and-claw", "drakesbane", "true-thrust"];
// コェルトリンクトーメントで竜眼を得て、ドゥームスパイクが竜眼蒼穹に自動変化する（天竜眼 +1）
const DRACONIAN_FURY = ["doom-spike", "sonic-thrust", "coerthan-torment", "doom-spike"];

describe("DRG: 天竜眼（firstminds-focus）の蓄積 (#351)", () => {
  it("リソース定義: 最大2・初期0", () => {
    const focus = DRG_RESOURCES.find((r) => r.id === FOCUS);
    expect(focus).toBeDefined();
    expect(focus!.maxStacks).toBe(FOCUS_MAX);
    expect(focus!.initialStacks).toBeUndefined();

    const result = resolve(["true-thrust"]);
    expect(result.entries[0].resourceSnapshot[FOCUS]).toBe(0);
  });

  it("竜眼雷電の使用で +1 される", () => {
    const result = resolve(FIRST_RAIDEN);
    const before = result.entries[4];
    const raiden = result.entries[5];

    expect(raiden.resolvedSkillId).toBe("raiden-thrust");
    expect(raiden.comboErrors).toHaveLength(0);
    expect(before.resourceSnapshot[FOCUS]).toBe(0);
    expect(raiden.resourceSnapshot[FOCUS]).toBe(1);
  });

  it("竜眼蒼穹の使用で +1 される", () => {
    const result = resolve(DRACONIAN_FURY);
    const before = result.entries[2];
    const fury = result.entries[3];

    expect(fury.resolvedSkillId).toBe("draconian-fury");
    expect(fury.comboErrors).toHaveLength(0);
    expect(before.resourceSnapshot[FOCUS]).toBe(0);
    expect(fury.resourceSnapshot[FOCUS]).toBe(1);
  });

  it("竜眼雷電 → 竜眼蒼穹のように種類が混在しても加算される", () => {
    const result = resolve([...FIRST_RAIDEN, ...DRACONIAN_FURY]);
    const last = result.entries[result.entries.length - 1];

    expect(last.resolvedSkillId).toBe("draconian-fury");
    expect(last.resourceSnapshot[FOCUS]).toBe(2);
  });

  it("上限2に達した後の竜眼雷電では増えない（上限キャップ）", () => {
    const result = resolve([...FIRST_RAIDEN, ...NEXT_RAIDEN, ...NEXT_RAIDEN]);
    const raidens = result.entries.filter((e) => e.resolvedSkillId === "raiden-thrust");

    expect(raidens).toHaveLength(3);
    expect(raidens.map((e) => e.comboErrors)).toEqual([[], [], []]);
    expect(raidens.map((e) => e.resourceSnapshot[FOCUS])).toEqual([1, FOCUS_MAX, FOCUS_MAX]);
  });
});

describe("DRG: 天竜点睛による天竜眼の消費 (#351)", () => {
  it.each([
    ["0", [] as string[]],
    ["1", FIRST_RAIDEN],
  ])("天竜眼 %s では使用できず、天竜眼も減らない", (_label, prefix) => {
    const result = resolve([...prefix, "wyrmwind-thrust"]);
    const wyrmwind = result.entries[result.entries.length - 1];
    const before = prefix.length > 0 ? result.entries[prefix.length - 1].resourceSnapshot[FOCUS] : 0;

    expect(wyrmwind.resourceErrors).toContain(FOCUS);
    expect(wyrmwind.resourceSnapshot[FOCUS]).toBe(before);
  });

  it("天竜眼 2 で使用でき、2 消費して 0 になる", () => {
    const prefix = [...FIRST_RAIDEN, ...NEXT_RAIDEN];
    const result = resolve([...prefix, "wyrmwind-thrust"]);
    const before = result.entries[prefix.length - 1];
    const wyrmwind = result.entries[prefix.length];

    expect(before.resourceSnapshot[FOCUS]).toBe(FOCUS_MAX);
    expect(wyrmwind.resourceErrors).toHaveLength(0);
    expect(wyrmwind.recastError).toBeFalsy();
    expect(wyrmwind.resourceSnapshot[FOCUS]).toBe(0);
  });

  it("消費後は再び 2 溜めるまで使用できない", () => {
    const result = resolve([
      ...FIRST_RAIDEN,
      ...NEXT_RAIDEN,
      "wyrmwind-thrust",
      ...NEXT_RAIDEN,
      "wyrmwind-thrust",
    ]);
    const wyrmwinds = result.entries.filter((e) => e.skillId === "wyrmwind-thrust");

    expect(wyrmwinds[0].resourceErrors).toHaveLength(0);
    expect(wyrmwinds[1].recastError).toBeFalsy();
    expect(wyrmwinds[1].resourceErrors).toContain(FOCUS);
    expect(wyrmwinds[1].resourceSnapshot[FOCUS]).toBe(1);
  });
});

describe("DRG: ランスチャージの威力倍率と効果時間 (#351)", () => {
  const lanceCharge = DRG_BUFFS.find((b) => b.id === "lance-charge")!;
  const multiplier = lanceCharge.effects.find((e) => e.type === "potency")!.value;
  const trueThrustPotency = skillMap.get("true-thrust")!.potency;

  it("バフ定義: 威力 1.1 倍・効果時間 20 秒", () => {
    expect(multiplier).toBe(1.1);
    expect(lanceCharge.duration).toBe(20);
  });

  it("効果時間中のスキルに 1.1 倍が乗り、20 秒経過後は乗らない", () => {
    // 竜槍等の他の威力バフが付かないよう、コンボを持たないトゥルースラストだけを並べる
    const result = resolve(["lance-charge", ...Array<string>(10).fill("true-thrust")]);
    const lanceEntry = result.entries[0];
    const expiresAt = lanceEntry.startTime + lanceCharge.duration!;
    const thrusts = result.entries.slice(1);

    const inside = thrusts.filter((e) => e.startTime < expiresAt);
    const outside = thrusts.filter((e) => e.startTime >= expiresAt);
    expect(inside.length).toBeGreaterThan(0);
    expect(outside.length).toBeGreaterThan(0);

    for (const e of inside) {
      expect(e.activeBuffsAtUse.some((ab) => ab.buffId === "lance-charge")).toBe(true);
      expect(e.buffMultiplier).toBeCloseTo(multiplier, 5);
      expect(Math.floor(e.resolvedPotency * e.buffMultiplier)).toBe(Math.floor(trueThrustPotency * multiplier));
    }
    for (const e of outside) {
      expect(e.activeBuffs.some((ab) => ab.buffId === "lance-charge")).toBe(false);
      expect(e.buffMultiplier).toBe(1);
      expect(e.resolvedPotency).toBe(trueThrustPotency);
    }
  });

  it("竜槍と同時に有効なときは乗算される", () => {
    // 竜槍（power-surge）はディセムボウルのコンボで付与される
    const result = resolve(["true-thrust", "disembowel", "lance-charge", "chaos-thrust"]);
    const chaos = result.entries[3];
    const powerSurge = DRG_BUFFS.find((b) => b.id === "power-surge")!;
    const powerSurgeMultiplier = powerSurge.effects.find((e) => e.type === "potency")!.value;

    expect(chaos.comboErrors).toHaveLength(0);
    expect(chaos.buffMultiplier).toBeCloseTo(multiplier * powerSurgeMultiplier, 5);
  });
});
