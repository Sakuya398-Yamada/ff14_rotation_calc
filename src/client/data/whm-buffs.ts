import type { BuffDefinition } from "../types/skill";

import presenceOfMindIcon from "../assets/icons/whm/Presence_of_Mind.png";
import sacredSightIcon from "../assets/icons/whm/traits/Enhanced_Presence_of_Mind.png";
import swiftcastIcon from "../assets/icons/whm/role_actions/Swiftcast.png";

/**
 * 白魔道士（WHM）バフ定義
 */
export const WHM_BUFFS: BuffDefinition[] = [
  {
    id: "presence-of-mind",
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
    icon: sacredSightIcon,
    duration: 30,
    effects: [],
    color: "#ffcc00",
    maxStacks: 3,
    acquiredLevel: 92,
  },
  {
    id: "swiftcast",
    icon: swiftcastIcon,
    duration: 10,
    effects: [{ type: "instantCast", value: 0 }],
    color: "#80deea",
    acquiredLevel: 18,
  },
];
