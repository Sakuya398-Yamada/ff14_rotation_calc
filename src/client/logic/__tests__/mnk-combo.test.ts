import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { MNK_ATTACK_SKILLS } from "../../data/mnk-skills";
import { MNK_BUFFS } from "../../data/mnk-buffs";
import { MNK_RESOURCES } from "../../data/mnk-resources";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(MNK_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string, manualStartTime?: number): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId, manualStartTime };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, MNK_RESOURCES, undefined, MNK_BUFFS).entries;
}

describe("MNK: 型コンボ（壱→弐→参）と功力", () => {
  it("演武 → 双竜脚 → 双掌打 → 破砕拳 で功力が付与される", () => {
    const result = resolveTimeline(
      [entry("form-shift"), entry("dragon-kick"), entry("twin-snakes"), entry("demolish")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    // 双竜脚は零の型（演武）でバイパス成立
    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resourceSnapshot["opo-fury"]).toBe(1);
    // 双掌打: 双竜脚（壱の型のWS）から弐の型コンボ成立
    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[2].resourceSnapshot["raptor-fury"]).toBe(1);
    // 破砕拳: 参の功力が2スタック付与される
    expect(result.entries[3].wsComboError).toBe(false);
    expect(result.entries[3].resourceSnapshot["coeurl-fury"]).toBe(2);
  });

  it("功力保有時、猿舞連撃／竜頷正拳撃／虎襲崩拳が功力版に自動変化して消費する", () => {
    const result = resolveTimeline(
      [
        entry("form-shift"),
        entry("dragon-kick"), // opo-fury +1
        entry("twin-snakes"), // raptor-fury +1
        entry("demolish"), // coeurl-fury +2
        entry("leaping-opo"), // → leaping-opo-fury (460)
        entry("rising-raptor"), // → rising-raptor-fury (540)
        entry("pouncing-coeurl"), // → pouncing-coeurl-fury (520)、参の功力残1
        entry("dragon-kick"),
        entry("twin-snakes"),
        entry("pouncing-coeurl"), // → 功力版で残りの参の功力を消費
      ],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[4].resolvedSkillId).toBe("leaping-opo-fury");
    expect(result.entries[4].resolvedPotency).toBe(460);
    expect(result.entries[4].resourceSnapshot["opo-fury"]).toBe(0);

    expect(result.entries[5].resolvedSkillId).toBe("rising-raptor-fury");
    expect(result.entries[5].resolvedPotency).toBe(540);
    expect(result.entries[5].resourceSnapshot["raptor-fury"]).toBe(0);

    // 参の功力は2スタックから1ずつ消費される
    expect(result.entries[6].resolvedSkillId).toBe("pouncing-coeurl-fury");
    expect(result.entries[6].resolvedPotency).toBe(520);
    expect(result.entries[6].resourceSnapshot["coeurl-fury"]).toBe(1);

    expect(result.entries[9].resolvedSkillId).toBe("pouncing-coeurl-fury");
    expect(result.entries[9].resourceSnapshot["coeurl-fury"]).toBe(0);
  });

  it("功力なしでは基本威力のまま（自動変化しない）", () => {
    const result = resolveTimeline(
      [entry("form-shift"), entry("leaping-opo")],
      skillMap,
      MNK_RESOURCES,
      undefined,
      MNK_BUFFS
    );

    expect(result.entries[1].resolvedSkillId).toBe("leaping-opo");
    expect(result.entries[1].resolvedPotency).toBe(260);
  });

  it("型の順序違反は発動条件エラーになり功力も付与されない", () => {
    // 双竜脚（壱の型のWS）は弐の型を付けるので、参の型の破砕拳は撃てない
    const e = resolve([entry("form-shift"), entry("dragon-kick"), entry("demolish")]);

    expect(e[2].comboErrors.map((err) => err.buffId)).toEqual(["coeurl-form"]);
    expect(e[2].wsComboError).toBe(false);
    expect(e[2].resourceSnapshot["coeurl-fury"] ?? 0).toBe(0);
  });

  it("壊神衝は壱の型成立時に威力120、不成立時は110", () => {
    const e = resolve([
      entry("arm-of-the-destroyer"),
      entry("four-point-fury"),
      entry("rockbreaker"),
      entry("arm-of-the-destroyer"),
    ]);

    // 1つ目: 型なし → 撃てるが非コンボ威力
    expect(e[0].comboErrors).toEqual([]);
    expect(e[0].wsComboError).toBe(true);
    expect(e[0].resolvedPotency).toBe(110);
    // 壊神衝 → 弐の型 → 四面脚 → 参の型 → 地烈斬 → 壱の型
    expect(e[1].comboErrors).toEqual([]);
    expect(e[2].comboErrors).toEqual([]);
    // 4つ目は地烈斬が付けた壱の型で成立して威力120
    expect(e[3].comboErrors).toEqual([]);
    expect(e[3].wsComboError).toBe(false);
    expect(e[3].resolvedPotency).toBe(120);
  });
});

