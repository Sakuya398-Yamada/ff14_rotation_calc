import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, BuffDefinition } from "../../types/skill";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";
import { WHM_BUFFS } from "../../data/whm-buffs";
import { PCT_ATTACK_SKILLS } from "../../data/pct-skills";
import { PCT_BUFFS } from "../../data/pct-buffs";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";

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

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

const triplecastBuff: BuffDefinition = {
  id: "triplecast-test",
  name: "三連魔",
  shortName: "三連魔",
  icon: "",
  duration: 15,
  maxStacks: 3,
  effects: [{ type: "instantCast", value: 0 }],
  color: "#ffee58",
};

const firestarterBuff: BuffDefinition = {
  id: "firestarter-test",
  name: "ファイアスターター",
  shortName: "FS",
  icon: "",
  duration: null,
  effects: [{ type: "instantCast", value: 0 }],
  color: "#ff7043",
};

describe("instantCast バフ（詠唱破棄）", () => {
  it("triplecast 3スタックは詠唱GCDを打つ度に1スタック消費し、3発目後に失効する", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["triplecast-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [
        makeEntry("grant"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
      ],
      skillMap,
      [],
      undefined,
      [triplecastBuff]
    );

    // 1〜3発目の詠唱スキルは castTime=0（Instant化）
    expect(result.entries[1].castTime).toBe(0);
    expect(result.entries[2].castTime).toBe(0);
    expect(result.entries[3].castTime).toBe(0);

    // 4発目は triplecast 失効済みのため castTime が元の値で計算される（速度バフなし = 2.8）
    expect(result.entries[4].castTime).toBeCloseTo(2.8, 3);

    // 最終エントリの activeBuffs は triplecast を含まない（3発で使い切った）
    expect(result.entries[4].activeBuffs.some((ab) => ab.buffId === "triplecast-test")).toBe(false);
  });

  it("firestarter（単発バフ）は1回の詠唱GCDで消費され、次の詠唱スキルは通常の詠唱時間に戻る", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["firestarter-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("cast-spell"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [firestarterBuff]
    );

    expect(result.entries[1].castTime).toBe(0);
    // 消費後は通常詠唱
    expect(result.entries[2].castTime).toBeCloseTo(2.8, 3);

    // 消費されたので2発目時点ではバフは存在しない
    expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "firestarter-test")).toBe(false);
  });

  it("非詠唱GCD（castTime 未設定）は instantCast バフを消費しない", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["firestarter-test"] });
    const instantSkill = makeSkill({ id: "instant-skill" }); // castTime なし
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([
      [grant.id, grant],
      [instantSkill.id, instantSkill],
      [castSpell.id, castSpell],
    ]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("instant-skill"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [firestarterBuff]
    );

    // 非詠唱GCD では消費されず、次の詠唱スキルで消費される
    expect(result.entries[1].castTime).toBe(0);
    expect(result.entries[2].castTime).toBe(0);
    // 3発目の詠唱スキルで firestarter が消費されている（snapshot は消費後なので含まれない）
    expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "firestarter-test")).toBe(false);
  });

  it("oGCD は instantCast バフを消費しない（詠唱GCDでのみ消費）", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["firestarter-test"] });
    const ability = makeSkill({ id: "ability", type: "ogcd", recastTime: 30 });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([
      [grant.id, grant],
      [ability.id, ability],
      [castSpell.id, castSpell],
    ]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("ability"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [firestarterBuff]
    );

    // oGCD 実行後も firestarter バフは残り、次の詠唱 GCD で Instant 化される
    expect(result.entries[2].castTime).toBe(0);
  });

  it("instantCast バフなしでは詠唱スキルが speed バフの影響を受ける（回帰チェック）", () => {
    const speedBuff: BuffDefinition = {
      id: "speed-buff",
      name: "スピード",
      shortName: "SP",
      icon: "",
      duration: 30,
      effects: [{ type: "speed", value: 0.85 }],
      color: "#888888",
    };
    const grant = makeSkill({ id: "grant", buffApplications: ["speed-buff"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [speedBuff]
    );

    // speed バフで詠唱が 2.8 * 0.85 = 2.38 になる
    expect(result.entries[1].castTime).toBeCloseTo(2.38, 3);
  });

  it("speed バフと instantCast バフが共存すると instantCast が優先される（castTime=0）", () => {
    const speedBuff: BuffDefinition = {
      id: "speed-buff",
      name: "スピード",
      shortName: "SP",
      icon: "",
      duration: 30,
      effects: [{ type: "speed", value: 0.85 }],
      color: "#888888",
    };
    const grant = makeSkill({ id: "grant", buffApplications: ["speed-buff", "triplecast-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [speedBuff, triplecastBuff]
    );

    expect(result.entries[1].castTime).toBe(0);
  });
});

describe("迅速魔（Swiftcast）統合スモークテスト", () => {
  it.each([
    { job: "WHM", skills: WHM_ATTACK_SKILLS, buffs: WHM_BUFFS, castSkillId: "stone" },
    { job: "PCT", skills: PCT_ATTACK_SKILLS, buffs: PCT_BUFFS, castSkillId: "fire-in-red" },
    { job: "BLM", skills: BLM_ATTACK_SKILLS, buffs: BLM_BUFFS, castSkillId: "fire-3" },
  ])(
    "$job: 迅速魔バフ中の次の詠唱GCDは castTime=0 で発動し、消費後は通常詠唱に戻る",
    ({ skills, buffs, castSkillId }) => {
      const skillMap = new Map(skills.map((s) => [s.id, s]));
      const swiftcastSkill = skills.find((s) => s.id === "swiftcast");
      const castSpell = skills.find((s) => s.id === castSkillId);
      const swiftcastBuff = buffs.find((b) => b.id === "swiftcast");

      expect(swiftcastSkill).toBeDefined();
      expect(castSpell).toBeDefined();
      expect(castSpell!.castTime ?? 0).toBeGreaterThan(0);
      expect(swiftcastBuff).toBeDefined();
      expect(swiftcastBuff!.duration).toBe(10);
      expect(swiftcastBuff!.effects.some((e) => e.type === "instantCast")).toBe(true);

      const result = resolveTimeline(
        [makeEntry("swiftcast"), makeEntry(castSkillId), makeEntry(castSkillId)],
        skillMap,
        [],
        undefined,
        buffs
      );

      // 1発目の詠唱GCDはInstant化
      expect(result.entries[1].castTime).toBe(0);
      // 消費後は通常詠唱に戻る（speedバフ等は付与していないので castTime はそのまま）
      expect(result.entries[2].castTime).toBeCloseTo(castSpell!.castTime!, 3);
      // 2発目時点で swiftcast バフは消費済み
      expect(
        result.entries[2].activeBuffs.some((ab) => ab.buffId === "swiftcast")
      ).toBe(false);
    }
  );
});

describe("instantCast バフの appliesToSkillIds スコープ制限", () => {
  it("appliesToSkillIds 指定時、対象スキル以外では消費・Instant 化されない", () => {
    const scopedBuff: BuffDefinition = {
      id: "scoped-instant",
      name: "限定Instant",
      shortName: "限",
      icon: "",
      duration: null,
      effects: [{ type: "instantCast", value: 0, appliesToSkillIds: ["target-spell"] }],
      color: "#ffab91",
    };
    const grant = makeSkill({ id: "grant", buffApplications: ["scoped-instant"] });
    const otherSpell = makeSkill({ id: "other-spell", castTime: 2.5 });
    const targetSpell = makeSkill({ id: "target-spell", castTime: 3.5 });
    const skillMap = new Map([
      [grant.id, grant],
      [otherSpell.id, otherSpell],
      [targetSpell.id, targetSpell],
    ]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("other-spell"), makeEntry("target-spell"), makeEntry("target-spell")],
      skillMap,
      [],
      undefined,
      [scopedBuff]
    );

    // 対象外スキル（other-spell）では Instant 化されず、バフも消費されない
    expect(result.entries[1].castTime).toBeCloseTo(2.5, 3);
    expect(result.entries[1].activeBuffs.some((ab) => ab.buffId === "scoped-instant")).toBe(true);

    // 対象スキル（target-spell）では Instant 化され、バフが消費される
    expect(result.entries[2].castTime).toBe(0);
    expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "scoped-instant")).toBe(false);

    // 消費後、次の対象スキルは通常詠唱に戻る
    expect(result.entries[3].castTime).toBeCloseTo(3.5, 3);
  });

  it("BLM firestarter はファイガ（fire-3）のみを Instant 化し、ファイア（fire）では消費されない", () => {
    const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));
    const firestarterBuffDef = BLM_BUFFS.find((b) => b.id === "firestarter")!;
    const fire = BLM_ATTACK_SKILLS.find((s) => s.id === "fire")!;
    const fire3 = BLM_ATTACK_SKILLS.find((s) => s.id === "fire-3")!;

    expect(firestarterBuffDef.effects[0]).toMatchObject({
      type: "instantCast",
      appliesToSkillIds: ["fire-3"],
    });
    expect(fire.castTime).toBeGreaterThan(0);
    expect(fire3.castTime).toBeGreaterThan(0);

    // パラドックス（AF 中に firestarter 付与）の前提条件を構築せず、テスト用 grant スキルで
    // firestarter を直接付与する。fire-4 は requiredBuff: astral-fire-3 を持つためリソースエラーで
    // 消費判定がスキップされ得るので、本テストでは fire / fire-3 のみで検証する。
    const grant = makeSkill({ id: "test-grant-firestarter", buffApplications: ["firestarter"] });
    const augmented = new Map(skillMap);
    augmented.set(grant.id, grant);

    const result = resolveTimeline(
      [
        makeEntry("test-grant-firestarter"),
        makeEntry("fire"),
        makeEntry("fire-3"),
        makeEntry("fire-3"),
      ],
      augmented,
      [],
      undefined,
      BLM_BUFFS
    );

    // ファイア（fire）は Instant 化されず、firestarter は残ったまま
    expect(result.entries[1].castTime).toBeGreaterThan(0);
    expect(result.entries[1].activeBuffs.some((ab) => ab.buffId === "firestarter")).toBe(true);

    // ファイガ（fire-3）で初めて Instant 化されてバフが消費される
    expect(result.entries[2].castTime).toBe(0);
    expect(result.entries[2].activeBuffs.some((ab) => ab.buffId === "firestarter")).toBe(false);

    // 消費後の 2 発目ファイガは通常詠唱に戻る
    expect(result.entries[3].castTime).toBeGreaterThan(0);
  });
});

