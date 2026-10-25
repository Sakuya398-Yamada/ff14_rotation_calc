// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SkillDetailPanel } from "../SkillDetailPanel";
import { resolveTimeline } from "../../logic/resolve-timeline";
import { getAllSkillMapForLevel, getSkillsForLevel } from "../../logic/skill-level";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import type { CharacterStats } from "../../types/skill";

const stats: CharacterStats = {
  critical: 3000,
  directHit: 2000,
  determination: 2500,
  speed: 800,
};

const buffIds = new Set(BRD_BUFFS.map((b) => b.id));
const resourceIds = new Set(BRD_RESOURCES.map((r) => r.id));
const skillMap = getAllSkillMapForLevel(
  BRD_ATTACK_SKILLS,
  getSkillsForLevel(BRD_ATTACK_SKILLS, 100, buffIds, resourceIds),
  100,
  buffIds,
  resourceIds
);
const buffDefMap = new Map(BRD_BUFFS.map((b) => [b.id, b]));

/** skillIds を解決し、最後のエントリの詳細パネルを描画する */
function renderLastEntry(skillIds: string[]) {
  const entries = resolveTimeline(
    skillIds.map((skillId, i) => ({ uid: `${skillId}-${i}`, skillId })),
    skillMap,
    BRD_RESOURCES,
    stats,
    BRD_BUFFS
  ).entries;
  const entry = entries[entries.length - 1];
  render(
    <SkillDetailPanel
      entry={entry}
      resolvedSkill={skillMap.get(entry.resolvedSkillId)!}
      buffDefMap={buffDefMap}
      stats={stats}
      onClose={vi.fn()}
      onManualStartTimeChange={vi.fn()}
    />
  );
}

afterEach(cleanup);

describe("SkillDetailPanel: ホークアイの発動確率 (#615)", () => {
  it.each([
    [["burst-shot", "refulgent-arrow"], "ホークアイ発動確率 35.0%"],
    [["burst-shot", "burst-shot", "refulgent-arrow"], "ホークアイ発動確率 57.8%"],
  ])("%j のリフルジェントアローに「%s」と出る", (skillIds, expected) => {
    renderLastEntry(skillIds);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("乱れ撃ちを優先消費したリフルジェントアローには発動確率が出ない", () => {
    renderLastEntry(["barrage", "burst-shot", "refulgent-arrow"]);

    expect(screen.getByText("840")).toBeInTheDocument();
    expect(screen.queryByText(/発動確率/)).not.toBeInTheDocument();
  });
});
