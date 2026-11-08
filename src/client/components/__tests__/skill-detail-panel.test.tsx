// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import i18next from "i18next";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
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
      hitDelay={undefined}
      onHitDelayChange={vi.fn()}
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
        hitDelay={undefined}
        onHitDelayChange={vi.fn()}
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

describe("SkillDetailPanel: 着弾までの遅れ (#901)", () => {
  // 2 発目のファイガは AF 中のファイガ（fire-3-in-af）に自動変化する
  function renderSecondFire3(hitDelay?: number) {
    const onHitDelayChange = vi.fn();
    const entries = resolveTimeline(
      [
        { uid: "e-1", skillId: "fire-3" },
        { uid: "e-2", skillId: "fire-3" },
      ],
      BLM.skillMap,
      BLM.resources,
      stats,
      BLM.buffs,
      undefined,
      undefined,
      hitDelay !== undefined ? { "fire-3-in-af": hitDelay } : undefined
    ).entries;
    const entry = entries[1];
    render(
      <SkillDetailPanel
        entry={entry}
        resolvedSkill={BLM.skillMap.get(entry.resolvedSkillId)!}
        jobId={BLM.jobId}
        buffDefMap={BLM.buffDefMap}
        stats={stats}
        onClose={vi.fn()}
        onManualStartTimeChange={vi.fn()}
        onProcOccurredChange={vi.fn()}
        hitDelay={hitDelay}
        onHitDelayChange={onHitDelayChange}
      />
    );
    return { entry, onHitDelayChange, input: screen.getByRole("spinbutton", { name: "着弾までの遅れ" }) };
  }

  it("前提: 2 発目は AF 中のファイガに変化している", () => {
    const { entry } = renderSecondFire3();
    expect(entry.skillId).toBe("fire-3");
    expect(entry.resolvedSkillId).toBe("fire-3-in-af");
  });

  it("値を入れて Enter で確定すると、実行されたスキルの ID と 0.01 秒に丸めた値で呼ぶ", () => {
    const { input, onHitDelayChange } = renderSecondFire3();

    fireEvent.change(input, { target: { value: "0.624" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onHitDelayChange).toHaveBeenCalledWith("fire-3-in-af", 0.62);
  });

  it("設定中に空にして確定すると、解除（undefined）で呼ぶ", () => {
    const { input, onHitDelayChange } = renderSecondFire3(0.6);
    expect(input).toHaveValue(0.6);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onHitDelayChange).toHaveBeenCalledWith("fire-3-in-af", undefined);
  });

  it("負の値は呼ばずに、設定中の値に戻す", () => {
    const { input, onHitDelayChange } = renderSecondFire3(0.6);

    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);

    expect(onHitDelayChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(0.6);
  });

  it("設定中は着弾時刻を出し、解除ボタンで解除（undefined）で呼ぶ", () => {
    const { entry, onHitDelayChange } = renderSecondFire3(0.6);
    expect(entry.hitTime).toBeDefined();

    expect(screen.getByText(`（着弾: ${entry.hitTime!.toFixed(2)}s）`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "着弾までの遅れを解除" }));

    expect(onHitDelayChange).toHaveBeenCalledWith("fire-3-in-af", undefined);
  });

  it("Escape は入力の取り消しで、入力中の値では呼ばずに設定中の値に戻す", () => {
    const { input, onHitDelayChange } = renderSecondFire3(0.6);

    // フォーカスしていないと blur() が何もしないので、実際の操作と同じくフォーカスしてから入力する
    input.focus();
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onHitDelayChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(0.6);
  });

  it("未設定なら入力欄は空で解除ボタンは出ず、詠唱のあるスキルには詠唱完了の着弾時刻を出す", () => {
    const { entry, input } = renderSecondFire3();

    expect(input).toHaveValue(null);
    expect(screen.queryByRole("button", { name: "着弾までの遅れを解除" })).not.toBeInTheDocument();
    expect(screen.getByText(`（着弾: ${(entry.startTime + entry.castTime).toFixed(2)}s）`)).toBeInTheDocument();
  });

  it("詠唱の無いスキルで未設定なら、着弾時刻は出ない", () => {
    renderLastEntry(["burst-shot"]);

    expect(screen.getByRole("spinbutton", { name: "着弾までの遅れ" })).toHaveValue(null);
    expect(screen.queryByText(/着弾:/)).not.toBeInTheDocument();
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
