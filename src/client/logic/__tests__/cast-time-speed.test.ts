import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { DEFAULT_STATS } from "../stat-calc";
import type { CharacterStats, TimelineEntry } from "../../types/skill";
import { WHM_ATTACK_SKILLS } from "../../data/whm-skills";
import { WHM_BUFFS } from "../../data/whm-buffs";
import { WHM_RESOURCES } from "../../data/whm-resources";

const skillMap = new Map(WHM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[], stats?: CharacterStats) {
  return resolveTimeline(entries, skillMap, WHM_RESOURCES, stats, WHM_BUFFS);
}

// speedMod = ceil(130 * (420 - 1212) / 2780) = -37
// GCD: floor(2500 * 963 / 10000) = 240 → 2.40、詠唱 1.5 秒: floor(1500 * 963 / 10000) = 144 → 1.44
const GCD_240_STATS: CharacterStats = { ...DEFAULT_STATS, speed: 1212 };

describe("詠唱時間のスピード補正 (#676)", () => {
  it("GCD 2.40 になるスピードで、グレアIII の詠唱 1.5 秒が 1.44 秒になり、アビリティを詠唱完了から挟める", () => {
    const e = resolve([entry("glare3"), entry("assize")], GCD_240_STATS).entries;
    expect(e[0].gcdAvailableAt).toBe(2.4);
    expect(e[0].castTime).toBe(1.44);
    expect(e[1].startTime).toBe(1.44);
  });

  it("スピードが既定値（420）なら詠唱時間は変わらない", () => {
    const e = resolve([entry("glare3")], DEFAULT_STATS).entries;
    expect(e[0].castTime).toBe(1.5);
  });

  it("speed バフ（神速魔）はスピード補正後の詠唱時間に掛かる", () => {
    const e = resolve([entry("presence-of-mind"), entry("glare3")], GCD_240_STATS).entries;
    expect(e[1].castTime).toBe(Math.round(1.44 * 0.8 * 1000) / 1000);
  });
});
