import type { BuffDefinition } from "../types/skill";

import divinationIcon from "../assets/icons/ast/Divination.png";
import diviningIcon from "../assets/icons/ast/traits/Enhanced_Divination.png";
import lightspeedIcon from "../assets/icons/ast/Lightspeed.png";
import earthlyStarIcon from "../assets/icons/ast/Earthly_Star.png";
import swiftcastIcon from "../assets/icons/ast/role_actions/Swiftcast.png";

/**
 * 占星術師（AST）バフ定義
 */
export const AST_BUFFS: BuffDefinition[] = [
  {
    // 実際は自身と周囲のパーティメンバーの与ダメージ上昇。自分の与ダメージ上昇として扱う（DRG のバトルリタニーと同じ）
    id: "divination",
    name: "ディヴィネーション",
    shortName: "ﾃﾞｨｳﾞｨ\nﾈｰｼｮﾝ",
    icon: divinationIcon,
    duration: 20,
    effects: [
      {
        type: "potency",
        value: 1.06,
      },
    ],
    color: "#ffd54f",
    acquiredLevel: 50,
  },
  {
    // Lv92 特性「ディヴィネーション効果アップ」でディヴィネーションの使用時に付与される
    id: "divining",
    name: "オラクル実行可",
    shortName: "ｵﾗｸﾙ\n実行可",
    icon: diviningIcon,
    duration: 30,
    effects: [],
    color: "#ce93d8",
    acquiredLevel: 92,
  },
  {
    // 実際は魔法の詠唱時間を 2.5 秒短縮する。攻撃魔法の詠唱はどれも 1.5 秒なので、詠唱なし（倍率 0）として扱う
    id: "lightspeed",
    name: "ライトスピード",
    shortName: "ﾗｲﾄ\nｽﾋﾟｰﾄﾞ",
    icon: lightspeedIcon,
    duration: 15,
    effects: [{ type: "castTimeMultiplier", value: 0 }],
    color: "#90caf9",
    acquiredLevel: 6,
  },
  {
    // 設置したアーサリースターが残っている間（星の支配者 10 秒 + 巨星の支配者 10 秒）。
    // 巨星の支配者は独立したバフにせず、このバフのうち星の支配者が切れた後の区間で表す。
    // 時間切れでの自動爆発は数えず、ステラデトネーションを置いたときだけ爆発として数える
    id: "earthly-star",
    name: "アーサリースター",
    shortName: "ｱｰｻﾘｰ\nｽﾀｰ",
    icon: earthlyStarIcon,
    duration: 20,
    effects: [],
    color: "#4db6ac",
    acquiredLevel: 62,
  },
  {
    // 設置から 10 秒間（成熟前）。この間のステラデトネーションは威力 205 になる
    id: "earthly-dominance",
    name: "星の支配者",
    shortName: "星の\n支配者",
    icon: earthlyStarIcon,
    duration: 10,
    effects: [],
    color: "#80cbc4",
    acquiredLevel: 62,
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
