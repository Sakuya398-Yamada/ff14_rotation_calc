import { describe, it, expect } from "vitest";
import {
  DEFAULT_STATS,
  calcCritRate,
  calcCritMultiplier,
  calcDhRate,
  calcDetMultiplier,
  calcGcd,
  calcExpectedMultiplier,
} from "../stat-calc";
import type { CharacterStats } from "../../types/skill";

function makeStats(overrides: Partial<CharacterStats> = {}): CharacterStats {
  return { ...DEFAULT_STATS, ...overrides };
}

describe("calcCritRate", () => {
  it("基準値（CRIT=420）で初期値 5.0% を返す", () => {
    expect(calcCritRate(DEFAULT_STATS)).toBe(0.05);
  });

  it("実測ステータス値（CRIT=2000）で 16.3% を返す", () => {
    // floor(200 * 1580 / 2780) = floor(113.66...) = 113 → (113 + 50) / 1000
    expect(calcCritRate(makeStats({ critical: 2000 }))).toBe(0.163);
  });

  it("floor の丸め境界: CRIT=433 では 5.0% のまま、CRIT=434 で 5.1% に上がる", () => {
    // 200 * 13 / 2780 = 0.935（floor 0）、200 * 14 / 2780 = 1.007（floor 1）
    expect(calcCritRate(makeStats({ critical: 433 }))).toBe(0.05);
    expect(calcCritRate(makeStats({ critical: 434 }))).toBe(0.051);
  });
});

describe("calcCritMultiplier", () => {
  it("基準値（CRIT=420）で初期倍率 1.400 を返す", () => {
    expect(calcCritMultiplier(DEFAULT_STATS)).toBe(1.4);
  });

  it("実測ステータス値（CRIT=2000）で 1.513 を返す", () => {
    expect(calcCritMultiplier(makeStats({ critical: 2000 }))).toBe(1.513);
  });

  it("floor の丸め境界: CRIT=433 では 1.400 のまま、CRIT=434 で 1.401 に上がる", () => {
    expect(calcCritMultiplier(makeStats({ critical: 433 }))).toBe(1.4);
    expect(calcCritMultiplier(makeStats({ critical: 434 }))).toBe(1.401);
  });
});

describe("calcDhRate", () => {
  it("基準値（DH=420）で初期値 0% を返す", () => {
    expect(calcDhRate(DEFAULT_STATS)).toBe(0);
  });

  it("実測ステータス値（DH=2000）で 31.2% を返す", () => {
    // floor(550 * 1580 / 2780) = floor(312.58...) = 312
    expect(calcDhRate(makeStats({ directHit: 2000 }))).toBe(0.312);
  });

  it("floor の丸め境界: DH=425 では 0% のまま、DH=426 で 0.1% に上がる", () => {
    // 550 * 5 / 2780 = 0.989（floor 0）、550 * 6 / 2780 = 1.187（floor 1）
    expect(calcDhRate(makeStats({ directHit: 425 }))).toBe(0);
    expect(calcDhRate(makeStats({ directHit: 426 }))).toBe(0.001);
  });
});

describe("calcDetMultiplier", () => {
  it("基準値（DET=440）で初期倍率 1.000 を返す", () => {
    expect(calcDetMultiplier(DEFAULT_STATS)).toBe(1);
  });

  it("実測ステータス値（DET=3000）で 1.128 を返す", () => {
    // floor(140 * 2560 / 2780) = floor(128.92...) = 128
    expect(calcDetMultiplier(makeStats({ determination: 3000 }))).toBe(1.128);
  });

  it("floor の丸め境界: DET=459 では 1.000 のまま、DET=460 で 1.001 に上がる", () => {
    // 140 * 19 / 2780 = 0.956（floor 0）、140 * 20 / 2780 = 1.007（floor 1）
    expect(calcDetMultiplier(makeStats({ determination: 459 }))).toBe(1);
    expect(calcDetMultiplier(makeStats({ determination: 460 }))).toBe(1.001);
  });
});

describe("calcGcd", () => {
  it("基準値（Speed=420）で短縮なし（2.50 → 2.50）", () => {
    expect(calcGcd(2.5, DEFAULT_STATS)).toBe(2.5);
  });

  it("ceil の丸め境界: Speed=441 では 2.50 のまま、Speed=442 で 2.49 に縮む", () => {
    // 130 * -21 / 2780 = -0.982（ceil 0）、130 * -22 / 2780 = -1.028（ceil -1）
    // speedMod=-1 のとき floor(2500 * 999 / 10000) = floor(249.75) = 249 → 2.49
    expect(calcGcd(2.5, makeStats({ speed: 441 }))).toBe(2.5);
    expect(calcGcd(2.5, makeStats({ speed: 442 }))).toBe(2.49);
  });

  it("実測ステータス値（Speed=2000）で 2.50 → 2.31 に短縮される", () => {
    // speedMod = ceil(130 * -1580 / 2780) = ceil(-73.88) = -73
    // floor(2500 * 927 / 10000) = floor(231.75) = 231 → 2.31
    expect(calcGcd(2.5, makeStats({ speed: 2000 }))).toBe(2.31);
  });

  it("ベースGCD 2.8s（BLMディスペア等）でも同じ丸め順で短縮される", () => {
    // speedMod = -73: floor(2800 * 927 / 10000) = floor(259.56) = 259 → 2.59
    expect(calcGcd(2.8, makeStats({ speed: 2000 }))).toBe(2.59);
  });
});

describe("calcExpectedMultiplier", () => {
  it("基準値で 1.02（クリ率 5% × クリ倍率 1.4 の期待値のみ）", () => {
    // 1.000 * (1 + 0.05 * 0.4) * (1 + 0 * 0.25) = 1.02
    expect(calcExpectedMultiplier(DEFAULT_STATS)).toBeCloseTo(1.02, 10);
  });

  it("critRateBonus / dhRateBonus が発生率に加算される", () => {
    // critRate = 0.05 + 0.1 = 0.15, dhRate = 0 + 0.2 = 0.2
    // 1.000 * (1 + 0.15 * 0.4) * (1 + 0.2 * 0.25) = 1.06 * 1.05 = 1.113
    expect(calcExpectedMultiplier(DEFAULT_STATS, 0.1, 0.2)).toBeCloseTo(1.113, 10);
  });

  it("発生率は 1 を超えないようクランプされる", () => {
    // critRate / dhRate とも 1 にクランプ → 1.000 * 1.4 * 1.25 = 1.75
    expect(calcExpectedMultiplier(DEFAULT_STATS, 2, 2)).toBeCloseTo(1.75, 10);
  });
});