describe("consumeOnGcd と instantCast を併せ持つバフ（消費ロジック統合）", () => {
  // 現状そのようなバフ定義は存在しないが、将来追加された際に同一バフが
  // 1 発で 2 回デクリメントされる構造的リスクを排除した #198 の回帰テスト。
  it("両エフェクトを持つスタック式バフは詠唱GCD 1発でスタックが1だけ減る（二重消費しない）", () => {
    const dualBuff: BuffDefinition = {
      id: "dual-effect-test",
      name: "両効果バフ",
      shortName: "両",
      icon: "",
      duration: null,
      maxStacks: 2,
      effects: [
        { type: "instantCast", value: 0 },
        { type: "consumeOnGcd", value: 0 },
      ],
      color: "#90caf9",
    };
    const grant = makeSkill({ id: "grant", buffApplications: ["dual-effect-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [
        makeEntry("grant"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
        makeEntry("cast-spell"),
      ],
      skillMap,
      [],
      undefined,
      [dualBuff]
    );

    // ActiveBuff オブジェクトはエントリ間で参照を共有するため stacks の数値比較は
    // 安定しない。配列への含有／除外（splice の有無）でスタックの段階消費を検証する。
    // 二重消費が起きていれば 1 発目で stacks=0 になり splice されて entries[1] から消失する。

    // 1発目 cast-spell 後: dualBuff はまだ存在する（stacks 2→1。二重消費していない）
    expect(
      result.entries[1].activeBuffs.some((ab) => ab.buffId === "dual-effect-test")
    ).toBe(true);

    // 2発目 cast-spell 後: stacks 1→0 で splice され消失
    expect(
      result.entries[2].activeBuffs.some((ab) => ab.buffId === "dual-effect-test")
    ).toBe(false);

    // 1〜2発目は instantCast で詠唱破棄、3発目はバフ失効後で通常詠唱
    expect(result.entries[1].castTime).toBe(0);
    expect(result.entries[2].castTime).toBe(0);
    expect(result.entries[3].castTime).toBeCloseTo(2.8, 3);
  });

  it("両エフェクトを持つ単発バフは詠唱GCD 1発で消費される（重複削除エラーなし）", () => {
    const dualSingleBuff: BuffDefinition = {
      id: "dual-single-test",
      name: "両効果単発バフ",
      shortName: "両単",
      icon: "",
      duration: null,
      effects: [
        { type: "instantCast", value: 0 },
        { type: "consumeOnGcd", value: 0 },
      ],
      color: "#a5d6a7",
    };
    const grant = makeSkill({ id: "grant", buffApplications: ["dual-single-test"] });
    const castSpell = makeSkill({ id: "cast-spell", castTime: 2.8 });
    const skillMap = new Map([[grant.id, grant], [castSpell.id, castSpell]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("cast-spell"), makeEntry("cast-spell")],
      skillMap,
      [],
      undefined,
      [dualSingleBuff]
    );

    // 1発目で消費されてバフ消失（2回 splice しようとしてもエラーにならない）
    expect(result.entries[1].activeBuffs.some((ab) => ab.buffId === "dual-single-test")).toBe(false);
    // 1発目は instantCast 適用、2発目はバフ失効で通常詠唱
    expect(result.entries[1].castTime).toBe(0);
    expect(result.entries[2].castTime).toBeCloseTo(2.8, 3);
  });
});
