import type { ResourceDefinition } from "../types/skill";

/**
 * 暗黒騎士（DRK）リソース定義
 * - MP: 最大 10000。戦闘中は 3 秒ごとに 200 自然回復する（The Balance）。サイフォンストライク・ストルワートソウルのコンボ成立、
 *   カーヴ・アンド・スピット・アビサルドレイン（600）、ブラッドウェポン（1 スタックごとに 600）、デリリアム中の変化先（200・500）で得て、
 *   暗黒の剣・暗黒の波動、漆黒の剣・漆黒の波動（3000）で消費する。
 *   回復の刻みは、満タンから減ったときにそのスキルの使用時刻から数え始めるので、サーバーティック（3 の倍数秒）には揃わない近似
 * - ブラックブラッド: ソウルイーター・ストルワートソウルのコンボ成立（20）とブラッドウェポン（1 スタックごとに 10）で得て、
 *   ブラッドスピラー・クワイタス（50）で消費する。最大値は公式に記載が無く、The Balance の溢れの計算（70 + 3 × 10）から 100 とした
 */
export const DRK_RESOURCES: ResourceDefinition[] = [
  {
    id: "mp",
    maxStacks: 10000,
    initialStacks: 10000,
    color: "#5b9bd5",
    displayAsGauge: true,
    acquiredLevel: 1,
    autoGenerateInterval: 3,
    autoGenerateAmount: 200,
  },
  {
    id: "blackblood",
    maxStacks: 100,
    color: "#8e0000",
    displayAsGauge: true,
    acquiredLevel: 62,
  },
];
