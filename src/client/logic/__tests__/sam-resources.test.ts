import { describe, it, expect } from "vitest";
import { SAM_RESOURCES } from "../../data/sam-resources";
import { resolveTimeline } from "../resolve-timeline";
import { SAM_ATTACK_SKILLS } from "../../data/sam-skills";
import { SAM_BUFFS } from "../../data/sam-buffs";
import type { TimelineEntry } from "../../types/skill";

const skillMap = new Map(SAM_ATTACK_SKILLS.map((s) => [s.id, s]));

function entry(skillId: string): TimelineEntry {
  return { uid: `${skillId}-${Math.random()}`, skillId };
}

describe("侍: リソース定義（剣気・閃3種・剣圧）", () => {
  it("閃3種は displayGroup='sen' で 1 行統合表示される", () => {
    const setsu = SAM_RESOURCES.find((r) => r.id === "setsu");
    const getsu = SAM_RESOURCES.find((r) => r.id === "getsu");
    const ka = SAM_RESOURCES.find((r) => r.id === "ka");

    expect(setsu?.displayGroup).toBe("sen");
    expect(getsu?.displayGroup).toBe("sen");
    expect(ka?.displayGroup).toBe("sen");
    expect(setsu?.groupMaxStacks).toBe(3);
    expect(getsu?.groupMaxStacks).toBe(3);
    expect(ka?.groupMaxStacks).toBe(3);
  });

  it("剣気は最大100でキャップされる", () => {
    const kenki = SAM_RESOURCES.find((r) => r.id === "kenki");
    expect(kenki?.maxStacks).toBe(100);
    expect(kenki?.displayGroup).toBeUndefined();
  });

  it("剣圧は最大3でキャップされる", () => {
    const meditation = SAM_RESOURCES.find((r) => r.id === "meditation");
    expect(meditation?.maxStacks).toBe(3);
    expect(meditation?.acquiredLevel).toBe(90);
  });

  it("葉隠: 1閃のみで剣気+10", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),  // 雪閃のみ
        entry("hagakure"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot.setsu).toBe(0);
    // 剣気: 刃風(+5) + 雪風(+10) + 葉隠(+10*1) = 25
    expect(last.resourceSnapshot.kenki).toBe(25);
  });

  it("葉隠: 2閃で剣気+20（gainPerConsumed × consumeAllCount の乗算）", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),                  // 雪閃
        entry("hakaze"), entry("jinpu"), entry("gekko"),     // 月閃
        entry("hagakure"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot.setsu).toBe(0);
    expect(last.resourceSnapshot.getsu).toBe(0);
    // 剣気: 刃風×2(+10) + 雪風(+10) + 陣風(+5) + 月光(+10) + 葉隠(+10*2=20) = 55
    expect(last.resourceSnapshot.kenki).toBe(55);
  });

  it("葉隠: 3閃で剣気+30", () => {
    const result = resolveTimeline(
      [
        entry("hakaze"), entry("yukikaze"),
        entry("hakaze"), entry("jinpu"), entry("gekko"),
        entry("hakaze"), entry("shifu"), entry("kasha"),
        entry("hagakure"),
      ],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    const last = result.entries[result.entries.length - 1];
    expect(last.resourceSnapshot.setsu).toBe(0);
    expect(last.resourceSnapshot.getsu).toBe(0);
    expect(last.resourceSnapshot.ka).toBe(0);
    // 剣気: 刃風×3(+15) + 陣風(+5) + 月光(+10) + 士風(+5) + 花車(+10) + 雪風(+10) + 葉隠(+10*3=30) = 85
    expect(last.resourceSnapshot.kenki).toBe(85);
  });

  it("葉隠: 閃 0 のときは実行不可（resourceErrors に setsu）", () => {
    const result = resolveTimeline(
      [entry("hagakure")],
      skillMap,
      SAM_RESOURCES,
      undefined,
      SAM_BUFFS
    );

    expect(result.entries[0].resourceErrors).toContain("setsu");
    // エラーなので剣気は獲得されない
    expect(result.entries[0].resourceSnapshot.kenki ?? 0).toBe(0);
  });
});
