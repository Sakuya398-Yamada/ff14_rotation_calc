import { describe, it, expect } from "vitest";
import { resolveTimeline, getEffectiveMaxStacks } from "../resolve-timeline";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../skill-level";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

const LEVEL = 100;
const BASE_GCD = 2.5;

function buildSkillMap() {
  const buffIds = new Set(BRD_BUFFS.map((b) => b.id));
  const resourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
  const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, LEVEL, buffIds, resourceIds);
  return getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, LEVEL, buffIds, resourceIds);
}

const skillMap = buildSkillMap();

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

function burstShots(count: number): TimelineEntry[] {
  return Array.from({ length: count }, () => entry("burst-shot"));
}

describe("BRD: 軍神のパイオン中の詩心最大 4 とヘイスト (#419)", () => {
  it("軍神のパイオン中は詩心が 4 まで蓄積する", () => {
    const result = resolve([entry("armys-paeon"), ...burstShots(10)]);
    const stacks = result.entries.map((e) => e.resourceSnapshot["repertoire"]);
    expect(Math.max(...stacks)).toBe(4);
  });

  it("旅神のメヌエット中は詩心の上限が 3", () => {
    const result = resolve([entry("wanderers-minuet"), ...burstShots(10)]);
    const stacks = result.entries.map((e) => e.resourceSnapshot["repertoire"]);
    expect(Math.max(...stacks)).toBe(3);
  });

  it("軍神のパイオン中は詩心 1 つにつき GCD が 4% 短くなり、詩心 4 で 2.1 秒になる", () => {
    const result = resolve([entry("armys-paeon"), ...burstShots(10)]);
    const gcds = result.entries.slice(1);
    const gaps = gcds.slice(0, -1).map((e, i) => ({
      stacks: e.resourceSnapshot["repertoire"],
      gap: Math.round((gcds[i + 1].startTime - e.startTime) * 1000) / 1000,
    }));
    for (const { stacks, gap } of gaps) {
      expect(gap).toBe(Math.round(BASE_GCD * (1 - 0.04 * stacks) * 1000) / 1000);
    }
    expect(gaps.some((g) => g.stacks === 4 && g.gap === 2.1)).toBe(true);
    expect(gaps.some((g) => g.stacks === 0 && g.gap === BASE_GCD)).toBe(true);
  });

  it("旅神のメヌエット中は詩心があっても GCD は短くならない", () => {
    const result = resolve([entry("wanderers-minuet"), ...burstShots(10)]);
    const gcds = result.entries.slice(1);
    expect(gcds.some((e) => e.resourceSnapshot["repertoire"] === 3)).toBe(true);
    for (let i = 0; i < gcds.length - 1; i++) {
      expect(Math.round((gcds[i + 1].startTime - gcds[i].startTime) * 1000) / 1000).toBe(BASE_GCD);
    }
  });
});

