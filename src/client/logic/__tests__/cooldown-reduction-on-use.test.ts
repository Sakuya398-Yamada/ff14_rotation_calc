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

describe("cooldownEndTime（リキャストのレーンに描く区間の終わり。#898）", () => {
  it("短縮が無ければ、開始 + リキャストで終わる", () => {
    const e = resolve([entry("charged"), entry("charged"), entry("plain"), entry("plain")]);
    expect(e[0].cooldownEndTime).toBe(60);
    expect(e[1].cooldownEndTime).toBe(Math.round((e[1].startTime + 60) * 1000) / 1000);
    // リキャストの無いスキルには付かない
    expect(e[2].cooldownEndTime).toBeUndefined();
  });

  it("短縮は、いちばん早く終わる区間から引く", () => {
    // 次のチャージ（0 秒に使った分）は短縮 2 回で 50 秒に戻る。0.65 秒に使った区間は変わらない
    const e = resolve([entry("charged"), entry("charged"), entry("reducer"), entry("reducer"), entry("charged", 51)]);
    e.forEach(expectNoError);
    expect(e[0].cooldownEndTime).toBe(50);
    expect(e[1].cooldownEndTime).toBe(Math.round((e[1].startTime + 60) * 1000) / 1000);
  });

  it("残りより大きい短縮は、短縮した時刻で区間を終え、余りを次に早く終わる区間から引く", () => {
    // 57 秒の短縮で、0 秒に使った区間（残り 3 秒）は 57 秒で終わり、余りの 2 秒を 0.65 秒に使った区間から引く
    const e = resolve([entry("charged"), entry("charged"), entry("reducer", 57)]);
    e.forEach(expectNoError);
    expect(e[0].cooldownEndTime).toBe(57);
    expect(e[1].cooldownEndTime).toBe(Math.round((e[1].startTime + 60 - 2) * 1000) / 1000);
  });

  it("終わった区間には入らず、まだ走っている区間から引く", () => {
    // 61 秒の時点で 0 秒に使った区間は 60 秒で終わっている。短縮は 30 秒に使った区間（90 秒まで）から引く。
    // 計算では 2 つ目のチャージは 60 + 60 - 5 = 115 秒に戻る。区間は使うたびに描くので一致しない（#924）
    const e = resolve([entry("charged"), entry("charged", 30), entry("reducer", 61)]);
    e.forEach(expectNoError);
    expect(e[0].cooldownEndTime).toBe(60);
    expect(e[1].cooldownEndTime).toBe(85);
  });

  it("エラーで使えなかったエントリには付かない", () => {
    const e = resolve([entry("charged"), entry("charged"), entry("charged")]);
    expect(e[2].recastError).toBe(true);
    expect(e[2].cooldownEndTime).toBeUndefined();
  });
});
