import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { BuffDefinition, ResourceDefinition, Skill, TimelineEntry } from "../../types/skill";

// 確率で得るリソース（ResourceChange.procRate）と、期待値で撃ったスキルの確率付与（#959）。
// レーンの量は「出た扱い」で数え、消費するスキルの威力だけを「消費する量以上ある確率」で期待値にする

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

function makeOgcd(overrides: Partial<Skill> & { id: string }): Skill {
  return makeSkill({ type: "ogcd", recastTime: 0.65, ...overrides });
}

let uidSeq = 0;
function entry(skillId: string, procOccurred?: boolean): TimelineEntry {
  uidSeq += 1;
  return { uid: `e-${uidSeq}`, skillId, ...(procOccurred !== undefined ? { procOccurred } : {}) };
}

const feather: ResourceDefinition = { id: "feather", maxStacks: 4, color: "#000" };
const smallFeather: ResourceDefinition = { id: "small-feather", maxStacks: 1, color: "#000" };

function makeBuff(id: string, duration: number | null = 30): BuffDefinition {
  return { id, icon: "", duration, effects: [], color: "#000", maxStacks: 1 };
}
const procBuff = makeBuff("proc");
const comboProcBuff = makeBuff("combo-proc");

const gain = makeSkill({ id: "gain", resourceChanges: [{ resourceId: "feather", amount: 1, procRate: 0.5 }] });
const sureGain = makeSkill({ id: "sure-gain", resourceChanges: [{ resourceId: "feather", amount: 1 }] });
const smallGain = makeSkill({ id: "small-gain", resourceChanges: [{ resourceId: "small-feather", amount: 1, procRate: 0.5 }] });
const spend = makeOgcd({ id: "spend", potency: 100, resourceChanges: [{ resourceId: "feather", amount: -1 }] });
const smallSpend = makeOgcd({ id: "small-spend", potency: 100, resourceChanges: [{ resourceId: "small-feather", amount: -1 }] });
// 消費したフェザーの確率で撃ち、その撃てた確率で proc を付ける（扇の舞い【序】と【急】）
const spendAndProc = makeOgcd({
  id: "spend-and-proc",
  potency: 100,
  resourceChanges: [{ resourceId: "feather", amount: -1 }],
  buffApplications: ["proc"],
  buffApplicationProcRates: { proc: 0.5 },
});
const procConsumer = makeOgcd({
  id: "proc-consumer",
  potency: 200,
  buffConsumptionAnyOf: [{ buffId: "proc", stacks: 1, fallbackPotency: 0 }],
});
// proc を期待値で消費して撃ち、撃てた確率でフェザーを得る（リバースカスケード）
const procGrant = makeSkill({ id: "proc-grant", buffApplications: ["proc"], buffApplicationProcRates: { proc: 0.5 } });
const sureProcGrant = makeOgcd({ id: "sure-proc-grant", buffApplications: ["proc"] });
const procSpenderGain = makeSkill({
  id: "proc-spender-gain",
  potency: 300,
  buffConsumptionAnyOf: [{ buffId: "proc", stacks: 1, fallbackPotency: 100 }],
  resourceChanges: [{ resourceId: "feather", amount: 1, procRate: 0.5 }],
});
// proc を期待値で消費して撃ち、撃てた確率で別の proc を付ける
const procSpenderProc = makeSkill({
  id: "proc-spender-proc",
  potency: 300,
  buffConsumptionAnyOf: [{ buffId: "proc", stacks: 1, fallbackPotency: 100 }],
  buffApplications: ["combo-proc"],
  buffApplicationProcRates: { "combo-proc": 0.5 },
});
const comboStart = makeSkill({ id: "combo-start" });
const comboFinish = makeSkill({
  id: "combo-finish",
  comboFrom: ["combo-start"],
  comboBuffApplications: ["combo-proc"],
  buffApplicationProcRates: { "combo-proc": 0.5 },
});
const comboProcConsumer = makeOgcd({
  id: "combo-proc-consumer",
  potency: 200,
  buffConsumptionAnyOf: [{ buffId: "combo-proc", stacks: 1, fallbackPotency: 0 }],
});

