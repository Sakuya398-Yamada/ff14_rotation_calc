import type { BuffDefinition } from "../types/skill";

import chainStratagemIcon from "../assets/icons/sch/Chain_Stratagem.png";
import impactImminentIcon from "../assets/icons/sch/traits/Enhanced_Chain_Stratagem.png";
import swiftcastIcon from "../assets/icons/sch/role_actions/Swiftcast.png";

/**
 * 学者（SCH）バフ定義
 */
export const SCH_BUFFS: BuffDefinition[] = [
  {
    // 実際は対象がクリティカルヒットを受ける確率の上昇。自分の攻撃のクリティカル率上昇として扱う（DRG のバトルリタニーと同じ）
    id: "chain-stratagem",
    name: "連環計",
    shortName: "連環計",
    icon: chainStratagemIcon,
    duration: 20,
    effects: [
      {
        type: "critRate",
        value: 0.1,
      },
    ],
    color: "#7e57c2",
    acquiredLevel: 66,
  },
  {
    // Lv92 特性「連環計効果アップ」で連環計の使用時に付与される
    id: "impact-imminent",
    name: "埋伏の毒実行可",
    shortName: "埋伏\n実行可",
    icon: impactImminentIcon,
    duration: 30,
    effects: [],
    color: "#9ccc65",
    acquiredLevel: 92,
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
