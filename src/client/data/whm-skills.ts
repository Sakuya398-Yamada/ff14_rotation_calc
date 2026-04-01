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
import assizeIcon from "../assets/icons/whm/Assize.png";

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
    icon: stoneIcon,
  },
  {
    id: "aero",
    name: "エアロ",
    potency: 50,
    type: "gcd",
    icon: aeroIcon,
  },
  {
    id: "stone2",
    name: "ストンラ",
    potency: 190,
    type: "gcd",
    icon: stone2Icon,
  },
  {
    id: "aero2",
    name: "エアロラ",
    potency: 50,
    type: "gcd",
    icon: aero2Icon,
  },
  {
    id: "stone3",
    name: "ストンガ",
    potency: 220,
    type: "gcd",
    icon: stone3Icon,
  },
  {
    id: "stone4",
    name: "ストンジャ",
    potency: 260,
    type: "gcd",
    icon: stone4Icon,
  },
  {
    id: "dia",
    name: "ディア",
    potency: 85,
    type: "gcd",
    icon: diaIcon,
  },
  {
    id: "glare",
    name: "グレア",
    potency: 290,
    type: "gcd",
    icon: glareIcon,
  },
  {
    id: "glare3",
    name: "グレアガ",
    potency: 350,
    type: "gcd",
    icon: glare3Icon,
  },
  {
    id: "glare4",
    name: "グレアジャ",
    potency: 640,
    type: "gcd",
    icon: glare4Icon,
  },
  {
    id: "holy",
    name: "ホーリー",
    potency: 140,
    type: "gcd",
    icon: holyIcon,
  },
  {
    id: "holy3",
    name: "ホーリガ",
    potency: 150,
    type: "gcd",
    icon: holy3Icon,
  },

  {
    id: "heart-of-misery",
    name: "ハート・オブ・ミゼリ",
    potency: 1400,
    type: "gcd",
    icon: afflatus_miseryIcon,
  },

  // === oGCD ===
  {
    id: "assize",
    name: "アサイズ",
    potency: 400,
    type: "ogcd",
    icon: assizeIcon,
  },
];