const skillMap = new Map(
  [gain, sureGain, smallGain, spend, smallSpend, spendAndProc, procConsumer, procGrant, sureProcGrant, procSpenderGain, procSpenderProc, comboStart, comboFinish, comboProcConsumer].map(
    (s) => [s.id, s],
  ),
);

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, [feather, smallFeather], undefined, [procBuff, comboProcBuff]).entries;
}

describe("確率で得るリソース（ResourceChange.procRate）", () => {
  it("レーンの量は出た扱いで数え、消費するスキルの威力は消費する量以上ある確率を掛けた期待値にする", () => {
    const result = resolve([entry("gain"), entry("gain"), entry("spend"), entry("spend")]);
    expect(result[1].resourceSnapshot.feather).toBe(2);
    // 2 回の獲得で 0 / 1 / 2 本が 0.25 / 0.5 / 0.25。1 本目は 1 本以上ある確率 0.75、2 本目は残りが 1 本以上ある確率 0.25
    expect(result[2].resolvedPotency).toBe(75);
    expect(result[2].consumedResourceProc).toEqual({ resourceId: "feather", procRate: 0.75 });
    expect(result[3].resolvedPotency).toBe(25);
    expect(result[3].resourceSnapshot.feather).toBe(0);
    for (const e of result) expect(e.resourceErrors).toEqual([]);
  });

  it("確定の獲得しかしていないリソースの消費は、期待値にしない", () => {
    const result = resolve([entry("sure-gain"), entry("spend")]);
    expect(result[1].resolvedPotency).toBe(100);
    expect(result[1].consumedResourceProc).toBeUndefined();
  });

  it("確率の獲得のあとの確定の獲得は、分布をそのままずらす", () => {
    const result = resolve([entry("gain"), entry("sure-gain"), entry("spend"), entry("spend")]);
    // 1 / 2 本が 0.5 / 0.5。1 本目は確定、2 本目は 0.5
    expect(result[2].resolvedPotency).toBe(100);
    expect(result[3].resolvedPotency).toBe(50);
  });

  it("上限であふれた分は数えない", () => {
    const result = resolveTimeline(
      [entry("small-gain"), entry("small-gain"), entry("small-spend")],
      skillMap,
      [smallFeather],
    ).entries;
    expect(result[1].resourceSnapshot["small-feather"]).toBe(1);
    // 2 回のどちらかで出ていれば 1 本（0.75）
    expect(result[2].resolvedPotency).toBe(75);
  });

  it("発生しなかったと指定した獲得は、レーンの量にも分布にも入れない", () => {
    const result = resolve([entry("gain", false), entry("spend")]);
    expect(result[0].resourceSnapshot.feather).toBe(0);
    expect(result[1].resourceErrors).toEqual([{ resourceId: "feather", kind: "insufficient" }]);
  });

  it("発生したと指定した獲得は、確定で得る", () => {
    const result = resolve([entry("gain", true), entry("gain"), entry("spend"), entry("spend")]);
    expect(result[2].resolvedPotency).toBe(100);
    expect(result[3].resolvedPotency).toBe(50);
  });
});

