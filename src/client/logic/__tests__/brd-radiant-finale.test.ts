import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { ResolvedTimelineEntry, TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

/*
 * 期待値の出典: 公式ジョブガイド（詩人。Patch 7.5 / 7.55 表記）の PvE 欄
 * - 光神のフィナーレ: 「このアクションの効果量は、自身に付与されている「コーダシンボル」の種類数により変化する。
 *   シンボルが1種類のときの効果量：2％ シンボルが2種類のときの効果量：4％ シンボルが3種類のときの効果量：6％
 *   追加効果：自身に「光神のアンコール実行可」を付与する。」「発動条件：コーダシンボルが1つ以上付与されている」
 * - 光神のアンコール: 「このアクションの威力は、直前に実行した光神のフィナーレにおける「コーダシンボル」の消費数により変化する。
 *   コーダシンボルが1つのとき威力：700 コーダシンボルが2つのとき威力：800 コーダシンボルが3つのとき威力：1100」
 *   「発動条件：「光神のアンコール実行可」効果中」
 */

const skillMap = new Map(BRD_ATTACK_SKILLS.map((s) => [s.id, s]));

const CODA_IDS = ["coda-mages", "coda-armys", "coda-wanderers"] as const;

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

function codaTotal(e: ResolvedTimelineEntry): number {
  return CODA_IDS.reduce((sum, id) => sum + (e.resourceSnapshot[id] ?? 0), 0);
}

function radiantBuffIds(buffs: { buffId: string }[]): string[] {
  return buffs.map((ab) => ab.buffId).filter((id) => id.startsWith("radiant-")).sort();
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBeFalsy();
  expect(e.untargetableError).toBeFalsy();
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

// 歌ごとにコーダが 1 種類付く。最後の歌を旅神のメヌエット（クリティカル発生率だけ）にして、
// 光神のアンコールの buffMultiplier を光神のフィナーレの効果量だけにする（賢人のバラードの与ダメージ 1% は歌の排他で外れる）
const CODA_CASES = [
  { codaCount: 1, songs: ["wanderers-minuet"], damageUp: 1.02, encorePotency: 700 },
  { codaCount: 2, songs: ["mages-ballad", "wanderers-minuet"], damageUp: 1.04, encorePotency: 800 },
  { codaCount: 3, songs: ["mages-ballad", "armys-paeon", "wanderers-minuet"], damageUp: 1.06, encorePotency: 1100 },
] as const;

/** 歌でコーダを付け、光神のフィナーレ → 光神のアンコールの順に使う */
function resolveFinaleThenEncore(songs: readonly string[]) {
  const result = resolve([...songs.map(entry), entry("radiant-finale"), entry("radiant-encore")]);
  const n = songs.length;
  return {
    beforeFinale: result.entries[n - 1],
    finale: result.entries[n],
    encore: result.entries[n + 1],
  };
}

describe("BRD: 光神のフィナーレのコーダ数によるバフ段階と光神のアンコールの段階威力 (#112 / #111)", () => {
  it.each(CODA_CASES)(
    "コーダ $codaCount 種で光神のフィナーレを使うと、$codaCount 段階目のバフが付き、コーダがすべて消費される",
    ({ codaCount, songs }) => {
      const { beforeFinale, finale } = resolveFinaleThenEncore(songs);

      expect(codaTotal(beforeFinale)).toBe(codaCount);

      expectNoError(finale);
      expect(radiantBuffIds(finale.activeBuffs)).toEqual(
        [`radiant-encore-ready-${codaCount}`, `radiant-finale-${codaCount}`].sort(),
      );
      for (const id of CODA_IDS) {
        expect(finale.resourceSnapshot[id]).toBe(0);
      }
    },
  );

  it.each(CODA_CASES)(
    "コーダ $codaCount 種の光神のフィナーレに続く光神のアンコールは威力 $encorePotency で、与ダメージ ×$damageUp が乗り、実行可が消費される",
    ({ codaCount, songs, damageUp, encorePotency }) => {
      const { encore } = resolveFinaleThenEncore(songs);

      expectNoError(encore);
      expect(encore.resolvedPotency).toBe(encorePotency);
      expect(encore.buffMultiplier).toBeCloseTo(damageUp, 10);
      expect(encore.activeBuffsAtUse.map((ab) => ab.buffId)).toContain(`radiant-encore-ready-${codaCount}`);
      expect(radiantBuffIds(encore.activeBuffs)).toEqual([`radiant-finale-${codaCount}`]);
    },
  );

  it("コーダ 0 では光神のフィナーレを使えず（resourceErrors）、バフが付かない", () => {
    const result = resolve([entry("radiant-finale")]);
    const finale = result.entries[0];

    expect(codaTotal(finale)).toBe(0);
    expect(finale.resourceErrors).toContainEqual({ resourceId: "coda-mages", kind: "insufficient" });
    expect(radiantBuffIds(finale.activeBuffs)).toEqual([]);
  });
});
