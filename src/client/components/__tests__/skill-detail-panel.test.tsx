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
import { MNK_ATTACK_SKILLS } from "../../data/mnk-skills";
import { MNK_BUFFS } from "../../data/mnk-buffs";
import { MNK_RESOURCES } from "../../data/mnk-resources";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";
import type { BuffDefinition, CharacterStats, ResourceDefinition, Skill } from "../../types/skill";

const stats: CharacterStats = {
  critical: 3000,
  directHit: 2000,
  determination: 2500,
  speed: 800,
};

function setupJob(skills: Skill[], buffs: BuffDefinition[], resources: ResourceDefinition[]) {
  const buffIds = new Set(buffs.map((b) => b.id));
  const resourceIds = new Set(resources.map((r) => r.id));
  const skillMap = getAllSkillMapForLevel(
    skills,
    getSkillsForLevel(skills, 100, buffIds, resourceIds),
    100,
    buffIds,
    resourceIds
  );
  return {
    skillMap,
    buffs,
    resources,
    buffDefMap: new Map(buffs.map((b) => [b.id, b])),
    resourceDefMap: new Map(resources.map((r) => [r.id, r])),
  };
}

const BRD = setupJob(BRD_ATTACK_SKILLS, BRD_BUFFS, BRD_RESOURCES);
const MNK = setupJob(MNK_ATTACK_SKILLS, MNK_BUFFS, MNK_RESOURCES);
const BLM = setupJob(BLM_ATTACK_SKILLS, BLM_BUFFS, BLM_RESOURCES);

/** skillIds を解決し、最後のエントリの詳細パネルを描画する */
function renderLastEntry(skillIds: string[], job = BRD) {
  const entries = resolveTimeline(
    skillIds.map((skillId, i) => ({ uid: `${skillId}-${i}`, skillId })),
    job.skillMap,
    job.resources,
    stats,
    job.buffs
  ).entries;
  const entry = entries[entries.length - 1];
  render(
    <SkillDetailPanel
      entry={entry}
      resolvedSkill={job.skillMap.get(entry.resolvedSkillId)!}
      buffDefMap={job.buffDefMap}
      resourceDefMap={job.resourceDefMap}
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

describe("SkillDetailPanel: リソースのエラーを種類ごとの文言とリソース名で出す (#612)", () => {
  it("壱のチャクラが残っている踏鳴は「リソース超過」で、リソース名が出る", () => {
    renderLastEntry(["perfect-balance", "leaping-opo", "perfect-balance"], MNK);

    expect(screen.getByText("リソース超過: 壱のチャクラ")).toBeInTheDocument();
    expect(screen.queryByText(/リソース不足|opo-chakra/)).not.toBeInTheDocument();
  });

  it("闘気 5 の陰陽闘気は「リソース超過」で、リソース名が出る", () => {
    renderLastEntry(["forbidden-meditation"], MNK);

    expect(screen.getByText("リソース超過: 闘気")).toBeInTheDocument();
  });

  it("闘気が足りない陰陽闘気斬は「リソース不足」で、リソース名が出る", () => {
    // 続けて置いた 2 回目はリキャスト中のエラーも出るので、部分一致で見る
    renderLastEntry(["the-forbidden-chakra", "the-forbidden-chakra"], MNK);

    expect(screen.getByText(/リソース不足: 闘気/)).toBeInTheDocument();
    expect(screen.queryByText(/リソース超過|chakra/)).not.toBeInTheDocument();
  });
});

describe("SkillDetailPanel: バフ条件のエラーを種類ごとの文言とバフ名で出す (#666)", () => {
  it("歌なしのピッチパーフェクトは「バフ条件未達成」で、バフ名が出る", () => {
    // 歌なしでは詩心も 0 で「リソース不足: 詩心」も並ぶので、部分一致で見る
    renderLastEntry(["pitch-perfect"]);

    expect(screen.getByText(/バフ条件未達成: 旅神のメヌエット/)).toBeInTheDocument();
    expect(screen.queryByText(/wanderers-minuet/)).not.toBeInTheDocument();
  });

  it("黒魔紋の効果中に置いた黒魔紋は「バフ効果中」で、バフ名が出る", () => {
    renderLastEntry(["ley-lines", "ley-lines"], BLM);

    expect(screen.getByText("バフ効果中: 黒魔紋")).toBeInTheDocument();
    expect(screen.queryByText(/バフ条件未達成|ley-lines/)).not.toBeInTheDocument();
  });
});

describe("SkillDetailPanel: OR 条件のバフが未達のとき、候補をすべて出す (#679)", () => {
  it("AF 無しで置いたデスペアは、AF の段階を問わないことが分かる形で出る", () => {
    renderLastEntry(["despair"], BLM);

    expect(
      screen.getByText(/バフ条件未達成: アストラルファイア I・アストラルファイア II・アストラルファイア III のいずれか/)
    ).toBeInTheDocument();
  });

  it("ホークアイも乱れ撃ちも無いリフルジェントアローは、どちらか一方でよいことが分かる形で出る", () => {
    renderLastEntry(["refulgent-arrow"]);

    expect(screen.getByText(/バフ条件未達成: 乱れ撃ち・ホークアイ のいずれか/)).toBeInTheDocument();
  });
});
