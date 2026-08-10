import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";
import { WHM_BUFFS } from "../../data/whm-buffs";
import { WHM_RESOURCES } from "../../data/whm-resources";

const skillMap = new Map(WHM_ATTACK_SKILLS.map((s) => [s.id, s]));

const LILY_INTERVAL = 20;
const LILY_MAX = 3;

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, WHM_RESOURCES, undefined, WHM_BUFFS);
}

function glares(count: number): TimelineEntry[] {
  return Array.from({ length: count }, () => entry("glare3"));
}

describe("WHM: ヒーリングリリーの自動生成 (#322)", () => {
  it("リソース定義: 最大3・初期3・20秒ごとに自動生成", () => {
    const lily = WHM_RESOURCES.find((r) => r.id === "healing-lily");
    expect(lily).toBeDefined();
    expect(lily!.maxStacks).toBe(LILY_MAX);
    expect(lily!.initialStacks).toBe(LILY_MAX);
    expect(lily!.autoGenerateInterval).toBe(LILY_INTERVAL);
  });

  it("初期満タン（3/3）の間は時間が経過しても増えない（上限キャップ）", () => {
    const result = resolve(glares(12));

    for (const e of result.entries) {
      expect(e.resourceSnapshot["healing-lily"]).toBe(LILY_MAX);
    }
  });

  it("ソラスで消費すると、消費時刻から20秒ごとに再生成される", () => {
    // 消費前が満タンだとタイマーが停止したままなので、先に消費してから観測する
    const result = resolve([entry("heart-of-solace"), ...glares(12)]);

    // resourceSnapshot は消費適用後の値のため、ソラス自身のエントリで既に 2
    expect(result.entries[0].resourceSnapshot["healing-lily"]).toBe(LILY_MAX - 1);

    // タイマーは消費が発生したソラスの startTime から再始動する
    const timerStart = result.entries[0].startTime;

    for (const e of result.entries.slice(1)) {
      const ticks = Math.floor((e.startTime - timerStart) / LILY_INTERVAL);
      const expected = Math.min(LILY_MAX, LILY_MAX - 1 + ticks);
      expect(e.resourceSnapshot["healing-lily"]).toBe(expected);
    }

    // 12 GCD（30秒超）経過で 1 tick 以上発生し、満タンに戻っているはず
    const last = result.entries[result.entries.length - 1];
    expect(last.startTime - timerStart).toBeGreaterThan(LILY_INTERVAL);
    expect(last.resourceSnapshot["healing-lily"]).toBe(LILY_MAX);
  });

  it("3連続で消費すると 0 になり、その後も上限3を超えて生成されない", () => {
    const result = resolve([
      entry("heart-of-solace"),
      entry("heart-of-rapture"),
      entry("heart-of-solace"),
      ...glares(20),
    ]);

    // 3連続消費直後の snapshot は 0
    expect(result.entries[3].resourceSnapshot["healing-lily"]).toBe(0);

    for (const e of result.entries) {
      expect(e.resourceSnapshot["healing-lily"]).toBeLessThanOrEqual(LILY_MAX);
    }
  });
});

describe("WHM: ブラッドリリーの蓄積とハート・オブ・ミゼリ (#322)", () => {
  it("リソース定義: 最大3・初期0・自動生成なし", () => {
    const blood = WHM_RESOURCES.find((r) => r.id === "blood-lily");
    expect(blood).toBeDefined();
    expect(blood!.maxStacks).toBe(LILY_MAX);
    expect(blood!.initialStacks).toBeUndefined();
    expect(blood!.autoGenerateInterval).toBeUndefined();
  });

  it.each(["heart-of-solace", "heart-of-rapture"])(
    "%s でヒーリングリリー -1 / ブラッドリリー +1",
    (skillId) => {
      const result = resolve([entry(skillId), entry("glare3")]);

      const after = result.entries[1].resourceSnapshot;
      expect(after["healing-lily"]).toBe(LILY_MAX - 1);
      expect(after["blood-lily"]).toBe(1);
    }
  );

  it("ソラス／ラプチャーを3回使うとブラッドリリーが3まで蓄積する", () => {
    const result = resolve([
      entry("heart-of-solace"),
      entry("heart-of-rapture"),
      entry("heart-of-solace"),
      entry("glare3"),
    ]);

    expect(result.entries[3].resourceSnapshot["blood-lily"]).toBe(3);
  });

  it("ブラッドリリー3未満ではミゼリが使用できない（resourceErrors）", () => {
    const result = resolve([entry("heart-of-solace"), entry("heart-of-misery")]);

    const misery = result.entries[1];
    expect(misery.resourceErrors).toContain("blood-lily");
    // エラー時はリソース変動が適用されず、蓄積分は残ったまま
    expect(misery.resourceSnapshot["blood-lily"]).toBe(1);
  });

  it("ブラッドリリー3でミゼリが使用でき、威力1240で全量消費する", () => {
    const result = resolve([
      entry("heart-of-solace"),
      entry("heart-of-rapture"),
      entry("heart-of-solace"),
      entry("heart-of-misery"),
      entry("glare3"),
    ]);

    const misery = result.entries[3];
    expect(misery.resourceErrors).toHaveLength(0);
    expect(misery.resolvedPotency).toBe(1240);
    // snapshot は消費適用後の値。ミゼリ自身のエントリで全量消費済み
    expect(misery.resourceSnapshot["blood-lily"]).toBe(0);
    expect(result.entries[4].resourceSnapshot["blood-lily"]).toBe(0);
  });
});