describe("期待値で撃ったスキルの確率付与（撃てた確率を掛ける）", () => {
  it("確率で得たリソースを消費して撃ったスキルの確率付与は、撃てた確率を掛ける", () => {
    const result = resolve([entry("gain"), entry("spend-and-proc"), entry("proc-consumer")]);
    expect(result[1].resolvedPotency).toBe(50);
    // proc が付いている確率は 0.5（撃てた確率）× 0.5（付与率）
    expect(result[2].consumedProc?.procRate).toBeCloseTo(0.25);
    expect(result[2].resolvedPotency).toBe(50);
  });

  it("確率で付いたバフを期待値で消費したスキルが確率で得るリソースは、撃てた確率を掛ける", () => {
    const result = resolve([entry("proc-grant"), entry("proc-spender-gain"), entry("spend")]);
    expect(result[1].resolvedPotency).toBe(200);
    expect(result[1].resourceSnapshot.feather).toBe(1);
    // フェザーが出ている確率は 0.5（proc があった確率）× 0.5（獲得率）
    expect(result[2].consumedResourceProc?.procRate).toBeCloseTo(0.25);
    expect(result[2].resolvedPotency).toBe(25);
  });

  it("バフが無いフィラー枠（撃てた確率 0）は、確率で得るリソースをレーンの量にも入れない", () => {
    const result = resolve([entry("proc-spender-gain")]);
    expect(result[0].resolvedPotency).toBe(100);
    expect(result[0].resourceSnapshot.feather).toBe(0);
  });

  // 撃てた確率 0 の枠は、実際には出なかったときのスキルを撃っているので、発生の指定は効かない (#1005)
  it("フィラー枠（撃てた確率 0）に発生したと指定しても、確率で得るリソースは得ない", () => {
    const result = resolve([entry("proc-spender-gain", true), entry("spend")]);
    expect(result[0].resourceSnapshot.feather).toBe(0);
    expect(result[1].resourceErrors).toEqual([{ resourceId: "feather", kind: "insufficient" }]);
  });

  it("フィラー枠（撃てた確率 0）に発生したと指定しても、確率付与のバフは付かない", () => {
    const result = resolve([entry("proc-spender-proc", true), entry("combo-proc-consumer")]);
    expect(result[0].activeBuffs.map((b) => b.buffId)).not.toContain("combo-proc");
    expect(result[1].resolvedPotency).toBe(0);
  });

  // 撃てた確率が 0 より大きければ、発生の指定は実際に撃って出たことを表すので確定で得る
  it("撃てた確率が 0 より大きい枠に発生したと指定すれば、確定で得る", () => {
    const result = resolve([entry("proc-grant"), entry("proc-spender-gain", true), entry("spend")]);
    expect(result[2].consumedResourceProc?.procRate).toBe(1);
    expect(result[2].resolvedPotency).toBe(100);
  });
});

describe("コンボ成立時の確率付与（comboBuffApplications と buffApplicationProcRates）", () => {
  it("コンボが成立すれば付与率で付き、消費するスキルの威力は期待値になる", () => {
    const result = resolve([entry("combo-start"), entry("combo-finish"), entry("combo-proc-consumer")]);
    expect(result[2].consumedProc?.procRate).toBe(0.5);
    expect(result[2].resolvedPotency).toBe(100);
  });

  it("コンボが成立しなければ付かない", () => {
    const result = resolve([entry("combo-finish"), entry("combo-proc-consumer")]);
    expect(result[0].activeBuffs.some((b) => b.buffId === "combo-proc")).toBe(false);
  });

  it("発生しなかったと指定すれば付かず、発生したと指定すれば確定で付く", () => {
    const notOccurred = resolve([entry("combo-start"), entry("combo-finish", false)]);
    expect(notOccurred[1].activeBuffs.some((b) => b.buffId === "combo-proc")).toBe(false);
    const occurred = resolve([entry("combo-start"), entry("combo-finish", true), entry("combo-proc-consumer")]);
    expect(occurred[2].resolvedPotency).toBe(200);
  });
});

describe("確定付与で付け直した確率付与のバフ", () => {
  it("確率で付いたあとに確定で付け直したら、消費するスキルは確定で撃つ", () => {
    const result = resolve([entry("proc-grant"), entry("sure-proc-grant"), entry("proc-consumer")]);
    expect(result[2].resolvedPotency).toBe(200);
  });

  it("確定で付いたあとに確率で付け直しても、確定の効果時間のうちは確定で撃つ", () => {
    const result = resolve([entry("sure-proc-grant"), entry("proc-grant"), entry("proc-consumer")]);
    expect(result[2].resolvedPotency).toBe(200);
  });
});