describe("BRD: 賢人のバラード中の詩心付与でブラッドレッター系のリキャストが 7.5 秒短縮される (#419)", () => {
  // 歌 → ハートブレイクショット 3 回でチャージを使い切り、最後のハートブレイクショットを指定時刻に置く。
  // 詩心の自動生成は歌の実行時刻から 3.75 秒ごと（#524）
  function chargesUsedUp(song: string) {
    return [entry(song), entry("heartbreak-shot"), entry("heartbreak-shot"), entry("heartbreak-shot")];
  }
  const { entries: base } = resolve(chargesUsedUp("mages-ballad"));
  const songTime = base[0].startTime;
  const firstUse = base[1].startTime;

  it("詩心の付与 2 回で、15 秒のリキャストが 1 チャージ分回復する", () => {
    // 付与は songTime + 3.75 と songTime + 7.5。7.5 秒 × 2 回の短縮で、firstUse に使ったチャージが 2 回目の付与で戻る
    const before = resolve([...chargesUsedUp("mages-ballad"), entry("heartbreak-shot", songTime + 7.4)]);
    expect(before.entries[4].recastError).toBe(true);

    const after = resolve([...chargesUsedUp("mages-ballad"), entry("heartbreak-shot", songTime + 7.5)]);
    expect(after.entries[4].recastError).toBe(false);
  });

  it("旅神のメヌエット中は短縮されず、15 秒後まで回復しない", () => {
    const before = resolve([...chargesUsedUp("wanderers-minuet"), entry("heartbreak-shot", firstUse + 14.9)]);
    expect(before.entries[4].recastError).toBe(true);

    const after = resolve([...chargesUsedUp("wanderers-minuet"), entry("heartbreak-shot", firstUse + 15)]);
    expect(after.entries[4].recastError).toBe(false);
  });

  it("詩心が 0 のままでも、3.75 秒ごとの付与のたびに短縮される", () => {
    // 付与は songTime + 3.75 × k。バラード中は詩心が溜まらない（上限 0）が、付与のたびに短縮が続く
    const t = songTime + 3.75 * 6;
    const used = [
      entry("mages-ballad"),
      entry("heartbreak-shot"),
      entry("heartbreak-shot"),
      entry("heartbreak-shot"),
      entry("heartbreak-shot", t),
      entry("heartbreak-shot"),
      entry("heartbreak-shot"),
      entry("heartbreak-shot"),
    ];
    const r = resolve(used);
    expect(r.entries[4].resourceSnapshot["repertoire"]).toBe(0);
    // 付与 6 回分のソウルボイス
    expect(r.entries[4].resourceSnapshot["soul-voice"]).toBe(30);
    // t までに付与 6 回 = 45 秒短縮。15 秒 × 3 チャージ分を回復しきっている
    expect(r.entries.slice(4, 7).every((e) => !e.recastError)).toBe(true);
    // 4 回目はアニメーションロック後すぐで次の付与が無いため、チャージ切れ
    expect(r.entries[7].recastError).toBe(true);
  });

  it("エンピリアルアローによる詩心付与でも短縮される", () => {
    const withArrow = [...chargesUsedUp("mages-ballad"), entry("empyreal-arrow")];
    const arrow = resolve(withArrow).entries[4];
    // 詩心は増えない（上限 0）が、付与は起きている
    expect(arrow.resourceSnapshot["repertoire"]).toBe(0);
    const t = arrow.startTime;
    // 自動生成の付与（songTime + 3.75）とエンピリアルアローの付与で 15 秒短縮 → songTime + 3.75 時点で回復済み
    expect(t).toBeLessThan(songTime + 3.75);
    const result = resolve([...withArrow, entry("heartbreak-shot", songTime + 3.8)]);
    expect(result.entries[5].recastError).toBe(false);

    const noArrow = resolve([...chargesUsedUp("mages-ballad"), entry("heartbreak-shot", songTime + 3.8)]);
    expect(noArrow.entries[4].recastError).toBe(true);
  });
});

describe("BRD: 詩心の上限は歌ごとに決まり、賢人のバラード中と歌なしでは溜まらない (#631)", () => {
  const repertoire = BRD_RESOURCES.find((r) => r.id === "repertoire")!;

  it("賢人のバラード中はウェポンスキルを並べても詩心が 0 のまま", () => {
    const result = resolve([entry("mages-ballad"), ...burstShots(10)]);
    for (const e of result.entries) {
      expect(e.resourceErrors).toEqual([]);
      expect(e.resourceSnapshot["repertoire"]).toBe(0);
    }
    // 付与そのものは起きている（ソウルボイスは付与のたびに +5）
    expect(result.entries[result.entries.length - 1].resourceSnapshot["soul-voice"]).toBeGreaterThan(0);
  });

  it("各時点の実効上限は、歌なし 0・メヌエット 3・パイオン 4・バラード 0、歌が切れると 0", () => {
    const songs = resolve([entry("burst-shot"), entry("wanderers-minuet"), entry("armys-paeon"), entry("mages-ballad")]);
    expect(songs.entries.map((e) => getEffectiveMaxStacks(repertoire, e.activeBuffs))).toEqual([0, 3, 4, 0]);

    const expired = resolve([entry("wanderers-minuet"), entry("burst-shot", 50)]);
    expect(expired.entries.map((e) => getEffectiveMaxStacks(repertoire, e.activeBuffs))).toEqual([3, 0]);
  });
});

