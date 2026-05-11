import type { Skill } from "../types/skill";

import hakazeIcon from "../assets/icons/sam/Hakaze.png";
import gyofuIcon from "../assets/icons/sam/Gyofu.png";
import jinpuIcon from "../assets/icons/sam/Jinpu.png";
import shifuIcon from "../assets/icons/sam/Shifu.png";
import gekkoIcon from "../assets/icons/sam/Gekko.png";
import kashaIcon from "../assets/icons/sam/Kasha.png";
import yukikazeIcon from "../assets/icons/sam/Yukikaze.png";
import fugaIcon from "../assets/icons/sam/Fuga.png";
import fukoIcon from "../assets/icons/sam/Fuko.png";
import mangetsuIcon from "../assets/icons/sam/Mangetsu.png";
import okaIcon from "../assets/icons/sam/Oka.png";

import iaijutsuIcon from "../assets/icons/sam/Iaijutsu.png";
import higanbanaIcon from "../assets/icons/sam/Higanbana.png";
import tenkaGokenIcon from "../assets/icons/sam/Tenka_Goken.png";
import midareSetsugekkaIcon from "../assets/icons/sam/Midare_Setsugekka.png";
import tendoGokenIcon from "../assets/icons/sam/Tendo_Goken.png";
import tendoSetsugekkaIcon from "../assets/icons/sam/Tendo_Setsugekka.png";

import tsubameGaeshiIcon from "../assets/icons/sam/Tsubame-gaeshi.png";
import kaeshiGokenIcon from "../assets/icons/sam/Kaeshi_Goken.png";
import kaeshiSetsugekkaIcon from "../assets/icons/sam/Kaeshi_Setsugekka.png";
import tendoKaeshiGokenIcon from "../assets/icons/sam/Tendo_Kaeshi_Goken.png";
import tendoKaeshiSetsugekkaIcon from "../assets/icons/sam/Tendo_Kaeshi_Setsugekka.png";
import kaeshiNamikiriIcon from "../assets/icons/sam/Kaeshi_Namikiri.png";

import ogiNamikiriIcon from "../assets/icons/sam/Ogi_Namikiri.png";
import enpiIcon from "../assets/icons/sam/Enpi.png";
import shohaIcon from "../assets/icons/sam/Shoha.png";

import hissatsuGyotenIcon from "../assets/icons/sam/Hissatsu_Gyoten.png";
import hissatsuYatenIcon from "../assets/icons/sam/Hissatsu_Yaten.png";
import hissatsuShintenIcon from "../assets/icons/sam/Hissatsu_Shinten.png";
import hissatsuSeneiIcon from "../assets/icons/sam/Hissatsu_Senei.png";
import ikishotenIcon from "../assets/icons/sam/Ikishoten.png";
import hagakureIcon from "../assets/icons/sam/Hagakure.png";
import meikyoShisuiIcon from "../assets/icons/sam/Meikyo_Shisui.png";
import zanshinIcon from "../assets/icons/sam/Zanshin.png";

/**
 * 侍（SAM）攻撃スキル定義（Lv100まで）
 *
 * 大別:
 * 1. 単体WSコンボ（月/花/雪の3系統、起点共通の刃風）
 * 2. 範囲WSコンボ（風雅 → 満月/桜花）
 * 3. 居合術系（autoTransform で閃数＋天道バフに応じて変化）
 * 4. 燕返し系（autoTransform で Ready バフに応じて変化、5種）
 * 5. 奥義波切系（Lv90、確定クリ）
 * 6. 必殺剣系（剣気消費 oGCD/GCD）
 * 7. その他（意気衝天・葉隠・明鏡止水・残心・燕飛・照破）
 */
