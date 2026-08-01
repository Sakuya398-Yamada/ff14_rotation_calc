import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";

const skillMap = new Map(BRD_ATTACK_SKILLS.map((s) => [s.id, s]));

const SONG_BUFF_IDS = ["mages-ballad", "armys-paeon", "wanderers-minuet"] as const;

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

function resolve(entries: TimelineEntry[]) {
  return resolveTimeline(entries, skillMap, BRD_RESOURCES, undefined, BRD_BUFFS);
}

function activeSongs(activeBuffs: { buffId: string }[]): string[] {
  return SONG_BUFF_IDS.filter((id) => activeBuffs.some((ab) => ab.buffId === id));
}

describe("BRD: 歌バフの排他制御 (#114)", () => {
  it.each(SONG_BUFF_IDS)("バフ定義: %s は exclusiveGroup 'song' を持つ", (buffId) => {
    const buff = BRD_BUFFS.find((b) => b.id === buffId);
    expect(buff).toBeDefined();
    expect(buff!.exclusiveGroup).toBe("song");
    expect(buff!.duration).toBe(45);
  });

  it.each(SONG_BUFF_IDS)("%s 単独使用でその歌バフが付与される", (songId) => {
    const result = resolve([entry(songId)]);
    expect(activeSongs(result.entries[0].activeBuffs)).toEqual([songId]);
  });

  it("バラード → パイオンで、バラードが解除されパイオンだけ有効になる", () => {
    const result = resolve([entry("mages-ballad"), entry("armys-paeon")]);
    expect(activeSongs(result.entries[0].activeBuffs)).toEqual(["mages-ballad"]);
    expect(activeSongs(result.entries[1].activeBuffs)).toEqual(["armys-paeon"]);
  });

  it("3種の歌を連続使用しても、同時に有効な歌バフは常に1つだけ", () => {
    const result = resolve([
      entry("mages-ballad"),
      entry("armys-paeon"),
      entry("wanderers-minuet"),
      entry("heavy-shot"),
    ]);

    for (const e of result.entries) {
      expect(activeSongs(e.activeBuffs)).toHaveLength(1);
    }
    // 最後に使った歌だけが残る
    const last = result.entries[result.entries.length - 1];
    expect(activeSongs(last.activeBuffs)).toEqual(["wanderers-minuet"]);
  });

  it("歌以外のバフ（猛者の撃）は歌の切り替えで解除されない", () => {
    const result = resolve([
      entry("raging-strikes"),
      entry("mages-ballad"),
      entry("armys-paeon"),
    ]);

    const last = result.entries[2];
    expect(last.activeBuffs.some((ab) => ab.buffId === "raging-strikes")).toBe(true);
    expect(activeSongs(last.activeBuffs)).toEqual(["armys-paeon"]);
  });
});
