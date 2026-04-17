import { describe, it, expect } from "vitest";
import { computeBuffTimespans } from "../buff-timespans";
import type { ActiveBuff, BuffDefinition, ResolvedTimelineEntry } from "../../types/skill";

const buff30s: BuffDefinition = {
  id: "test-buff",
  name: "テストバフ",
  shortName: "TB",
  icon: "",
  duration: 30,
  effects: [],
  color: "#ff0000",
};

function makeEntry(startTime: number, activeBuffs: ActiveBuff[]): ResolvedTimelineEntry {
  return {
    uid: `e-${startTime}`,
    skillId: "dummy",
    resolvedSkillId: "dummy",
    resolvedPotency: 0,
    startTime,
    resourceSnapshot: {},
    resourceErrors: [],
    comboErrors: [],
    untargetableError: false,
    recastError: false,
    wsComboError: false,
    activeBuffs,
    buffMultiplier: 1,
    critRateBonus: 0,
    dhRateBonus: 0,
  };
}

describe("computeBuffTimespans", () => {
  it("バフ消費前に自然失効ポイントを跨ぐエントリ間ギャップがあってもスパンが30秒を超えない（#159）", () => {
    // aetherhues-3 が t=0 に付与され本来 t=30 で自然失効。
    // t=10 までアクティブ、次のエントリが t=32（自然失効後）でバフが消えている場合、
    // 修正前は span.endTime = 32 となりバーが30秒を超えて描画されていた。
    const ab: ActiveBuff = { buffId: "test-buff", startTime: 0, endTime: 30 };
    const entries: ResolvedTimelineEntry[] = [
      makeEntry(0, [ab]),
      makeEntry(10, [ab]),
      makeEntry(32, []),
    ];

    const spans = computeBuffTimespans(entries, [buff30s]);
    const list = spans.get("test-buff")!;

    expect(list).toHaveLength(1);
    expect(list[0].endTime).toBe(30);
  });

  it("バフ消費が自然失効より前なら、スパンは消費エントリ時刻まで詰められる", () => {
    const ab: ActiveBuff = { buffId: "test-buff", startTime: 0, endTime: 30 };
    const entries: ResolvedTimelineEntry[] = [
      makeEntry(0, [ab]),
      makeEntry(5, [ab]),
      makeEntry(10, []),
    ];

    const spans = computeBuffTimespans(entries, [buff30s]);
    const list = spans.get("test-buff")!;

    expect(list).toHaveLength(1);
    expect(list[0].endTime).toBe(10);
  });

  it("バフがリフレッシュされると startTime 別に独立したスパンとして扱う", () => {
    const first: ActiveBuff = { buffId: "test-buff", startTime: 0, endTime: 30 };
    const refreshed: ActiveBuff = { buffId: "test-buff", startTime: 20, endTime: 50 };
    const entries: ResolvedTimelineEntry[] = [
      makeEntry(0, [first]),
      makeEntry(10, [first]),
      makeEntry(20, [refreshed]),
      makeEntry(45, [refreshed]),
      makeEntry(55, []),
    ];

    const spans = computeBuffTimespans(entries, [buff30s]);
    const list = spans.get("test-buff")!;

    expect(list).toHaveLength(2);
    const oldSpan = list.find((s) => s.startTime === 0)!;
    const newSpan = list.find((s) => s.startTime === 20)!;
    // 旧スパンはリフレッシュ時刻（20）で閉じる
    expect(oldSpan.endTime).toBe(20);
    // 新スパンは自然失効まで保持（次のエントリ 55 に延長されない）
    expect(newSpan.endTime).toBe(50);
  });

  it("スパン調整は resolver スナップショットの ActiveBuff を副作用的に書き換えない", () => {
    const ab: ActiveBuff = { buffId: "test-buff", startTime: 0, endTime: 30 };
    const entries: ResolvedTimelineEntry[] = [
      makeEntry(0, [ab]),
      makeEntry(5, [ab]),
      makeEntry(10, []),
    ];

    computeBuffTimespans(entries, [buff30s]);

    expect(ab.endTime).toBe(30);
  });

  it("最後のエントリまでアクティブなバフは自然失効時刻を維持する", () => {
    const ab: ActiveBuff = { buffId: "test-buff", startTime: 0, endTime: 30 };
    const entries: ResolvedTimelineEntry[] = [
      makeEntry(0, [ab]),
      makeEntry(10, [ab]),
      makeEntry(20, [ab]),
    ];

    const spans = computeBuffTimespans(entries, [buff30s]);
    const list = spans.get("test-buff")!;

    expect(list[0].endTime).toBe(30);
  });
});