describe("BRD: 歌が上書き・時間切れで終わると詩心が 0 になる (#511)", () => {
  it("軍神のパイオンで詩心 4 にしてから旅神のメヌエットを実行すると、詩心は 0 から溜め直しになる", () => {
    const result = resolve([
      entry("armys-paeon"),
      ...burstShots(10),
      entry("wanderers-minuet"),
      entry("pitch-perfect"),
    ]);
    const entries = result.entries;
    const minuet = entries[11];
    const pitch = entries[12];

    expect(entries[10].resourceSnapshot["repertoire"]).toBe(4);
    expect(minuet.resourceSnapshot["repertoire"]).toBe(0);
    // パイオンの詩心 4 は引き継がれず、メヌエット直後のピッチパーフェクトは詩心不足
    expect(pitch.comboErrors).toEqual([]);
    expect(pitch.resourceErrors).toContain("repertoire");
  });

  it("上書き後のメヌエットで溜め直した詩心は上限 3 で、ピッチパーフェクトは 3 を消費する", () => {
    const result = resolve([
      entry("armys-paeon"),
      ...burstShots(10),
      entry("wanderers-minuet"),
      ...burstShots(8),
      entry("pitch-perfect"),
    ]);
    const entries = result.entries;
    const pitch = entries[entries.length - 1];
    const afterMinuet = entries.slice(11, -1).map((e) => e.resourceSnapshot["repertoire"]);

    expect(afterMinuet[0]).toBe(0);
    expect(Math.max(...afterMinuet)).toBe(3);
    expect(pitch.resourceErrors).toEqual([]);
    expect(pitch.resolvedPotency).toBe(360);
  });

  // 賢人のバラード中は詩心が溜まらない（#631）
  it.each(["armys-paeon", "wanderers-minuet"])(
    "%s が時間切れで終わると詩心が 0 になる",
    (song) => {
      const result = resolve([entry(song), ...burstShots(25)]);
      const songEnd = result.entries[0].startTime + 45;
      const during = result.entries.filter((e) => e.startTime < songEnd);
      const after = result.entries.filter((e) => e.startTime >= songEnd);

      expect(during[during.length - 1].resourceSnapshot["repertoire"]).toBeGreaterThan(0);
      expect(after.length).toBeGreaterThan(0);
      for (const e of after) expect(e.resourceSnapshot["repertoire"]).toBe(0);
    },
  );
});

describe("BRD: 詩心・ソウルボイスの自動付与は歌の実行時刻から数え、歌の終了時刻までを数える (#524)", () => {
  const SONGS = ["mages-ballad", "armys-paeon", "wanderers-minuet"];

  // 賢人のバラード中は詩心が溜まらない（#631）ので、付与の時刻はソウルボイスで見る
  it.each([["mages-ballad", 0], ["armys-paeon", 1], ["wanderers-minuet", 1]] as const)(
    "%s の実行から 3.75 秒後に最初の付与（詩心 +%s・ソウルボイス +5）",
    (song, repertoireGain) => {
      // 次のエントリを付与の直前・直後に置く。付与の時刻が次のエントリの時刻に引きずられないことを見る
      const before = resolve([entry(song), entry("burst-shot", 3.7)]).entries[1];
      expect(before.resourceSnapshot["repertoire"]).toBe(0);
      expect(before.resourceSnapshot["soul-voice"]).toBe(0);

      const after = resolve([entry(song), entry("burst-shot", 3.75)]).entries[1];
      expect(after.resourceSnapshot["repertoire"]).toBe(repertoireGain);
      expect(after.resourceSnapshot["soul-voice"]).toBe(5);
    },
  );

  it("歌を別の歌で上書きすると、上書きした歌の実行時刻から数え直す", () => {
    // 軍神のパイオンの付与は 3.75 × k（11.25 秒にも来る）。10 秒で上書きしたメヌエットの最初の付与は 13.75 秒
    const overwrite = (t: number) =>
      resolve([
        entry("armys-paeon"),
        entry("burst-shot"),
        entry("burst-shot"),
        entry("wanderers-minuet", 10),
        entry("burst-shot", t),
      ]).entries;

    const before = overwrite(13.7);
    expect(before[3].resolvedSkillId).toBe("wanderers-minuet");
    expect(before[4].recastError).toBe(false);
    expect(before[4].resourceSnapshot["repertoire"]).toBe(0);

    const after = overwrite(13.75);
    expect(after[4].recastError).toBe(false);
    expect(after[4].resourceSnapshot["repertoire"]).toBe(1);
  });

  // 0.13 秒開始は、3.75 を丸めずに足し続けると 12 回目が終了時刻 45.13 の手前に寄る
  it.each(SONGS.flatMap((song) => [[song, 0], [song, 0.13]] as const))(
    "%s を %s 秒に実行して、エントリの間で時間切れになっても、終了時刻の手前までの付与を数える",
    (song, songTime) => {
      // 歌の効果 45 秒で 3.75 秒ごとに 11 回（終了時刻ちょうどの 12 回目は数えない）。ソウルボイスは歌が終わっても残る
      const after = resolve([entry(song, songTime), entry("burst-shot", 50)]).entries[1];
      expect(after.activeBuffs.some((ab) => ab.buffId === song)).toBe(false);
      expect(after.resourceSnapshot["soul-voice"]).toBe(55);
    },
  );

  it("賢人のバラードが切れる前の付与はリキャストを短縮し、終了時刻ちょうどの付与は短縮しない", () => {
    // 39 秒からチャージを使い切ると次の回復は 54 秒。41.25 秒の付与で 46.5 秒に早まる。45 秒（終了時刻）の付与は数えない
    const withNext = (t: number) =>
      resolve([
        entry("mages-ballad"),
        entry("heartbreak-shot", 39),
        entry("heartbreak-shot"),
        entry("heartbreak-shot"),
        entry("heartbreak-shot", t),
      ]).entries;

    const before = withNext(46.4);
    expect(before.slice(1, 4).every((e) => !e.recastError)).toBe(true);
    expect(before[3].startTime).toBeLessThan(41.25);
    expect(before[4].recastError).toBe(true);

    const after = withNext(46.5);
    expect(after[4].activeBuffs.some((ab) => ab.buffId === "mages-ballad")).toBe(false);
    expect(after[4].recastError).toBe(false);
  });
});

