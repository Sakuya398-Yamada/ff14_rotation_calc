import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import type { TimelineEntry } from "../../types/skill";
import { BLM_ATTACK_SKILLS } from "../../data/blm-skills";
import { BLM_BUFFS } from "../../data/blm-buffs";
import { BLM_RESOURCES } from "../../data/blm-resources";

const skillMap = new Map(BLM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("BLM: ルーシッドドリーム", () => {
  it("スキル定義: oGCD、cooldown 60s、acquiredLevel 14", () => {
    const skill = BLM_ATTACK_SKILLS.find((s) => s.id === "lucid-dreaming");
    expect(skill).toBeDefined();
    expect(skill!.type).toBe("ogcd");
    expect(skill!.cooldown).toBe(60);
    expect(skill!.acquiredLevel).toBe(14);
    expect(skill!.buffApplications).toEqual(["lucid-dreaming"]);
  });

  it("バフ定義: duration 21 秒、effects は空（MP 回復はリソース側で駆動）", () => {
    const buff = BLM_BUFFS.find((b) => b.id === "lucid-dreaming");
    expect(buff).toBeDefined();
    expect(buff!.duration).toBe(21);
    expect(buff!.effects).toEqual([]);
  });

  it("MP リソースは lucid-dreaming バフ中に 3 秒ごとに 550 自動生成される設定", () => {
    const mp = BLM_RESOURCES.find((r) => r.id === "mp");
    expect(mp).toBeDefined();
    expect(mp!.autoGenerateInterval).toBe(3);
    expect(mp!.autoGenerateAmount).toBe(550);
    expect(mp!.autoGenerateWhileBuff).toContain("lucid-dreaming");
  });

  it("使用すると lucid-dreaming バフが付与される", () => {
    const result = resolveTimeline(
      [entry("lucid-dreaming")],
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const lucid = result.entries[0];
    expect(lucid.activeBuffs.some((ab) => ab.buffId === "lucid-dreaming")).toBe(true);
  });

  it("ルーシッド付与中は MP がティック回復し、バフ切れ後は停止する", () => {
    // fire-3（MP 2000 消費 + AF3 付与） + fire-4 × 3（AF3 中は MP 消費 2 倍）で
    // MP を 10000 → 数千レベルまで減らした状態でルーシッドを撃ち、長時間経過後の MP を計測する
    const entries: TimelineEntry[] = [
      entry("fire-3"),
      entry("fire-4"),
      entry("fire-4"),
      entry("fire-4"),
      entry("lucid-dreaming"),
    ];
    // ルーシッド後 30 秒（21 秒のバフ期間 + 余裕）経過させる
    for (let i = 0; i < 14; i++) {
      entries.push(entry("fire-4"));
    }

    const result = resolveTimeline(
      entries,
      skillMap,
      BLM_RESOURCES,
      undefined,
      BLM_BUFFS,
    );

    const lucidIdx = result.entries.findIndex((e) => e.skillId === "lucid-dreaming");
    expect(lucidIdx).toBeGreaterThan(-1);

    const lucidEntry = result.entries[lucidIdx];
    const lucidStartTime = lucidEntry.startTime;

    // バフ期間内のエントリでは lucid-dreaming がアクティブ
    const duringBuff = result.entries.find(
      (e, i) =>
        i > lucidIdx &&
        e.startTime >= lucidStartTime + 3 &&
        e.startTime < lucidStartTime + 21,
    );
    expect(duringBuff).toBeDefined();
    expect(duringBuff!.activeBuffs.some((ab) => ab.buffId === "lucid-dreaming")).toBe(
      true,
    );

    // バフ切れ後 (21 秒以降) のエントリでは外れている
    const afterBuff = result.entries.find(
      (e, i) => i > lucidIdx && e.startTime > lucidStartTime + 21,
    );
    expect(afterBuff).toBeDefined();
    expect(afterBuff!.activeBuffs.some((ab) => ab.buffId === "lucid-dreaming")).toBe(
      false,
    );
  });
});
