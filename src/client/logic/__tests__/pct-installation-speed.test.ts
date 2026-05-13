import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { Skill, TimelineEntry, BuffDefinition } from "../../types/skill";

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

// インスタレーション相当の speed バフ（対象スキル限定）
const installationBuff: BuffDefinition = {
  id: "installation-test",
  name: "インスタレーション",
  shortName: "ｲﾝｽﾀ",
  icon: "",
  duration: 30,
  maxStacks: 5,
  effects: [
    {
      type: "speed",
      value: 0.75,
      appliesToSkillIds: [
        "fire-in-red",
        "aero-in-green",
        "water-in-blue",
        "blizzard-in-cyan",
        "stone-in-yellow",
        "thunder-in-magenta",
        "star-prism",
        "holy-in-white",
        "comet-in-black",
      ],
    },
  ],
  color: "#b39ddb",
};

// 黒魔紋相当の speed バフ（全GCD対象、appliesToSkillIds なし）
const leyLinesBuff: BuffDefinition = {
  id: "ley-lines-test",
  name: "黒魔紋",
  shortName: "黒魔紋",
  icon: "",
  duration: 20,
  effects: [{ type: "speed", value: 0.85 }],
  color: "#ab47bc",
};

/** entry のリキャストを startTime と gcdAvailableAt から逆算する */
function recastOf(entry: { startTime: number; gcdAvailableAt: number }): number {
  return Math.round((entry.gcdAvailableAt - entry.startTime) * 1000) / 1000;
}

