import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

/** GCDのデフォルトリキャストタイム（秒） */
const GCD_RECAST = 2.5;

/** デフォルトのアニメーションロック（秒） */
const DEFAULT_ANIMATION_LOCK = 0.65;

const WHM_SKILLS = [
  // === GCD ===
  { id: "stone", name: "ストーン", potency: 140, type: "gcd", icon: "whm/Stone.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "aero", name: "エアロ", potency: 50, type: "gcd", icon: "whm/Aero.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "stone2", name: "ストンラ", potency: 190, type: "gcd", icon: "whm/Stone_II.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "aero2", name: "エアロラ", potency: 50, type: "gcd", icon: "whm/Aero_II.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "stone3", name: "ストンガ", potency: 220, type: "gcd", icon: "whm/Stone_III.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "stone4", name: "ストンジャ", potency: 260, type: "gcd", icon: "whm/Stone_IV.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "dia", name: "ディア", potency: 85, type: "gcd", icon: "whm/Dia.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "glare", name: "グレア", potency: 290, type: "gcd", icon: "whm/Glare.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "glare3", name: "グレアガ", potency: 350, type: "gcd", icon: "whm/Glare_III.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "glare4", name: "グレアジャ", potency: 640, type: "gcd", icon: "whm/Glare_IV.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK, buffConsumptions: JSON.stringify([{ buffId: "sacred-sight", stacks: 1 }]) },
  { id: "holy", name: "ホーリー", potency: 140, type: "gcd", icon: "whm/Holy.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "holy3", name: "ホーリガ", potency: 150, type: "gcd", icon: "whm/Holy_III.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK },
  // === リリー関連GCD ===
  { id: "heart-of-solace", name: "ハート・オブ・ソラス", potency: 0, type: "gcd", icon: "whm/Afflatus_Solace.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK, resourceChanges: JSON.stringify([{ resourceId: "healing-lily", amount: -1 }, { resourceId: "blood-lily", amount: 1 }]) },
  { id: "heart-of-rapture", name: "ハート・オブ・ラプチャー", potency: 0, type: "gcd", icon: "whm/Afflatus_Rapture.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK, resourceChanges: JSON.stringify([{ resourceId: "healing-lily", amount: -1 }, { resourceId: "blood-lily", amount: 1 }]) },
  { id: "heart-of-misery", name: "ハート・オブ・ミゼリ", potency: 1400, type: "gcd", icon: "whm/Afflatus_Misery.png", recastTime: GCD_RECAST, animationLock: DEFAULT_ANIMATION_LOCK, resourceChanges: JSON.stringify([{ resourceId: "blood-lily", amount: -3 }]) },
  // === oGCD ===
  { id: "assize", name: "アサイズ", potency: 400, type: "ogcd", icon: "whm/Assize.png", recastTime: DEFAULT_ANIMATION_LOCK, animationLock: DEFAULT_ANIMATION_LOCK },
  { id: "presence-of-mind", name: "神速魔", potency: 0, type: "ogcd", icon: "whm/Presence_of_Mind.png", recastTime: DEFAULT_ANIMATION_LOCK, animationLock: DEFAULT_ANIMATION_LOCK, buffApplications: JSON.stringify(["presence-of-mind", "sacred-sight"]) },
];

async function main() {
  // 既存データを削除してから投入（冪等性確保）
  await prisma.skill.deleteMany();

  for (const skill of WHM_SKILLS) {
    await prisma.skill.create({ data: skill });
  }

  console.log(`Seeded ${WHM_SKILLS.length} skills.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