describe("BRD: 詩心・ソウルボイスが上限に達したあと消費しても、付与は歌の実行時刻からの刻みで続く (#557)", () => {
  it("メヌエット中に詩心 3 でピッチパーフェクトを撃っても、次の付与は歌の実行時刻からの 15 秒", () => {
    // 付与は 3.75 × k。11.25 秒で詩心 3（上限）になり、12.2 秒のピッチパーフェクトで 0 に戻る
    const withNext = (t: number) =>
      resolve([
        entry("wanderers-minuet", 0),
        entry("burst-shot", 11.5),
        entry("pitch-perfect", 12.2),
        entry("burst-shot", t),
      ]).entries;

    const before = withNext(14.9);
    expect(before[1].resourceSnapshot["repertoire"]).toBe(3);
    expect(before[2].resourceErrors).toEqual([]);
    expect(before[2].recastError).toBe(false);
    expect(before[2].resolvedPotency).toBe(360);
    expect(before[2].resourceSnapshot["repertoire"]).toBe(0);
    expect(before[3].recastError).toBe(false);
    expect(before[3].resourceSnapshot["repertoire"]).toBe(0);

    const after = withNext(15.2);
    expect(after[3].recastError).toBe(false);
    expect(after[3].resourceSnapshot["repertoire"]).toBe(1);
  });

  it("ソウルボイス 100 でエイペックスアローを撃っても、次の付与は歌の実行時刻からの刻み", () => {
    // バラードの 10 回で 50、40 秒の軍神のパイオンから 3.75 秒ごとに 10 回で 77.5 秒に 100（上限）。
    // 78 秒のエイペックスアローで 0 に戻り、次の付与はパイオンの実行時刻から 11 回目の 81.25 秒
    const withNext = (t: number) =>
      resolve([
        entry("mages-ballad", 0),
        entry("armys-paeon", 40),
        entry("apex-arrow", 78),
        entry("burst-shot", t),
      ]).entries;

    const before = withNext(81.2);
    expect(before[2].resourceErrors).toEqual([]);
    expect(before[2].resolvedPotency).toBe(700);
    expect(before[2].resourceSnapshot["soul-voice"]).toBe(0);
    expect(before[3].recastError).toBe(false);
    expect(before[3].resourceSnapshot["soul-voice"]).toBe(0);

    const after = withNext(81.25);
    expect(after[3].recastError).toBe(false);
    expect(after[3].resourceSnapshot["soul-voice"]).toBe(5);
  });
});
