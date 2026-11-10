import type { ResourceDefinition } from "../types/skill";

/**
 * 踊り子（DNC）リソース定義
 * - フェザー（幻扇）: リバースカスケード・ファウンテンフォール・ライジングウィンドミル・ブラッドシャワーの命中時に 50% で 1 つ得て（最大 4）、
 *   扇の舞い【序】【破】で 1 つ消費する。確率の獲得は ResourceChange.procRate で、消費するスキルの威力を期待値にする（#959）
 * - エスプリ: 自分にエスプリ効果（スタンダードフィニッシュ由来・テクニカルフィニッシュ由来）がある間の WS（カスケード系 +5、
 *   リバースカスケード系 +5・Lv84 から +10）と、ティラナ（+50）で得て、剣の舞い・暁の舞いで 50 消費する（最大 100）。
 *   パートナー・パーティメンバーの WS・魔法で得る分は入れない（確率の値に公式の出典が無い。#959 で決定）
 * - ステップ: ダンス中にステップを実行した回数（どのステップを、どの順で置いても 1 回と数える。#959 で決定）。
 *   スタンダードステップ中は 2 回、テクニカルステップ中は 4 回まで数え、それより後のステップは数えない。
 *   フィニッシュ（ダンスの解除）とダンスの時間切れで 0 に戻す
 */
export const DNC_RESOURCES: ResourceDefinition[] = [
  {
    id: "dnc-feather",
    maxStacks: 4,
    color: "#ec407a",
  },
  {
    id: "esprit",
    maxStacks: 100,
    color: "#ffca28",
    displayAsGauge: true,
    acquiredLevel: 76,
  },
  {
    id: "dance-steps",
    maxStacks: 4,
    color: "#ab47bc",
    whileBuffModifiers: [{ buffId: "standard-step", maxStacks: 2 }],
    resetOnBuffEnd: ["standard-step", "technical-step"],
  },
];
