import type { BuffDefinition } from "../types/skill";

import eukrasiaIcon from "../assets/icons/sge/Eukrasia.png";
import swiftcastIcon from "../assets/icons/sge/role_actions/Swiftcast.png";

/**
 * 賢者（SGE）バフ定義
 */
export const SGE_BUFFS: BuffDefinition[] = [
  {
    // 効果中はドシス・ディスクラシアII・ディアグノシスがエウクラシア系の魔法に変わる（変化元の autoTransform）。
    // 時間では切れず、変化した魔法の buffConsumptions で外れる
    id: "eukrasia",
    name: "エウクラシア",
    shortName: "ｴｳｸﾗ\nｼｱ",
    icon: eukrasiaIcon,
    duration: null,
    effects: [],
    color: "#4fc3f7",
    acquiredLevel: 30,
  },
  {
    id: "swiftcast",
    name: "迅速魔",
    shortName: "迅速魔",
    icon: swiftcastIcon,
    duration: 10,
    effects: [{ type: "instantCast", value: 0 }],
    color: "#80deea",
    acquiredLevel: 18,
  },
];