describe("MNK: 型の発動条件（#610）", () => {
  // ジョブガイドで「発動条件：「弐の型」／「参の型」効果中」の WS（パレットに出すもの）
  const FORM_REQUIRED_WS: [string, string][] = [
    ["true-strike", "raptor-form"],
    ["twin-snakes", "raptor-form"],
    ["four-point-fury", "raptor-form"],
    ["rising-raptor", "raptor-form"],
    ["snap-punch", "coeurl-form"],
    ["demolish", "coeurl-form"],
    ["rockbreaker", "coeurl-form"],
    ["pouncing-coeurl", "coeurl-form"],
  ];

  it.each(FORM_REQUIRED_WS)("型の無い状態で %s を置くと %s の発動条件エラーになる", (skillId, formId) => {
    const e = resolve([entry(skillId)]);

    expect(e[0].comboErrors).toEqual([{ buffId: formId, kind: "missing" }]);
  });

  it("功力版に変化した竜頷正拳撃も、弐の型が無ければ発動条件エラーになり功力を消費しない", () => {
    // 双掌打は参の型を付けるので、続く竜頷正拳撃は弐の型が無い
    const e = resolve([entry("form-shift"), entry("dragon-kick"), entry("twin-snakes"), entry("rising-raptor")]);

    expect(e[3].resolvedSkillId).toBe("rising-raptor-fury");
    expect(e[3].comboErrors.map((err) => err.buffId)).toEqual(["raptor-form"]);
    expect(e[3].resourceSnapshot["raptor-fury"]).toBe(1);
  });

  it.each([
    ["perfect-balance", "twin-snakes", "raptor-fury", 1],
    ["perfect-balance", "demolish", "coeurl-fury", 2],
    ["form-shift", "twin-snakes", "raptor-fury", 1],
    ["form-shift", "demolish", "coeurl-fury", 2],
  ])("%s の効果中は型が無くても %s を撃て、功力が付く", (enablerId, skillId, furyId, fury) => {
    const e = resolve([entry(enablerId), entry(skillId)]);

    expect(e[1].comboErrors).toEqual([]);
    expect(e[1].resourceErrors).toEqual([]);
    expect(e[1].recastError).toBeFalsy();
    expect(e[1].wsComboError).toBe(false);
    expect(e[1].resourceSnapshot[furyId]).toBe(fury);
  });

  // 型の効果時間は 30 秒（コンボタイマーの 15 秒ではない）。時刻ごとに別のタイムラインで解決する。
  // 零の型（30 秒）で成立しないよう、演武は置かない
  it.each([
    [20, []],
    [31, ["raptor-form"]],
  ])("双竜脚の %s 秒後に置いた双掌打の発動条件エラーは %j", (time, expected) => {
    const e = resolve([entry("dragon-kick"), entry("twin-snakes", time)]);

    expect(e[1].recastError).toBeFalsy();
    expect(e[1].comboErrors.map((err) => err.buffId)).toEqual(expected);
    expect(e[1].resourceSnapshot["raptor-fury"] ?? 0).toBe(expected.length === 0 ? 1 : 0);
  });

  it("踏鳴の効果中に撃った WS も次の型を付ける", () => {
    // 踏鳴の 3 スタックを双竜脚で使い切ったあと、最後の双竜脚が付けた弐の型で双掌打を撃てる
    const e = resolve([
      entry("perfect-balance"),
      entry("dragon-kick"),
      entry("dragon-kick"),
      entry("dragon-kick"),
      entry("twin-snakes"),
    ]);

    expect(e[4].activeBuffsAtUse.map((b) => b.buffId)).not.toContain("perfect-balance");
    expect(e[4].comboErrors).toEqual([]);
    expect(e[4].wsComboError).toBe(false);
  });

  it("演武は今の型を外さないが、零の型で撃った WS が次の型を付けるので回しは変わらない", () => {
    // 双竜脚（弐の型）→ 演武（零の型）→ 参の型の破砕拳は零の型で撃て、壱の型を付ける
    const e = resolve([entry("dragon-kick"), entry("form-shift"), entry("demolish"), entry("dragon-kick")]);

    expect(e[2].comboErrors).toEqual([]);
    expect(e[2].resourceSnapshot["coeurl-fury"]).toBe(2);
    expect(e[3].comboErrors).toEqual([]);
    expect(e[3].wsComboError).toBe(false);
    expect(e[3].resourceSnapshot["opo-fury"]).toBe(1);
  });

  it("型の付かない GCD（六合星導脚）を挟んでも型は切れない", () => {
    const e = resolve([entry("dragon-kick"), entry("six-sided-star"), entry("twin-snakes")]);

    expect(e[1].comboErrors).toEqual([]);
    expect(e[1].resourceErrors).toEqual([]);
    expect(e[1].recastError).toBeFalsy();
    expect(e[2].comboErrors).toEqual([]);
    expect(e[2].wsComboError).toBe(false);
    expect(e[2].resourceSnapshot["raptor-fury"]).toBe(1);
  });
});
