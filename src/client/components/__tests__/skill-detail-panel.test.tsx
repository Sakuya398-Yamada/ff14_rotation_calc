// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import i18next from "i18next";
import { render, screen, cleanup, within } from "@testing-library/react";
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
import type { JobId } from "../../data/job-registry";

const stats: CharacterStats = {
  critical: 3000,
  directHit: 2000,
  determination: 2500,
  speed: 800,
};

function setupJob(jobId: JobId, skills: Skill[], buffs: BuffDefinition[], resources: ResourceDefinition[]) {
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
    jobId,
    skillMap,
    buffs,
    resources,
    buffDefMap: new Map(buffs.map((b) => [b.id, b])),
  };
}

const BRD = setupJob("brd", BRD_ATTACK_SKILLS, BRD_BUFFS, BRD_RESOURCES);
const MNK = setupJob("mnk", MNK_ATTACK_SKILLS, MNK_BUFFS, MNK_RESOURCES);
const BLM = setupJob("blm", BLM_ATTACK_SKILLS, BLM_BUFFS, BLM_RESOURCES);

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
      jobId={job.jobId}
      buffDefMap={job.buffDefMap}
      stats={stats}
      onClose={vi.fn()}
      onManualStartTimeChange={vi.fn()}
      onProcOccurredChange={vi.fn()}
    />
  );
}

afterEach(cleanup);

describe("SkillDetailPanel: ホークアイの発生の有無の指定 (#838)", () => {
  function renderEntry(skillId: string, procOccurred?: boolean, job = BRD) {
    const onProcOccurredChange = vi.fn();
    const [entry] = resolveTimeline(
      [{ uid: "e-1", skillId, ...(procOccurred !== undefined ? { procOccurred } : {}) }],
      job.skillMap,
      job.resources,
      stats,
      job.buffs
    ).entries;
    render(
      <SkillDetailPanel
        entry={entry}
        resolvedSkill={job.skillMap.get(entry.resolvedSkillId)!}
        jobId={job.jobId}
        buffDefMap={job.buffDefMap}
        stats={stats}
        onClose={vi.fn()}
        onManualStartTimeChange={vi.fn()}
        onProcOccurredChange={onProcOccurredChange}
      />
    );
    return onProcOccurredChange;
  }

  it.each(["burst-shot", "iron-jaws", "ladonsbite"])("付与元の %s には指定のボタンが出る", (skillId) => {
    renderEntry(skillId);

    expect(screen.getByRole("group", { name: "ホークアイの発生" })).toBeInTheDocument();
  });

  it.each([
    ["消費側のリフルジェントアロー", "refulgent-arrow", BRD],
    ["確定付与の乱れ撃ち", "barrage", BRD],
    ["ほかのジョブの確率付与（ファイア）", "fire", BLM],
  ])("%s には指定のボタンが出ない", (_label, skillId, job) => {
    renderEntry(skillId, undefined, job);

    expect(screen.queryByRole("group", { name: "ホークアイの発生" })).not.toBeInTheDocument();
  });

  it.each([
    ["期待値", undefined],
    ["発生", true],
    ["不発", false],
  ])("「%s」を押すと procOccurred = %s で呼ぶ", (label, expected) => {
    const onProcOccurredChange = renderEntry("burst-shot", true);

    screen.getByRole("button", { name: label }).click();

    expect(onProcOccurredChange).toHaveBeenCalledWith("e-1", expected);
  });

  it.each([
    [undefined, "期待値"],
    [true, "発生"],
    [false, "不発"],
  ])("procOccurred = %s なら「%s」だけが押された状態になる", (procOccurred, selectedLabel) => {
    renderEntry("burst-shot", procOccurred);

    for (const label of ["期待値", "発生", "不発"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", String(label === selectedLabel));
    }
  });
});

describe("SkillDetailPanel: ホークアイの発動確率 (#615)", () => {
  // 出なかったときに撃つ GCD を添える。付与元が無い枠は P = 0 のフィラー枠 (#842)
  it.each([
    [["burst-shot", "refulgent-arrow"], "ホークアイ発動確率 35.0%（不発時はバーストショット）"],
    [["burst-shot", "burst-shot", "refulgent-arrow"], "ホークアイ発動確率 57.8%（不発時はバーストショット）"],
    [["refulgent-arrow"], "ホークアイ発動確率 0.0%（不発時はバーストショット）"],
  ])("%j のリフルジェントアローに「%s」と出る", (skillIds, expected) => {
    renderLastEntry(skillIds);

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/バフ条件未達成/)).not.toBeInTheDocument();
  });

  // 効いているホークアイに重ねた付与元に、上書きで無駄になる確率を出す (#842)
  it("ストームバイト → コースティックバイトのコースティックバイトに「ホークアイ上書き確率 12.3%」と出る", () => {
    renderLastEntry(["stormbite", "caustic-bite"]);

    expect(screen.getByText("ホークアイ上書き確率 12.3%")).toBeInTheDocument();
  });

  it("ホークアイが付いていない枠のストームバイトには上書き確率が出ない", () => {
    renderLastEntry(["stormbite"]);

    expect(screen.getByRole("group", { name: "ホークアイの発生" })).toBeInTheDocument();
    expect(screen.queryByText(/上書き確率/)).not.toBeInTheDocument();
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

  // ホークアイも乱れ撃ちも無いリフルジェントアローは、#842 からエラーにしないフィラー枠なので、詩人は光神のアンコールで見る
  it("光神のアンコールレディの無い光神のアンコールは、どの段階でもよいことが分かる形で出る", () => {
    renderLastEntry(["radiant-encore"]);

    expect(
      screen.getByText(/バフ条件未達成: 光神のアンコールレディ（3種）・光神のアンコールレディ（2種）・光神のアンコールレディ（1種） のいずれか/)
    ).toBeInTheDocument();
  });
});

describe("SkillDetailPanel（英語）", () => {
  beforeEach(() => i18next.changeLanguage("en"));
  afterEach(() => i18next.changeLanguage("ja"));

  it("見出しと発生の指定を英語で出す", () => {
    renderLastEntry(["burst-shot"]);

    expect(screen.getByRole("complementary", { name: "Action details panel" })).toBeInTheDocument();
    expect(screen.getByText("Base potency")).toBeInTheDocument();
    expect(screen.getByAltText("Burst Shot")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Hawk's Eye proc" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Expected", "Proc", "No proc"]);
    expect(screen.queryByText("基本威力")).not.toBeInTheDocument();
  });

  it("エラーの文言を英語で出す", () => {
    renderLastEntry(["pitch-perfect"]);

    expect(screen.getByText(/Buff condition not met: The Wanderer's Minuet/)).toBeInTheDocument();
    expect(screen.getByText(/Insufficient resources: Repertoire/)).toBeInTheDocument();
  });
});
