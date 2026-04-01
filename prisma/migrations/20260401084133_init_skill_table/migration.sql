-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "potency" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "recastTime" REAL NOT NULL,
    "animationLock" REAL NOT NULL
);
