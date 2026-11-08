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
// 1 チャージ・60 秒の oGCD と、そのリキャストを 5 秒縮める GCD
const single = makeSkill({ id: "single", type: "ogcd", recastTime: 0.65, cooldown: 60 });
const singleReducer = makeSkill({ id: "single-reducer", cooldownReductionsOnUse: [{ chargeKey: "single", seconds: 5 }] });
const skillMap = new Map([charged, reducer, plain, single, singleReducer].map((s) => [s.id, s]));

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
  it("短縮が無ければ、1 本目は開始 + リキャストで、続けて使った 2 本目は 1 本目のチャージが戻ってからリキャスト分で終わる", () => {
    const e = resolve([entry("charged"), entry("charged"), entry("plain"), entry("plain")]);
    expect(e[0].cooldownEndTime).toBe(60);
    expect(e[1].cooldownEndTime).toBe(120);
    // リキャストの無いスキルには付かない
    expect(e[2].cooldownEndTime).toBeUndefined();
  });

  it("短縮は次に戻るチャージ（いちばん古い区間）に効き、後のチャージはそこからリキャスト分で戻る", () => {
    // 次のチャージ（0 秒に使った分）は短縮 2 回で 50 秒に戻り、0.65 秒に使った分は 110 秒、51 秒に使った分は 170 秒に戻る
    const e = resolve([entry("charged"), entry("charged"), entry("reducer"), entry("reducer"), entry("charged", 51)]);
    e.forEach(expectNoError);
    expect(e[0].cooldownEndTime).toBe(50);
    expect(e[1].cooldownEndTime).toBe(110);
    expect(e[4].cooldownEndTime).toBe(170);
  });

  it("残りより大きい短縮は、短縮した時刻で区間を終え、余りは次のチャージの戻りを早める", () => {
    // 57 秒の短縮で、0 秒に使った区間（残り 3 秒）は 57 秒で終わる。計算のタイマーは 55 秒に戻った扱いで次を数えるので、
    // 0.65 秒に使った分は 55 + 60 = 115 秒に戻る
    const e = resolve([entry("charged"), entry("charged"), entry("reducer", 57)]);
    e.forEach(expectNoError);
    expect(e[0].cooldownEndTime).toBe(57);
    expect(e[1].cooldownEndTime).toBe(115);
  });

  it("終わった区間には入らず、まだ走っている区間に効く", () => {
    // 61 秒の時点で 0 秒に使った区間は 60 秒で終わっている。30 秒に使った分は 60 秒から数え、短縮で 60 + 60 - 5 = 115 秒に戻る
    const e = resolve([entry("charged"), entry("charged", 30), entry("reducer", 61)]);
    e.forEach(expectNoError);
    expect(e[0].cooldownEndTime).toBe(60);
    expect(e[1].cooldownEndTime).toBe(115);
  });

  it("エラーで使えなかったエントリには付かない", () => {
    const e = resolve([entry("charged"), entry("charged"), entry("charged")]);
    expect(e[2].recastError).toBe(true);
    expect(e[2].cooldownEndTime).toBeUndefined();
  });

  it("続けて使ったチャージの区間は、計算でそのチャージが戻る時刻で終わる（#924）", () => {
    // 計算はチャージを 1 本のタイマーで順番に戻す: 60 秒に 1 つ戻り、次は 120 秒、その次は 180 秒
    const e = resolve([entry("charged"), entry("charged"), entry("charged", 61), entry("charged", 62)]);
    [e[0], e[1], e[2]].forEach(expectNoError);
    expect(e[3].recastError).toBe(true);
    expect(e[0].cooldownEndTime).toBe(60);
    expect(e[1].cooldownEndTime).toBe(120);
    expect(e[2].cooldownEndTime).toBe(180);
    // 62 秒の時点で走っている区間（使用中のチャージ）は 2 本
    expect(e.filter((x) => x.startTime <= 62 && (x.cooldownEndTime ?? 0) > 62)).toHaveLength(2);
  });

  it("1 チャージのスキルは、使った時刻 + リキャストで終わり、残りより大きい短縮は短縮した時刻で終える", () => {
    const e = resolve([entry("single"), entry("single-reducer", 57), entry("single", 60)]);
    e.forEach(expectNoError);
    expect(e[0].cooldownEndTime).toBe(57);
    expect(e[2].cooldownEndTime).toBe(120);
  });
});
