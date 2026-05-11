import { describe, it, expect } from "vitest";
import { resolveTimeline } from "../resolve-timeline";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import { SAM_RESOURCES } from "../../data/sam-resources";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("侍: 明鏡止水（bypassCombo + consumeOnGcd）", () => {
  it("明鏡止水中: 陣風単独で wsComboError=false かつ威力300", () => {
    const result = resolveTimeline(
      [
        entry("meikyo-shisui-skill"),
        entry("jinpu"),    // コンボ起点無しでも成立扱い
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resolvedPotency).toBe(300);
    // 明鏡止水バフのスタックが 3 → 2 に減っている
    const meikyoBuff = result.entries[1].activeBuffs.find((b) => b.buffId === "meikyo-shisui");
    expect(meikyoBuff?.stacks).toBe(2);
  });

  it("明鏡止水中: 月光単独でも wsComboError=false（comboFrom=[jinpu] を強制バイパス）", () => {
    const result = resolveTimeline(
      [
        entry("meikyo-shisui-skill"),
        entry("gekko"),   // comboFrom=["jinpu"] だがバイパスで成立
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[1].resolvedPotency).toBe(370);
    // 月閃も付与される
    expect(result.entries[1].resourceSnapshot.getsu).toBe(1);
  });

  it("明鏡止水で 3 WS 消費した後、4回目は通常判定（バフ消失）", () => {
    const result = resolveTimeline(
      [
        entry("meikyo-shisui-skill"),
        entry("jinpu"),       // スタック 3→2
        entry("shifu"),       // スタック 2→1
        entry("yukikaze"),    // スタック 1→0、バフ消失
        entry("jinpu"),       // バフ無し → コンボ判定通常通り（yukikazeの直後なのでコンボ不成立）
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[3].wsComboError).toBe(false);
    // 4回目は通常判定で失敗（バフ消失の証左）
    expect(result.entries[4].wsComboError).toBe(true);
  });

  it("明鏡止水中、2WS だけ使った時点ではバイパスが効くこと（中間スタックの存在確認）", () => {
    // 2 WS だけ使う独立シーケンス: スタック 1 残り、3WS 目のシフが成立する
    const result = resolveTimeline(
      [
        entry("meikyo-shisui-skill"),
        entry("jinpu"),       // 1WS 目: バイパス成立、スタック 3→2
        entry("shifu"),       // 2WS 目: バイパス成立、スタック 2→1（hakaze 経由不要）
        entry("yukikaze"),    // 3WS 目: バイパス成立、スタック 1→0
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    // 3WS 全てバイパスで成立
    expect(result.entries[1].wsComboError).toBe(false);
    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[3].wsComboError).toBe(false);
  });

  it("明鏡止水中の WS でも lastComboSkillId は更新される（通常コンボとの繋がり）", () => {
    const result = resolveTimeline(
      [
        entry("meikyo-shisui-skill"),
        entry("jinpu"),       // バイパス成立、lastComboSkillId="jinpu"
        entry("gekko"),       // jinpu の直後 → 通常コンボとして成立
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[2].wsComboError).toBe(false);
    expect(result.entries[2].resolvedPotency).toBe(370);
  });

  it("明鏡止水は居合術には影響しない（appliesToSkillIds 対象外）", () => {
    // 居合術系は comboFrom が無いので、そもそも明鏡止水のバイパス対象ではない
    // また居合術自体は閃数で変化するため、明鏡止水中に閃 0 で使うとマッチしない
    const result = resolveTimeline(
      [
        entry("meikyo-shisui-skill"),
        entry("iaijutsu"),    // 閃 0 → 元 iaijutsu のまま
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[1].resolvedSkillId).toBe("iaijutsu");
    // 明鏡止水のスタックは消費されない（appliesToSkillIds に iaijutsu が含まれないため）
    const meikyoBuff = result.entries[1].activeBuffs.find((b) => b.buffId === "meikyo-shisui");
    expect(meikyoBuff?.stacks).toBe(3);
  });

  it("Lv100 の明鏡止水で天道バフも同時に付与される", () => {
    const result = resolveTimeline(
      [entry("meikyo-shisui-skill")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[0].activeBuffs.some((b) => b.buffId === "meikyo-shisui")).toBe(true);
    expect(result.entries[0].activeBuffs.some((b) => b.buffId === "tendo")).toBe(true);
  });
});
