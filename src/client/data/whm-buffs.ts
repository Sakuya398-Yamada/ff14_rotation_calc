import type { BuffDefinition } from "../types/skill";

import presenceOfMindIcon from "../assets/icons/whm/Presence_of_Mind.png";
import sacredSightIcon from "../assets/icons/whm/traits/Enhanced_Presence_of_Mind.png";

/**
 * 白魔道士（WHM）バフ定義
 */
export const WHM_BUFFS: BuffDefinition[] = [
  {
    id: "presence-of-mind",
    name: "神速魔",
    shortName: "神速魔",
    icon: presenceOfMindIcon,
    duration: 15,
    effects: [
      {
        type: "speed",
        value: 0.8,
      },
    ],
    color: "#ff9800",
  },
  {
    id: "sacred-sight",
    name: "グレアジャ実行可",
    shortName: "グレアジャ\n実行可",
    icon: sacredSightIcon,
    duration: 30,
    effects: [],
    color: "#ffcc00",
    maxStacks: 3,
  },
];
