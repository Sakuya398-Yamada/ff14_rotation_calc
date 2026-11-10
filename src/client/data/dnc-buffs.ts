import type { BuffDefinition } from "../types/skill";

import standardStepIcon from "../assets/icons/dnc/Standard_Step.png";
import technicalStepIcon from "../assets/icons/dnc/Technical_Step.png";
import emboiteIcon from "../assets/icons/dnc/Emboite.png";
import standardFinishIcon from "../assets/icons/dnc/Standard_Finish.png";
import technicalFinishIcon from "../assets/icons/dnc/Technical_Finish.png";
import saberDanceIcon from "../assets/icons/dnc/Saber_Dance.png";
import devilmentIcon from "../assets/icons/dnc/Devilment.png";
import reverseCascadeIcon from "../assets/icons/dnc/Reverse_Cascade.png";
import fountainfallIcon from "../assets/icons/dnc/Fountainfall.png";
import fanDanceIIIIcon from "../assets/icons/dnc/Fan_Dance_III.png";
import fanDanceIVIcon from "../assets/icons/dnc/Fan_Dance_IV.png";
import finishingMoveIcon from "../assets/icons/dnc/Finishing_Move.png";
import tillanaIcon from "../assets/icons/dnc/Tillana.png";
import danceOfTheDawnIcon from "../assets/icons/dnc/Dance_of_the_Dawn.png";
import lastDanceIcon from "../assets/icons/dnc/Last_Dance.png";
import starfallDanceIcon from "../assets/icons/dnc/Starfall_Dance.png";

/**
 * 踊り子（DNC）バフ定義
 * - ダンス: スタンダードステップ・テクニカルステップは、それぞれのバフと、両方に共通の「ダンスモード」を付ける。
 *   ダンスモード中はステップとフィニッシュしか使えない（ほかのスキルの forbiddenBuff）
 * - スタンダードフィニッシュ・テクニカルフィニッシュの与ダメージ上昇は、ステップの回数ごとのバフ（同じ exclusiveGroup で上書き）。
 *   計算するのは自分の分だけ（パートナー・パーティメンバーに付く分は対象外）
 * - エスプリはスタンダードフィニッシュ由来（60 秒）とテクニカルフィニッシュ由来（20 秒）を別のバフにする（ゲームでも別のステータス。
 *   同じバフにすると、テクニカルフィニッシュの 20 秒で 60 秒の方を縮めてしまう）
 * - 実行可のバフで使えるスキルのアイコンを、そのバフのアイコンにする（ステータスのアイコンは取り込んでいない）
 */
export const DNC_BUFFS: BuffDefinition[] = [
  { id: "standard-step", icon: standardStepIcon, duration: 15, effects: [], color: "#ec407a", maxStacks: 1 },
  { id: "technical-step", icon: technicalStepIcon, duration: 15, effects: [], color: "#7e57c2", maxStacks: 1 },
  { id: "dancing", icon: emboiteIcon, duration: 15, effects: [], color: "#f48fb1", maxStacks: 1 },
  {
    id: "standard-finish-1",
    icon: standardFinishIcon,
    duration: 60,
    effects: [{ type: "potency", value: 1.02 }],
    color: "#f06292",
    exclusiveGroup: "standard-finish",
  },
  {
    id: "standard-finish-2",
    icon: standardFinishIcon,
    duration: 60,
    effects: [{ type: "potency", value: 1.05 }],
    color: "#e91e63",
    exclusiveGroup: "standard-finish",
  },
  ...([1.01, 1.02, 1.03, 1.05] as const).map((value, i): BuffDefinition => ({
    id: `technical-finish-${i + 1}`,
    icon: technicalFinishIcon,
    duration: 20,
    effects: [{ type: "potency", value }],
    color: "#9575cd",
    exclusiveGroup: "technical-finish",
  })),
  { id: "esprit-standard", icon: saberDanceIcon, duration: 60, effects: [], color: "#ffca28", acquiredLevel: 76 },
  { id: "esprit-technical", icon: saberDanceIcon, duration: 20, effects: [], color: "#ffa000", acquiredLevel: 76 },
  {
    id: "devilment",
    icon: devilmentIcon,
    duration: 20,
    effects: [
      { type: "critRate", value: 0.2 },
      { type: "dhRate", value: 0.2 },
    ],
    color: "#d81b60",
    acquiredLevel: 62,
  },
  { id: "silken-symmetry", icon: reverseCascadeIcon, duration: 30, effects: [], color: "#4fc3f7", maxStacks: 1 },
  { id: "silken-flow", icon: fountainfallIcon, duration: 30, effects: [], color: "#81c784", maxStacks: 1 },
  { id: "flourishing-symmetry", icon: reverseCascadeIcon, duration: 30, effects: [], color: "#0288d1", maxStacks: 1, acquiredLevel: 72 },
  { id: "flourishing-flow", icon: fountainfallIcon, duration: 30, effects: [], color: "#388e3c", maxStacks: 1, acquiredLevel: 72 },
  { id: "threefold-fan-dance", icon: fanDanceIIIIcon, duration: 30, effects: [], color: "#ff7043", maxStacks: 1, acquiredLevel: 66 },
  { id: "fourfold-fan-dance", icon: fanDanceIVIcon, duration: 30, effects: [], color: "#f4511e", maxStacks: 1, acquiredLevel: 86 },
  { id: "finishing-move-ready", icon: finishingMoveIcon, duration: 30, effects: [], color: "#c2185b", maxStacks: 1, acquiredLevel: 96 },
  { id: "flourishing-finish", icon: tillanaIcon, duration: 30, effects: [], color: "#5e35b1", maxStacks: 1, acquiredLevel: 82 },
  { id: "dance-of-the-dawn-ready", icon: danceOfTheDawnIcon, duration: 30, effects: [], color: "#ffb300", maxStacks: 1, acquiredLevel: 100 },
  { id: "last-dance-ready", icon: lastDanceIcon, duration: 30, effects: [], color: "#ad1457", maxStacks: 1, acquiredLevel: 92 },
  { id: "flourishing-starfall", icon: starfallDanceIcon, duration: 20, effects: [], color: "#ffd54f", maxStacks: 1, acquiredLevel: 90 },
];
