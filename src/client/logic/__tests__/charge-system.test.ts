import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry } from "../../types/skill";

/** テスト用のスキルを生成するヘルパー */
function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: "",
    recastTime: 0.65,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  };
}

/** タイムラインエントリを生成するヘルパー */
function makeEntry(skillId: string, uid?: string): TimelineEntry {
  return { uid: uid ?? `${skillId}-${Math.random()}`, skillId };
}

describe("チャージシステム", () => {
  describe("チャージなしスキル（従来互換）", () => {
    it("cooldown中に再使用するとrecastErrorになる", () => {
      const skill = makeSkill({ id: "test-skill", cooldown: 30 });
      const skillMap = new Map([[skill.id, skill]]);
      const entries = [makeEntry("test-skill"), makeEntry("test-skill")];

      const result = resolveTimeline(entries, skillMap, []);

      expect(result.entries[0].recastError).toBe(false);
      expect(result.entries[1].recastError).toBe(true);
    });

    it("cooldown経過後は再使用できる", () => {
      // cooldown: 1秒のスキルをGCDを挟んで使用（GCD 2.5sで間隔が空く）
      const oGcd = makeSkill({ id: "short-cd", cooldown: 1 });
      const gcd = makeSkill({
        id: "gcd-skill",
        type: "gcd",
        recastTime: 2.5,
      });
      const skillMap = new Map([
        [oGcd.id, oGcd],
        [gcd.id, gcd],
      ]);
      const entries = [
        makeEntry("short-cd"),
        makeEntry("gcd-skill"),
        makeEntry("short-cd"),
      ];

      const result = resolveTimeline(entries, skillMap, []);

      expect(result.entries[0].recastError).toBe(false);
      expect(result.entries[2].recastError).toBe(false);
    });
  });

  describe("チャージ付きスキル（maxCharges: 2）", () => {
    it("2チャージのスキルを連続2回使用してもエラーにならない", () => {
      const skill = makeSkill({ id: "charged-skill", cooldown: 40, maxCharges: 2 });
      const skillMap = new Map([[skill.id, skill]]);
      const entries = [makeEntry("charged-skill"), makeEntry("charged-skill")];

      const result = resolveTimeline(entries, skillMap, []);

      expect(result.entries[0].recastError).toBe(false);
      expect(result.entries[1].recastError).toBe(false);
    });

    it("2チャージのスキルを3回連続使用すると3回目でエラーになる", () => {
      const skill = makeSkill({ id: "charged-skill", cooldown: 40, maxCharges: 2 });
      const skillMap = new Map([[skill.id, skill]]);
      const entries = [
        makeEntry("charged-skill"),
        makeEntry("charged-skill"),
        makeEntry("charged-skill"),
      ];

      const result = resolveTimeline(entries, skillMap, []);

      expect(result.entries[0].recastError).toBe(false);
      expect(result.entries[1].recastError).toBe(false);
      expect(result.entries[2].recastError).toBe(true);
    });

    it("チャージ消費後、cooldown経過で1チャージ回復する", () => {
      // cooldown: 1s, maxCharges: 2
      // t=0: charged (charges 2→1, nextChargeAt=1.0)
      // t=0.65: charged (charges 1→0, nextChargeAt=1.0)
      // t=1.30: GCD start (actionAvailableAt=1.95, gcdAvailableAt=3.80)
      // t=1.95: charged → nextChargeAt=1.0 <= 1.95 → charges 0→1, 回復済み → OK
      const skill = makeSkill({ id: "charged-skill", cooldown: 1, maxCharges: 2 });
      const gcd = makeSkill({
        id: "gcd-skill",
        type: "gcd",
        recastTime: 2.5,
      });
      const skillMap = new Map([
        [skill.id, skill],
        [gcd.id, gcd],
      ]);
      const entries = [
        makeEntry("charged-skill"),
        makeEntry("charged-skill"),
        makeEntry("gcd-skill"),
        makeEntry("charged-skill"),
      ];

      const result = resolveTimeline(entries, skillMap, []);

      expect(result.entries[0].recastError).toBe(false);
      expect(result.entries[1].recastError).toBe(false);
      expect(result.entries[3].recastError).toBe(false);
    });

    it("チャージ回復は最大チャージ数を超えない", () => {
      // cooldown: 2s, maxCharges: 2
      // t=0: charged (charges 2→1, nextChargeAt=2.0)
      // GCD x3: t=0.65, t=3.15, t=5.65
      // t=6.30: charged → nextChargeAt=2.0<=6.30, charges 1→2, nextChargeAt=null → charges 2→1 (使用)
      // t=6.95: charged → nextChargeAt=8.30, charges 1→0 (使用)
      // t=7.60: charged → nextChargeAt=8.30>7.60, charges=0 → recastError!
      const skill = makeSkill({ id: "charged-skill", cooldown: 2, maxCharges: 2 });
      const gcd = makeSkill({
        id: "gcd-skill",
        type: "gcd",
        recastTime: 2.5,
      });
      const skillMap = new Map([
        [skill.id, skill],
        [gcd.id, gcd],
      ]);
      const entries = [
        makeEntry("charged-skill"),
        makeEntry("gcd-skill"),
        makeEntry("gcd-skill"),
        makeEntry("gcd-skill"),
        makeEntry("charged-skill"),
        makeEntry("charged-skill"),
        makeEntry("charged-skill"),
      ];

      const result = resolveTimeline(entries, skillMap, []);

      // 初回使用: OK
      expect(result.entries[0].recastError).toBe(false);
      // 6.3s経過後: 最大2チャージまで回復 → 2回連続OK
      expect(result.entries[4].recastError).toBe(false);
      expect(result.entries[5].recastError).toBe(false);
      // 3回目はチャージ切れ（cooldown 2sが未経過）
      expect(result.entries[6].recastError).toBe(true);
    });
  });

  describe("チャージが最大状態でのクールダウン", () => {
    it("チャージ最大時はクールダウンが進行しない（回復タイマー停止）", () => {
      const skill = makeSkill({ id: "charged-skill", cooldown: 1, maxCharges: 2 });
      const gcd = makeSkill({
        id: "gcd-skill",
        type: "gcd",
        recastTime: 2.5,
      });
      const skillMap = new Map([
        [skill.id, skill],
        [gcd.id, gcd],
      ]);
      // GCD x2 (5s) → charged x2（初回使用、最大チャージ）→ charged x1 (エラーなし)
      // エラーにならないことを確認（チャージ最大から使用開始）
      const entries = [
        makeEntry("gcd-skill"),
        makeEntry("gcd-skill"),
        makeEntry("charged-skill"),
        makeEntry("charged-skill"),
      ];

      const result = resolveTimeline(entries, skillMap, []);

      expect(result.entries[2].recastError).toBe(false);
      expect(result.entries[3].recastError).toBe(false);
    });
  });

  describe("ライフサージ（竜騎士）シナリオ", () => {
    it("maxCharges: 2のライフサージを連続使用できる", () => {
      const lifeSurge = makeSkill({
        id: "life-surge",
        cooldown: 40,
        maxCharges: 2,
        target: "self",
        potency: 0,
      });
      const gcd = makeSkill({
        id: "true-thrust",
        type: "gcd",
        recastTime: 2.5,
        potency: 230,
      });
      const skillMap = new Map([
        [lifeSurge.id, lifeSurge],
        [gcd.id, gcd],
      ]);
      // GCD → ライフサージ → ライフサージ → GCD
      const entries = [
        makeEntry("true-thrust"),
        makeEntry("life-surge"),
        makeEntry("life-surge"),
        makeEntry("true-thrust"),
      ];

      const result = resolveTimeline(entries, skillMap, []);

      expect(result.entries[1].recastError).toBe(false);
      expect(result.entries[2].recastError).toBe(false);
    });
  });
});
