import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, BuffDefinition } from "../../types/skill";

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

function makeEntry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

/** テスト用のレディバフ定義 */
function makeReadyBuff(id: string): BuffDefinition {
  return {
    id,
    name: id,
    shortName: id,
    icon: "",
    duration: 20,
    effects: [],
    color: "#000",
    maxStacks: 1,
  };
}

describe("竜騎士バフ条件による使用制限", () => {
  const diveReady = makeReadyBuff("dive-ready");
  const dragonsFlightBuff = makeReadyBuff("dragons-flight");
  const nastrondReady = makeReadyBuff("nastrond-ready");
  const stardiverReady = makeReadyBuff("stardiver-ready");
  const starcrossReady = makeReadyBuff("starcross-ready");

  const allBuffs = [diveReady, dragonsFlightBuff, nastrondReady, stardiverReady, starcrossReady];

  describe("ミラージュダイブ → ダイブレディが必要", () => {
    it("ダイブレディなしで使用するとcomboErrorになる", () => {
      const mirageDive = makeSkill({
        id: "mirage-dive",
        buffConsumptions: [{ buffId: "dive-ready", stacks: 1 }],
      });
      const skillMap = new Map([[mirageDive.id, mirageDive]]);

      const result = resolveTimeline([makeEntry("mirage-dive")], skillMap, [], undefined, allBuffs);

      expect(result.entries[0].comboErrors).toContain("dive-ready");
    });

    it("ハイジャンプ後にダイブレディが付与されミラージュダイブが使える", () => {
      const highJump = makeSkill({
        id: "high-jump",
        cooldown: 30,
        buffApplications: ["dive-ready"],
      });
      const mirageDive = makeSkill({
        id: "mirage-dive",
        buffConsumptions: [{ buffId: "dive-ready", stacks: 1 }],
      });
      const skillMap = new Map([
        [highJump.id, highJump],
        [mirageDive.id, mirageDive],
      ]);

      const result = resolveTimeline(
        [makeEntry("high-jump"), makeEntry("mirage-dive")],
        skillMap, [], undefined, allBuffs,
      );

      expect(result.entries[0].comboErrors).toHaveLength(0);
      expect(result.entries[1].comboErrors).toHaveLength(0);
    });
  });

  describe("ドラゴンライズ → ドラゴンフライトが必要", () => {
    it("ドラゴンフライトなしで使用するとcomboErrorになる", () => {
      const riseOfDragon = makeSkill({
        id: "rise-of-the-dragon",
        buffConsumptions: [{ buffId: "dragons-flight", stacks: 1 }],
      });
      const skillMap = new Map([[riseOfDragon.id, riseOfDragon]]);

      const result = resolveTimeline([makeEntry("rise-of-the-dragon")], skillMap, [], undefined, allBuffs);

      expect(result.entries[0].comboErrors).toContain("dragons-flight");
    });

    it("ドラゴンダイブ後にドラゴンフライトが付与されドラゴンライズが使える", () => {
      const dragonfireDive = makeSkill({
        id: "dragonfire-dive",
        cooldown: 120,
        buffApplications: ["dragons-flight"],
      });
      const riseOfDragon = makeSkill({
        id: "rise-of-the-dragon",
        buffConsumptions: [{ buffId: "dragons-flight", stacks: 1 }],
      });
      const skillMap = new Map([
        [dragonfireDive.id, dragonfireDive],
        [riseOfDragon.id, riseOfDragon],
      ]);

      const result = resolveTimeline(
        [makeEntry("dragonfire-dive"), makeEntry("rise-of-the-dragon")],
        skillMap, [], undefined, allBuffs,
      );

      expect(result.entries[0].comboErrors).toHaveLength(0);
      expect(result.entries[1].comboErrors).toHaveLength(0);
    });
  });

  describe("ナーストレンド → ナーストレンドレディが必要", () => {
    it("ナーストレンドレディなしで使用するとcomboErrorになる", () => {
      const nastrond = makeSkill({
        id: "nastrond",
        buffConsumptions: [{ buffId: "nastrond-ready", stacks: 1 }],
      });
      const skillMap = new Map([[nastrond.id, nastrond]]);

      const result = resolveTimeline([makeEntry("nastrond")], skillMap, [], undefined, allBuffs);

      expect(result.entries[0].comboErrors).toContain("nastrond-ready");
    });
  });

  describe("ゲイルスコグル → ナーストレンド・スターダイバーの連携", () => {
    it("ゲイルスコグル後にナーストレンドとスターダイバーが使える", () => {
      const geirskogul = makeSkill({
        id: "geirskogul",
        cooldown: 60,
        buffApplications: ["life-of-the-dragon", "nastrond-ready", "stardiver-ready"],
      });
      const nastrond = makeSkill({
        id: "nastrond",
        cooldown: 2,
        buffConsumptions: [{ buffId: "nastrond-ready", stacks: 1 }],
      });
      const stardiver = makeSkill({
        id: "stardiver",
        cooldown: 30,
        buffConsumptions: [{ buffId: "stardiver-ready", stacks: 1 }],
        buffApplications: ["starcross-ready"],
      });
      const skillMap = new Map([
        [geirskogul.id, geirskogul],
        [nastrond.id, nastrond],
        [stardiver.id, stardiver],
      ]);

      const result = resolveTimeline(
        [makeEntry("geirskogul"), makeEntry("nastrond"), makeEntry("stardiver")],
        skillMap, [], undefined, [...allBuffs],
      );

      expect(result.entries[0].comboErrors).toHaveLength(0);
      expect(result.entries[1].comboErrors).toHaveLength(0);
      expect(result.entries[2].comboErrors).toHaveLength(0);
    });

    it("ナーストレンドを2回使用すると2回目でcomboErrorになる", () => {
      const geirskogul = makeSkill({
        id: "geirskogul",
        cooldown: 60,
        buffApplications: ["life-of-the-dragon", "nastrond-ready", "stardiver-ready"],
      });
      const nastrond = makeSkill({
        id: "nastrond",
        cooldown: 2,
        buffConsumptions: [{ buffId: "nastrond-ready", stacks: 1 }],
      });
      const skillMap = new Map([
        [geirskogul.id, geirskogul],
        [nastrond.id, nastrond],
      ]);

      const result = resolveTimeline(
        [makeEntry("geirskogul"), makeEntry("nastrond"), makeEntry("nastrond")],
        skillMap, [], undefined, allBuffs,
      );

      expect(result.entries[1].comboErrors).toHaveLength(0);
      expect(result.entries[2].comboErrors).toContain("nastrond-ready");
    });
  });

  describe("スターダイバー → スタークロッサーの連携", () => {
    it("スターダイバー後にスタークロッサーが使える", () => {
      const geirskogul = makeSkill({
        id: "geirskogul",
        cooldown: 60,
        buffApplications: ["life-of-the-dragon", "nastrond-ready", "stardiver-ready"],
      });
      const stardiver = makeSkill({
        id: "stardiver",
        cooldown: 30,
        buffConsumptions: [{ buffId: "stardiver-ready", stacks: 1 }],
        buffApplications: ["starcross-ready"],
      });
      const starcross = makeSkill({
        id: "starcross",
        cooldown: 1,
        buffConsumptions: [{ buffId: "starcross-ready", stacks: 1 }],
      });
      const skillMap = new Map([
        [geirskogul.id, geirskogul],
        [stardiver.id, stardiver],
        [starcross.id, starcross],
      ]);

      const result = resolveTimeline(
        [makeEntry("geirskogul"), makeEntry("stardiver"), makeEntry("starcross")],
        skillMap, [], undefined, allBuffs,
      );

      expect(result.entries[0].comboErrors).toHaveLength(0);
      expect(result.entries[1].comboErrors).toHaveLength(0);
      expect(result.entries[2].comboErrors).toHaveLength(0);
    });

    it("スターダイバーなしでスタークロッサーを使用するとcomboErrorになる", () => {
      const starcross = makeSkill({
        id: "starcross",
        cooldown: 1,
        buffConsumptions: [{ buffId: "starcross-ready", stacks: 1 }],
      });
      const skillMap = new Map([[starcross.id, starcross]]);

      const result = resolveTimeline([makeEntry("starcross")], skillMap, [], undefined, allBuffs);

      expect(result.entries[0].comboErrors).toContain("starcross-ready");
    });
  });
});
