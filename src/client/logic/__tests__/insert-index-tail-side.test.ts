import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, ActiveBuff, ResolvedTimelineEntry } from "../../types/skill";

/**
 * Issue #190: タイムライン内D&D時、末尾側（C-D 間など）にドラッグしても挿入位置が
 * 1 つ右（D の後）にズレる症状を再現・回帰テストする。
 *
 * Timeline.tsx の calcInsertIndex / visibleEntriesForInsert / insertionResolvedEntries /
 * mapGcdIndexToInsertion の組み合わせをテスト用に抜き出した純粋関数版で検証する。
 */

const PX_PER_SEC = 80;
const LANE_LABEL_WIDTH = 52;

function calcInsertIndex(
  mouseX: number,
  scrollLeft: number,
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>,
  recastFn: (skill: Skill, activeBuffs: ActiveBuff[]) => number,
): number {
  const contentX = mouseX + scrollLeft - LANE_LABEL_WIDTH;
  const time = contentX / PX_PER_SEC;
  if (resolvedEntries.length === 0) return 0;
  for (let i = 0; i < resolvedEntries.length; i++) {
    const entry = resolvedEntries[i];
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;
    const centerTime = entry.startTime + recastFn(skill, entry.activeBuffs) / 2;
    if (time < centerTime) return i;
  }
  return resolvedEntries.length;
}

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

function makeEntry(skillId: string, uid: string): TimelineEntry {
  return { uid, skillId };
}

describe("タイムライン内D&D: 末尾側挿入のインデックス計算 (Issue #190)", () => {
  // A, B, C, D の 4 GCD を 0, 2.5, 5, 7.5s に並べる
  const skillA = makeSkill({ id: "a" });
  const skillB = makeSkill({ id: "b" });
  const skillC = makeSkill({ id: "c" });
  const skillD = makeSkill({ id: "d" });
  const skillMap = new Map<string, Skill>([
    [skillA.id, skillA],
    [skillB.id, skillB],
    [skillC.id, skillC],
    [skillD.id, skillD],
  ]);
  const rawEntries: TimelineEntry[] = [
    makeEntry("a", "ua"),
    makeEntry("b", "ub"),
    makeEntry("c", "uc"),
    makeEntry("d", "ud"),
  ];
  const resolvedAll = resolveTimeline(rawEntries, skillMap, []).entries;

  const getRecast = (skill: Skill, _buffs: ActiveBuff[]) => skill.recastTime;

  function simulateDragB(mouseTime: number) {
    // Timeline.tsx の実装を再現:
    //   visibleEntriesForInsert = resolvedEntries.filter(e.uid !== draggingEntryUid)
    //   insertionResolvedEntries = resolveTimeline(filteredRaw, ...)
    //   GCD 挿入時: calcInsertIndex(visible) → mapGcdIndexToInsertion → insertion の idx
    const draggingUid = "ub";
    const visible = resolvedAll.filter((e) => e.uid !== draggingUid);
    const filteredRaw = rawEntries.filter((e) => e.uid !== draggingUid);
    const insertion = resolveTimeline(filteredRaw, skillMap, []).entries;

    // GCD-only フィルタ（A, C, D はすべて GCD なので同じ）
    const visibleGcd = visible.filter((e) => skillMap.get(e.skillId)?.type === "gcd");
    const insertionGcd = insertion.filter((e) => skillMap.get(e.skillId)?.type === "gcd");

    const mouseX = mouseTime * PX_PER_SEC + LANE_LABEL_WIDTH;
    const scrollLeft = 0;
    const gcdIdx = calcInsertIndex(mouseX, scrollLeft, visibleGcd, skillMap, getRecast);

    // mapGcdIndexToInsertion
    let idx: number;
    if (gcdIdx >= insertionGcd.length) {
      idx = insertion.length;
    } else {
      const target = insertionGcd[gcdIdx];
      idx = insertion.findIndex((e) => e.uid === target.uid);
    }

    const targetUid = idx < insertion.length ? insertion[idx].uid : undefined;
    return { gcdIdx, idx, targetUid, insertion, visible };
  }

  it("A, B, C, D @ 0,2.5,5,7.5 の startTime で解決される", () => {
    expect(resolvedAll.map((e) => e.startTime)).toEqual([0, 2.5, 5, 7.5]);
  });

  it("B を C-D 間の左寄り (time=6.3) にドラッグすると C の直後 = D の前に挿入される", () => {
    // 視覚上 C は x=5-7.5、D は x=7.5-10。C の中央は 6.25、D の中央は 8.75。
    // mouse=6.3 (C の中央をわずかに超えた位置) → 「D の前」が期待値
    const r = simulateDragB(6.3);
    expect(r.targetUid).toBe("ud"); // D の前 = 挿入後の順序 [A, C, B, D]
  });

  it("B を C-D 間の中央 (time=7.0) にドラッグすると D の前に挿入される", () => {
    // mouse=7.0 (C の中央 6.25 と D の中央 8.75 の間) → D の前
    const r = simulateDragB(7.0);
    expect(r.targetUid).toBe("ud");
  });

  it("B を D の左端ちょうど (time=7.5) にドラッグすると D の前に挿入される", () => {
    const r = simulateDragB(7.5);
    expect(r.targetUid).toBe("ud");
  });

  it("B を D の中央を超えた先 (time=8.8) にドラッグすると末尾（D の後）に追加される", () => {
    // D 中央 8.75 を超える → append
    const r = simulateDragB(8.8);
    expect(r.targetUid).toBeUndefined();
  });
});

