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
import { DRK_ATTACK_SKILLS } from "../../data/drk-skills";
import { DRK_BUFFS } from "../../data/drk-buffs";
import { DRK_RESOURCES } from "../../data/drk-resources";
import { DNC_ATTACK_SKILLS } from "../../data/dnc-skills";
import { DNC_BUFFS } from "../../data/dnc-buffs";
import { DNC_RESOURCES } from "../../data/dnc-resources";
import { calcDelayedHitBreakdown } from "../../logic/expected-potency";
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
const DRK = setupJob("drk", DRK_ATTACK_SKILLS, DRK_BUFFS, DRK_RESOURCES);
const DNC = setupJob("dnc", DNC_ATTACK_SKILLS, DNC_BUFFS, DNC_RESOURCES);

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
      resources={job.resources}
      onAutoGenerateProcChange={vi.fn()}
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
        resources={job.resources}
        onAutoGenerateProcChange={vi.fn()}
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

describe("SkillDetailPanel: 踊り子の確率付与・幻扇の発生の指定 (#1005)", () => {
  it.each([
    [["cascade"], "対称投擲の発生"],
    [["cascade", "fountain"], "非対称投擲の発生"],
    [["fan-dance"], "扇の舞い【急】実行可の発生"],
    [["windmill", "reverse-cascade"], "幻扇の発生"],
  ])("%j の最後のスキルに「%s」の指定のボタンが出る", (skillIds, groupName) => {
    renderLastEntry(skillIds, DNC);

    expect(screen.getByRole("group", { name: groupName })).toBeInTheDocument();
  });

  it.each([
    ["コンボが切れたファウンテン", ["fountain"], DNC],
    ["確率付与の無い扇の舞い【急】", ["fan-dance", "fan-dance-iii"], DNC],
    ["黒魔道士のファイア", ["fire"], BLM],
    // 対称投擲が無いので撃てた確率 0（実際にはカスケードを撃つ枠）
    ["対称投擲の無いリバースカスケード", ["reverse-cascade"], DNC],
  ])("%s には指定のボタンが出ない", (_label, skillIds, job) => {
    renderLastEntry(skillIds, job);

    expect(screen.queryByRole("group", { name: /の発生$/ })).not.toBeInTheDocument();
  });

  it("カスケード → カスケードの 2 つ目に「対称投擲上書き確率 25.0%」と出る", () => {
    renderLastEntry(["cascade", "cascade"], DNC);

    expect(screen.getByText("対称投擲上書き確率 25.0%")).toBeInTheDocument();
  });

  // 黒魔道士のファイアスターターは、上書き確率も対象外のまま (#838)
  it("ファイア → ファイアの 2 つ目には上書き確率が出ない", () => {
    renderLastEntry(["fire", "fire"], BLM);

    expect(screen.queryByText(/上書き確率/)).not.toBeInTheDocument();
  });

  // 幻扇は 50% で得るので、扇の舞い【序】の威力は幻扇がある確率を掛けた期待値になる (#959)
  it("カスケード → リバースカスケード → 扇の舞い【序】の扇の舞い【序】に「幻扇がある確率 25.0%」と出る", () => {
    renderLastEntry(["cascade", "reverse-cascade", "fan-dance"], DNC);

    expect(screen.getByText("幻扇がある確率 25.0%")).toBeInTheDocument();
  });

  it("幻扇を確率で得ていない扇の舞い【序】には、幻扇がある確率が出ない", () => {
    renderLastEntry(["fan-dance"], DNC);

    expect(screen.queryByText(/がある確率/)).not.toBeInTheDocument();
  });
});

