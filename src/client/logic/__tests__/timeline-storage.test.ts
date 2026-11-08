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

  it("Object のプロトタイプのキーをジョブIDにした JSON は例外を投げずに null を返す", () => {
    for (const key of ["constructor", "toString", "__proto__"]) {
      const json = JSON.stringify({ version: SCHEMA_VERSION, ...makeSnapshot(), selectedJob: key });
      expect(() => deserializeAppState(json), key).not.toThrow();
      expect(deserializeAppState(json), key).toBeNull();
    }
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

  it("procOccurred は true / false とも往復し、boolean 以外はキーを落とし、未設定ならキーは無い (#838)", () => {
    const json = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot({ selectedJob: "brd" }),
      entries: [
        { uid: "entry-1", skillId: "burst-shot", procOccurred: true },
        { uid: "entry-2", skillId: "heavy-shot", procOccurred: false },
        { uid: "entry-3", skillId: "iron-jaws", procOccurred: "true" },
        { uid: "entry-4", skillId: "refulgent-arrow" },
      ],
    });
    const restored = deserializeAppState(json);
    expect(restored?.entries).toEqual([
      { uid: "entry-1", skillId: "burst-shot", procOccurred: true },
      { uid: "entry-2", skillId: "heavy-shot", procOccurred: false },
      { uid: "entry-3", skillId: "iron-jaws" },
      { uid: "entry-4", skillId: "refulgent-arrow" },
    ]);
    expect(restored?.entries[2]).not.toHaveProperty("procOccurred");
    expect(restored?.entries[3]).not.toHaveProperty("procOccurred");
  });

  it("autoGenerateProcOccurred は往復し、末尾の null を切り詰め、不正な値と全部 null はキーを落とす (#900)", () => {
    const json = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot({ selectedJob: "brd" }),
      entries: [
        { uid: "entry-1", skillId: "wanderers-minuet", autoGenerateProcOccurred: [true, null, false] },
        { uid: "entry-2", skillId: "mages-ballad", autoGenerateProcOccurred: [null, true, null, null] },
        { uid: "entry-3", skillId: "armys-paeon", autoGenerateProcOccurred: [null, null] },
        { uid: "entry-4", skillId: "wanderers-minuet", autoGenerateProcOccurred: [true, "false"] },
        { uid: "entry-5", skillId: "mages-ballad", autoGenerateProcOccurred: Array.from({ length: 15 }, () => true) },
        { uid: "entry-6", skillId: "armys-paeon", autoGenerateProcOccurred: { 0: true } },
        { uid: "entry-7", skillId: "burst-shot" },
      ],
    });
    const restored = deserializeAppState(json);
    expect(restored?.entries).toEqual([
      { uid: "entry-1", skillId: "wanderers-minuet", autoGenerateProcOccurred: [true, null, false] },
      { uid: "entry-2", skillId: "mages-ballad", autoGenerateProcOccurred: [null, true] },
      { uid: "entry-3", skillId: "armys-paeon" },
      { uid: "entry-4", skillId: "wanderers-minuet" },
      { uid: "entry-5", skillId: "mages-ballad" },
      { uid: "entry-6", skillId: "armys-paeon" },
      { uid: "entry-7", skillId: "burst-shot" },
    ]);
    for (const e of restored!.entries.slice(2)) expect(e).not.toHaveProperty("autoGenerateProcOccurred");

    // 14 回ちょうどは上限の内
    const full = Array.from({ length: 14 }, (_, i) => i % 2 === 0);
    const fullJson = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot({ selectedJob: "brd" }),
      entries: [{ uid: "entry-1", skillId: "wanderers-minuet", autoGenerateProcOccurred: full }],
    });
    expect(deserializeAppState(fullJson)?.entries[0].autoGenerateProcOccurred).toEqual(full);
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

  it("着弾までの遅れ（hitDelays）はラウンドトリップで残る (#901)", () => {
    const snapshot = makeSnapshot({ hitDelays: { glare3: 0.62, dia: 0 } });
    const restored = deserializeAppState(serializeAppState(snapshot));
    expect(restored).toEqual({ version: SCHEMA_VERSION, ...snapshot });
  });

  it("hitDelays の無い保存データも読め、復元結果にもキーが無い (#901)", () => {
    const restored = deserializeAppState(serializeAppState(makeSnapshot()));
    expect(restored).not.toBeNull();
    expect(restored).not.toHaveProperty("hitDelays");
  });

  it("hitDelays のうち、選択ジョブに無いスキル・負の値・数値でない値は落とし、残りが無ければキーも無い (#901)", () => {
    const json = JSON.stringify({
      version: SCHEMA_VERSION,
      ...makeSnapshot(),
      hitDelays: { glare3: 0.5, "burst-shot": 0.6, dia: -0.1, holy3: "0.6" },
    });
    expect(deserializeAppState(json)?.hitDelays).toEqual({ glare3: 0.5 });

    const allInvalid = JSON.stringify({ version: SCHEMA_VERSION, ...makeSnapshot(), hitDelays: { dia: -1 } });
    expect(deserializeAppState(allInvalid)).not.toHaveProperty("hitDelays");

    const notObject = JSON.stringify({ version: SCHEMA_VERSION, ...makeSnapshot(), hitDelays: [0.5] });
    expect(deserializeAppState(notObject)).not.toHaveProperty("hitDelays");
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
