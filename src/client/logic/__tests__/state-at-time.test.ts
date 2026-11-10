import { describe, it, expect } from "vitest";
import { getEffectiveMaxStacks, resolveStateAt, resolveTimeline } from "../resolve-timeline";
import { buildCooldownSpans, getRecastStatesAt } from "../recast-state";
import { getAllSkillMapForLevel, getBuffsForLevel, getResourcesForLevel, getSkillsForLevel } from "../skill-level";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";
import { WHM_BUFFS } from "../../data/whm-buffs";
import { WHM_RESOURCES } from "../../data/whm-resources";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import { GNB_ATTACK_SKILLS } from "../../data/gnb-skills";
import { GNB_BUFFS } from "../../data/gnb-buffs";
import { GNB_RESOURCES } from "../../data/gnb-resources";
import type {
  BuffDefinition,
  PlayerLevel,
  ResourceDefinition,
  Skill,
  TimelineEntry,
  TimelineStateAt,
} from "../../types/skill";

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

/** App と同じく getSkillsForLevel → getAllSkillMapForLevel でスキルマップを作る（testing-conventions 罠4） */
function setup(
  jobSkills: Skill[],
  jobBuffs: BuffDefinition[],
  jobResources: ResourceDefinition[],
  level: PlayerLevel,
  hitDelays?: Record<string, number>,
) {
  const buffs = getBuffsForLevel(jobBuffs, level);
  const resources = getResourcesForLevel(jobResources, level);
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skills = getSkillsForLevel(jobSkills, level, buffIds, resourceIds);
  const skillMap = getAllSkillMapForLevel(jobSkills, skills, level, buffIds, resourceIds);
  return {
    skillMap,
    resources,
    resolve: (entries: TimelineEntry[]) =>
      resolveTimeline(entries, skillMap, resources, undefined, buffs, undefined, undefined, hitDelays),
    stateAt: (entries: TimelineEntry[], time: number) =>
      resolveStateAt(entries, skillMap, resources, undefined, buffs, undefined, undefined, hitDelays, time),
  };
}

const whm = setup(WHM_ATTACK_SKILLS, WHM_BUFFS, WHM_RESOURCES, 100);
const brd = setup(BRD_ATTACK_SKILLS, BRD_BUFFS, BRD_RESOURCES, 100);

const resourceAt = (state: TimelineStateAt, resourceId: string) => {
  const r = state.resources.find((s) => s.resourceId === resourceId);
  if (!r) throw new Error(`resource ${resourceId} not found`);
  return r;
};

const repeat = (skillId: string, count: number) => Array.from({ length: count }, () => entry(skillId));

