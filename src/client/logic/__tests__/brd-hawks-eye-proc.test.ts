import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { PlayerLevel, ResolvedTimelineEntry, Skill, TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import { getAllSkillMapForLevel, getBuffsForLevel, getResourcesForLevel, getSkillsForLevel } from "../skill-level";

// fallbackPotency は Lv76 / Lv82 の上書きで決まるので、App と同じくレベル調整したスキルで解決する (#600)
const buffIds = new Set(BRD_BUFFS.map((b) => b.id));
const resourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
const skillMap = getAllSkillMapForLevel(
  BRD_ATTACK_SKILLS,
  getSkillsForLevel(BRD_ATTACK_SKILLS, 100, buffIds, resourceIds),
  100,
  buffIds,
  resourceIds,
);

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

function grantsHawksEye(skill: Skill): boolean {
  return (
    (skill.buffApplications?.includes("hawks-eye") ?? false) ||
    (skill.traitPotencyOverrides?.some((o) => o.buffApplications?.includes("hawks-eye")) ?? false)
  );
}

describe("BRD: ホークアイ proc 確率の期待値反映 (#118 / #427) と乱れ撃ち (#110)", () => {
  it("スキル定義: リフルジェントアローは barrage 優先 → hawks-eye（付与元の蓄積から期待値）", () => {
    const refulgent = skillMap.get("refulgent-arrow");
    expect(refulgent).toBeDefined();
    expect(refulgent!.potency).toBe(280);
    expect(refulgent!.buffConsumptionAnyOf).toEqual([
      { buffId: "barrage", stacks: 1, potency: 840 },
      { buffId: "hawks-eye", stacks: 1, fallbackPotency: 220, fallbackSkillId: "burst-shot" },
    ]);
  });

  // 公式ジョブガイド PvE 欄: ヘヴィショット・クイックノックは 20%、それ以外は 35% (#427)
  it("スキル定義: ホークアイの付与元はすべて付与確率を持つ", () => {
    const rates = Object.fromEntries(
      BRD_ATTACK_SKILLS.filter(grantsHawksEye).map((s) => [s.id, s.buffApplicationProcRates?.["hawks-eye"]]),
    );
    expect(rates).toEqual({
      "heavy-shot": 0.2,
      "quick-nock": 0.2,
      "burst-shot": 0.35,
      ladonsbite: 0.35,
      "iron-jaws": 0.35,
      "caustic-bite": 0.35,
      stormbite: 0.35,
    });
  });

  it("スキル定義: ホークアイの消費側はすべて fallbackPotency を持つ", () => {
    const consumers = [...skillMap.values()].flatMap((s) =>
      (s.buffConsumptionAnyOf ?? [])
        .filter((o) => o.buffId === "hawks-eye")
        .map((o) => [s.id, o.fallbackPotency] as const),
    );
    expect(Object.fromEntries(consumers)).toEqual({
      "straight-shot": 160,
      "refulgent-arrow": 220,
      "wide-volley": 110,
      shadowbite: 140,
    });
  });

  it("バーストショットでホークアイが付与される", () => {
    const result = resolve([entry("burst-shot")]);
    expect(result.entries[0].activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(
      true,
    );
  });

  // ホークアイ付与特性（バイトマスタリー II, Lv76）はコースティックバイト/ストームバイトが対象で、
  // Lv64 で置き換わるベノムバイト/ウィンドバイトとは共存しない (#418)
  it.each(["venomous-bite", "windbite"])("%s ではホークアイが付与されない", (skillId) => {
    const result = resolve([entry(skillId), entry("straight-shot")]);

    expect(result.entries[0].activeBuffs.some((ab) => ab.buffId === "hawks-eye")).toBe(
      false,
    );
    // 付与元が無い（P = 0）ストレートショットは、エラーにせずヘヴィショットを撃つフィラー枠になる (#842)
    const straight = result.entries[1];
    expect(straight.comboErrors).toEqual([]);
    expect(straight.consumedProc?.procRate).toBe(0);
    expect(straight.resolvedPotency).toBe(160);
  });

  it("ホークアイ消費時のリフルジェントアローは期待値威力 241 になる", () => {
    const result = resolve([entry("burst-shot"), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    // floor(220 + (280 - 220) * 0.35) = 241
    expect(refulgent.resolvedPotency).toBe(241);
  });

  // 消費したホークアイは消えるが、出なかった分岐（1 − P）で撃つバーストショットが 0.35 で付け直すので、
  // 次の消費は P = 0.65 × 0.35 = 0.2275 になる（#842 までは「残らない」でエラーにしていた）
  it("消費したホークアイは、出なかった分岐のバーストショットの付与確率 (1 − P) × 0.35 で付け直される", () => {
    const result = resolve([
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    const first = result.entries[1];
    const reapplied = first.activeBuffs.find((ab) => ab.buffId === "hawks-eye");
    expect(reapplied?.startTime).toBe(first.startTime);
    expect(reapplied?.procRate).toBeCloseTo(0.65 * 0.35, 10);
    const second = result.entries[2];
    expect(second.comboErrors).toEqual([]);
    expect(second.consumedProc?.procRate).toBeCloseTo(0.65 * 0.35, 10);
    // floor(220 + 60 × 0.2275)
    expect(second.resolvedPotency).toBe(233);
  });

  // #842 までは発動条件エラーにしていた。P = 0 の枠はバーストショットを撃つフィラー枠として扱う
  it("ホークアイなし・乱れ撃ちなしのリフルジェントアローは、エラーにせず威力 220 のフィラー枠になり、0.35 の付与元を残す", () => {
    const result = resolve([entry("refulgent-arrow")]);

    const refulgent = result.entries[0];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(220);
    expect(refulgent.consumedProc).toEqual({ buffId: "hawks-eye", procRate: 0, fallbackSkillName: "バーストショット" });
    expect(refulgent.activeBuffs.find((ab) => ab.buffId === "hawks-eye")?.procRate).toBeCloseTo(0.35, 10);
  });

  it("乱れ撃ち中はホークアイ不要で使用でき、威力 840 固定（proc 期待値は適用されない）", () => {
    const result = resolve([entry("barrage"), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(840);
  });

  it("乱れ撃ちとホークアイが両方有効なら乱れ撃ちを優先消費し、ホークアイは残る", () => {
    const result = resolve([
      entry("barrage"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    // 1発目: barrage 消費で 840
    expect(result.entries[2].resolvedPotency).toBe(840);
    // 2発目: 残っていたホークアイを消費して期待値 241
    const second = result.entries[3];
    expect(second.comboErrors).toEqual([]);
    expect(second.resolvedPotency).toBe(241);
  });

  it.each([
    // floor(fallback + (potency - fallback) * p)
    ["heavy-shot", "straight-shot", 168], // floor(160 + (200 - 160) * 0.2)
    ["quick-nock", "shadowbite", 152], // floor(140 + (200 - 140) * 0.2)
    ["ladonsbite", "shadowbite", 161], // floor(140 + (200 - 140) * 0.35)
  ])("%s → %s は付与元の確率で proc 期待値威力 %i になる", (sourceId, skillId, expected) => {
    const result = resolve([entry(sourceId), entry(skillId)]);

    const e = result.entries[1];
    expect(e.comboErrors).toEqual([]);
    expect(e.resolvedPotency).toBe(expected);
  });

  it.each([
    // P = 1 − Π(1 − p_i)
    [["burst-shot", "burst-shot"], 254], // floor(220 + 60 * (1 − 0.65²))
    [["heavy-shot", "burst-shot"], 248], // floor(220 + 60 * (1 − 0.8 × 0.65))
  ])("付与元 %j の後のリフルジェントアローは蓄積した確率で期待値威力 %i になる", (sourceIds, expected) => {
    const result = resolve([...sourceIds.map((id) => entry(id)), entry("refulgent-arrow")]);

    const refulgent = result.entries[sourceIds.length];
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(expected);
  });

  // 消費前の付与元は消え、出なかった分岐のバーストショット (1 − 0.5775) × 0.35 = 0.147875 と新たな付与元 0.35 で
  // P = 1 − 0.852125 × 0.65 になる（#842 までは新たな付与元だけの 0.35 で 241 だった）
  it("ホークアイを消費すると蓄積がリセットされ、次の消費は出なかった分岐の付与元と新たな付与元で計算される", () => {
    const result = resolve([
      entry("burst-shot"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
    ]);

    expect(result.entries[2].resolvedPotency).toBe(254);
    const second = result.entries[4];
    expect(second.recastError).toBeFalsy();
    expect(second.comboErrors).toEqual([]);
    expect(second.consumedProc?.procRate).toBeCloseTo(1 - (1 - 0.4225 * 0.35) * 0.65, 10);
    // floor(220 + 60 × 0.44611875)
    expect(second.resolvedPotency).toBe(246);
  });

  // t=0 の付与元は 30 秒で切れる。t=20 の付与元でホークアイ自体は残っている
  it.each([
    [29.9, 254],
    [30, 241],
  ])("t=%s のリフルジェントアローは 30 秒より前の付与元を数えず期待値威力 %i になる", (time, expected) => {
    const result = resolve([entry("burst-shot"), entry("burst-shot", 20), entry("refulgent-arrow", time)]);

    const refulgent = result.entries[2];
    expect(refulgent.startTime).toBe(time);
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(expected);
  });

  it("乱れ撃ちを優先消費した場合はホークアイの蓄積が残る", () => {
    const result = resolve([
      entry("barrage"),
      entry("burst-shot"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("refulgent-arrow"),
    ]);

    expect(result.entries[3].resolvedPotency).toBe(840);
    const second = result.entries[4];
    expect(second.comboErrors).toEqual([]);
    expect(second.resolvedPotency).toBe(254);
  });
});

// 期待値の根拠として画面に出す発動確率 P = 1 − Π(1 − p_i) (#615)
describe("BRD: ホークアイの発動確率 P を解決結果に持たせる (#615)", () => {
  function hawksEyeOf(e: ResolvedTimelineEntry) {
    return e.activeBuffs.find((ab) => ab.buffId === "hawks-eye");
  }

  it("バーストショット → リフルジェントアローは、付与時点も消費時も P = 0.35", () => {
    const result = resolve([entry("burst-shot"), entry("refulgent-arrow")]);

    expect(hawksEyeOf(result.entries[0])?.procRate).toBeCloseTo(0.35, 10);
    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.consumedProc?.buffId).toBe("hawks-eye");
    expect(refulgent.consumedProc?.procRate).toBeCloseTo(0.35, 10);
  });

  it("バーストショット ×2 は、付与時点の P が 1本目 0.35・2本目 1 − 0.65²、消費時も 1 − 0.65²", () => {
    const result = resolve([entry("burst-shot"), entry("burst-shot"), entry("refulgent-arrow")]);

    expect(hawksEyeOf(result.entries[0])?.procRate).toBeCloseTo(0.35, 10);
    expect(hawksEyeOf(result.entries[1])?.procRate).toBeCloseTo(1 - 0.65 ** 2, 10);
    const refulgent = result.entries[2];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.consumedProc?.procRate).toBeCloseTo(1 - 0.65 ** 2, 10);
  });

  // t=0 の付与元は 30 秒で切れるので、t=30 の付与では数えない
  it.each([
    [29.9, 1 - 0.65 ** 2],
    [30, 0.35],
  ])("t=%s に付与したホークアイの P は、効果時間内の付与元だけから %s になる", (time, expected) => {
    const result = resolve([entry("burst-shot"), entry("burst-shot", time)]);

    expect(result.entries[1].startTime).toBe(time);
    expect(result.entries[1].recastError).toBeFalsy();
    expect(hawksEyeOf(result.entries[1])?.procRate).toBeCloseTo(expected, 10);
  });

  // 消費後に残るのは出なかった分岐のバーストショット (1 − 0.5775) × 0.35 だけで、新たな付与元と合成する
  // （#842 までは新たな付与元だけの 0.35 だった）
  it("ホークアイを消費した後の付与は、出なかった分岐の付与元と新たな付与元から P = 1 − (1 − 0.147875) × 0.65 になる", () => {
    const result = resolve([
      entry("burst-shot"),
      entry("burst-shot"),
      entry("refulgent-arrow"),
      entry("burst-shot"),
    ]);

    expect(hawksEyeOf(result.entries[2])?.procRate).toBeCloseTo(0.4225 * 0.35, 10);
    expect(hawksEyeOf(result.entries[3])?.procRate).toBeCloseTo(1 - (1 - 0.4225 * 0.35) * 0.65, 10);
  });

  it("乱れ撃ちを優先消費したリフルジェントアローは P を持たず、乱れ撃ちのバフにも P は無い", () => {
    const result = resolve([entry("barrage"), entry("burst-shot"), entry("refulgent-arrow")]);

    const barrage = result.entries[0].activeBuffs.find((ab) => ab.buffId === "barrage");
    expect(barrage).toBeDefined();
    expect(barrage).not.toHaveProperty("procRate");
    const refulgent = result.entries[2];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(840);
    expect(refulgent.consumedProc).toBeUndefined();
  });
});

// 付与元ごとに「発生した（true）／しなかった（false）」を指定する (#838)
describe("BRD: ホークアイの発生の有無を付与元ごとに指定する (#838)", () => {
  function procEntry(skillId: string, procOccurred: boolean, manualStartTime?: number): TimelineEntry {
    return { ...entry(skillId, manualStartTime), procOccurred };
  }

  function hasHawksEye(e: ResolvedTimelineEntry): boolean {
    return e.activeBuffs.some((ab) => ab.buffId === "hawks-eye");
  }

  const SOURCES = ["heavy-shot", "burst-shot", "iron-jaws", "caustic-bite", "stormbite", "quick-nock", "ladonsbite"];

  it.each(SOURCES)("%s を「発生した」にすると、リフルジェントアローは確定の威力 280（P = 1）になる", (sourceId) => {
    const result = resolve([procEntry(sourceId, true), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(280);
    expect(refulgent.consumedProc).toEqual({ buffId: "hawks-eye", procRate: 1, fallbackSkillName: "バーストショット" });
    // 出なかった分岐が無い（1 − P = 0）ので、ホークアイは付け直さない (#842)
    expect(hasHawksEye(refulgent)).toBe(false);
  });

  // #842 までは発動条件エラーにしていた。P = 0 の枠はバーストショットを撃つフィラー枠として扱う
  it.each(SOURCES)("%s を「しなかった」にするとホークアイが付かず、リフルジェントアローは威力 220 のフィラー枠になり、次の P は 0.35", (sourceId) => {
    const result = resolve([procEntry(sourceId, false), entry("refulgent-arrow"), entry("refulgent-arrow")]);

    expect(hasHawksEye(result.entries[0])).toBe(false);
    const refulgent = result.entries[1];
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.consumedProc?.procRate).toBe(0);
    expect(refulgent.resolvedPotency).toBe(220);
    // フィラー枠で撃ったバーストショットの付与確率 0.35 が、そのまま次の P になる (#842)
    const next = result.entries[2];
    expect(next.recastError).toBeFalsy();
    expect(next.comboErrors).toEqual([]);
    expect(next.consumedProc?.procRate).toBeCloseTo(0.35, 10);
  });

  it("ラドンバイトを「発生した」にすると、シャドウバイトは確定の威力 200 になる", () => {
    const result = resolve([procEntry("ladonsbite", true), entry("shadowbite")]);

    const shadowbite = result.entries[1];
    expect(shadowbite.comboErrors).toEqual([]);
    expect(shadowbite.resolvedPotency).toBe(200);
  });

  it.each([
    // 「しなかった」の付与元は確率の合成から外れ、未指定の 1 本だけで floor(220 + 60 × 0.35) = 241
    ["未指定 → しなかった", 241, [entry("burst-shot"), procEntry("burst-shot", false)]],
    ["しなかった → 未指定", 241, [procEntry("burst-shot", false), entry("burst-shot")]],
    // 「発生した」の付与元が効いていれば、ほかが未指定でも P = 1
    ["発生した → 未指定", 280, [procEntry("burst-shot", true), entry("burst-shot")]],
    ["未指定 → 発生した", 280, [entry("burst-shot"), procEntry("burst-shot", true)]],
  ] as const)("付与元が %s のリフルジェントアローは威力 %i", (_label, expected, sources) => {
    const result = resolve([...sources, entry("refulgent-arrow")]);

    const refulgent = result.entries[2];
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(expected);
  });

  // t=0 の付与は 30 秒で切れる。t=20 の付与元が「しなかった」なら延長されない
  it("「しなかった」の付与元は、効いているホークアイを延長しない", () => {
    const result = resolve([entry("burst-shot"), procEntry("burst-shot", false, 20), entry("refulgent-arrow", 30)]);

    expect(result.entries[1].recastError).toBeFalsy();
    expect(result.entries[1].activeBuffs.find((ab) => ab.buffId === "hawks-eye")?.endTime).toBe(30);
    // t=30 には付与元が無く（P = 0）、フィラー枠になる（#842 までは発動条件エラー）
    const refulgent = result.entries[2];
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.consumedProc?.procRate).toBe(0);
    expect(refulgent.resolvedPotency).toBe(220);
  });

  it("確率付与でないバフは「しなかった」を指定しても付く（乱れ撃ちは 840 のまま）", () => {
    const result = resolve([procEntry("barrage", false), entry("refulgent-arrow")]);

    const refulgent = result.entries[1];
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.resolvedPotency).toBe(840);
  });

  // 既知の制限: バフレーンの P は付与した時点の値（#615）。「発生した」の効果が切れた後の消費は、残りの付与元だけで計算する
  it("「発生した」の後に未指定で延長すると、延長したバフは P を持たず、t=30 の消費は残りの付与元だけで P = 0.35", () => {
    const result = resolve([procEntry("burst-shot", true), entry("burst-shot", 20), entry("refulgent-arrow", 30)]);

    expect(result.entries[1].activeBuffs.find((ab) => ab.buffId === "hawks-eye")).not.toHaveProperty("procRate");
    const refulgent = result.entries[2];
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.consumedProc?.procRate).toBeCloseTo(0.35, 10);
    expect(refulgent.resolvedPotency).toBe(241);
  });
});

// 消費側の枠をフィラー枠として扱い、出なかった分岐で撃つ fallback の GCD の付与確率 (1 − P) × p を次の枠に伝える (#842)
describe("BRD: 消費側の出なかった分岐の付与確率を伝える (#842)", () => {
  function setupLevel(level: PlayerLevel) {
    const buffs = getBuffsForLevel(BRD_BUFFS, level);
    const resources = getResourcesForLevel(BRD_RESOURCES, level);
    const levelBuffIds = new Set(buffs.map((b) => b.id));
    const levelResourceIds = new Set(resources.map((r) => r.id));
    const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, level, levelBuffIds, levelResourceIds);
    const levelSkillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, level, levelBuffIds, levelResourceIds);
    return { buffs, resources, skillMap: levelSkillMap };
  }

  function resolveAtLevel(entries: TimelineEntry[], level: PlayerLevel) {
    const { buffs, resources, skillMap: levelSkillMap } = setupLevel(level);
    return resolveTimeline(entries, levelSkillMap, resources, undefined, buffs);
  }

  // q₁ = 1 − 0.65²、qₙ₊₁ = (1 − qₙ) × 0.35。威力は floor(220 + 60 × P)
  it("ストームバイト → コースティックバイト → リフルジェントアロー ×4 の P と威力", () => {
    const result = resolve([
      entry("stormbite"),
      entry("caustic-bite"),
      ...Array.from({ length: 4 }, () => entry("refulgent-arrow")),
    ]);

    const refulgents = result.entries.slice(2);
    for (const e of refulgents) {
      expect(e.recastError).toBeFalsy();
      expect(e.comboErrors).toEqual([]);
    }
    const procRates = refulgents.map((e) => e.consumedProc?.procRate);
    [0.5775, 0.147875, 0.298244, 0.245615].forEach((expected, i) => expect(procRates[i]).toBeCloseTo(expected, 6));
    expect(refulgents.map((e) => e.resolvedPotency)).toEqual([254, 228, 237, 234]);
    // バフレーンの P（付け直したホークアイ）も、次の消費の P と同じ値になる
    expect(refulgents[0].activeBuffs.find((ab) => ab.buffId === "hawks-eye")?.procRate).toBeCloseTo(0.147875, 10);
  });

  // 1 本目は付与元が無い（P = 0）フィラー枠なので、fallback の付与確率がそのまま 2 本目の P になる
  it.each([
    [70, "refulgent-arrow", "ヘヴィショット", 160, 0.2],
    [80, "shadowbite", "クイックノック", 110, 0.2],
    [100, "shadowbite", "ラドンバイト", 140, 0.35],
  ] as const)("Lv%s の %s は、出なかった分岐で %s（威力 %i・付与確率 %s）を撃つ", (level, skillId, fallbackName, fallbackPotency, rate) => {
    const result = resolveAtLevel([entry(skillId), entry(skillId)], level);

    const [first, second] = result.entries;
    expect(first.resolvedSkillId).toBe(skillId);
    expect(first.comboErrors).toEqual([]);
    expect(first.resolvedPotency).toBe(fallbackPotency);
    expect(first.consumedProc).toEqual({ buffId: "hawks-eye", procRate: 0, fallbackSkillName: fallbackName });
    expect(second.recastError).toBeFalsy();
    expect(second.comboErrors).toEqual([]);
    expect(second.consumedProc?.procRate).toBeCloseTo(rate, 10);
  });

  // 消費側の 4 系統すべてで、fallback のスキルが引けてホークアイを付与し、威力が fallbackPotency と一致する
  // Lv70: ヘヴィショット・クイックノック、Lv80: バーストショット・クイックノック、Lv90 / 100: バーストショット・ラドンバイト
  it.each([70, 80, 90, 100] as const)("Lv%s: ホークアイの消費側の fallbackSkillId は修得済みの付与元で、威力が fallbackPotency と一致する", (level) => {
    const { skillMap: levelSkillMap } = setupLevel(level);
    const consumers = [...levelSkillMap.values()].flatMap((s) =>
      (s.buffConsumptionAnyOf ?? []).filter((o) => o.buffId === "hawks-eye").map((o) => [s.id, o] as const),
    );

    expect(consumers.length).toBeGreaterThan(0);
    for (const [skillId, option] of consumers) {
      const fallback = levelSkillMap.get(option.fallbackSkillId ?? "");
      expect(fallback, skillId).toBeDefined();
      expect(fallback!.buffApplications, skillId).toContain("hawks-eye");
      expect(fallback!.potency, skillId).toBe(option.fallbackPotency);
    }
  });

  // バーストショット（t=0）→ リフルジェントアロー（t=2.5、P = 0.35）が残す付与元 0.65 × 0.35 は t=32.5 で切れる
  it.each([
    [32.4, "0.65 × 0.35", 0.65 * 0.35, 233],
    [32.5, "0", 0, 220],
  ] as const)("t=%s のリフルジェントアローは、出なかった分岐の付与元を 30 秒だけ数えて P = %s・威力 %i になる", (time, _label, expectedP, expectedPotency) => {
    const result = resolve([entry("burst-shot"), entry("refulgent-arrow"), entry("refulgent-arrow", time)]);

    expect(result.entries[1].startTime).toBe(2.5);
    const refulgent = result.entries[2];
    expect(refulgent.startTime).toBe(time);
    expect(refulgent.recastError).toBeFalsy();
    expect(refulgent.comboErrors).toEqual([]);
    expect(refulgent.consumedProc?.procRate).toBeCloseTo(expectedP, 10);
    expect(refulgent.resolvedPotency).toBe(expectedPotency);
  });

  it("上書きで無駄になるプロックの期待値は、ストームバイトで 0、効果中に重ねたコースティックバイトで 0.35 × 0.35", () => {
    const result = resolve([entry("stormbite"), entry("caustic-bite")]);

    expect(result.entries[0].wastedProc).toBeUndefined();
    expect(result.entries[1].wastedProc?.buffId).toBe("hawks-eye");
    expect(result.entries[1].wastedProc?.rate).toBeCloseTo(0.1225, 10);
  });

  // 「発生した」は P × 1、「しなかった」は付与しないので 0 (#838)
  it.each([
    ["発生した", true, 0.35],
    ["しなかった", false, undefined],
  ] as const)("効いているホークアイに「%s」の付与元を重ねると、上書きの期待値は %s", (_label, procOccurred, expected) => {
    const result = resolve([entry("burst-shot"), { ...entry("burst-shot"), procOccurred }]);

    const second = result.entries[1];
    expect(second.recastError).toBeFalsy();
    if (expected === undefined) {
      expect(second.wastedProc).toBeUndefined();
    } else {
      expect(second.wastedProc?.rate).toBeCloseTo(expected, 10);
    }
  });
});
