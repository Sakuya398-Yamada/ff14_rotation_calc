import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { computeBuffTimespans } from "../buff-timespans";
import { DEFAULT_STATS } from "../stat-calc";
import type {
  BuffDefinition,
  ResolvedTimelineEntry,
  ResourceDefinition,
  Skill,
  TimelineEntry,
} from "../../types/skill";

// スキルが付けるバフを着弾時刻（hitTime ?? startTime）から効かせる（#948）。
// 付けるかどうかの判定は実行時、付与そのもの（排他の解除・付け直し・効果時間・延長）は着弾時刻に行う

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

function makeBuff(overrides: Partial<BuffDefinition> & { id: string }): BuffDefinition {
  return { icon: "", duration: 20, effects: [], color: "#000", ...overrides };
}

function makeResource(overrides: Partial<ResourceDefinition> & { id: string }): ResourceDefinition {
  return { maxStacks: 3, color: "#000", ...overrides };
}

let uidSeq = 0;
function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  uidSeq += 1;
  return { uid: `entry-${uidSeq}`, skillId, ...(manualStartTime !== undefined ? { manualStartTime } : {}) };
}

const buffs: BuffDefinition[] = [
  makeBuff({ id: "damage-up", effects: [{ type: "potency", value: 1.2 }] }),
  makeBuff({ id: "spell-buff", duration: 30 }),
  // buffConsumptionAnyOf はスタック数で消費できるかを見るので、確率付与のバフも 1 スタックで持つ
  makeBuff({ id: "proc", duration: 30, maxStacks: 1 }),
  makeBuff({ id: "combo-buff", duration: 30 }),
  makeBuff({ id: "ext-target", duration: 10 }),
  makeBuff({ id: "short-target", duration: 1 }),
  makeBuff({
    id: "trigger",
    duration: 20,
    maxStacks: 1,
    effects: [
      { type: "consumeOnGcd", value: 0, appliesToSkillIds: ["trigger-gcd"] },
      { type: "applyBuffOnSkill", value: 0, appliesToSkillIds: ["trigger-gcd"], appliedBuffId: "granted" },
    ],
  }),
  makeBuff({ id: "granted", duration: 30 }),
  makeBuff({
    id: "stacked",
    duration: 30,
    maxStacks: 1,
    effects: [
      { type: "consumeOnGcd", value: 0 },
      { type: "applyBuffOnDeplete", value: 0, appliedBuffId: "after-deplete" },
    ],
  }),
  makeBuff({ id: "after-deplete", duration: 30 }),
  makeBuff({ id: "by-count-1" }),
  makeBuff({ id: "by-count-2" }),
  makeBuff({ id: "by-count-3" }),
  makeBuff({ id: "if-resource" }),
  makeBuff({ id: "song", duration: 45 }),
  makeBuff({ id: "ethos-1" }),
  makeBuff({ id: "ethos-2" }),
  makeBuff({ id: "fest", duration: 30 }),
  makeBuff({ id: "stance-a", duration: 30, exclusiveGroup: "stance" }),
  makeBuff({ id: "stance-b", duration: 30, exclusiveGroup: "stance" }),
  makeBuff({ id: "consumable", duration: 20, effects: [{ type: "consumeOnGcd", value: 0 }] }),
  makeBuff({ id: "song-a", duration: 45, exclusiveGroup: "songs" }),
  makeBuff({ id: "song-b", duration: 45, exclusiveGroup: "songs" }),
];

const resources: ResourceDefinition[] = [
  makeResource({ id: "gauge", initialStacks: 2 }),
  makeResource({ id: "flag", maxStacks: 1, initialStacks: 1 }),
  makeResource({ id: "repertoire", initialStacks: 2 }),
  makeResource({ id: "soil", initialStacks: 3, whileBuffModifiers: [{ buffId: "fest", maxStacks: 6 }] }),
  // 歌の間だけ 3 秒ごとに溜まり、歌が変わったら付いた時刻から数え直す（詩人の詩心と同じ形）
  makeResource({
    id: "song-gauge",
    maxStacks: 10,
    autoGenerateInterval: 3,
    autoGenerateWhileBuff: ["song-a", "song-b"],
    autoGenerateRestartOnBuffChange: true,
  }),
];

