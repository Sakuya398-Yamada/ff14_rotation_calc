import type { ResourceDefinition } from "../types/skill";

/**
 * 詩人（BRD）リソース定義
 *
 * - ソウルボイス（Soul Voice）: 詩心付与時に+5（最大100）
 *   → エイペックスアローで全消費
 * - コーダシンボル（Coda）: 各歌の実行時に付与（最大3）
 *   → 光神のフィナーレ / 光神のアンコールで消費
 * - 詩心（Repertoire）: 歌の効果中にDoTクリティカル時等で付与（最大3。軍神のパイオン中は最大4）
 *   → メヌエット中はピッチパーフェクトで消費
 */
export const BRD_RESOURCES: ResourceDefinition[] = [
  {
    id: "soul-voice",
    name: "ソウルボイス",
    shortName: "ｿｳﾙ\nﾎﾞｲｽ",
    maxStacks: 100,
    color: "#ffd700",
    acquiredLevel: 80,
    autoGenerateInterval: 3.75,
    autoGenerateAmount: 5,
    autoGenerateWhileBuff: ["mages-ballad", "armys-paeon", "wanderers-minuet"],
    // 詩心と同じく、歌を実行した時刻から数える
    autoGenerateRestartOnBuffChange: true,
  },
  {
    id: "coda-mages",
    name: "賢人のコーダ",
    shortName: "ｺｰﾀﾞ",
    maxStacks: 1,
    color: "#9c27b0",
    acquiredLevel: 90,
    displayGroup: "coda",
  },
  {
    id: "coda-armys",
    name: "軍神のコーダ",
    shortName: "ｺｰﾀﾞ",
    maxStacks: 1,
    color: "#ff9800",
    acquiredLevel: 90,
    displayGroup: "coda",
  },
  {
    id: "coda-wanderers",
    name: "旅神のコーダ",
    shortName: "ｺｰﾀﾞ",
    maxStacks: 1,
    color: "#4caf50",
    acquiredLevel: 90,
    displayGroup: "coda",
  },
  {
    id: "repertoire",
    name: "詩心",
    shortName: "詩心",
    maxStacks: 3,
    color: "#4caf50",
    acquiredLevel: 52,
    autoGenerateInterval: 3.75,
    autoGenerateWhileBuff: ["mages-ballad", "armys-paeon", "wanderers-minuet"],
    // 付与は歌ごとの効果なので、歌を上書きしたら新しい歌を実行した時刻から数え直す
    autoGenerateRestartOnBuffChange: true,
    whileBuffModifiers: [
      // 軍神のパイオン: 詩心は最大 4、詩心 1 つにつき 4% のヘイスト
      { buffId: "armys-paeon", maxStacks: 4, gcdHastePerStack: 0.04 },
      // 賢人のバラード: 詩心が付与されるとブラッドレッター系のリキャストが 7.5 秒短縮
      { buffId: "mages-ballad", cooldownReductionOnGain: { chargeKey: "brd-bloodletter", seconds: 7.5 } },
    ],
    // 詩心は歌ごとのゲージで、歌が別の歌で上書きされるか時間切れになると消える
    resetOnBuffEnd: ["mages-ballad", "armys-paeon", "wanderers-minuet"],
  },
];
