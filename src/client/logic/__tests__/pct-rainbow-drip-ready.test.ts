import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry, ResolvedTimelineEntry } from "../../types/skill";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { PCT_BUFFS } from "../../data/pct-buffs";
import { PCT_RESOURCES } from "../../data/pct-resources";

/**
 * PCT: レインボードリップ効果アップ（rainbow-drip-ready）
 *
 * 公式ジョブガイド（イマジンスカイ）:
 *   「インスタレーションを5スタック全て消費すると自身に『レインボードリップ効果アップ』を付与する。
 *    効果時間：30秒。レインボードリップのリキャストタイムが短縮され、さらに詠唱時間無しで唱えられる」
 * 短縮後のリキャスト値は公式に数値記載が無いため、The Balance の「標準 2.5 秒 GCD 相当」に従う（#349）。
 */

const skillMap = new Map(PCT_ATTACK_SKILLS.map((s) => [s.id, s]));

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function recastOf(entry: ResolvedTimelineEntry): number {
  return Math.round((entry.gcdAvailableAt - entry.startTime) * 1000) / 1000;
}

function hasBuff(entry: ResolvedTimelineEntry, buffId: string): boolean {
  return entry.activeBuffs.some((ab) => ab.buffId === buffId);
}

/** イマジンスカイ（scenic-muse）を発動し、色魔法を count 回撃った後に rainbow-drip を撃つシーケンス */
function burstSequence(aetherhueCount: number): TimelineEntry[] {
  // scape-canvas は initialStacks: 1 のため、ピクトスケープを描かずに scenic-muse を撃てる
  return [
    makeEntry("scenic-muse"),
    ...Array.from({ length: aetherhueCount }, () => makeEntry("fire-in-red")),
    makeEntry("rainbow-drip"),
  ];
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, PCT_RESOURCES, undefined, PCT_BUFFS);
}

