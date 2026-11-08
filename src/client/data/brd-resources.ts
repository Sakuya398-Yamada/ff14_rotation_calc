import type { ResourceDefinition } from "../types/skill";

/**
 * 詩人（BRD）リソース定義
 *
 * - ソウルボイス（Soul Voice）: 詩心付与時に+5（最大100）
 *   → エイペックスアローで全消費
 * - コーダシンボル（Coda）: 各歌の実行時に付与（最大3）
 *   → 光神のフィナーレ / 光神のアンコールで消費
 * - 詩心（Repertoire）: 歌の効果中の 3 秒ごとの判定で、80% の確率で付与（旅神のメヌエット中は最大3、軍神のパイオン中は最大4。
 *   賢人のバラード中は溜まらず、付与のたびにブラッドレッター系のリキャストを短縮する）
 *   → メヌエット中はピッチパーフェクトで消費
 *
 * 歌の判定は、歌が付いてから 3, 6, …, 42 秒の 14 回（45 秒の時間切れちょうどは判定しない）。
 * 判定ごとの発生は歌のエントリで指定し、未指定の判定は 3・8・13 回目を不発とする（#900。出典は公式ジョブガイドの
 * 「追加効果（発動確率80％）」と特性「ソウルボイス」の「発動条件：自身に「詩心」が付与されるとき」、間隔と起点は The Balance の BRD FAQ）
 */
export const BRD_RESOURCES: ResourceDefinition[] = [
  {
    id: "soul-voice",
    maxStacks: 100,
    color: "#ffd700",
    displayAsGauge: true,
    acquiredLevel: 80,
    autoGenerateInterval: 3,
    autoGenerateAmount: 5,
    autoGenerateWhileBuff: ["mages-ballad", "armys-paeon", "wanderers-minuet"],
    // 詩心と同じく、歌を実行した時刻から数える
    autoGenerateRestartOnBuffChange: true,
    // 詩心が付与される判定と同じ判定で増える（詩心と同じ指定を引く）
    autoGenerateProcRate: 0.8,
  },
  {
    id: "coda-mages",
    maxStacks: 1,
    color: "#9c27b0",
    acquiredLevel: 90,
    displayGroup: "coda",
  },
  {
    id: "coda-armys",
    maxStacks: 1,
    color: "#ff9800",
    acquiredLevel: 90,
    displayGroup: "coda",
  },
  {
    id: "coda-wanderers",
    maxStacks: 1,
    color: "#4caf50",
    acquiredLevel: 90,
    displayGroup: "coda",
  },
  {
    id: "repertoire",
    // 詩心を使わない時間帯（歌なし・賢人のバラード中）は上限 0。上限は歌ごとに whileBuffModifiers で決める
    maxStacks: 0,
    color: "#4caf50",
    // ドットだと、アビリティを続けて並べたときに隣のマーカーの丸とつながって数が読めないので、数字付きのゲージで描く
    displayAsGauge: true,
    acquiredLevel: 52,
    autoGenerateInterval: 3,
    autoGenerateWhileBuff: ["mages-ballad", "armys-paeon", "wanderers-minuet"],
    // 付与は歌ごとの効果なので、歌を上書きしたら新しい歌を実行した時刻から数え直す
    autoGenerateRestartOnBuffChange: true,
    autoGenerateProcRate: 0.8,
    whileBuffModifiers: [
      // 旅神のメヌエット: 詩心は最大 3（ピッチパーフェクトで消費）
      { buffId: "wanderers-minuet", maxStacks: 3 },
      // 軍神のパイオン: 詩心は最大 4、詩心 1 つにつき 4% のヘイスト
      { buffId: "armys-paeon", maxStacks: 4, gcdHastePerStack: 0.04 },
      // 賢人のバラード: 詩心は溜まらない（上限 0）が、付与されるたびにブラッドレッター系のリキャストが 7.5 秒短縮
      { buffId: "mages-ballad", cooldownReductionOnGain: { chargeKey: "brd-bloodletter", seconds: 7.5 } },
    ],
    // 詩心は歌ごとのゲージで、歌が別の歌で上書きされるか時間切れになると消える
    resetOnBuffEnd: ["mages-ballad", "armys-paeon", "wanderers-minuet"],
  },
];
