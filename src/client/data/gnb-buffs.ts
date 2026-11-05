import type { BuffDefinition, BuffEffect } from "../types/skill";

import noMercyIcon from "../assets/icons/gnb/No_Mercy.png";
import sonicBreakIcon from "../assets/icons/gnb/Sonic_Break.png";
import bloodfestIcon from "../assets/icons/gnb/Bloodfest.png";
import jugularRipIcon from "../assets/icons/gnb/Jugular_Rip.png";
import abdomenTearIcon from "../assets/icons/gnb/Abdomen_Tear.png";
import eyeGougeIcon from "../assets/icons/gnb/Eye_Gouge.png";
import hypervelocityIcon from "../assets/icons/gnb/Hypervelocity.png";
import fatedBrandIcon from "../assets/icons/gnb/Fated_Brand.png";
import reignOfBeastsIcon from "../assets/icons/gnb/Reign_of_Beasts.png";
import savageClawIcon from "../assets/icons/gnb/Savage_Claw.png";
import wickedTalonIcon from "../assets/icons/gnb/Wicked_Talon.png";
import nobleBloodIcon from "../assets/icons/gnb/Noble_Blood.png";
import lionHeartIcon from "../assets/icons/gnb/Lion_Heart.png";

/** コンティニュエーションの「〜実行可」は、ウェポンスキルを実行すると解除される */
const ENDS_ON_WEAPONSKILL: BuffEffect[] = [{ type: "consumeOnGcd", value: 1 }];

/**
 * ガンブレイカー（GNB）バフ定義
 *
 * ビートファング → サベッジクロウ → ウィケッドタロンと、ライズ・オブ・ハート → ルーラー・オブ・ハート → エンド・オブ・ハートは、
 * メインのコンボ（キーンエッジ → ブルータルシェル → ソリッドバレル）とは別に進むコンボなので、次の段を段のバフ（データ独自。
 * 効果時間はコンボの継続時間 30 秒）で表す。前の段が次の段のバフを付け、次の段は comboFromBuff で受ける
 */
export const GNB_BUFFS: BuffDefinition[] = [
  {
    id: "no-mercy",
    icon: noMercyIcon,
    duration: 20,
    effects: [{ type: "potency", value: 1.2 }],
    color: "#c62828",
    acquiredLevel: 2,
  },
  {
    // ノー・マーシーで付与（特性ノー・マーシー効果アップ）。ソニックブレイクの発動条件
    id: "ready-to-break",
    icon: sonicBreakIcon,
    duration: 30,
    effects: [],
    color: "#1565c0",
    acquiredLevel: 54,
  },
  {
    // ソイルの最大を 4（Lv88 から 6）にする（gnb-resources.ts の whileBuffModifiers）
    id: "bloodfest",
    icon: bloodfestIcon,
    duration: 30,
    effects: [],
    color: "#ad1457",
    acquiredLevel: 76,
  },
  {
    // ブラッドソイルで付与（特性ブラッドソイル効果アップ）。ライズ・オブ・ハートの発動条件
    id: "ready-to-reign",
    icon: reignOfBeastsIcon,
    duration: 30,
    effects: [],
    color: "#6a1b9a",
    acquiredLevel: 100,
  },
  {
    // ビートファングで付与。コンティニュエーションがジャギュラーリップに変化する
    id: "ready-to-rip",
    icon: jugularRipIcon,
    duration: 10,
    effects: ENDS_ON_WEAPONSKILL,
    color: "#00838f",
    acquiredLevel: 70,
  },
  {
    // サベッジクロウで付与。コンティニュエーションがアブドメンテアーに変化する
    id: "ready-to-tear",
    icon: abdomenTearIcon,
    duration: 10,
    effects: ENDS_ON_WEAPONSKILL,
    color: "#00695c",
    acquiredLevel: 70,
  },
  {
    // ウィケッドタロンで付与。コンティニュエーションがアイガウジに変化する
    id: "ready-to-gouge",
    icon: eyeGougeIcon,
    duration: 10,
    effects: ENDS_ON_WEAPONSKILL,
    color: "#2e7d32",
    acquiredLevel: 70,
  },
  {
    // バーストストライクで付与（特性コンティニュエーション効果アップ）。コンティニュエーションがハイパーヴェロシティに変化する
    id: "ready-to-blast",
    icon: hypervelocityIcon,
    duration: 10,
    effects: ENDS_ON_WEAPONSKILL,
    color: "#ef6c00",
    acquiredLevel: 86,
  },
  {
    // フェイテッドサークルで付与（特性コンティニュエーション効果アップII）。コンティニュエーションがフェイテッドブランドに変化する
    id: "ready-to-raze",
    icon: fatedBrandIcon,
    duration: 10,
    effects: ENDS_ON_WEAPONSKILL,
    color: "#f9a825",
    acquiredLevel: 96,
  },
  {
    // 段のバフ（データ独自）: ビートファングがサベッジクロウに変化する
    id: "savage-claw-ready",
    icon: savageClawIcon,
    duration: 30,
    exclusiveGroup: "gnashing-fang-combo",
    effects: [],
    color: "#4e342e",
    acquiredLevel: 60,
  },
  {
    // 段のバフ（データ独自）: ビートファングがウィケッドタロンに変化する
    id: "wicked-talon-ready",
    icon: wickedTalonIcon,
    duration: 30,
    exclusiveGroup: "gnashing-fang-combo",
    effects: [],
    color: "#3e2723",
    acquiredLevel: 60,
  },
  {
    // 段のバフ（データ独自）: ライズ・オブ・ハートがルーラー・オブ・ハートに変化する
    id: "noble-blood-ready",
    icon: nobleBloodIcon,
    duration: 30,
    exclusiveGroup: "reign-combo",
    effects: [],
    color: "#8e24aa",
    acquiredLevel: 100,
  },
  {
    // 段のバフ（データ独自）: ライズ・オブ・ハートがエンド・オブ・ハートに変化する
    id: "lion-heart-ready",
    icon: lionHeartIcon,
    duration: 30,
    exclusiveGroup: "reign-combo",
    effects: [],
    color: "#4a148c",
    acquiredLevel: 100,
  },
];