describe("インスタレーション（対象スキル限定 speed バフ）", () => {
  it("色魔法のリキャストは 25% 短縮される", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["installation-test"] });
    const fireInRed = makeSkill({ id: "fire-in-red" });
    const skillMap = new Map([[grant.id, grant], [fireInRed.id, fireInRed]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("fire-in-red")],
      skillMap,
      [],
      undefined,
      [installationBuff]
    );

    expect(recastOf(result.entries[1])).toBeCloseTo(2.5 * 0.75, 3);
  });

  it("スタープリズム / ホワイトホーリー / ブラックコメットも 25% 短縮される", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["installation-test"] });
    const starPrism = makeSkill({ id: "star-prism" });
    const holyInWhite = makeSkill({ id: "holy-in-white" });
    const cometInBlack = makeSkill({ id: "comet-in-black" });
    const skillMap = new Map([
      [grant.id, grant],
      [starPrism.id, starPrism],
      [holyInWhite.id, holyInWhite],
      [cometInBlack.id, cometInBlack],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("grant"),
        makeEntry("star-prism"),
        makeEntry("holy-in-white"),
        makeEntry("comet-in-black"),
      ],
      skillMap,
      [],
      undefined,
      [installationBuff]
    );

    expect(recastOf(result.entries[1])).toBeCloseTo(2.5 * 0.75, 3);
    expect(recastOf(result.entries[2])).toBeCloseTo(2.5 * 0.75, 3);
    expect(recastOf(result.entries[3])).toBeCloseTo(2.5 * 0.75, 3);
  });

  it("ハンマーコンボのリキャストは短縮されない（対象外）", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["installation-test"] });
    const hammerStamp = makeSkill({ id: "hammer-stamp" });
    const hammerBrush = makeSkill({ id: "hammer-brush" });
    const polishingHammer = makeSkill({ id: "polishing-hammer" });
    const skillMap = new Map([
      [grant.id, grant],
      [hammerStamp.id, hammerStamp],
      [hammerBrush.id, hammerBrush],
      [polishingHammer.id, polishingHammer],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("grant"),
        makeEntry("hammer-stamp"),
        makeEntry("hammer-brush"),
        makeEntry("polishing-hammer"),
      ],
      skillMap,
      [],
      undefined,
      [installationBuff]
    );

    expect(recastOf(result.entries[1])).toBeCloseTo(2.5, 3);
    expect(recastOf(result.entries[2])).toBeCloseTo(2.5, 3);
    expect(recastOf(result.entries[3])).toBeCloseTo(2.5, 3);
  });

  it("描画スキル（creature/weapon/landscape-motif）のリキャストは短縮されない（対象外）", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["installation-test"] });
    const creatureMotif = makeSkill({ id: "creature-motif" });
    const weaponMotif = makeSkill({ id: "weapon-motif" });
    const landscapeMotif = makeSkill({ id: "landscape-motif" });
    const skillMap = new Map([
      [grant.id, grant],
      [creatureMotif.id, creatureMotif],
      [weaponMotif.id, weaponMotif],
      [landscapeMotif.id, landscapeMotif],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("grant"),
        makeEntry("creature-motif"),
        makeEntry("weapon-motif"),
        makeEntry("landscape-motif"),
      ],
      skillMap,
      [],
      undefined,
      [installationBuff]
    );

    expect(recastOf(result.entries[1])).toBeCloseTo(2.5, 3);
    expect(recastOf(result.entries[2])).toBeCloseTo(2.5, 3);
    expect(recastOf(result.entries[3])).toBeCloseTo(2.5, 3);
  });

  it("レインボードリップのリキャストは短縮されない（対象外）", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["installation-test"] });
    const rainbowDrip = makeSkill({ id: "rainbow-drip" });
    const skillMap = new Map([[grant.id, grant], [rainbowDrip.id, rainbowDrip]]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("rainbow-drip")],
      skillMap,
      [],
      undefined,
      [installationBuff]
    );

    expect(recastOf(result.entries[1])).toBeCloseTo(2.5, 3);
  });

  it("詠唱時間も対象スキルにのみ短縮される（色魔法は短縮 / ハンマーは対象外）", () => {
    // ハンマー系は本来詠唱なしだが、フィルタの作用をテストするため castTime を持たせる
    const grant = makeSkill({ id: "grant", buffApplications: ["installation-test"] });
    const fireInRed = makeSkill({ id: "fire-in-red", castTime: 1.5 });
    const hammerStamp = makeSkill({ id: "hammer-stamp", castTime: 1.5 });
    const skillMap = new Map([
      [grant.id, grant],
      [fireInRed.id, fireInRed],
      [hammerStamp.id, hammerStamp],
    ]);

    const result = resolveTimeline(
      [makeEntry("grant"), makeEntry("fire-in-red"), makeEntry("hammer-stamp")],
      skillMap,
      [],
      undefined,
      [installationBuff]
    );

    expect(result.entries[1].castTime).toBeCloseTo(1.5 * 0.75, 3);
    expect(result.entries[2].castTime).toBeCloseTo(1.5, 3);
  });
});

describe("黒魔紋（全GCD対象 speed バフ、appliesToSkillIds なし）回帰テスト", () => {
  it("appliesToSkillIds が無い speed バフは全GCDのリキャストを短縮する（回帰）", () => {
    const grant = makeSkill({ id: "grant", buffApplications: ["ley-lines-test"] });
    const fireInRed = makeSkill({ id: "fire-in-red" });
    const hammerStamp = makeSkill({ id: "hammer-stamp" });
    const rainbowDrip = makeSkill({ id: "rainbow-drip" });
    const skillMap = new Map([
      [grant.id, grant],
      [fireInRed.id, fireInRed],
      [hammerStamp.id, hammerStamp],
      [rainbowDrip.id, rainbowDrip],
    ]);

    const result = resolveTimeline(
      [
        makeEntry("grant"),
        makeEntry("fire-in-red"),
        makeEntry("hammer-stamp"),
        makeEntry("rainbow-drip"),
      ],
      skillMap,
      [],
      undefined,
      [leyLinesBuff]
    );

    expect(recastOf(result.entries[1])).toBeCloseTo(2.5 * 0.85, 3);
    expect(recastOf(result.entries[2])).toBeCloseTo(2.5 * 0.85, 3);
    expect(recastOf(result.entries[3])).toBeCloseTo(2.5 * 0.85, 3);
  });
});
