import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { ResolvedTimelineEntry, Skill, TimelineEntry } from "../../types/skill";

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: "",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

// 2 チャージ・60 秒の oGCD と、使うとそのリキャストを 5 秒縮める GCD（戦士のウォークライとフェルクリーヴの形）
const charged = makeSkill({ id: "charged", type: "ogcd", recastTime: 0.65, cooldown: 60, maxCharges: 2 });
const reducer = makeSkill({ id: "reducer", cooldownReductionsOnUse: [{ chargeKey: "charged", seconds: 5 }] });
const plain = makeSkill({ id: "plain" });
const skillMap = new Map([charged, reducer, plain].map((s) => [s.id, s]));

const resolve = (entries: TimelineEntry[]) => resolveTimeline(entries, skillMap, [], undefined, []).entries;

describe("cooldownReductionsOnUse（使ったときに別スキルのリキャストを縮める）", () => {
  it("2 チャージを使い切ったあと、短縮するスキルを 4 回使うと、次のチャージが 20 秒早く戻る", () => {
    const prefix = [entry("charged"), entry("charged")];
    // 次のチャージは最初の使用（0 秒）から 60 秒後。4 回の短縮で 40 秒になる
    const reduced = resolve([...prefix, entry("reducer"), entry("reducer"), entry("reducer"), entry("reducer"), entry("charged", 41)]);
    expectNoError(reduced[6]);

    // 短縮しないスキルでは 41 秒にはまだチャージが無い
    const control = resolve([...prefix, entry("plain"), entry("plain"), entry("plain"), entry("plain"), entry("charged", 41)]);
    expect(control[6].recastError).toBe(true);
  });

  it("チャージが満タンのときの短縮は持ち越さない", () => {
    // 先に 2 回短縮してから 2 チャージを使い切ると、次のチャージは最初に使った時刻（2.5 秒より後）から 60 秒後のまま
    const e = resolve([entry("reducer"), entry("reducer"), entry("charged"), entry("charged"), entry("charged", 60)]);
    expect(e[2].startTime).toBeGreaterThan(2.5);
    expect(e[4].recastError).toBe(true);
  });
});
