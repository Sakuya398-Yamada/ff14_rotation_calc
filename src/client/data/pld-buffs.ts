import type { BuffDefinition } from "../types/skill";
import fightOrFlightIcon from "../assets/icons/pld/Fight_or_Flight.png";
import goringBladeIcon from "../assets/icons/pld/Goring_Blade.png";
import divineMightIcon from "../assets/icons/pld/traits/Divine_Magic_Mastery.png";
import atonementIcon from "../assets/icons/pld/Atonement.png";
import supplicationIcon from "../assets/icons/pld/Supplication.png";
import sepulchreIcon from "../assets/icons/pld/Sepulchre.png";
import requiescatIcon from "../assets/icons/pld/Requiescat.png";
import confiteorIcon from "../assets/icons/pld/Confiteor.png";
import bladeOfFaithIcon from "../assets/icons/pld/Blade_of_Faith.png";
import bladeOfTruthIcon from "../assets/icons/pld/Blade_of_Truth.png";
import bladeOfValorIcon from "../assets/icons/pld/Blade_of_Valor.png";
import bladeOfHonorIcon from "../assets/icons/pld/Blade_of_Honor.png";

/** レクイエスカットのスタックを 1 つずつ消費するスキル（レクイエスカット中に変化した版。神聖魔法効果アップ中の版は消費しない） */
const REQUIESCAT_CONSUMERS = [
  "holy-spirit-requiescat",
  "holy-circle-requiescat",
  "confiteor-requiescat",
  "blade-of-faith-requiescat",
  "blade-of-truth-requiescat",
  "blade-of-valor-requiescat",
];

/**
 * ナイト（PLD）バフ定義
 * ブレード・オブ・フェイス／トゥルース／ヴァラー実行可は、7.0 からゲーム内ではコンボで管理される魔法コンボの段を表すデータ上のバフ（効果時間はコンボの受付時間）
 */
export const PLD_BUFFS: BuffDefinition[] = [
  {
    id: "fight-or-flight",
    icon: fightOrFlightIcon,
    duration: 20,
    effects: [{ type: "potency", value: 1.25 }],
    color: "#ff7043",
    acquiredLevel: 2,
  },
  {
    id: "goring-blade-ready",
    icon: goringBladeIcon,
    duration: 30,
    effects: [],
    color: "#d84315",
    acquiredLevel: 54,
  },
  {
    id: "divine-might",
    icon: divineMightIcon,
    duration: 30,
    effects: [],
    color: "#fdd835",
    acquiredLevel: 64,
  },
  {
    id: "atonement-ready",
    icon: atonementIcon,
    duration: 30,
    effects: [],
    color: "#90caf9",
    acquiredLevel: 76,
  },
  {
    id: "supplication-ready",
    icon: supplicationIcon,
    duration: 30,
    effects: [],
    color: "#64b5f6",
    acquiredLevel: 76,
  },
  {
    id: "sepulchre-ready",
    icon: sepulchreIcon,
    duration: 30,
    effects: [],
    color: "#1e88e5",
    acquiredLevel: 76,
  },
  {
    id: "requiescat",
    icon: requiescatIcon,
    duration: 30,
    maxStacks: 4,
    effects: [{ type: "consumeOnGcd", value: 1, appliesToSkillIds: REQUIESCAT_CONSUMERS }],
    color: "#ab47bc",
    acquiredLevel: 68,
  },
  {
    id: "confiteor-ready",
    icon: confiteorIcon,
    duration: 30,
    effects: [],
    color: "#7e57c2",
    acquiredLevel: 80,
  },
  {
    id: "blade-of-faith-ready",
    icon: bladeOfFaithIcon,
    duration: 30,
    effects: [],
    color: "#4db6ac",
    acquiredLevel: 90,
  },
  {
    id: "blade-of-truth-ready",
    icon: bladeOfTruthIcon,
    duration: 30,
    effects: [],
    color: "#26a69a",
    acquiredLevel: 90,
  },
  {
    id: "blade-of-valor-ready",
    icon: bladeOfValorIcon,
    duration: 30,
    effects: [],
    color: "#00897b",
    acquiredLevel: 90,
  },
  {
    id: "blade-of-honor-ready",
    icon: bladeOfHonorIcon,
    duration: 30,
    effects: [],
    color: "#ffca28",
    acquiredLevel: 100,
  },
];
