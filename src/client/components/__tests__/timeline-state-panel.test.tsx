// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import i18next from "i18next";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TimelineStatePanel } from "../TimelineStatePanel";
import { resolveStateAt, resolveTimeline } from "../../logic/resolve-timeline";
import { getRecastStatesAt } from "../../logic/recast-state";
import { getAllSkillMapForLevel, getBuffsForLevel, getResourcesForLevel, getSkillsForLevel } from "../../logic/skill-level";
import { BRD_ATTACK_SKILLS } from "../../data/brd-skills";
import { BRD_BUFFS } from "../../data/brd-buffs";
import { BRD_RESOURCES } from "../../data/brd-resources";
import type { TimelineEntry } from "../../types/skill";

/** App と同じく getSkillsForLevel → getAllSkillMapForLevel でスキルマップを作る（testing-conventions 罠4） */
const level = 100;
const buffs = getBuffsForLevel(BRD_BUFFS, level);
const resources = getResourcesForLevel(BRD_RESOURCES, level);
const buffIds = new Set(buffs.map((b) => b.id));
const resourceIds = new Set(resources.map((r) => r.id));
const skills = getSkillsForLevel(BRD_ATTACK_SKILLS, level, buffIds, resourceIds);
const skillMap = getAllSkillMapForLevel(BRD_ATTACK_SKILLS, skills, level, buffIds, resourceIds);

const entries = (ids: string[]): TimelineEntry[] => ids.map((skillId, i) => ({ uid: `${skillId}-${i}`, skillId }));

function renderPanel(timeline: TimelineEntry[], time: number) {
  const state = resolveStateAt(timeline, skillMap, resources, undefined, buffs, undefined, undefined, undefined, time);
  const resolved = resolveTimeline(timeline, skillMap, resources, undefined, buffs).entries;
  const recastStates = getRecastStatesAt(state, resolved, skillMap);
  const onClose = vi.fn();
  render(<TimelineStatePanel jobId="brd" state={state} recastStates={recastStates} skillMap={skillMap} onClose={onClose} />);
  return { state, recastStates, onClose };
}

/** 一覧の行（li）の文字列。名前の文字列から探す */
function rowText(region: HTMLElement, name: string): string {
  return within(region).getByText(name).closest("li")!.textContent ?? "";
}

afterEach(cleanup);

describe("TimelineStatePanel (#1001)", () => {
  // メヌエット → ハートブレイクショット（3 チャージ）→ バーストショット。歌のリキャスト（120 秒）とハートブレイクのチャージの回復中を見る
  const minuet = entries(["wanderers-minuet", "heartbreak-shot", ...Array(6).fill("burst-shot")]);

  it("時刻と、上限が 0 でないリソースの値 / 上限を、resolveStateAt の結果のとおりに出す", () => {
    const { state } = renderPanel(minuet, 10);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("10.00s 時点の状態");

    const region = screen.getByRole("region", { name: "リソース" });
    const visible = state.resources.filter((r) => r.maxStacks > 0);
    expect(visible.map((r) => r.resourceId)).toContain("repertoire");
    expect(within(region).getAllByRole("listitem")).toHaveLength(visible.length);
    const repertoire = visible.find((r) => r.resourceId === "repertoire")!;
    expect(rowText(region, "詩心")).toBe(`詩心${repertoire.value} / ${repertoire.maxStacks}`);
  });

  it("上限が 0 の時間帯のリソース（賢人のバラード中の詩心）は出さない", () => {
    const { state } = renderPanel(entries(["mages-ballad", ...Array(4).fill("burst-shot")]), 5);
    expect(state.resources.find((r) => r.resourceId === "repertoire")?.maxStacks).toBe(0);

    const region = screen.getByRole("region", { name: "リソース" });
    expect(within(region).queryByText("詩心")).toBeNull();
  });

  it("リキャスト中は残り秒数、チャージ式は残りチャージ数 / 最大と次のチャージまでの秒数を出す", () => {
    const { recastStates } = renderPanel(minuet, 10);
    const region = screen.getByRole("region", { name: "リキャスト" });

    const song = recastStates.find((r) => r.skillId === "wanderers-minuet")!;
    expect(song.available).toBe(false);
    expect(rowText(region, "旅神のメヌエット")).toBe(`旅神のメヌエット残り ${song.remaining.toFixed(2)}s＞`);

    const heartbreak = recastStates.find((r) => r.skillId === "heartbreak-shot")!;
    expect(heartbreak.available).toBe(true);
    expect(heartbreak.remaining).toBeGreaterThan(0);
    expect(rowText(region, "ハートブレイクショット")).toBe(
      `ハートブレイクショットチャージ ${heartbreak.charges}/${heartbreak.maxCharges}使用可能 / 次のチャージまで ${heartbreak.remaining.toFixed(2)}s＞`
    );
  });

  it("リキャストが終わっていれば使用可能と出し、「＞」は出さない", () => {
    const { recastStates } = renderPanel(minuet, 130);
    const region = screen.getByRole("region", { name: "リキャスト" });
    expect(recastStates.find((r) => r.skillId === "wanderers-minuet")).toMatchObject({ available: true, remaining: 0 });
    expect(rowText(region, "旅神のメヌエット")).toBe("旅神のメヌエット使用可能");
    expect(within(region).queryByRole("button", { name: "旅神のメヌエット が実際に戻る時刻を表示" })).toBeNull();
  });

  it("「＞」を開くと、実際に戻る時刻を出す", () => {
    const { recastStates } = renderPanel(minuet, 10);
    const song = recastStates.find((r) => r.skillId === "wanderers-minuet")!;
    const toggle = screen.getByRole("button", { name: "旅神のメヌエット が実際に戻る時刻を表示" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/^実際に戻る時刻/)).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(`実際に戻る時刻（この後の短縮込み）: ${song.actualEndTime!.toFixed(2)}s`)).toBeInTheDocument();
  });

  it("閉じるボタンで onClose を呼ぶ", () => {
    const { onClose } = renderPanel(minuet, 10);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("英語", () => {
    beforeEach(() => i18next.changeLanguage("en"));
    afterEach(() => i18next.changeLanguage("ja"));

    it("文言とスキル・リソースの名前を英語で出す", () => {
      const { recastStates } = renderPanel(minuet, 10);
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("State at 10.00s");
      expect(within(screen.getByRole("region", { name: "Resources" })).getByText("Repertoire")).toBeInTheDocument();

      const region = screen.getByRole("region", { name: "Recasts" });
      const song = recastStates.find((r) => r.skillId === "wanderers-minuet")!;
      expect(rowText(region, "The Wanderer's Minuet")).toBe(`The Wanderer's Minuet${song.remaining.toFixed(2)}s left＞`);
      fireEvent.click(screen.getByRole("button", { name: "Show when The Wanderer's Minuet is actually ready" }));
      expect(screen.getByText(`Actually ready at (including later reductions): ${song.actualEndTime!.toFixed(2)}s`)).toBeInTheDocument();
    });
  });
});