describe("タイムライン内D&D: oGCD を挟む末尾挿入 (Issue #190)", () => {
  // A_gcd, B_gcd, oG_ogcd, C_gcd, D_gcd の順。B をドラッグして C-D 間を狙う。
  const gcd = (id: string) => makeSkill({ id });
  const ogcd = (id: string) =>
    makeSkill({ id, type: "ogcd", recastTime: 60, animationLock: 0.65 });
  const skillA = gcd("a");
  const skillB = gcd("b");
  const skillOG = ogcd("og");
  const skillC = gcd("c");
  const skillD = gcd("d");
  const skillMap = new Map<string, Skill>([
    [skillA.id, skillA],
    [skillB.id, skillB],
    [skillOG.id, skillOG],
    [skillC.id, skillC],
    [skillD.id, skillD],
  ]);
  const rawEntries: TimelineEntry[] = [
    makeEntry("a", "ua"),
    makeEntry("b", "ub"),
    makeEntry("og", "uog"),
    makeEntry("c", "uc"),
    makeEntry("d", "ud"),
  ];
  const resolvedAll = resolveTimeline(rawEntries, skillMap, []).entries;

  const getRecast = (skill: Skill, _buffs: ActiveBuff[]) => skill.recastTime;

  function simulateDragB(mouseTime: number) {
    const draggingUid = "ub";
    const visible = resolvedAll.filter((e) => e.uid !== draggingUid);
    const filteredRaw = rawEntries.filter((e) => e.uid !== draggingUid);
    const insertion = resolveTimeline(filteredRaw, skillMap, []).entries;
    const visibleGcd = visible.filter((e) => skillMap.get(e.skillId)?.type === "gcd");
    const insertionGcd = insertion.filter((e) => skillMap.get(e.skillId)?.type === "gcd");

    const mouseX = mouseTime * PX_PER_SEC + LANE_LABEL_WIDTH;
    const gcdIdx = calcInsertIndex(mouseX, 0, visibleGcd, skillMap, getRecast);

    let idx: number;
    if (gcdIdx >= insertionGcd.length) {
      idx = insertion.length;
    } else {
      const target = insertionGcd[gcdIdx];
      idx = insertion.findIndex((e) => e.uid === target.uid);
    }
    const targetUid = idx < insertion.length ? insertion[idx].uid : undefined;
    return { gcdIdx, idx, targetUid, insertion, visible };
  }

  it("通常解決で oGCD は B の直後 (3.15s)", () => {
    const og = resolvedAll.find((e) => e.uid === "uog")!;
    expect(og.startTime).toBeCloseTo(3.15, 3);
  });

  it("B を C-D 間 (time=7.0) にドラッグすると D の前に挿入される", () => {
    const r = simulateDragB(7.0);
    expect(r.targetUid).toBe("ud");
  });
});
