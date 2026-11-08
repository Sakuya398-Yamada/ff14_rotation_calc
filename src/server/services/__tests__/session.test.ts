import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessions, users } from "../../db/schema";
import { deleteExpiredSessions, validateSession } from "../session";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../../migrations", import.meta.url));
const DAY = 24 * 60 * 60;
const NOW = 1_800_000_000;
const TOKEN = "s".repeat(43);

// src/server/routes/__tests__/auth.test.ts と同じく、本番の D1 と同じマイグレーションを当てた better-sqlite3 の DB を使う
function createTestDb() {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

async function insertSession(db: ReturnType<typeof createTestDb>, row: { expiresAt: number; createdAt: number }) {
  await db.insert(users).values({ id: "user-1" });
  await db.insert(sessions).values({
    idHash: createHash("sha256").update(TOKEN).digest("hex"),
    userId: "user-1",
    ...row,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("deleteExpiredSessions: 期限が切れたセッションの行を消す", () => {
  it.each([
    ["有効期限の 1 秒前", false, { expiresAt: NOW + 1, createdAt: NOW - 30 * DAY + 1 }],
    ["有効期限ちょうど", true, { expiresAt: NOW, createdAt: NOW - 30 * DAY }],
    ["有効期限切れ", true, { expiresAt: NOW - DAY, createdAt: NOW - 31 * DAY }],
    ["絶対期限の 1 秒前", false, { expiresAt: NOW + 20 * DAY, createdAt: NOW - 365 * DAY + 1 }],
    ["絶対期限ちょうど（有効期限の内）", true, { expiresAt: NOW + 20 * DAY, createdAt: NOW - 365 * DAY }],
  ])("%s の行を消すかは %s で、validateSession が期限切れとみなすかと一致する", async (_label, deleted, row) => {
    const db = createTestDb();
    await insertSession(db, row);

    await deleteExpiredSessions(db);

    expect(await db.select().from(sessions)).toHaveLength(deleted ? 0 : 1);
    // validateSession は期限切れの行を読んだときに消すので、別の DB で判定を見る
    const other = createTestDb();
    await insertSession(other, row);
    expect((await validateSession(other, TOKEN)) === null).toBe(deleted);
  });
});