const skills: Skill[] = [
  makeSkill({ id: "gcd", potency: 100 }),
  makeSkill({ id: "ogcd", type: "ogcd", potency: 0, recastTime: 1 }),
  makeSkill({ id: "buff-ogcd", type: "ogcd", potency: 0, recastTime: 120, buffApplications: ["damage-up"] }),
  makeSkill({ id: "quick-buff-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["damage-up"] }),
  makeSkill({ id: "spell", potency: 300, castTime: 2.0, buffApplications: ["spell-buff"] }),
  // 詠唱とリキャストが同じ（次の GCD がちょうど着弾時刻から始まる）
  makeSkill({ id: "even-spell", potency: 300, castTime: 2.5, buffApplications: ["consumable"] }),
  makeSkill({ id: "proc-gcd", buffApplications: ["proc"], buffApplicationProcRates: { proc: 0.4 } }),
  makeSkill({ id: "combo-1" }),
  makeSkill({ id: "combo-2", comboFrom: ["combo-1"], comboBuffApplications: ["combo-buff"] }),
  makeSkill({ id: "target-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["ext-target"] }),
  makeSkill({ id: "short-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["short-target"] }),
  makeSkill({
    id: "ext-ogcd",
    type: "ogcd",
    potency: 0,
    recastTime: 1,
    buffExtensions: [{ buffId: "ext-target", seconds: 10 }, { buffId: "short-target", seconds: 10 }],
  }),
  makeSkill({ id: "trigger-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["trigger"] }),
  makeSkill({ id: "trigger-gcd" }),
  makeSkill({ id: "stack-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["stacked"] }),
  makeSkill({
    id: "count-ogcd",
    type: "ogcd",
    potency: 0,
    recastTime: 1,
    consumeAllResources: ["gauge"],
    buffApplicationsByConsumedCount: [["by-count-1"], ["by-count-2"], ["by-count-3"]],
  }),
  makeSkill({
    id: "if-resource-ogcd",
    type: "ogcd",
    potency: 0,
    recastTime: 1,
    buffApplicationIfResource: { resourceId: "flag", minAmount: 1, buffIds: ["if-resource"] },
  }),
  makeSkill({ id: "song-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["song"] }),
  makeSkill({
    id: "ethos-ogcd",
    type: "ogcd",
    potency: 0,
    recastTime: 1,
    buffApplicationByResourceWhileBuff: { buffId: "song", resourceId: "repertoire", buffIds: ["ethos-1", "ethos-2"] },
  }),
  makeSkill({
    id: "fest-ogcd",
    type: "ogcd",
    potency: 0,
    recastTime: 1,
    resourceChanges: [{ resourceId: "soil", amount: 3 }],
    buffApplications: ["fest"],
  }),
  makeSkill({ id: "spend-ogcd", type: "ogcd", potency: 0, recastTime: 1, resourceChanges: [{ resourceId: "soil", amount: -1 }] }),
  makeSkill({ id: "stance-a-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["stance-a"] }),
  makeSkill({ id: "stance-b-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["stance-b"] }),
  makeSkill({ id: "song-a-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["song-a"] }),
  makeSkill({ id: "song-b-ogcd", type: "ogcd", potency: 0, recastTime: 1, buffApplications: ["song-b"] }),
  // 確率付与の付け直し（buffConsumptionAnyOf の fallback）: 出なかった分岐で撃つ proc-gcd の付与確率で付け直す
  makeSkill({
    id: "proc-consumer",
    buffConsumptionAnyOf: [{ buffId: "proc", stacks: 1, fallbackPotency: 100, fallbackSkillId: "proc-gcd" }],
  }),
];
const skillMap = new Map(skills.map((s) => [s.id, s]));

function resolve(entries: TimelineEntry[], hitDelays?: Record<string, number>) {
  return resolveTimeline(entries, skillMap, resources, DEFAULT_STATS, buffs, undefined, undefined, hitDelays);
}

function buffAtUse(e: ResolvedTimelineEntry, buffId: string) {
  return e.activeBuffsAtUse.find((ab) => ab.buffId === buffId);
}

function expectNoError(e: ResolvedTimelineEntry) {
  expect(e.recastError).toBe(false);
  expect(e.untargetableError).toBe(false);
  expect(e.comboErrors).toEqual([]);
  expect(e.resourceErrors).toEqual([]);
}

describe("着弾の前後で、スキルが付けるバフが乗るか", () => {
  // buff-ogcd を 0 秒に置き、遅れ 0.8 秒で 0.8 秒に着弾させる。次の GCD は自動なら 0.65 秒（アニメーションロック明け）
  it.each([
    { at: undefined, label: "着弾前（0.65 秒）", multiplier: 1 },
    { at: 0.8, label: "着弾時刻ちょうど（0.8 秒）", multiplier: 1.2 },
    { at: 1.0, label: "着弾後（1.0 秒）", multiplier: 1.2 },
  ])("$label に置いた GCD の倍率は $multiplier", ({ at, multiplier }) => {
    const result = resolve([entry("buff-ogcd"), entry("gcd", at)], { "buff-ogcd": 0.8 });
    const gcd = result.entries[1];
    expectNoError(gcd);
    expect(gcd.startTime).toBe(at ?? 0.65);
    expect(gcd.buffMultiplier).toBe(multiplier);
  });

  it("遅れを設定していなければ、実行時から乗る（今と同じ）", () => {
    const gcd = resolve([entry("buff-ogcd"), entry("gcd")]).entries[1];
    expectNoError(gcd);
    expect(gcd.startTime).toBe(0.65);
    expect(gcd.buffMultiplier).toBe(1.2);
  });

  it("付けたエントリの activeBuffs には無く、着弾で付いたバフを hitAppliedBuffs に持つ", () => {
    const [buffEntry] = resolve([entry("buff-ogcd"), entry("gcd")], { "buff-ogcd": 0.8 }).entries;
    expect(buffEntry.activeBuffs.some((ab) => ab.buffId === "damage-up")).toBe(false);
    expect(buffEntry.hitAppliedBuffs).toEqual([
      { buffId: "damage-up", startTime: 0.8, endTime: 20.8, stacks: undefined },
    ]);
  });

  it("遅れを設定していなければ hitAppliedBuffs を持たない", () => {
    const [buffEntry] = resolve([entry("buff-ogcd"), entry("gcd")]).entries;
    expect(buffEntry.hitAppliedBuffs).toBeUndefined();
  });
});

describe("効果時間は着弾時刻から数える", () => {
  // 0.8 秒に着弾した 20 秒のバフは 20.8 秒に切れる
  it.each([
    { at: 20.7, multiplier: 1.2 },
    { at: 20.8, multiplier: 1 },
  ])("$at 秒に置いた GCD の倍率は $multiplier", ({ at, multiplier }) => {
    const gcd = resolve([entry("buff-ogcd"), entry("gcd", at)], { "buff-ogcd": 0.8 }).entries[1];
    expectNoError(gcd);
    expect(gcd.buffMultiplier).toBe(multiplier);
  });

  it("遅れが未設定の詠唱スキルが付けるバフは、詠唱完了から付き、そこから効果時間を数える", () => {
    const [spell, next] = resolve([entry("spell"), entry("gcd")]).entries;
    expect(spell.castTime).toBeGreaterThan(0);
    expect(spell.hitTime).toBe(spell.castTime);
    expect(spell.activeBuffs.some((ab) => ab.buffId === "spell-buff")).toBe(false);
    const applied = next.activeBuffsAtUse.find((ab) => ab.buffId === "spell-buff");
    expect(applied?.startTime).toBe(spell.hitTime);
    expect(applied?.endTime).toBe(Math.round((spell.castTime + 30) * 1000) / 1000);
  });

  it("詠唱スキルに遅れを設定すると、詠唱完了 + 遅れから付く", () => {
    const [spell, next] = resolve([entry("spell"), entry("gcd")], { spell: 0.3 }).entries;
    expect(spell.hitTime).toBe(Math.round((spell.castTime + 0.3) * 1000) / 1000);
    expect(buffAtUse(next, "spell-buff")?.startTime).toBe(spell.hitTime);
  });
});

describe("付与の 9 か所がどれも着弾時刻から効く", () => {
  // 各ケース: setup のあとに遅れ 1 秒のスキル（delayed）を置き、その直後（アニメーションロック明け・着弾前）の oGCD と、
  // 着弾後に置いた GCD とで、付いたバフ（buffId）が見えるかを比べる
  const cases: { name: string; setup: string[]; delayed: string; buffId: string }[] = [
    { name: "通常の付与（buffApplications）", setup: [], delayed: "buff-ogcd", buffId: "damage-up" },
    { name: "確率付与（buffApplicationProcRates）", setup: [], delayed: "proc-gcd", buffId: "proc" },
    { name: "コンボで付く付与（comboBuffApplications）", setup: ["combo-1"], delayed: "combo-2", buffId: "combo-buff" },
    { name: "別のバフが起点の付与（applyBuffOnSkill）", setup: ["trigger-ogcd"], delayed: "trigger-gcd", buffId: "granted" },
    { name: "スタックを使い切ったときの付与（applyBuffOnDeplete）", setup: ["stack-ogcd"], delayed: "gcd", buffId: "after-deplete" },
    // 消費数は、消費したリソースの種類の数（gauge の 1 種類なので by-count-1）
    { name: "消費数に応じた付与（buffApplicationsByConsumedCount）", setup: [], delayed: "count-ogcd", buffId: "by-count-1" },
    { name: "リソース条件付きの付与（buffApplicationIfResource）", setup: [], delayed: "if-resource-ogcd", buffId: "if-resource" },
    { name: "バフ中のリソース量に応じた付与（buffApplicationByResourceWhileBuff）", setup: ["song-ogcd"], delayed: "ethos-ogcd", buffId: "ethos-2" },
    { name: "確率付与の付け直し（buffConsumptionAnyOf の fallback）", setup: ["proc-gcd"], delayed: "proc-consumer", buffId: "proc" },
  ];

  it.each(cases)("$name", ({ setup, delayed, buffId }) => {
    const entries = [...setup.map((id) => entry(id)), entry(delayed), entry("ogcd"), entry("gcd", 20)];
    const result = resolve(entries, { [delayed]: 1 }).entries;
    const delayedEntry = result[setup.length];
    const beforeHit = result[setup.length + 1];
    const afterHit = result[setup.length + 2];
    expectNoError(delayedEntry);
    expect(delayedEntry.hitTime).toBe(Math.round((delayedEntry.startTime + 1) * 1000) / 1000);
    expect(beforeHit.startTime).toBeLessThan(delayedEntry.hitTime!);
    expect(buffAtUse(beforeHit, buffId)).toBeUndefined();
    expect(buffAtUse(afterHit, buffId)?.startTime).toBe(delayedEntry.hitTime);

    // 遅れが無ければ、直後の oGCD にも見える（このケースで付与が起きていることの確認）
    const control = resolve(entries).entries;
    expect(buffAtUse(control[setup.length + 1], buffId)?.startTime).toBe(control[setup.length].startTime);
  });

  it("確率付与は、着弾で付いたバフにも付与確率を持たせる", () => {
    const result = resolve([entry("proc-gcd"), entry("ogcd"), entry("gcd")], { "proc-gcd": 1 }).entries;
    expect(buffAtUse(result[2], "proc")?.procRate).toBe(0.4);
  });

  it("効いているバフに着弾で重なった確率付与は、付けたエントリに wastedProc を持つ", () => {
    // 1 回目は 1 秒、2 回目は 3.5 秒に着弾し、1 回目のバフ（確率 0.4）に重なる
    const result = resolve([entry("proc-gcd"), entry("proc-gcd")], { "proc-gcd": 1 }).entries;
    expect(result[0].wastedProc).toBeUndefined();
    expect(result[1].wastedProc?.buffId).toBe("proc");
    expect(result[1].wastedProc?.rate).toBeCloseTo(0.16, 6);
  });

  it("確率付与の付け直しは、出なかった分岐の確率（(1 − 0.4) × 0.4）で着弾時に付く", () => {
    const result = resolve([entry("proc-gcd"), entry("proc-consumer"), entry("ogcd"), entry("gcd")], { "proc-consumer": 1 }).entries;
    expect(result[1].consumedProc?.procRate).toBe(0.4);
    expect(buffAtUse(result[3], "proc")?.procRate).toBeCloseTo(0.24, 6);
  });

  it("別のバフが起点の付与は、実行時に効いているかで決める（起点のバフを同じ GCD で消費しても付く）", () => {
    const result = resolve([entry("trigger-ogcd"), entry("trigger-gcd"), entry("ogcd"), entry("gcd")], { "trigger-gcd": 1 }).entries;
    expect(result[1].activeBuffs.some((ab) => ab.buffId === "trigger")).toBe(false);
    expect(buffAtUse(result[3], "granted")).toBeDefined();
  });

  it("延長（buffExtensions）は着弾時刻に、効果中のバフだけを延ばす", () => {
    // target-ogcd（0 秒、10 秒のバフ）→ ext-ogcd（0.65 秒、遅れ 1 秒で 1.65 秒に着弾）
    const result = resolve([entry("target-ogcd"), entry("ext-ogcd"), entry("ogcd"), entry("gcd", 5)], { "ext-ogcd": 1 }).entries;
    expect(result[2].startTime).toBeLessThan(1.65);
    expect(buffAtUse(result[2], "ext-target")?.endTime).toBe(10);
    expect(buffAtUse(result[3], "ext-target")).toMatchObject({ startTime: 1.65, endTime: 20 });
  });

  it("延長の着弾までに切れたバフは延ばさない", () => {
    // short-ogcd（0 秒、1 秒のバフ）→ ext-ogcd（0.65 秒、遅れ 0.5 秒で 1.15 秒に着弾）。実行時には効いている
    const result = resolve([entry("short-ogcd"), entry("ext-ogcd"), entry("gcd", 5)], { "ext-ogcd": 0.5 }).entries;
    expect(buffAtUse(result[1], "short-target")).toBeDefined();
    expect(buffAtUse(result[2], "short-target")).toBeUndefined();
  });

  it("排他の解除も着弾時刻に行う（着弾前は前のバフが残る）", () => {
    const result = resolve([entry("stance-a-ogcd"), entry("stance-b-ogcd"), entry("ogcd"), entry("gcd", 5)], { "stance-b-ogcd": 1 }).entries;
    expect(buffAtUse(result[2], "stance-a")).toBeDefined();
    expect(buffAtUse(result[2], "stance-b")).toBeUndefined();
    expect(buffAtUse(result[3], "stance-a")).toBeUndefined();
    expect(buffAtUse(result[3], "stance-b")).toBeDefined();
  });
});

describe("着弾までの間に起きること", () => {
  it("付ける前に着弾時刻まで自動生成を進める（付け替える前の歌の刻みも数える）", () => {
    // song-a（0 秒）で 3・6 秒に溜まり、song-b（5 秒、遅れ 2 秒で 7 秒に着弾）に替わってからは 7 秒から数えて 10 秒に溜まる
    const result = resolve([entry("song-a-ogcd"), entry("song-b-ogcd", 5), entry("gcd", 10.5)], { "song-b-ogcd": 2 }).entries;
    expect(buffAtUse(result[2], "song-a")).toBeUndefined();
    expect(buffAtUse(result[2], "song-b")?.startTime).toBe(7);
    expect(result[1].resourceSnapshot["song-gauge"]).toBe(1);
    expect(result[2].resourceSnapshot["song-gauge"]).toBe(3);
  });

  it("確率付与の付け直しの着弾までに同じバフが付いていたら、付け直す（同じバフを 2 つ持たない）", () => {
    // proc-consumer（2.5 秒、遅れ 3 秒で 5.5 秒に着弾）の着弾より前に、proc-gcd（5 秒）が proc を付ける
    const result = resolve([entry("proc-gcd"), entry("proc-consumer"), entry("proc-gcd"), entry("gcd")], { "proc-consumer": 3 }).entries;
    expect(result[2].startTime).toBe(5);
    const procs = result[3].activeBuffsAtUse.filter((ab) => ab.buffId === "proc");
    expect(procs).toHaveLength(1);
    expect(procs[0].startTime).toBe(5.5);
  });
});

describe("リソースの上限を上げるバフ（whileBuffModifiers）", () => {
  it("上限は実行時から上がり、着弾前に使っても上げた上限から減る", () => {
    // fest-ogcd でソイル 3 → 6（上限 6）。遅れ 1 秒の着弾より前に spend-ogcd で 1 使う
    const result = resolve([entry("fest-ogcd"), entry("spend-ogcd"), entry("gcd", 5)], { "fest-ogcd": 1 }).entries;
    expect(result[0].resourceSnapshot["soil"]).toBe(6);
    expect(result[1].startTime).toBeLessThan(result[0].hitTime!);
    expect(buffAtUse(result[1], "fest")).toBeUndefined();
    expect(result[1].resourceSnapshot["soil"]).toBe(5);
    // 着弾を待っているバフは、付けたエントリにも、着弾前の後続のエントリにも持たせる（リソースのレーンの上限の表示に使う）
    expect(result[0].pendingBuffIds).toEqual(["fest"]);
    expect(result[1].pendingBuffIds).toEqual(["fest"]);
    expect(result[2].pendingBuffIds).toBeUndefined();
  });
});

describe("バフのレーン", () => {
  it("最後のエントリより後に着弾したバフも、着弾時刻から描かれる", () => {
    const result = resolve([entry("gcd"), entry("buff-ogcd")], { "buff-ogcd": 0.8 });
    const last = result.entries[1];
    expect(last.activeBuffs.some((ab) => ab.buffId === "damage-up")).toBe(false);
    const spans = computeBuffTimespans(result.entries, buffs).get("damage-up");
    expect(spans).toEqual([
      { buffId: "damage-up", startTime: Math.round((last.startTime + 0.8) * 1000) / 1000, endTime: Math.round((last.startTime + 20.8) * 1000) / 1000, stacks: undefined },
    ]);
  });

  it("着弾時刻ちょうどに始まったエントリが消費したバフは、その時刻で区間を終える", () => {
    const result = resolve([entry("even-spell"), entry("gcd"), entry("gcd")]);
    const [spell, consumer] = result.entries;
    expect(consumer.startTime).toBe(spell.hitTime);
    expect(buffAtUse(consumer, "consumable")).toBeDefined();
    expect(consumer.activeBuffs.some((ab) => ab.buffId === "consumable")).toBe(false);
    const spans = computeBuffTimespans(result.entries, buffs).get("consumable");
    expect(spans).toEqual([{ buffId: "consumable", startTime: spell.hitTime, endTime: spell.hitTime, stacks: undefined }]);
  });

  it("エントリの間の着弾で排他グループのバフが外れたら、その着弾時刻で区間を終える", () => {
    // stance-a（遅れ 0.2 秒で 0.2 秒に着弾）→ stance-b（0.65 秒、遅れ 0.1 秒で 0.75 秒に着弾し stance-a を外す）→ GCD 5 秒
    const result = resolve(
      [entry("stance-a-ogcd"), entry("stance-b-ogcd"), entry("gcd", 5)],
      { "stance-a-ogcd": 0.2, "stance-b-ogcd": 0.1 },
    );
    expect(buffAtUse(result.entries[1], "stance-a")).toBeDefined();
    expect(buffAtUse(result.entries[2], "stance-a")).toBeUndefined();
    const spans = computeBuffTimespans(result.entries, buffs);
    expect(spans.get("stance-a")).toEqual([{ buffId: "stance-a", startTime: 0.2, endTime: 0.75, stacks: undefined }]);
    expect(spans.get("stance-b")).toEqual([{ buffId: "stance-b", startTime: 0.75, endTime: 30.75, stacks: undefined }]);
  });

  it("最後のエントリより後の着弾で付け直したバフは、前の区間をその着弾時刻で終える", () => {
    // buff-ogcd（0 秒、遅れ 0.8 秒で 0.8 秒に着弾）→ quick-buff-ogcd（0.65 秒、遅れ 1 秒で 1.65 秒に付け直し）。どちらも最後のエントリの後に着弾する
    const result = resolve([entry("buff-ogcd"), entry("quick-buff-ogcd")], { "buff-ogcd": 0.8, "quick-buff-ogcd": 1 });
    const spans = computeBuffTimespans(result.entries, buffs).get("damage-up");
    expect(spans).toEqual([
      { buffId: "damage-up", startTime: 0.8, endTime: 1.65, stacks: undefined },
      { buffId: "damage-up", startTime: 1.65, endTime: 21.65, stacks: undefined },
    ]);
  });

  it("排他グループの付け替えが最後のエントリの後に着弾しても、前の区間はその着弾時刻で終える", () => {
    const result = resolve([entry("stance-a-ogcd"), entry("stance-b-ogcd")], { "stance-b-ogcd": 1 });
    const spans = computeBuffTimespans(result.entries, buffs);
    expect(spans.get("stance-a")).toEqual([{ buffId: "stance-a", startTime: 0, endTime: 1.65, stacks: undefined }]);
    expect(spans.get("stance-b")).toEqual([{ buffId: "stance-b", startTime: 1.65, endTime: 31.65, stacks: undefined }]);
  });
});

describe("手動の開始時刻で前後したエントリ", () => {
  it("近似: 先に流し込んだ付与は、後に処理する前の時刻のエントリにも見える（失効と同じく配列の順に処理する）", () => {
    // buff-ogcd（0 秒、遅れ 3 秒で 3 秒に着弾）→ GCD（5 秒）→ oGCD（手動 2 秒。配列では後ろ）
    const result = resolve([entry("buff-ogcd"), entry("gcd", 5), entry("ogcd", 2)], { "buff-ogcd": 3 }).entries;
    expect(result[2].startTime).toBe(2);
    expect(buffAtUse(result[2], "damage-up")?.startTime).toBe(3);
  });
});