export const SAM_ATTACK_SKILLS: Skill[] = [
  // ============================================================
  // 1. 単体 WS コンボ（起点共通）
  // ============================================================
  {
    id: "hakaze",
    name: "刃風",
    potency: 200,
    type: "gcd",
    target: "enemy",
    icon: hakazeIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    resourceChanges: [{ resourceId: "kenki", amount: 5 }],
  },
  {
    id: "gyofu",
    name: "暁風",
    potency: 240,
    type: "gcd",
    target: "enemy",
    icon: gyofuIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 92,
    replacesSkillId: "hakaze",
    resourceChanges: [{ resourceId: "kenki", amount: 5 }],
  },
  {
    id: "jinpu",
    name: "陣風",
    potency: 300,
    nonComboPotency: 120,
    type: "gcd",
    target: "enemy",
    icon: jinpuIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 4,
    comboFrom: ["hakaze", "gyofu"],
    comboBuffApplications: ["fugetsu"],
    comboResourceChanges: [{ resourceId: "kenki", amount: 5 }],
  },
  {
    id: "shifu",
    name: "士風",
    potency: 300,
    nonComboPotency: 120,
    type: "gcd",
    target: "enemy",
    icon: shifuIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 18,
    comboFrom: ["hakaze", "gyofu"],
    comboBuffApplications: ["fuka"],
    comboResourceChanges: [{ resourceId: "kenki", amount: 5 }],
  },
  {
    id: "yukikaze",
    name: "雪風",
    potency: 340,
    nonComboPotency: 160,
    type: "gcd",
    target: "enemy",
    icon: yukikazeIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 50,
    comboFrom: ["hakaze", "gyofu"],
    comboResourceChanges: [
      { resourceId: "setsu", amount: 1 },
      { resourceId: "kenki", amount: 15 },
    ],
  },
  {
    // 月光: コンボ成立時威力 370 + 背面ボーナス 50 = 420（方向指定成功前提）
    // 風月バフは陣風（2段目）のみが付与する。明鏡止水中の月光時の風月付与は、
    // 明鏡止水バフ側の applyBuffOnSkill エフェクトで表現する（sam-buffs.ts）。
    id: "gekko",
    name: "月光",
    potency: 420,
    nonComboPotency: 170,
    type: "gcd",
    target: "enemy",
    icon: gekkoIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 30,
    comboFrom: ["jinpu"],
    comboResourceChanges: [
      { resourceId: "getsu", amount: 1 },
      { resourceId: "kenki", amount: 10 },
    ],
  },
  {
    // 花車: コンボ成立時威力 370 + 側面ボーナス 50 = 420（方向指定成功前提）
    // 風花バフは士風（2段目）のみが付与する。明鏡止水中の花車時の風花付与は、
    // 明鏡止水バフ側の applyBuffOnSkill エフェクトで表現する（sam-buffs.ts）。
    id: "kasha",
    name: "花車",
    potency: 420,
    nonComboPotency: 170,
    type: "gcd",
    target: "enemy",
    icon: kashaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 40,
    comboFrom: ["shifu"],
    comboResourceChanges: [
      { resourceId: "ka", amount: 1 },
      { resourceId: "kenki", amount: 10 },
    ],
  },

  // ============================================================
  // 2. 範囲 WS コンボ
  // ============================================================
  {
    id: "fuga",
    name: "風雅",
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: fugaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 26,
    resourceChanges: [{ resourceId: "kenki", amount: 5 }],
  },
  {
    id: "fuko",
    name: "風光",
    potency: 120,
    type: "gcd",
    target: "enemy",
    icon: fukoIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 86,
    replacesSkillId: "fuga",
    resourceChanges: [{ resourceId: "kenki", amount: 10 }],
  },
  {
    // 満月: 範囲コンボ最終段。通常コンボ完走では風月バフは付与されない。
    // 明鏡止水中の満月時の風月付与は、明鏡止水バフ側の applyBuffOnSkill で表現する。
    id: "mangetsu",
    name: "満月",
    potency: 120,
    nonComboPotency: 100,
    type: "gcd",
    target: "enemy",
    icon: mangetsuIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 35,
    comboFrom: ["fuga", "fuko"],
    comboResourceChanges: [
      { resourceId: "getsu", amount: 1 },
      { resourceId: "kenki", amount: 10 },
    ],
  },
  {
    // 桜花: 範囲コンボ最終段。風花バフ付与の扱いは満月と同様（明鏡止水バフ側で表現）。
    id: "oka",
    name: "桜花",
    potency: 120,
    nonComboPotency: 100,
    type: "gcd",
    target: "enemy",
    icon: okaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 45,
    comboFrom: ["fuga", "fuko"],
    comboResourceChanges: [
      { resourceId: "ka", amount: 1 },
      { resourceId: "kenki", amount: 10 },
    ],
  },

  // ============================================================
  // 3. 居合術系（パレット用 + 隠しスキル）
  // ============================================================
  {
    id: "iaijutsu",
    name: "居合術",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: iaijutsuIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 6,
    castTime: 1.3,
    // 配列の先頭から優先評価。3閃天道 > 2閃天道 > 3閃通常 > 2閃通常 > 1閃 の順
    autoTransform: [
      // 天道 + 3閃 → 天道雪月花
      {
        buffId: "tendo",
        resourceConditions: [
          { resourceId: "setsu", minAmount: 1 },
          { resourceId: "getsu", minAmount: 1 },
          { resourceId: "ka", minAmount: 1 },
        ],
        skillId: "tendo-setsugekka",
      },
      // 天道 + 2閃（3通り）→ 天道五剣
      {
        buffId: "tendo",
        resourceConditions: [
          { resourceId: "setsu", minAmount: 1 },
          { resourceId: "getsu", minAmount: 1 },
        ],
        skillId: "tendo-goken",
      },
      {
        buffId: "tendo",
        resourceConditions: [
          { resourceId: "setsu", minAmount: 1 },
          { resourceId: "ka", minAmount: 1 },
        ],
        skillId: "tendo-goken",
      },
      {
        buffId: "tendo",
        resourceConditions: [
          { resourceId: "getsu", minAmount: 1 },
          { resourceId: "ka", minAmount: 1 },
        ],
        skillId: "tendo-goken",
      },
      // 通常 3閃 → 乱れ雪月花
      {
        resourceConditions: [
          { resourceId: "setsu", minAmount: 1 },
          { resourceId: "getsu", minAmount: 1 },
          { resourceId: "ka", minAmount: 1 },
        ],
        skillId: "midare-setsugekka",
      },
      // 通常 2閃（3通り）→ 天下五剣
      {
        resourceConditions: [
          { resourceId: "setsu", minAmount: 1 },
          { resourceId: "getsu", minAmount: 1 },
        ],
        skillId: "tenka-goken",
      },
      {
        resourceConditions: [
          { resourceId: "setsu", minAmount: 1 },
          { resourceId: "ka", minAmount: 1 },
        ],
        skillId: "tenka-goken",
      },
      {
        resourceConditions: [
          { resourceId: "getsu", minAmount: 1 },
          { resourceId: "ka", minAmount: 1 },
        ],
        skillId: "tenka-goken",
      },
      // 通常 1閃（3通り）→ 彼岸花
      { resourceConditions: [{ resourceId: "setsu", minAmount: 1 }], skillId: "higanbana" },
      { resourceConditions: [{ resourceId: "getsu", minAmount: 1 }], skillId: "higanbana" },
      { resourceConditions: [{ resourceId: "ka", minAmount: 1 }], skillId: "higanbana" },
    ],
  },
  {
    id: "higanbana",
    name: "彼岸花",
    potency: 200,
    type: "gcd",
    target: "enemy",
    icon: higanbanaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 6,
    castTime: 1.3,
    hidden: true,
    consumeAllResources: ["setsu", "getsu", "ka"],
    dotPotency: 50,
    dotDuration: 60,
  },
  {
    id: "tenka-goken",
    name: "天下五剣",
    potency: 300,
    type: "gcd",
    target: "enemy",
    icon: tenkaGokenIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 30,
    castTime: 1.3,
    hidden: true,
    consumeAllResources: ["setsu", "getsu", "ka"],
    resourceChanges: [{ resourceId: "meditation", amount: 1 }],
    buffApplications: ["tsubame-kaeshi-goken-ready"],
  },
  {
    id: "midare-setsugekka",
    name: "乱れ雪月花",
    potency: 680,
    type: "gcd",
    target: "enemy",
    icon: midareSetsugekkaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 50,
    castTime: 1.3,
    hidden: true,
    guaranteedCrit: true,
    consumeAllResources: ["setsu", "getsu", "ka"],
    resourceChanges: [{ resourceId: "meditation", amount: 1 }],
    buffApplications: ["tsubame-kaeshi-setsugekka-ready"],
  },
  {
    id: "tendo-goken",
    name: "天道五剣",
    potency: 410,
    type: "gcd",
    target: "enemy",
    icon: tendoGokenIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 100,
    castTime: 1.3,
    hidden: true,
    consumeAllResources: ["setsu", "getsu", "ka"],
    resourceChanges: [{ resourceId: "meditation", amount: 1 }],
    buffConsumptions: [{ buffId: "tendo", stacks: 1 }],
    buffApplications: ["tsubame-tendo-kaeshi-goken-ready"],
  },
  {
    id: "tendo-setsugekka",
    name: "天道雪月花",
    potency: 1100,
    type: "gcd",
    target: "enemy",
    icon: tendoSetsugekkaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 100,
    castTime: 1.3,
    hidden: true,
    guaranteedCrit: true,
    consumeAllResources: ["setsu", "getsu", "ka"],
    resourceChanges: [{ resourceId: "meditation", amount: 1 }],
    buffConsumptions: [{ buffId: "tendo", stacks: 1 }],
    buffApplications: ["tsubame-tendo-kaeshi-setsugekka-ready"],
  },

  // ============================================================
  // 4. 燕返し系（パレット用 + 隠しスキル 5 種）
  // ============================================================
  {
    id: "tsubame-gaeshi",
    name: "燕返し",
    potency: 0,
    type: "gcd",
    target: "enemy",
    icon: tsubameGaeshiIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 76,
    autoTransform: [
      { buffId: "tsubame-tendo-kaeshi-setsugekka-ready", skillId: "tendo-kaeshi-setsugekka" },
      { buffId: "tsubame-tendo-kaeshi-goken-ready", skillId: "tendo-kaeshi-goken" },
      { buffId: "tsubame-kaeshi-setsugekka-ready", skillId: "kaeshi-setsugekka" },
      { buffId: "tsubame-kaeshi-goken-ready", skillId: "kaeshi-goken" },
      { buffId: "tsubame-kaeshi-namikiri-ready", skillId: "kaeshi-namikiri" },
    ],
  },
  // 燕返し系は剣圧を付与しない（実機: 剣圧は居合術系と奥義波切のみで付与）
  {
    id: "kaeshi-goken",
    name: "返し五剣",
    potency: 300,
    type: "gcd",
    target: "enemy",
    icon: kaeshiGokenIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 76,
    hidden: true,
    requiredBuff: "tsubame-kaeshi-goken-ready",
    buffConsumptions: [{ buffId: "tsubame-kaeshi-goken-ready", stacks: 1 }],
  },
  {
    id: "kaeshi-setsugekka",
    name: "返し雪月花",
    potency: 680,
    type: "gcd",
    target: "enemy",
    icon: kaeshiSetsugekkaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 76,
    hidden: true,
    guaranteedCrit: true,
    requiredBuff: "tsubame-kaeshi-setsugekka-ready",
    buffConsumptions: [{ buffId: "tsubame-kaeshi-setsugekka-ready", stacks: 1 }],
  },
  {
    id: "tendo-kaeshi-goken",
    name: "天道返し五剣",
    potency: 410,
    type: "gcd",
    target: "enemy",
    icon: tendoKaeshiGokenIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 100,
    hidden: true,
    requiredBuff: "tsubame-tendo-kaeshi-goken-ready",
    buffConsumptions: [{ buffId: "tsubame-tendo-kaeshi-goken-ready", stacks: 1 }],
  },
  {
    id: "tendo-kaeshi-setsugekka",
    name: "天道返し雪月花",
    potency: 1100,
    type: "gcd",
    target: "enemy",
    icon: tendoKaeshiSetsugekkaIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 100,
    hidden: true,
    guaranteedCrit: true,
    requiredBuff: "tsubame-tendo-kaeshi-setsugekka-ready",
    buffConsumptions: [{ buffId: "tsubame-tendo-kaeshi-setsugekka-ready", stacks: 1 }],
  },
  {
    id: "kaeshi-namikiri",
    name: "返し波切",
    potency: 1000,
    type: "gcd",
    target: "enemy",
    icon: kaeshiNamikiriIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 90,
    hidden: true,
    guaranteedCrit: true,
    guaranteedDh: true,
    requiredBuff: "tsubame-kaeshi-namikiri-ready",
    buffConsumptions: [{ buffId: "tsubame-kaeshi-namikiri-ready", stacks: 1 }],
  },

  // ============================================================
  // 5. 奥義波切
  // ============================================================
  {
    id: "ogi-namikiri",
    name: "奥義波切",
    potency: 1000,
    type: "gcd",
    target: "enemy",
    icon: ogiNamikiriIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 90,
    castTime: 1.3,
    guaranteedCrit: true,
    requiredBuff: "ogi-namikiri-ready",
    buffConsumptions: [{ buffId: "ogi-namikiri-ready", stacks: 1 }],
    buffApplications: ["tsubame-kaeshi-namikiri-ready"],
    resourceChanges: [{ resourceId: "meditation", amount: 1 }],
  },

  // ============================================================
  // 6. 必殺剣系（剣気消費 oGCD）
  // ============================================================
  {
    id: "hissatsu-gyoten",
    name: "必殺剣・暁天",
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: hissatsuGyotenIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 54,
    cooldown: 10,
    resourceChanges: [{ resourceId: "kenki", amount: -10 }],
  },
  {
    id: "hissatsu-yaten",
    name: "必殺剣・夜天",
    potency: 100,
    type: "ogcd",
    target: "enemy",
    icon: hissatsuYatenIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 56,
    cooldown: 10,
    resourceChanges: [{ resourceId: "kenki", amount: -10 }],
  },
  {
    id: "hissatsu-shinten",
    name: "必殺剣・震天",
    potency: 250,
    type: "ogcd",
    target: "enemy",
    icon: hissatsuShintenIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 62,
    cooldown: 1,
    resourceChanges: [{ resourceId: "kenki", amount: -25 }],
  },
  {
    id: "hissatsu-senei",
    name: "必殺剣・閃影",
    potency: 800,
    type: "ogcd",
    target: "enemy",
    icon: hissatsuSeneiIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 72,
    cooldown: 60,
    resourceChanges: [{ resourceId: "kenki", amount: -25 }],
  },

  // ============================================================
  // 7. その他
  // ============================================================
  {
    id: "ikishoten",
    name: "意気衝天",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: ikishotenIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 68,
    cooldown: 120,
    resourceChanges: [{ resourceId: "kenki", amount: 50 }],
    buffApplications: ["ikishoten-buff", "ogi-namikiri-ready", "zanshin-ready"],
  },
  {
    id: "enpi",
    name: "燕飛",
    potency: 860,
    type: "gcd",
    target: "enemy",
    icon: enpiIcon,
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 76,
    requiredBuff: "ikishoten-buff",
    buffConsumptions: [{ buffId: "ikishoten-buff", stacks: 1 }],
  },
  {
    id: "hagakure",
    name: "葉隠",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: hagakureIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 68,
    cooldown: 5,
    consumeAllResources: ["setsu", "getsu", "ka"],
    resourceGainByConsumedCount: {
      fromResourceIds: ["setsu", "getsu", "ka"],
      resourceId: "kenki",
      gainPerConsumed: 10,
    },
  },
  {
    id: "meikyo-shisui-skill",
    name: "明鏡止水",
    potency: 0,
    type: "ogcd",
    target: "self",
    icon: meikyoShisuiIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 50,
    cooldown: 55,
    maxCharges: 2,
    buffApplications: ["meikyo-shisui", "tendo"],
  },
  {
    id: "zanshin",
    name: "残心",
    potency: 940,
    type: "ogcd",
    target: "enemy",
    icon: zanshinIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 96,
    cooldown: 1,
    resourceChanges: [{ resourceId: "kenki", amount: -50 }],
    requiredBuff: "zanshin-ready",
    buffConsumptions: [{ buffId: "zanshin-ready", stacks: 1 }],
  },
  {
    id: "shoha",
    name: "照破",
    potency: 640,
    type: "ogcd",
    target: "enemy",
    icon: shohaIcon,
    recastTime: 1.0,
    animationLock: 0.65,
    acquiredLevel: 82,
    cooldown: 15,
    resourceChanges: [{ resourceId: "meditation", amount: -3 }],
  },
];
