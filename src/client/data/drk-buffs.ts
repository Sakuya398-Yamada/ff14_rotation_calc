import type { BuffDefinition } from "../types/skill";
import { DRK_DARKSIDE_TARGET_IDS, DRK_GCD_IDS } from "./drk-skills";

import edgeOfShadowIcon from "../assets/icons/drk/Edge_of_Shadow.png";
import deliriumIcon from "../assets/icons/drk/Delirium.png";
import bloodWeaponIcon from "../assets/icons/drk/Blood_Weapon.png";
import comeuppanceIcon from "../assets/icons/drk/Comeuppance.png";
import torcleaverIcon from "../assets/icons/drk/Torcleaver.png";
import disesteemIcon from "../assets/icons/drk/Disesteem.png";
import saltedEarthIcon from "../assets/icons/drk/Salted_Earth.png";

/** ブラッドデリリアム中にブラックブラッドを消費せずに使える（Lv68〜95）スキル */
const DELIRIUM_FREE_IDS = ["bloodspiller", "quietus"];
/** ブラッドデリリアムのスタックを消費するスキル（Lv96 からは変化先で消費する） */
const DELIRIUM_CONSUMER_IDS = [...DELIRIUM_FREE_IDS, "scarlet-delirium", "comeuppance", "torcleaver", "impalement"];

/**
 * 暗黒騎士（DRK）バフ定義
 * 暗黒（与ダメージ +10%）は漆黒の剣・漆黒の波動（Lv74 未満は暗黒の剣・暗黒の波動）で付与し、効果中に付け直すと 30 秒延長（上限 60 秒）。
 * ブラッドデリリアムはブラッドデリリアムとブラッドウェポンを 3 スタックずつ付与する
 */
export const DRK_BUFFS: BuffDefinition[] = [
  {
    // 英雄の影身の攻撃（影身具現）には乗らない（The Balance）ので、対象から影身具現を外す
    id: "darkside",
    icon: edgeOfShadowIcon,
    duration: 30,
    maxDuration: 60,
    effects: [{ type: "potency", value: 1.1, appliesToSkillIds: DRK_DARKSIDE_TARGET_IDS }],
    color: "#6a1b9a",
    acquiredLevel: 30,
  },
  {
    // Lv68〜95: ブラッドスピラー・クワイタスをブラックブラッドを消費せずに使える（命中時の MP 回復は量の記載が無いので表さない）。
    // Lv96〜: ブラッドスピラーがレッドデリリアムに、クワイタスがインペイルメントに変化する（drk-skills.ts の autoTransform）。
    // どちらも使うたびに 1 スタック消費する（変化後の ID で判定する）
    id: "delirium",
    icon: deliriumIcon,
    duration: 15,
    maxStacks: 3,
    effects: [
      { type: "resourceCostMultiplier", value: 0, resourceId: "blackblood", appliesToSkillIds: DELIRIUM_FREE_IDS },
      { type: "consumeOnGcd", value: 1, appliesToSkillIds: DELIRIUM_CONSUMER_IDS },
    ],
    color: "#c62828",
    acquiredLevel: 68,
  },
  {
    // ウェポンスキル・魔法が命中するたびに 1 スタック消費し、MP 600 とブラックブラッド 10 を得る（範囲攻撃でも 1 回）
    id: "blood-weapon",
    icon: bloodWeaponIcon,
    duration: 15,
    maxStacks: 3,
    effects: [
      { type: "consumeOnGcd", value: 1, appliesToSkillIds: DRK_GCD_IDS },
      { type: "resourceGainOnSkill", value: 600, resourceId: "mp", appliesToSkillIds: DRK_GCD_IDS },
      { type: "resourceGainOnSkill", value: 10, resourceId: "blackblood", appliesToSkillIds: DRK_GCD_IDS },
    ],
    color: "#8e0000",
    acquiredLevel: 68,
  },
  {
    // 段のバフ（データ独自）: レッドデリリアムがカマパンスに変化する
    id: "comeuppance-ready",
    icon: comeuppanceIcon,
    duration: 30,
    exclusiveGroup: "delirium-combo",
    effects: [],
    color: "#ad1457",
    acquiredLevel: 96,
  },
  {
    // 段のバフ（データ独自）: レッドデリリアムがトアクリーバーに変化する
    id: "torcleaver-ready",
    icon: torcleaverIcon,
    duration: 30,
    exclusiveGroup: "delirium-combo",
    effects: [],
    color: "#880e4f",
    acquiredLevel: 96,
  },
  {
    // 影身具現で付与。ディセスティームを実行できる
    id: "scorn",
    icon: disesteemIcon,
    duration: 30,
    effects: [],
    color: "#37474f",
    acquiredLevel: 100,
  },
  {
    // ソルトアースの効果中（データ独自の目印）。ソルト・アンド・ダークを実行できる
    id: "salted-earth",
    icon: saltedEarthIcon,
    duration: 15,
    effects: [],
    color: "#5d4037",
    acquiredLevel: 52,
  },
];
