import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry } from "../../types/skill";

/**
 * Issue #175: タイムライン上のスキル開始時刻をマニュアル設定できる。
 *
 * 仕様（候補A: 強制上書き）:
 * - entry.manualStartTime が設定されていれば、自動計算値を無視してその時刻を採用する
 * - リキャスト中・ボス離脱中等の制約違反は recastError / untargetableError として
 *   検出されるが、配置自体はブロックせずユーザー判断を尊重する（警告のみ）
 * - autoStartTime には自動計算した場合の時刻が保持される（UI 表示用）
 * - 後続エントリは manualStartTime ベースで再計算される
 */

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
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

const gcdA = makeSkill({ id: "gcd-a" });
const gcdB = makeSkill({ id: "gcd-b" });
const gcdC = makeSkill({ id: "gcd-c" });
const ogcdX = makeSkill({ id: "ogcd-x", type: "ogcd", recastTime: 45, animationLock: 0.6 });
const skillMap = new Map([gcdA, gcdB, gcdC, ogcdX].map((s) => [s.id, s]));

describe("manualStartTime (Issue #175)", () => {
  it("manualStartTime 未設定なら従来通り自動計算で動作する（回帰なし）", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" },
      { uid: "b", skillId: "gcd-b" },
    ];
    const result = resolveTimeline(entries, skillMap, []);
    expect(result.entries[0].startTime).toBeCloseTo(0, 6);
    expect(result.entries[1].startTime).toBeCloseTo(2.5, 6);
    // autoStartTime は startTime と同値
    expect(result.entries[0].autoStartTime).toBeCloseTo(0, 6);
    expect(result.entries[1].autoStartTime).toBeCloseTo(2.5, 6);
    expect(result.entries[0].manualStartTime).toBeUndefined();
    expect(result.entries[1].manualStartTime).toBeUndefined();
  });

  it("manualStartTime が自動計算値より遅い場合（ディレイ）、その時刻が startTime として採用される", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" },
      { uid: "b", skillId: "gcd-b", manualStartTime: 5.0 }, // 自動なら 2.5s だが 5.0s にディレイ
    ];
    const result = resolveTimeline(entries, skillMap, []);
    expect(result.entries[1].startTime).toBeCloseTo(5.0, 6);
    expect(result.entries[1].autoStartTime).toBeCloseTo(2.5, 6);
    expect(result.entries[1].manualStartTime).toBeCloseTo(5.0, 6);
    // ディレイなのでリキャストエラーにはならない
    expect(result.entries[1].recastError).toBe(false);
  });

  it("manualStartTime が自動計算値より早い場合（リキャスト中）、配置は尊重しつつ recastError で警告する", () => {
    const skillWithCooldown = makeSkill({
      id: "skill-cd",
      cooldown: 60,
      maxCharges: 1,
    });
    const map = new Map([skillWithCooldown].map((s) => [s.id, s]));
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "skill-cd" },
      // 自動なら 60s 後にしか撃てないが、マニュアルで 3s に強制配置
      { uid: "b", skillId: "skill-cd", manualStartTime: 3.0 },
    ];
    const result = resolveTimeline(entries, map, []);
    expect(result.entries[1].startTime).toBeCloseTo(3.0, 6);
    // リキャスト中エラーが立つが、配置自体は尊重される
    expect(result.entries[1].recastError).toBe(true);
  });

  it("cooldown を持たない GCD でも、manualStartTime が自動計算値より早ければ recastError を立てる", () => {
    // Issue #175 フィードバック対応: グレアガ→ディアを 1.0s に手動配置すると
    // 自動 2.5s に対して GCD リキャスト中の強制配置になるが、現状警告が出なかった問題。
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" },
      { uid: "b", skillId: "gcd-b", manualStartTime: 1.0 }, // 自動 2.5s に対し 1.0s に前倒し
    ];
    const result = resolveTimeline(entries, skillMap, []);
    expect(result.entries[1].startTime).toBeCloseTo(1.0, 6);
    expect(result.entries[1].autoStartTime).toBeCloseTo(2.5, 6);
    expect(result.entries[1].recastError).toBe(true);
  });

  it("manualStartTime == autoStartTime（境界）では recastError を立てない", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" },
      { uid: "b", skillId: "gcd-b", manualStartTime: 2.5 }, // 自動値と同じ
    ];
    const result = resolveTimeline(entries, skillMap, []);
    expect(result.entries[1].startTime).toBeCloseTo(2.5, 6);
    expect(result.entries[1].recastError).toBe(false);
  });

  it("oGCD でも manualStartTime が自動計算値より早ければ recastError を立てる（アニメロック中）", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" }, // アニメロック 0.65s
      { uid: "x", skillId: "ogcd-x", manualStartTime: 0.3 }, // 自動 0.65s に対し 0.3s に前倒し
    ];
    const result = resolveTimeline(entries, skillMap, []);
    expect(result.entries[1].startTime).toBeCloseTo(0.3, 6);
    expect(result.entries[1].autoStartTime).toBeCloseTo(0.65, 6);
    expect(result.entries[1].recastError).toBe(true);
  });

  it("マニュアル設定された後続エントリは、マニュアル時刻を基準に再計算される", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" },
      { uid: "b", skillId: "gcd-b", manualStartTime: 5.0 },
      { uid: "c", skillId: "gcd-c" }, // 自動: b の startTime + 2.5s = 7.5s
    ];
    const result = resolveTimeline(entries, skillMap, []);
    expect(result.entries[1].startTime).toBeCloseTo(5.0, 6);
    expect(result.entries[2].startTime).toBeCloseTo(7.5, 6);
    expect(result.entries[2].autoStartTime).toBeCloseTo(7.5, 6);
  });

  it("oGCD エントリも manualStartTime を尊重する", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" },
      { uid: "x", skillId: "ogcd-x", manualStartTime: 1.0 },
    ];
    const result = resolveTimeline(entries, skillMap, []);
    expect(result.entries[1].startTime).toBeCloseTo(1.0, 6);
    expect(result.entries[1].autoStartTime).toBeCloseTo(0.65, 6); // gcdA の animationLock 直後
  });

  it("manualStartTime は 0.01 秒刻みで丸められる（呼び出し側が事前丸めしていない場合でも整合）", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a", manualStartTime: 1.234567 },
    ];
    const result = resolveTimeline(entries, skillMap, []);
    // resolve-timeline.ts 側で Math.round(* 1000) / 1000 にしている（0.001 刻み）。
    // UI 側 (0.01 刻み) で先に丸められていれば余分な桁は無い前提だが、
    // resolveTimeline 単体ではミリ秒精度に正規化する。
    expect(result.entries[0].startTime).toBeCloseTo(1.235, 3);
  });

  it("manualStartTime が undefined のエントリは startTime === autoStartTime になる", () => {
    const entries: TimelineEntry[] = [
      { uid: "a", skillId: "gcd-a" },
      { uid: "b", skillId: "gcd-b" },
    ];
    const result = resolveTimeline(entries, skillMap, []);
    for (const e of result.entries) {
      expect(e.startTime).toBeCloseTo(e.autoStartTime, 6);
    }
  });
});