describe("resolveStateAt: 時刻 t のリソース（#1000）", () => {
  it("エントリの間の時刻でも、自動生成で増えた値が返る（白魔道士のヒーリングリリー）", () => {
    // GCD は 2.5 秒刻みなので、ソラスの次の GCD を自動の 5 秒より遅い 6 秒に置き、20 秒後に増える時刻を GCD の開始時刻からずらす
    const entries = [entry("glare3"), entry("heart-of-solace"), entry("glare3", 6), ...repeat("glare3", 10)];
    const e = whm.resolve(entries).entries;
    e.forEach((x) => expect(x.recastError).toBe(false));
    // ソラスで 1 つ使い、使った時刻から 20 秒ごとに増える
    expect(e[1].resourceSnapshot["healing-lily"]).toBe(2);
    const tick = e[1].startTime + 20;

    // 増える直前のエントリのマーカーは 2 のまま。その後ろ、次のエントリより前の時刻で 3 になっている
    const before = e.filter((x) => x.startTime <= tick + 0.1).at(-1)!;
    expect(before.startTime).toBeLessThan(tick);
    expect(before.resourceSnapshot["healing-lily"]).toBe(2);

    expect(resourceAt(whm.stateAt(entries, tick - 0.1), "healing-lily")).toEqual({ resourceId: "healing-lily", value: 2, maxStacks: 3 });
    expect(resourceAt(whm.stateAt(entries, tick + 0.1), "healing-lily")).toEqual({ resourceId: "healing-lily", value: 3, maxStacks: 3 });
  });

  it("最後のエントリより後の時刻でも、自動生成を進めた値が返る", () => {
    const entries = [entry("heart-of-solace")];
    const [solace] = whm.resolve(entries).entries;
    expect(resourceAt(whm.stateAt(entries, solace.startTime + 19.9), "healing-lily").value).toBe(2);
    expect(resourceAt(whm.stateAt(entries, solace.startTime + 20), "healing-lily").value).toBe(3);
  });

  it("歌が時間切れになった後は、吟遊詩人の詩心が 0 になり、上限も 0 になる", () => {
    const entries = [entry("wanderers-minuet"), ...repeat("burst-shot", 22)];
    const e = brd.resolve(entries).entries;
    const songEnd = e[0].startTime + 45;

    // 時間切れの直前のエントリのマーカーは 3（メヌエット中の上限）のまま
    const before = e.filter((x) => x.startTime <= songEnd + 0.3).at(-1)!;
    expect(before.startTime).toBeLessThan(songEnd);
    expect(before.resourceSnapshot["repertoire"]).toBe(3);

    expect(resourceAt(brd.stateAt(entries, songEnd - 0.3), "repertoire")).toEqual({ resourceId: "repertoire", value: 3, maxStacks: 3 });
    expect(resourceAt(brd.stateAt(entries, songEnd + 0.3), "repertoire")).toEqual({ resourceId: "repertoire", value: 0, maxStacks: 0 });
  });

  it("上限は、その時刻の歌に合わせる（軍神のパイオン中は 4）", () => {
    const entries = [entry("armys-paeon"), ...repeat("burst-shot", 6)];
    const [paeon] = brd.resolve(entries).entries;
    expect(resourceAt(brd.stateAt(entries, paeon.startTime + 10), "repertoire").maxStacks).toBe(4);
  });

  const jobs = [
    {
      name: "吟遊詩人（歌の切り替え・ピッチパーフェクト・エイペックスアロー）",
      job: brd,
      skillIds: [
        "wanderers-minuet", "burst-shot", "heartbreak-shot", "burst-shot", "empyreal-arrow", "burst-shot", "pitch-perfect",
        ...Array.from({ length: 14 }, (_, i) => (i % 3 === 0 ? "refulgent-arrow" : "burst-shot")),
        "pitch-perfect", "mages-ballad", "burst-shot", "heartbreak-shot", "burst-shot", "heartbreak-shot",
        ...Array.from({ length: 16 }, () => "burst-shot"),
        "armys-paeon", "burst-shot", "burst-shot", "apex-arrow", "burst-shot",
      ],
    },
    {
      name: "白魔道士（リリーの消費と自動生成）",
      job: whm,
      skillIds: ["glare3", "heart-of-solace", "glare3", "heart-of-solace", ...Array.from({ length: 20 }, () => "glare3"), "heart-of-solace", "glare3"],
    },
    {
      name: "侍（黙想の付与）",
      job: setup(SAM_ATTACK_SKILLS, SAM_BUFFS, SAM_RESOURCES, 100),
      skillIds: ["gyofu", "meditate", "gyofu", "gyofu", "shifu", "gyofu", "meditate", "gyofu"],
    },
    {
      name: "ガンブレイカー（着弾を待っているブラッドフェストで上限が上がる。#948）",
      job: setup(GNB_ATTACK_SKILLS, GNB_BUFFS, GNB_RESOURCES, 100, { bloodfest: 0.8 }),
      skillIds: ["keen-edge", "brutal-shell", "solid-barrel", "bloodfest", "burst-strike", "burst-strike", "gnashing-fang", "keen-edge"],
    },
  ];

  it.each(jobs)("t ちょうどに実行するエントリがあるときは、実行した後の値と、リソースレーンと同じ上限が返る: $name", ({ job, skillIds }) => {
    const entries = skillIds.map((id) => entry(id));
    const e = job.resolve(entries).entries;
    expect(e).toHaveLength(entries.length);
    let checked = 0;
    for (const [i, x] of e.entries()) {
      // 同じ時刻のエントリが続くときは、最後のエントリの後の値になる
      if (e[i + 1]?.startTime === x.startTime) continue;
      const state = job.stateAt(entries, x.startTime);
      // リソースレーン（ResourceLanes.tsx の getMarkers）と同じく、着弾を待っているバフも上限に入れる
      const capBuffs = [
        ...x.activeBuffs,
        ...(x.pendingBuffIds ?? []).map((buffId) => ({ buffId, startTime: x.startTime, endTime: x.startTime })),
      ];
      expect(state.resources).toEqual(job.resources.map((r) => ({
        resourceId: r.id,
        value: x.resourceSnapshot[r.id] ?? 0,
        maxStacks: getEffectiveMaxStacks(r, capBuffs),
      })));
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("着弾を待っているバフで上がった上限が返る（ガンブレイカーのブラッドフェスト）", () => {
    const gnb = jobs[3].job;
    const entries = ["keen-edge", "brutal-shell", "bloodfest"].map((id) => entry(id));
    const e = gnb.resolve(entries).entries;
    expect(e[2].pendingBuffIds).toContain("bloodfest");
    expect(resourceAt(gnb.stateAt(entries, e[2].startTime + 0.1), "cartridge").maxStacks).toBe(6);
  });

  it("着弾が t より前の付与は、t の状態に入る（着弾の遅れを付けた賢人のバラードでメヌエットが上書きされ、詩心が消える。#948）", () => {
    const delayed = setup(BRD_ATTACK_SKILLS, BRD_BUFFS, BRD_RESOURCES, 100, { "mages-ballad": 1 });
    const entries = [entry("wanderers-minuet"), ...repeat("burst-shot", 5), entry("mages-ballad")];
    const e = delayed.resolve(entries).entries;
    const ballad = e.at(-1)!;
    // バラードを実行した時点では、まだメヌエット中で詩心が残っている（着弾までの 0.5 秒に判定は無い）
    expect(ballad.pendingBuffIds).toContain("mages-ballad");
    const before = ballad.resourceSnapshot["repertoire"];
    expect(before).toBeGreaterThan(0);
    expect(resourceAt(delayed.stateAt(entries, ballad.startTime + 0.5), "repertoire")).toEqual({ resourceId: "repertoire", value: before, maxStacks: 3 });
    expect(resourceAt(delayed.stateAt(entries, ballad.startTime + 1.5), "repertoire")).toEqual({ resourceId: "repertoire", value: 0, maxStacks: 0 });
  });

  it("手動の開始時刻で時刻が逆戻りしたエントリは入らないが、リキャストエラーで効果が無いので値は変わらない（既知の制限）", () => {
    // 30 秒に置いた GCD の後ろに、5 秒に置いたソラスを並べる。自動の開始時刻より早いのでリキャストエラーになり、リリーを使わない
    const entries = [entry("glare3"), entry("glare3", 30), entry("heart-of-solace", 5)];
    const e = whm.resolve(entries).entries;
    expect(e[2].startTime).toBe(5);
    expect(e[2].recastError).toBe(true);
    expect(e[2].resourceSnapshot["healing-lily"]).toBe(3);
    expect(resourceAt(whm.stateAt(entries, 10), "healing-lily").value).toBe(3);
  });
});

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

// 1 チャージ・60 秒の oGCD / 2 チャージ・60 秒の oGCD と、使うとそれを 5 秒縮める GCD（戦士のウォークライとフェルクリーヴの形） /
// 3 チャージ・15 秒でリキャストを共有する 2 つの oGCD（吟遊詩人のブラッドレッターとレイン・オブ・デスの形）
const single = makeSkill({ id: "single", type: "ogcd", recastTime: 0.65, cooldown: 60 });
const charged = makeSkill({ id: "charged", type: "ogcd", recastTime: 0.65, cooldown: 60, maxCharges: 2 });
const reducer = makeSkill({ id: "reducer", cooldownReductionsOnUse: [{ chargeKey: "charged", seconds: 5 }] });
const groupA = makeSkill({ id: "group-a", type: "ogcd", recastTime: 0.65, cooldown: 15, maxCharges: 3, cooldownGroup: "group" });
const groupB = makeSkill({ id: "group-b", type: "ogcd", recastTime: 0.65, cooldown: 15, maxCharges: 3, cooldownGroup: "group" });
const plain = makeSkill({ id: "plain" });
const syntheticMap = new Map([single, charged, reducer, groupA, groupB, plain].map((s) => [s.id, s]));

function recastAt(skillMap: Map<string, Skill>, resolve: (entries: TimelineEntry[]) => ReturnType<typeof resolveTimeline>,
  stateAt: (entries: TimelineEntry[], time: number) => TimelineStateAt, entries: TimelineEntry[], time: number) {
  return getRecastStatesAt(stateAt(entries, time), resolve(entries).entries, skillMap);
}

const synthetic = {
  resolve: (entries: TimelineEntry[]) => resolveTimeline(entries, syntheticMap, [], undefined, []),
  stateAt: (entries: TimelineEntry[], time: number) => resolveStateAt(entries, syntheticMap, [], undefined, [], undefined, undefined, undefined, time),
};
const syntheticRecastAt = (entries: TimelineEntry[], time: number) =>
  recastAt(syntheticMap, synthetic.resolve, synthetic.stateAt, entries, time);
const brdRecastAt = (entries: TimelineEntry[], time: number) => recastAt(brd.skillMap, brd.resolve, brd.stateAt, entries, time);

describe("getRecastStatesAt: 時刻 t のリキャスト（#1000）", () => {
  it("区間の中は残り秒数と実際に戻る時刻、区間の外は使用可能で残り 0（1 チャージ）。t ちょうどに使ったときは使った後", () => {
    const entries = [entry("single"), ...repeat("plain", 3)];
    expect(syntheticRecastAt(entries, 0)).toEqual([{ skillId: "single", available: false, remaining: 60, actualEndTime: 60 }]);
    expect(syntheticRecastAt(entries, 30)).toEqual([{ skillId: "single", available: false, remaining: 30, actualEndTime: 60 }]);
    expect(syntheticRecastAt(entries, 60)).toEqual([{ skillId: "single", available: true, remaining: 0 }]);
  });

  it("t より後に初めて使うスキルも、レーンと同じく並び、使用可能になる", () => {
    const entries = [entry("plain"), entry("single", 10)];
    expect(syntheticRecastAt(entries, 5)).toEqual([{ skillId: "single", available: true, remaining: 0 }]);
  });

  it("エラーで使えなかったスキルは、レーンと同じく並ばない", () => {
    // 2 回目は 1 回目のリキャスト中なのでエラー。1 回目だけがレーンの区間になる
    const entries = [entry("single"), entry("plain"), entry("single")];
    const e = synthetic.resolve(entries).entries;
    expect(e[2].recastError).toBe(true);
    expect([...buildCooldownSpans(e, syntheticMap).keys()]).toEqual(["single"]);
    expect(syntheticRecastAt(entries, 10).map((s) => s.skillId)).toEqual(["single"]);
  });

  it.each([
    {
      name: "リキャストを共有するスキル（グループ全体で数える）",
      entries: () => [entry("group-a"), entry("group-a"), entry("group-b"), ...repeat("plain", 6), entry("group-b"), ...repeat("plain", 6)],
      skillIds: ["group-a", "group-b"],
      until: 60,
    },
    {
      name: "使ったときのリキャスト短縮（#898）を受けた区間",
      entries: () => [entry("charged"), entry("charged"), entry("reducer"), entry("reducer"), entry("charged", 51)],
      skillIds: ["charged"],
      until: 180,
    },
  ])("チャージ式の残りチャージ数・実際に戻る時刻が、レーンの区間と合う: $name", ({ entries: makeEntries, skillIds, until }) => {
    const entries = makeEntries();
    const e = synthetic.resolve(entries).entries;
    e.forEach((x) => expect(x.recastError).toBe(false));
    const spans = buildCooldownSpans(e, syntheticMap);
    expect([...spans.keys()]).toEqual(skillIds);
    const groupSpans = skillIds.flatMap((id) => spans.get(id)!);
    for (let t = 0; t <= until; t += 0.25) {
      const covering = groupSpans.filter((s) => s.startTime <= t && t < s.endTime);
      const maxCharges = syntheticMap.get(skillIds[0])!.maxCharges!;
      const states = syntheticRecastAt(entries, t);
      expect(states.map((s) => s.skillId)).toEqual(skillIds);
      for (const s of states) {
        expect(s.charges, `t=${t}`).toBe(maxCharges - covering.length);
        expect(s.maxCharges).toBe(maxCharges);
        expect(s.available).toBe(covering.length < maxCharges);
        expect(s.actualEndTime, `t=${t}`).toBe(covering.length > 0 ? Math.min(...covering.map((c) => c.endTime)) : undefined);
      }
    }
  });

  it("チャージが残っているときは使用可能で、残り秒数は次のチャージが戻るまで。満タンなら 0", () => {
    const entries = [entry("charged"), ...repeat("plain", 3)];
    expect(syntheticRecastAt(entries, 10)).toEqual([
      { skillId: "charged", available: true, remaining: 50, actualEndTime: 60, charges: 1, maxCharges: 2 },
    ]);
    expect(syntheticRecastAt(entries, 60)).toEqual([{ skillId: "charged", available: true, remaining: 0, charges: 2, maxCharges: 2 }]);
  });

  it("チャージを使い切ると使用不可で、残り秒数は次のチャージが戻るまで", () => {
    const entries = [entry("charged"), entry("charged"), ...repeat("plain", 3)];
    expect(syntheticRecastAt(entries, 10)).toEqual([
      { skillId: "charged", available: false, remaining: 50, actualEndTime: 60, charges: 0, maxCharges: 2 },
    ]);
  });

  it("残り秒数は、t までに使った短縮だけを反映する", () => {
    // 短縮するスキルを使う前は 60 秒に戻る残り。使った後は 5 秒縮む
    const entries = [entry("charged"), entry("charged"), entry("plain"), entry("reducer"), ...repeat("plain", 3)];
    const e = synthetic.resolve(entries).entries;
    const reducedAt = e[3].startTime;
    expect(e[0].cooldownEndTime).toBe(55);
    expect(syntheticRecastAt(entries, reducedAt - 0.1)[0]).toMatchObject({ remaining: Math.round((60 - reducedAt + 0.1) * 1000) / 1000, actualEndTime: 55 });
    expect(syntheticRecastAt(entries, reducedAt)[0]).toMatchObject({ remaining: Math.round((55 - reducedAt) * 1000) / 1000, actualEndTime: 55 });
  });

  it("賢人のバラード中に使ったハートブレイクショットの残り秒数は、t までの詩心の付与による短縮だけを反映する", () => {
    const entries = [entry("mages-ballad"), entry("heartbreak-shot"), ...repeat("burst-shot", 8)];
    const e = brd.resolve(entries).entries;
    const ballad = e[0].startTime;
    const used = e[1].startTime;
    // 歌の 3 秒・6 秒の判定で詩心が付き、それぞれ 7.5 秒縮む。6 秒の時点で 15 秒分縮み、チャージが戻る
    expect(e[1].cooldownEndTime).toBe(ballad + 6);
    const at = (t: number) => brdRecastAt(entries, t).find((s) => s.skillId === "heartbreak-shot")!;

    // 3 秒の付与より前: 短縮はまだ入らない
    expect(at(ballad + 2)).toEqual({
      skillId: "heartbreak-shot", available: true, remaining: Math.round((used + 15 - ballad - 2) * 1000) / 1000,
      actualEndTime: ballad + 6, charges: 2, maxCharges: 3,
    });
    // 3 秒の付与の後: 1 回分（7.5 秒）だけ入る
    expect(at(ballad + 4)).toMatchObject({ remaining: Math.round((used + 7.5 - ballad - 4) * 1000) / 1000, actualEndTime: ballad + 6, charges: 2 });
    // 6 秒の付与でチャージが戻る
    expect(at(ballad + 6)).toEqual({ skillId: "heartbreak-shot", available: true, remaining: 0, charges: 3, maxCharges: 3 });
  });

  it("リキャストを共有するスキルは、グループ全体でチャージを数える（Lv90 のブラッドレッターとレイン・オブ・デス）", () => {
    const brd90 = setup(BRD_ATTACK_SKILLS, BRD_BUFFS, BRD_RESOURCES, 90);
    const entries = [entry("bloodletter"), entry("bloodletter"), entry("rain-of-death"), ...repeat("burst-shot", 3)];
    const e = brd90.resolve(entries).entries;
    e.forEach((x) => expect(x.recastError).toBe(false));
    const t = e[2].startTime + 1;
    const states = recastAt(brd90.skillMap, brd90.resolve, brd90.stateAt, entries, t);
    const expected = { available: false, remaining: Math.round((e[0].startTime + 15 - t) * 1000) / 1000, actualEndTime: e[0].cooldownEndTime, charges: 0, maxCharges: 3 };
    expect(states).toEqual([{ skillId: "bloodletter", ...expected }, { skillId: "rain-of-death", ...expected }]);
  });

  it("最後のエントリより後の詩心の付与による短縮は、残り秒数には入るが、レーンの区間（実際に戻る時刻）には入らない（#898 の既知の制限）", () => {
    const entries = [entry("mages-ballad"), entry("heartbreak-shot")];
    const e = brd.resolve(entries).entries;
    const ballad = e[0].startTime;
    const used = e[1].startTime;
    // レーンは最後のエントリより先の付与を数えないので、短縮の無い 15 秒で終わる
    expect(e[1].cooldownEndTime).toBe(used + 15);
    const state = brdRecastAt(entries, ballad + 4).find((s) => s.skillId === "heartbreak-shot")!;
    expect(state).toMatchObject({ remaining: Math.round((used + 7.5 - ballad - 4) * 1000) / 1000, actualEndTime: used + 15 });
  });
});
