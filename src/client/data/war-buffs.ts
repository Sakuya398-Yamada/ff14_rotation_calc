import type { BuffDefinition } from "../types/skill";

import stormsEyeIcon from "../assets/icons/war/Storm's_Eye.png";
import berserkIcon from "../assets/icons/war/Berserk.png";
import innerReleaseIcon from "../assets/icons/war/Inner_Release.png";
import infuriateIcon from "../assets/icons/war/Infuriate.png";
import primalRendIcon from "../assets/icons/war/Primal_Rend.png";
import primalRuinationIcon from "../assets/icons/war/Primal_Ruination.png";
import primalWrathIcon from "../assets/icons/war/Primal_Wrath.png";

/** 原初の解放のゲージ消費なし・確定クリティカル／ダイレクトヒット・スタック消費の対象 */
const INNER_RELEASE_TARGET_IDS = ["fell-cleave", "decimate"];

/**
 * 戦士（WAR）バフ定義
 *
 * 原初の鼓動（Lv96。原初の解放中のフェルクリーヴ・デシメートで 1 スタック、3 スタックで原初の激震実行可に変わる）は、
 * 原初の解放の 3 スタックを使い切ったら原初の激震実行可を付ける（applyBuffOnDeplete）形で近似する。
 * 解放が使い残しで切れたときの鼓動の持ち越し（次の解放で 3 スタックに届く）は表さない
 */
export const WAR_BUFFS: BuffDefinition[] = [
  {
    // シュトルムブレハ・ミスリルテンペストのコンボで付与。効果中に付与し直すと 30 秒延長（上限 60 秒）。
    // 原初の解放・バーサクで 10 秒延長（上限 60 秒。war-skills.ts の buffExtensions）
    id: "surging-tempest",
    icon: stormsEyeIcon,
    duration: 30,
    maxDuration: 60,
    effects: [{ type: "potency", value: 1.1 }],
    color: "#f57c00",
    acquiredLevel: 40,
  },
  {
    // ウェポンスキル 1 回ごとに 1 スタック消費し、必ずクリティカルヒットかつダイレクトヒット（Lv70 で原初の解放に置き換わる）
    id: "berserk",
    icon: berserkIcon,
    duration: 15,
    maxStacks: 3,
    effects: [
      { type: "guaranteedCrit", value: 1 },
      { type: "guaranteedDh", value: 1 },
    ],
    color: "#c62828",
    acquiredLevel: 6,
  },
  {
    // フェルクリーヴ・デシメートをビーストゲージを消費せずに使え（50 未満でも使える）、必ずクリティカルヒットかつダイレクトヒット。
    // インナーカオス・カオティックサイクロンに変化したときはスタックを消費しない（変化後の ID で判定する）
    id: "inner-release",
    icon: innerReleaseIcon,
    duration: 15,
    maxStacks: 3,
    effects: [
      { type: "resourceCostMultiplier", value: 0, resourceId: "beast-gauge", appliesToSkillIds: INNER_RELEASE_TARGET_IDS },
      { type: "guaranteedCrit", value: 1, appliesToSkillIds: INNER_RELEASE_TARGET_IDS },
      { type: "guaranteedDh", value: 1, appliesToSkillIds: INNER_RELEASE_TARGET_IDS },
      { type: "consumeOnGcd", value: 1, appliesToSkillIds: INNER_RELEASE_TARGET_IDS },
      { type: "applyBuffOnDeplete", value: 1, appliedBuffId: "wrathful" },
    ],
    color: "#b71c1c",
    acquiredLevel: 70,
  },
  {
    // ウォークライで付与。ビーストゲージ 50 以上でフェルクリーヴがインナーカオス（Lv80）に、デシメートがカオティックサイクロンに変化する
    id: "nascent-chaos",
    icon: infuriateIcon,
    duration: 30,
    effects: [],
    color: "#6a1b9a",
    acquiredLevel: 72,
  },
  {
    id: "primal-rend-ready",
    icon: primalRendIcon,
    duration: 30,
    effects: [],
    color: "#ad1457",
    acquiredLevel: 90,
  },
  {
    id: "primal-ruination-ready",
    icon: primalRuinationIcon,
    duration: 20,
    effects: [],
    color: "#880e4f",
    acquiredLevel: 100,
  },
  {
    // 原初の激震実行可。効果時間は、変わる前の原初の鼓動の 30 秒を引き継ぐとみなした推定
    id: "wrathful",
    icon: primalWrathIcon,
    duration: 30,
    effects: [],
    color: "#d84315",
    acquiredLevel: 96,
  },
];
