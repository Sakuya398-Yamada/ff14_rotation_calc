import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

// #415: 反対属性の MP 0・詠唱半減、ファイガ効果アップ／パラドックス／ブリザド系の MP 消費

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

function resolve(skillIds: string[]) {
  const entries: TimelineEntry[] = skillIds.map((skillId, i) => ({ uid: `entry-${i}`, skillId }));
  return resolveTimeline(entries, skillMap, BLM_RESOURCES, undefined, BLM_BUFFS).entries;
}

function expectNoErrors(entry: ResolvedTimelineEntry) {
  expect(entry.recastError).toBeFalsy();
  expect(entry.untargetableError).toBeFalsy();
  expect(entry.comboErrors).toEqual([]);
  expect(entry.resourceErrors).toEqual([]);
}

describe("BLM: 反対属性の MP 消費 0", () => {
  it("AF3 で MP 0 にした直後のブリザガはリソースエラーにならず、UB3 に切り替わる", () => {
    const [, despair, blizzard3] = resolve(["fire-3", "despair", "blizzard-3"]);
    expect(despair.resourceSnapshot["mp"]).toBe(0);
    expectNoErrors(blizzard3);
    expect(blizzard3.resourceSnapshot["mp"]).toBe(0);
    expect(blizzard3.activeBuffs.some((ab) => ab.buffId === "umbral-ice-3")).toBe(true);
  });

  it("AF/UB 外のブリザド系は基本コストを消費する（ブリザド 400 / ブリザラ 800）", () => {
    const [blizzard] = resolve(["blizzard"]);
    const [blizzard2] = resolve(["blizzard-2"]);
    expect(blizzard.resourceSnapshot["mp"]).toBe(10000 - 400);
    expect(blizzard2.resourceSnapshot["mp"]).toBe(10000 - 800);
  });

  it("UB 中のファイアは MP を消費しない", () => {
    // ブリザド（MP -400、UB1）→ ファイア（UB1 中なので MP 0、AF1 へ）
    const [blizzard, fire] = resolve(["blizzard", "fire"]);
    expectNoErrors(fire);
    expect(blizzard.resourceSnapshot["mp"]).toBe(10000 - 400);
    expect(fire.resourceSnapshot["mp"]).toBe(10000 - 400);
  });
});

describe("BLM: AF3 / UB3 中の反対属性の詠唱半減", () => {
  it("AF3 中のブリザガは詠唱 1.75 秒になる（リキャストは 2.5 秒のまま）", () => {
    const [fire3, blizzard3, fire] = resolve(["fire-3", "blizzard-3", "fire"]);
    expectNoErrors(blizzard3);
    expect(blizzard3.castTime).toBe(1.75);
    expect(blizzard3.startTime - fire3.startTime).toBe(3.5);
    expect(fire.startTime - blizzard3.startTime).toBe(2.5);
  });

  it("AF1 中のブリザガは詠唱が半減しない", () => {
    const [, blizzard3] = resolve(["fire", "blizzard-3"]);
    expect(blizzard3.castTime).toBe(3.5);
  });

  it("UB3 中のファイガは詠唱 1.75 秒になる", () => {
    const [, fire3] = resolve(["blizzard-3", "fire-3"]);
    expectNoErrors(fire3);
    expect(fire3.castTime).toBe(1.75);
  });

  it("UB1 中のファイガは詠唱が半減しない", () => {
    const [, fire3] = resolve(["blizzard", "fire-3"]);
    expect(fire3.castTime).toBe(3.5);
  });
});

describe("BLM: ファイガ効果アップとパラドックスの MP 消費", () => {
  it("AF 中のパラドックスは MP 1600 を消費し、ファイガ効果アップで撃ったファイガは MP もアンブラルハートも消費しない", () => {
    // マナフォント（AF3・UH3・パラドックス付与）→ パラドックス（AF 中: MP -1600、ファイアスターター付与）→ ファイガ
    const [manafont, paradox, fire3] = resolve(["manafont", "paradox", "fire-3"]);
    expect(manafont.resourceSnapshot["mp"]).toBe(10000);
    expectNoErrors(paradox);
    expect(paradox.resourceSnapshot["mp"]).toBe(10000 - 1600);
    expect(paradox.activeBuffs.some((ab) => ab.buffId === "firestarter")).toBe(true);

    expectNoErrors(fire3);
    expect(fire3.castTime).toBe(0);
    expect(fire3.resourceSnapshot["mp"]).toBe(10000 - 1600);
    expect(fire3.resourceSnapshot["umbral-heart"]).toBe(3);
  });

  it("ファイガ効果アップが無い AF 中のファイガは、アンブラルハートを 1 消費して基本コストを払う", () => {
    // 比較用: マナフォント（AF3・UH3）→ ファイガ（UH で倍化を打ち消して MP -2000）
    const [, fire3] = resolve(["manafont", "fire-3"]);
    expect(fire3.resourceSnapshot["mp"]).toBe(10000 - 2000);
    expect(fire3.resourceSnapshot["umbral-heart"]).toBe(2);
  });

  it("UB 中のパラドックスは MP を消費しない", () => {
    // マナフォント（AF3・UH3・パラドックス）→ ファイジャ（UH 消費で MP -800）→ トランス（UB1）→ パラドックス
    const [, fire4, , paradox] = resolve(["manafont", "fire-4", "transpose", "paradox"]);
    expect(fire4.resourceSnapshot["mp"]).toBe(10000 - 800);
    expectNoErrors(paradox);
    expect(paradox.activeBuffs.some((ab) => ab.buffId === "umbral-ice-1")).toBe(true);
    expect(paradox.resourceSnapshot["mp"]).toBe(10000 - 800);
    expect(paradox.resourceSnapshot["paradox-gauge"]).toBe(0);
  });
});
