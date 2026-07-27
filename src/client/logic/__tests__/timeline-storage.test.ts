// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  serializeAppState,
  deserializeAppState,
  computeNextUid,
  loadAppState,
  saveAppState,
} from "../timeline-storage";
import type { AppStateSnapshot } from "../timeline-storage";
import type { TimelineEntry } from "../../types/skill";

function makeSnapshot(overrides: Partial<AppStateSnapshot> = {}): AppStateSnapshot {
  return {
    selectedJob: "whm",
    level: 100,
    entries: [
      { uid: "entry-1", skillId: "glare3" },
      { uid: "entry-2", skillId: "dia", manualStartTime: 12.5 },
    ],
    stats: { critical: 3000, directHit: 2000, determination: 2500, speed: 528 },
    untargetableWindows: [{ startTime: 30, endTime: 45 }],
    multiTargetWindows: [{ startTime: 0, endTime: 20, targetCount: 3 }],
    ...overrides,
  };
}

describe("serializeAppState / deserializeAppState", () => {
  it("シリアライズ→復元のラウンドトリップで同じ状態が得られる", () => {
    const snapshot = makeSnapshot();
    const restored = deserializeAppState(serializeAppState(snapshot));
    expect(restored).toEqual({ version: SCHEMA_VERSION, ...snapshot });
  });

  it("manualStartTime 未設定のエントリはキー自体が省略されたまま復元される", () => {
    const restored = deserializeAppState(serializeAppState(makeSnapshot()));
    expect(restored?.entries[0]).toEqual({ uid: "entry-1", skillId: "glare3" });
    expect(restored?.entries[0]).not.toHaveProperty("manualStartTime");
  });

  it("null・空文字・不正JSONは null を返す", () => {
    expect(deserializeAppState(null)).toBeNull();
    expect(deserializeAppState("")).toBeNull();
    expect(deserializeAppState("{not json")).toBeNull();
    expect(deserializeAppState('"string"')).toBeNull();
  });

  it("スキーマバージョン不一致は null を返す", () => {
    const json = JSON.stringify({ version: SCHEMA_VERSION + 1, ...makeSnapshot() });
    expect(deserializeAppState(json)).toBeNull();
  });

  it("不正なジョブID・レベルは null を返す", () => {
    const badJob = JSON.stringify({ version: SCHEMA_VERSION, ...makeSnapshot(), selectedJob: "ninja" });
    expect(deserializeAppState(badJob)).toBeNull();
    const badLevel = JSON.stringify({ version: SCHEMA_VERSION, ...makeSnapshot(), level: 55 });
    expect(deserializeAppState(badLevel)).toBeNull();
  });

  it("stats のフィールド欠落・非数値は null を返す", () => {
    const missing = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot(),
      stats: { critical: 3000, directHit: 2000, determination: 2500 },
    });
    expect(deserializeAppState(missing)).toBeNull();
    const nonNumber = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot(),
      stats: { critical: "3000", directHit: 2000, determination: 2500, speed: 528 },
    });
    expect(deserializeAppState(nonNumber)).toBeNull();
  });

  it("選択ジョブに存在しない skillId のエントリは除外して復元する", () => {
    const snapshot = makeSnapshot({
      entries: [
        { uid: "entry-1", skillId: "glare3" },
        { uid: "entry-2", skillId: "removed-skill" },
        { uid: "entry-3", skillId: "dia" },
      ],
    });
    const restored = deserializeAppState(serializeAppState(snapshot));
    expect(restored?.entries.map((e) => e.skillId)).toEqual(["glare3", "dia"]);
  });

  it("他ジョブの skillId は選択ジョブ基準で除外される", () => {
    // fire-3 は BLM のスキルなので WHM 選択時は除外される
    const snapshot = makeSnapshot({
      entries: [{ uid: "entry-1", skillId: "fire-3" }],
    });
    const restored = deserializeAppState(serializeAppState(snapshot));
    expect(restored?.entries).toEqual([]);
  });

  it("manualStartTime が非数値のエントリはキーを落として復元する", () => {
    const json = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot(),
      entries: [{ uid: "entry-1", skillId: "glare3", manualStartTime: "abc" }],
    });
    const restored = deserializeAppState(json);
    expect(restored?.entries).toEqual([{ uid: "entry-1", skillId: "glare3" }]);
  });

  it("targetCount が 2 未満の複数体ウィンドウを含む場合は null を返す", () => {
    const json = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot(),
      multiTargetWindows: [{ startTime: 0, endTime: 20, targetCount: 1 }],
    });
    expect(deserializeAppState(json)).toBeNull();
  });
});

describe("computeNextUid", () => {
  it("空配列なら 1 を返す", () => {
    expect(computeNextUid([])).toBe(1);
  });

  it("entry-N 形式の最大値 + 1 を返す", () => {
    const entries: TimelineEntry[] = [
      { uid: "entry-3", skillId: "glare3" },
      { uid: "entry-7", skillId: "dia" },
      { uid: "entry-2", skillId: "glare3" },
    ];
    expect(computeNextUid(entries)).toBe(8);
  });

  it("entry-N 形式でない uid は無視する", () => {
    const entries: TimelineEntry[] = [
      { uid: "custom-99", skillId: "glare3" },
      { uid: "entry-4", skillId: "dia" },
    ];
    expect(computeNextUid(entries)).toBe(5);
  });
});

describe("loadAppState / saveAppState (LocalStorage 連携)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("保存した状態を読み込みで復元できる", () => {
    const snapshot = makeSnapshot();
    saveAppState(snapshot);
    expect(loadAppState()).toEqual({ version: SCHEMA_VERSION, ...snapshot });
  });

  it("未保存時は null を返す", () => {
    expect(loadAppState()).toBeNull();
  });

  it("保存データが壊れている場合は null を返す（初期状態フォールバック）", () => {
    window.localStorage.setItem(STORAGE_KEY, "{broken json");
    expect(loadAppState()).toBeNull();
  });

  it("スキーマバージョンが古い保存データは null を返す", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 0, ...makeSnapshot() }));
    expect(loadAppState()).toBeNull();
  });
});
