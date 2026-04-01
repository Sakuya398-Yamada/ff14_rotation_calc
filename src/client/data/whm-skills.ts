import type { Skill } from "../types/skill";

import stoneIcon from "../assets/icons/whm/Stone.png";
import aeroIcon from "../assets/icons/whm/Aero.png";
import stone2Icon from "../assets/icons/whm/Stone_II.png";
import aero2Icon from "../assets/icons/whm/Aero_II.png";
import stone3Icon from "../assets/icons/whm/Stone_III.png";
import stone4Icon from "../assets/icons/whm/Stone_IV.png";
import diaIcon from "../assets/icons/whm/Dia.png";
import glareIcon from "../assets/icons/whm/Glare.png";
import glare3Icon from "../assets/icons/whm/Glare_III.png";
import glare4Icon from "../assets/icons/whm/Glare_IV.png";
import holyIcon from "../assets/icons/whm/Holy.png";
import holy3Icon from "../assets/icons/whm/Holy_III.png";
import afflatus_miseryIcon from "../assets/icons/whm/Afflatus_Misery.png";
import afflatus_solaceIcon from "../assets/icons/whm/Afflatus_Solace.png";
import afflatus_raptureIcon from "../assets/icons/whm/Afflatus_Rapture.png";
import assizeIcon from "../assets/icons/whm/Assize.png";
import presenceOfMindIcon from "../assets/icons/whm/Presence_of_Mind.png";

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

/**
 * 白魔道士（WHM）攻撃スキル一覧
 * パッチ7.x準拠の威力値
 */
export const WHM_ATTACK_SKILLS: Skill[] = [
  // === GCD ===
  {
    id: "stone",
    name: "ストーン",
    potency: 140,
    type: "gcd",
    target: "enemy",
    icon: stoneIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "aero",
    name: "エアロ",
    potency: 50,
    type: "gcd",
    target: "enemy",
    icon: aeroIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 30,
    dotDuration: 18,
  },
  {
    id: "stone2",
    name: "ストンラ",
    potency: 190,
    type: "gcd",
    target: "enemy",
    icon: stone2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "aero2",
    name: "エアロラ",
    potency: 50,
    type: "gcd",
    target: "enemy",
    icon: aero2Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 60,
    dotDuration: 18,
  },
  {
    id: "stone3",
    name: "ストンガ",
    potency: 220,
    type: "gcd",
    target: "enemy",
    icon: stone3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "stone4",
    name: "ストンジャ",
    potency: 260,
    type: "gcd",
    target: "enemy",
    icon: stone4Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "dia",
    name: "ディア",
    potency: 85,
    type: "gcd",
    target: "enemy",
    icon: diaIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    dotPotency: 75,
    dotDuration: 30,
  },
  {
    id: "glare",
    name: "グレア",
    potency: 290,
    type: "gcd",
    target: "enemy",
    icon: glareIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "glare3",
    name: "グレアガ",
    potency: 350,
    type: "gcd",
    target: "enemy",
    icon: glare3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "glare4",
    name: "グレアジャ",
    potency: 640,
    type: "gcd",
    target: "enemy",
    icon: glare4Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    buffConsumptions: [
      { buffId: "sacred-sight", stacks: 1 },
    ],
  },
  {
    id: "holy",
    name: "ホーリー",
    potency: 140,
    type: "gcd",
    target: "enemy",
    icon: holyIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "holy3",
    name: "ホーリガ",
    potency: 150,
    type: "gcd",
    target: "enemy",
    icon: holy3Icon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  // === リリー関連GCD ===
  {
    id: "heart-of-solace",
    name: "ハート・オブ・ソラス",
    potency: 0,
    type: "gcd",
    target: "party",
    icon: afflatus_solaceIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    resourceChanges: [
      { resourceId: "healing-lily", amount: -1 },
      { resourceId: "blood-lily", amount: 1 },
    ],
  },
  {
    id: "heart-of-rapture",
    name: "ハート・オブ・ラプチャー",
    potency: 0,
    type: "gcd",
    target: "party",
    icon: afflatus_raptureIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    resourceChanges: [
      { resourceId: "healing-lily", amount: -1 },
      { resourceId: "blood-lily", amount: 1 },
    ],
  },
  {
    id: "heart-of-misery",
    name: "ハート・オブ・ミゼリ",
    potency: 1400,
    type: "gcd",
    target: "enemy",
    icon: afflatus_miseryIcon,
    recastTime: GCD_RECAST,
    animationLock: DEFAULT_ANIMATION_LOCK,
    resourceChanges: [
      { resourceId: "blood-lily", amount: -3 },
    ],
  },

  // === oGCD ===
  {
    id: "assize",
    name: "アサイズ",
    potency: 400,
    type: "ogcd",
    target: "enemy",
    icon: assizeIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
  },
  {
    id: "presence-of-mind",
    name: "神速魔",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: presenceOfMindIcon,
    recastTime: DEFAULT_ANIMATION_LOCK,
    animationLock: DEFAULT_ANIMATION_LOCK,
    buffApplications: ["presence-of-mind", "sacred-sight"],
  },
];