describe("SkillDetailPanel: 歌の判定ごとの発生の指定 (#900)", () => {
  function renderEntry(skillId: string, autoGenerateProcOccurred?: (boolean | null)[], job = BRD) {
    const onAutoGenerateProcChange = vi.fn();
    const [entry] = resolveTimeline(
      [{ uid: "e-1", skillId, ...(autoGenerateProcOccurred ? { autoGenerateProcOccurred } : {}) }],
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
        onProcOccurredChange={vi.fn()}
        hitDelay={undefined}
        onHitDelayChange={vi.fn()}
        resources={job.resources}
        onAutoGenerateProcChange={onAutoGenerateProcChange}
      />
    );
    return onAutoGenerateProcChange;
  }

  it.each([
    ["wanderers-minuet", "旅神のメヌエット"],
    ["mages-ballad", "賢人のバラード"],
    ["armys-paeon", "軍神のパイオン"],
  ])("%s には残り 42〜3 秒の 14 回の判定のボタンが並ぶ", (skillId, name) => {
    renderEntry(skillId);

    const group = screen.getByRole("group", { name: `${name}の判定` });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(14);
    expect(buttons[0]).toHaveAccessibleName("残り42秒の判定: 未指定（発生として計算）");
    expect(buttons[0]).toHaveAttribute("title", "残り42秒の判定: 未指定（発生として計算）");
    expect(buttons[13]).toHaveAccessibleName("残り3秒の判定: 未指定（発生として計算）");
  });

  it("ボタンの秒数は歌の残り秒数で、左から 42s, 39s, …, 3s と並ぶ (#969)", () => {
    renderEntry("wanderers-minuet");

    const buttons = within(screen.getByRole("group", { name: "旅神のメヌエットの判定" })).getAllByRole("button");
    expect(buttons.map((b) => b.querySelector(".num")?.textContent)).toEqual(
      Array.from({ length: 14 }, (_, i) => `${42 - 3 * i}s`),
    );
  });

  it.each([
    ["歌ではないバーストショット", "burst-shot", BRD],
    ["自動生成が確率の判定でないジョブ（ルーシッドドリームの MP）", "lucid-dreaming", BLM],
  ])("%s には判定のボタンが出ない", (_label, skillId, job) => {
    renderEntry(skillId, undefined, job);

    expect(screen.queryByRole("group", { name: /の判定$/ })).not.toBeInTheDocument();
  });

  it("未指定の判定は既定の並びの結果を示し、指定した判定はその結果を示す（#900 の形の指定が、左から同じ回の判定に効く）", () => {
    renderEntry("wanderers-minuet", [false, null, true]);

    const buttons = within(screen.getByRole("group", { name: "旅神のメヌエットの判定" })).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName("残り42秒の判定: 不発");
    expect(buttons[1]).toHaveAccessibleName("残り39秒の判定: 未指定（発生として計算）");
    expect(buttons[2]).toHaveAccessibleName("残り36秒の判定: 発生");
    expect(buttons[7]).toHaveAccessibleName("残り21秒の判定: 未指定（不発として計算）");
  });

  it("左端（残り 42 秒）のボタンを押すと、1 回目（歌が付いてから 3 秒）の判定を切り替える (#969)", () => {
    const onAutoGenerateProcChange = renderEntry("wanderers-minuet");

    within(screen.getByRole("group", { name: "旅神のメヌエットの判定" })).getAllByRole("button")[0].click();

    expect(onAutoGenerateProcChange).toHaveBeenCalledWith("e-1", 1, true);
  });

  it.each([
    ["未指定", null, true],
    ["発生", true, false],
    ["不発", false, undefined],
  ])("%s の判定を押すと、未指定 → 発生 → 不発 → 未指定 の次の値で呼ぶ", (_label, current, next) => {
    const onAutoGenerateProcChange = renderEntry("wanderers-minuet", [null, current]);

    within(screen.getByRole("group", { name: "旅神のメヌエットの判定" }))
      .getByRole("button", { name: /^残り39秒の判定/ })
      .click();

    expect(onAutoGenerateProcChange).toHaveBeenCalledWith("e-1", 2, next);
  });
});

