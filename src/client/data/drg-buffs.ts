import type { BuffDefinition } from "../types/skill";

import lanceChargeIcon from "../assets/icons/drg/Lance_Charge.png";
import battleLitanyIcon from "../assets/icons/drg/Battle_Litany.png";
import lifeSurgeIcon from "../assets/icons/drg/Life_Surge.png";
import lifeOfTheDragonIcon from "../assets/icons/drg/traits/Life_of_the_Dragon.png";
import raidenThrustIcon from "../assets/icons/drg/Raiden_Thrust.png";
import disembowelIcon from "../assets/icons/drg/Disembowel.png";
import mirageDiveIcon from "../assets/icons/drg/Mirage_Dive.png";
import dragonfireDiveIcon from "../assets/icons/drg/Dragonfire_Dive.png";
import nastrondIcon from "../assets/icons/drg/Nastrond.png";
import stardiverIcon from "../assets/icons/drg/Stardiver.png";
import starcrossIcon from "../assets/icons/drg/Starcross.png";

/**
 * 竜騎士（DRG）バフ定義
 */
export const DRG_BUFFS: BuffDefinition[] = [
  {
    id: "lance-charge",
    name: "ランスチャージ",
    shortName: "ﾗﾝｽ\nﾁｬｰｼﾞ",
    icon: lanceChargeIcon,
    duration: 20,
    effects: [
      {
        type: "potency",
        value: 1.1,
      },
    ],
    color: "#ff5722",
  },
  {
    id: "battle-litany",
    name: "バトルリタニー",
    shortName: "ﾊﾞﾄﾙ\nﾘﾀﾆｰ",
    icon: battleLitanyIcon,
    duration: 20,
    effects: [
      {
        type: "critRate",
        value: 0.1,
      },
    ],
    color: "#2196f3",
  },
  {
    id: "life-surge",
    name: "ライフサージ",
    shortName: "ﾗｲﾌ\nｻｰｼﾞ",
    icon: lifeSurgeIcon,
    duration: 5,
    effects: [
      {
        type: "guaranteedCrit",
        value: 1,
      },
    ],
    color: "#4caf50",
    maxStacks: 1,
  },
  {
    id: "dragons-eye",
    name: "竜眼",
    shortName: "竜眼",
    icon: raidenThrustIcon,
    duration: 30,
    effects: [
      {
        type: "consumeOnGcd",
        value: 1,
      },
    ],
    color: "#e91e63",
    maxStacks: 1,
    acquiredLevel: 64,
  },
  {
    id: "power-surge",
    name: "竜槍",
    shortName: "竜槍",
    icon: disembowelIcon,
    duration: 30,
    effects: [
      {
        type: "potency",
        value: 1.1,
      },
    ],
    color: "#ff9800",
    acquiredLevel: 18,
  },
  {
    id: "life-of-the-dragon",
    name: "紅の竜血",
    shortName: "紅の\n竜血",
    icon: lifeOfTheDragonIcon,
    duration: 20,
    effects: [
      {
        type: "potency",
        value: 1.15,
      },
    ],
    color: "#f44336",
    acquiredLevel: 70,
  },
  {
    id: "dive-ready",
    name: "ダイブレディ",
    shortName: "ﾀﾞｲﾌﾞ\nﾚﾃﾞｨ",
    icon: mirageDiveIcon,
    duration: 15,
    effects: [],
    color: "#7c4dff",
    maxStacks: 1,
    acquiredLevel: 68,
  },
  {
    id: "dragons-flight",
    name: "ドラゴンフライト",
    shortName: "ﾄﾞﾗｺﾞﾝ\nﾌﾗｲﾄ",
    icon: dragonfireDiveIcon,
    duration: 30,
    effects: [],
    color: "#ff6d00",
    maxStacks: 1,
    acquiredLevel: 92,
  },
  {
    id: "nastrond-ready",
    name: "ナーストレンドレディ",
    shortName: "ﾅｰｽ\nﾚﾃﾞｨ",
    icon: nastrondIcon,
    duration: 20,
    effects: [],
    color: "#d50000",
    maxStacks: 1,
    acquiredLevel: 70,
  },
  {
    id: "stardiver-ready",
    name: "スターダイバーレディ",
    shortName: "ｽﾀﾀﾞｲ\nﾚﾃﾞｨ",
    icon: stardiverIcon,
    duration: 20,
    effects: [],
    color: "#aa00ff",
    maxStacks: 1,
    acquiredLevel: 80,
  },
  {
    id: "starcross-ready",
    name: "スタークロスレディ",
    shortName: "ｽﾀｸﾛ\nﾚﾃﾞｨ",
    icon: starcrossIcon,
    duration: 20,
    effects: [],
    color: "#6200ea",
    maxStacks: 1,
    acquiredLevel: 100,
  },
];