describe("PCT: レインボードリップ効果アップ（rainbow-drip-ready）", () => {
  it("イマジンスカイ後、色魔法 5 回でインスタレーションが枯渇し rainbow-drip-ready が付与される", () => {
    const result = resolve(burstSequence(5));
    const [muse, c1, c2, c3, c4, c5] = result.entries;

    // scenic-muse 直後: インスタレーション付与、Ready は未付与
    expect(hasBuff(muse, "installation")).toBe(true);
    expect(hasBuff(muse, "rainbow-drip-ready")).toBe(false);

    // 4 発目まではインスタレーションが残り Ready は付かない
    for (const e of [c1, c2, c3, c4]) {
      expect(e.resourceErrors).toEqual([]);
      expect(hasBuff(e, "installation")).toBe(true);
      expect(hasBuff(e, "rainbow-drip-ready")).toBe(false);
    }

    // 5 発目でインスタレーションが消滅し Ready が付与される
    expect(c5.resourceErrors).toEqual([]);
    expect(hasBuff(c5, "installation")).toBe(false);
    expect(hasBuff(c5, "rainbow-drip-ready")).toBe(true);

    // Ready の効果時間は 30 秒（5 発目の開始時刻起点）
    const ready = c5.activeBuffs.find((ab) => ab.buffId === "rainbow-drip-ready");
    expect(ready?.startTime).toBe(c5.startTime);
    expect(ready?.endTime).toBeCloseTo(c5.startTime + 30, 3);
  });

  it("Ready 中の rainbow-drip は詠唱なし・リキャスト 2.5 秒で解決され、Ready を消費する", () => {
    const result = resolve(burstSequence(5));
    const drip = result.entries[6];

    expect(drip.resolvedSkillId).toBe("rainbow-drip");
    expect(drip.castTime).toBe(0);
    expect(recastOf(drip)).toBe(2.5);
    // instantCast バフとして消費され、実行後の activeBuffs から消える
    expect(hasBuff(drip, "rainbow-drip-ready")).toBe(false);
  });

  it("Ready 消費後の 2 発目の rainbow-drip は通常の 4 秒詠唱・6 秒リキャストに戻る", () => {
    const result = resolve([...burstSequence(5), makeEntry("rainbow-drip")]);
    const second = result.entries[7];

    expect(second.castTime).toBe(4);
    expect(recastOf(second)).toBe(6);
  });

  it("色魔法が 4 回だけでは Ready が付与されず rainbow-drip はフルキャストのまま", () => {
    const result = resolve(burstSequence(4));
    const drip = result.entries[5];

    expect(hasBuff(result.entries[4], "installation")).toBe(true);
    expect(hasBuff(result.entries[4], "rainbow-drip-ready")).toBe(false);
    expect(drip.castTime).toBe(4);
    expect(recastOf(drip)).toBe(6);
  });

  it("イマジンスカイ無しの rainbow-drip は 4 秒詠唱・6 秒リキャスト", () => {
    const result = resolve([makeEntry("rainbow-drip")]);
    const drip = result.entries[0];

    expect(drip.castTime).toBe(4);
    expect(recastOf(drip)).toBe(6);
    expect(hasBuff(drip, "rainbow-drip-ready")).toBe(false);
  });

  it("Ready 中の rainbow-drip のリキャスト短縮はタイムライン終了時刻にも反映される", () => {
    const result = resolve(burstSequence(5));
    const drip = result.entries[6];

    // 最終 GCD のリキャスト完了 = drip.startTime + 2.5（実行後に Ready が消えても 6 秒には戻らない）
    expect(result.timelineEndTime).toBeCloseTo(drip.startTime + 2.5, 3);
  });

  it("迅速魔が先に付いていても Ready 中の rainbow-drip で Ready は必ず消費される", () => {
    const result = resolve([
      makeEntry("swiftcast"),
      makeEntry("scenic-muse"),
      ...Array.from({ length: 5 }, () => makeEntry("fire-in-red")),
      makeEntry("rainbow-drip"),
      makeEntry("rainbow-drip"),
    ]);
    const c5 = result.entries[6];
    const first = result.entries[7];
    const second = result.entries[8];

    // 迅速魔は色魔法（詠唱あり）で先に消費されるので、Ready 付与時点では迅速魔は無い前提を崩さないよう
    // ここでは Ready と迅速魔の併存ではなく「Ready が rainbow-drip で確実に消費される」ことを検証する
    expect(hasBuff(c5, "rainbow-drip-ready")).toBe(true);
    expect(first.castTime).toBe(0);
    expect(hasBuff(first, "rainbow-drip-ready")).toBe(false);
    expect(second.castTime).toBe(4);
    expect(recastOf(second)).toBe(6);
  });

  it("Ready と迅速魔が併存する rainbow-drip では Ready のみ消費され、迅速魔は据え置かれる", () => {
    const result = resolve([
      makeEntry("scenic-muse"),
      ...Array.from({ length: 5 }, () => makeEntry("fire-in-red")),
      makeEntry("swiftcast"),
      makeEntry("rainbow-drip"),
      makeEntry("rainbow-drip"),
    ]);
    const swift = result.entries[6];
    const first = result.entries[7];
    const second = result.entries[8];

    expect(hasBuff(swift, "rainbow-drip-ready")).toBe(true);
    expect(hasBuff(swift, "swiftcast")).toBe(true);
    // 1 発目: Ready により instant + 2.5 秒。Ready は消費され、迅速魔は残る
    expect(first.castTime).toBe(0);
    expect(recastOf(first)).toBe(2.5);
    expect(hasBuff(first, "rainbow-drip-ready")).toBe(false);
    expect(hasBuff(first, "swiftcast")).toBe(true);
    // 2 発目: Ready は無いのでリキャストは 6 秒に戻る（詠唱は残っていた迅速魔で instant 化される）
    expect(second.castTime).toBe(0);
    expect(recastOf(second)).toBe(6);
    expect(hasBuff(second, "swiftcast")).toBe(false);
  });

  it("Ready はレインボードリップ以外の詠唱 GCD では消費されない", () => {
    const result = resolve([
      makeEntry("scenic-muse"),
      ...Array.from({ length: 5 }, () => makeEntry("fire-in-red")),
      makeEntry("fire-in-red"),
      makeEntry("rainbow-drip"),
    ]);
    const sixth = result.entries[6];
    const drip = result.entries[7];

    // 6 発目の色魔法は Ready の対象外（appliesToSkillIds: rainbow-drip 限定）なので詠唱あり・Ready 据え置き
    expect(sixth.castTime).toBeGreaterThan(0);
    expect(hasBuff(sixth, "rainbow-drip-ready")).toBe(true);
    expect(drip.castTime).toBe(0);
    expect(recastOf(drip)).toBe(2.5);
  });
});