describe("SkillDetailPanel: 開始時刻の手動設定 (#953)", () => {
  function renderSecondBurstShot() {
    const onManualStartTimeChange = vi.fn();
    const entries = resolveTimeline(
      [
        { uid: "e-1", skillId: "burst-shot" },
        { uid: "e-2", skillId: "burst-shot" },
      ],
      BRD.skillMap,
      BRD.resources,
      stats,
      BRD.buffs
    ).entries;
    const entry = entries[1];
    render(
      <SkillDetailPanel
        entry={entry}
        resolvedSkill={BRD.skillMap.get(entry.resolvedSkillId)!}
        jobId={BRD.jobId}
        buffDefMap={BRD.buffDefMap}
        stats={stats}
        onClose={vi.fn()}
        onManualStartTimeChange={onManualStartTimeChange}
        onProcOccurredChange={vi.fn()}
        hitDelay={undefined}
        onHitDelayChange={vi.fn()}
        resources={BRD.resources}
        onAutoGenerateProcChange={vi.fn()}
      />
    );
    return { entry, onManualStartTimeChange, input: screen.getByRole("spinbutton", { name: "開始時刻" }) };
  }

  it("Escape は入力の取り消しで、入力中の値では呼ばずに元の値に戻す", () => {
    const { entry, input, onManualStartTimeChange } = renderSecondBurstShot();
    expect(entry.manualStartTime).toBeUndefined();
    const original = Number(entry.autoStartTime.toFixed(2));
    expect(original).toBeGreaterThan(0);
    expect(input).toHaveValue(original);

    // フォーカスしていないと blur() が何もしないので、実際の操作と同じくフォーカスしてから入力する
    input.focus();
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onManualStartTimeChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(original);
    expect(input).not.toHaveFocus();
  });

  it("Escape で取り消したあとも、入力し直して blur すると、その値で確定する", () => {
    const { entry, input, onManualStartTimeChange } = renderSecondBurstShot();

    input.focus();
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Escape" });
    input.focus();
    fireEvent.change(input, { target: { value: "4.567" } });
    input.blur();

    expect(onManualStartTimeChange).toHaveBeenCalledTimes(1);
    expect(onManualStartTimeChange).toHaveBeenCalledWith(entry.uid, 4.57);
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
        resources={BLM.resources}
        onAutoGenerateProcChange={vi.fn()}
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

describe("SkillDetailPanel: 時間差の攻撃 (#957)", () => {
  it("影身具現は、基本威力と期待値に分身の攻撃の合計を出し、攻撃ごとに着弾時刻と計算式を並べる", () => {
    const [entry] = resolveTimeline([{ uid: "e-1", skillId: "living-shadow" }], DRK.skillMap, DRK.resources, stats, DRK.buffs).entries;
    const skill = DRK.skillMap.get("living-shadow")!;
    const hitTotals = entry.delayedHits!.map((hit) => calcDelayedHitBreakdown(hit, skill, stats).total);
    // 前提: 使ったときの威力は無く、期待値はクリ/DH の期待値で威力より大きい
    expect(entry.resolvedPotency).toBe(0);
    expect(hitTotals[0]).toBeGreaterThan(420);

    renderLastEntry(["living-shadow"], DRK);

    expect(within(screen.getByText("基本威力").parentElement!).getByText("2450")).toBeInTheDocument();
    const expectedTotal = hitTotals.reduce((sum, v) => sum + v, 0);
    expect(within(screen.getByText("期待値").parentElement!).getByText(String(expectedTotal))).toBeInTheDocument();
    const times = ["6.80", "11.16", "13.34", "15.52", "17.70"];
    const potencies = [420, 570, 420, 420, 620];
    times.forEach((time, i) => {
      expect(screen.getByText(new RegExp(`^（着弾: ${time}s） ${potencies[i]} × 1\\.00 × [0-9.]+ = ${hitTotals[i]}$`))).toBeInTheDocument();
    });
  });
});

describe("SkillDetailPanel: 確定クリティカル・ダイレクトヒット (#1004)", () => {
  it("攻めのタンゴ中の流星の舞いは、見出しに確定と出し、率の上昇を換算した倍率で期待値を出す", () => {
    renderLastEntry(["devilment", "cascade", "starfall-dance"], DNC);

    const crit = within(screen.getByText("CRT率ボーナス").parentElement!.parentElement!);
    expect(crit.getByText("確定CRT")).toBeInTheDocument();
    expect(crit.getByText("+20.0%")).toBeInTheDocument();
    const dh = within(screen.getByText("DH率ボーナス").parentElement!.parentElement!);
    expect(dh.getByText("確定DH")).toBeInTheDocument();
    expect(dh.getByText("+20.0%")).toBeInTheDocument();
    // CRIT=3000: クリ倍率 1.585 × floor3(1 + 0.585 × 0.2) = 1.117。DH: 1.25 × floor3(1 + 0.25 × 0.2) = 1.05。
    // DET=2500 の 1.103 に DH=2000 の 0.079 を足して 1.182。合わせて 2.747（600 × 2.747… = 1647）
    expect(screen.getByText("600 × 1.00 × 2.747 = 1647")).toBeInTheDocument();
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

/** 0 秒のファイガは詠唱完了（約 3.5 秒）が離脱（2〜10 秒）の中に着弾する（ゴースト。#950） */
function renderGhostFire3() {
  const entry = resolveTimeline(
    [{ uid: "e-1", skillId: "fire-3" }],
    BLM.skillMap,
    BLM.resources,
    stats,
    BLM.buffs,
    [{ startTime: 2, endTime: 10 }]
  ).entries[0];
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
      hitDelay={undefined}
      onHitDelayChange={vi.fn()}
      resources={BLM.resources}
      onAutoGenerateProcChange={vi.fn()}
    />
  );
  return entry;
}

describe("SkillDetailPanel: 着弾時にボス離脱中（ゴースト。#950）", () => {
  it("警告を出し、期待値は 0 で計算式の行は出さず、基本威力は残す", () => {
    const entry = renderGhostFire3();
    expect(entry.untargetableHit).toBe(true);

    expect(screen.getByText("着弾時にボス離脱中のため威力 0（このスキルが付けるバフ・DoT も付かない）")).toBeInTheDocument();
    expect(within(screen.getByText("期待値").parentElement!).getByText("0")).toBeInTheDocument();
    expect(screen.queryByText(/×.*=/)).not.toBeInTheDocument();
    expect(within(screen.getByText("基本威力").parentElement!).getByText(String(entry.resolvedPotency))).toBeInTheDocument();
    expect(entry.resolvedPotency).toBeGreaterThan(0);
    // ハードエラーではない
    expect(within(screen.getByText("エラー").parentElement!).getByText("なし")).toBeInTheDocument();
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

  it("着弾時にボス離脱中の警告を英語で出す（#950）", () => {
    renderGhostFire3();

    expect(screen.getByText("Boss untargetable when it lands, so 0 potency (its buffs and DoTs are not applied)")).toBeInTheDocument();
  });

  it("歌の判定のボタンの読み上げ名と title を、残り秒数の英語で出す (#969)", () => {
    renderLastEntry(["wanderers-minuet"]);

    const buttons = within(screen.getByRole("group", { name: "The Wanderer's Minuet procs" })).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName("Check at 42s remaining: unset (counted as proc)");
    expect(buttons[0]).toHaveAttribute("title", "Check at 42s remaining: unset (counted as proc)");
    expect(buttons[2]).toHaveAccessibleName("Check at 36s remaining: unset (counted as no proc)");
    expect(buttons[13]).toHaveAccessibleName("Check at 3s remaining: unset (counted as proc)");
  });
});
