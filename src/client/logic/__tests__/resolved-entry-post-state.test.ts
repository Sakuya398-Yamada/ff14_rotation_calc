import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, BuffDefinition } from "../../types/skill";

/**
 * Issue #187: D&D挿入予定位置インジケーターが、パレットD&D時とタイムライン内D&D時で一致することを
 * 支える基盤。ResolvedTimelineEntry.{gcdAvailableAt, actionAvailableAt} が
 * resolveTimeline 内部で使う post-entry state と一致し、かつ
 * 「filter後に再 resolve した結果」とも整合することを保証する。
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

function makeEntry(skillId: string, uid?: string): TimelineEntry {
  return { uid: uid ?? `${skillId}-${Math.random()}`, skillId };
}

const trueThrust = makeSkill({ id: "true-thrust" });
const disembowel = makeSkill({ id: "disembowel" });
const chaoticSpring = makeSkill({ id: "chaotic-spring" });
const lifeSurge = makeSkill({ id: "life-surge", type: "ogcd", recastTime: 45, animationLock: 0.6 });
const allSkills = new Map([trueThrust, disembowel, chaoticSpring, lifeSurge].map((s) => [s.id, s]));

describe("ResolvedTimelineEntry post-entry state (Issue #187)", () => {
  it("GCD エントリの gcdAvailableAt / actionAvailableAt が次エントリの startTime と整合する", () => {
    const entries: TimelineEntry[] = [
      makeEntry("true-thrust", "a"),
      makeEntry("disembowel", "b"),
      makeEntry("chaotic-spring", "c"),
    ];
    const result = resolveTimeline(entries, allSkills, []);
    expect(result.entries).toHaveLength(3);

    // GCD → GCD: 次のGCDは max(gcdAvailableAt, actionAvailableAt) から開始
    for (let i = 1; i < result.entries.length; i++) {
      const prev = result.entries[i - 1];
      const cur = result.entries[i];
      const expected = Math.round(Math.max(prev.gcdAvailableAt, prev.actionAvailableAt) * 1000) / 1000;
      expect(cur.startTime).toBeCloseTo(expected, 6);
    }
  });

  it("oGCD エントリは gcdAvailableAt を引き継ぎ、actionAvailableAt のみ進む", () => {
    const entries: TimelineEntry[] = [
      makeEntry("true-thrust", "a"),
      makeEntry("life-surge", "b"),
      makeEntry("disembowel", "c"),
    ];
    const result = resolveTimeline(entries, allSkills, []);
    const [gcd1, ogcd, gcd2] = result.entries;

    // oGCD 後も gcdAvailableAt は GCD1 由来の値（2.5s）のまま
    expect(ogcd.gcdAvailableAt).toBeCloseTo(gcd1.gcdAvailableAt, 6);
    // actionAvailableAt は oGCD 硬直後
    expect(ogcd.actionAvailableAt).toBeCloseTo(ogcd.startTime + 0.6, 6);
    // 次のGCD（gcd2）は max(gcdAvailableAt, actionAvailableAt) から開始
    const expected = Math.round(Math.max(ogcd.gcdAvailableAt, ogcd.actionAvailableAt) * 1000) / 1000;
    expect(gcd2.startTime).toBeCloseTo(expected, 6);
  });

  it("エントリを除外して re-resolve した結果が、D&Dインジケーター算出の基準として機能する", () => {
    // 3エントリのうち中央を除いて再計算した場合、残る2エントリ目の startTime は
    // 1エントリ目の post-entry state に基づき算出される。
    const entries: TimelineEntry[] = [
      makeEntry("true-thrust", "a"),
      makeEntry("disembowel", "b"),
      makeEntry("chaotic-spring", "c"),
    ];
    const full = resolveTimeline(entries, allSkills, []);

    const filtered = entries.filter((e) => e.uid !== "b");
    const refiltered = resolveTimeline(filtered, allSkills, []);
    expect(refiltered.entries).toHaveLength(2);

    // filtered 版で 2 番目（chaotic-spring）の startTime は 1 番目（true-thrust）の
    // post-entry gcdAvailableAt / actionAvailableAt の max と一致する必要がある。
    const prev = refiltered.entries[0];
    const cur = refiltered.entries[1];
    const expected = Math.round(Math.max(prev.gcdAvailableAt, prev.actionAvailableAt) * 1000) / 1000;
    expect(cur.startTime).toBeCloseTo(expected, 6);

    // 追加: filtered 版の true-thrust の post-state は full 版の同エントリの post-state と一致する
    // （先頭は除外対象の影響を受けない）。
    expect(refiltered.entries[0].gcdAvailableAt).toBeCloseTo(full.entries[0].gcdAvailableAt, 6);
    expect(refiltered.entries[0].actionAvailableAt).toBeCloseTo(full.entries[0].actionAvailableAt, 6);
  });
});
