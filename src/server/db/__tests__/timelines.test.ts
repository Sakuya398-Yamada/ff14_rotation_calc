import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { timelines } from "../schema";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../../migrations", import.meta.url));

// 本番の D1 と同じマイグレーションを当てた使い捨ての DB。workerd を起動しないよう D1 ではなく better-sqlite3 を使う（#574）。
// 外部キー制約は D1 と同じく最初から有効（better-sqlite3 は SQLITE_DEFAULT_FOREIGN_KEYS=1 でビルドされている）
function createTestDb() {
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

const ROW = {
  id: "V1StGXR8_Z5jdHi6B-myT",
  schemaVer: 1,
  data: JSON.stringify({ version: 1, selectedJob: "BLM", level: 100 }),
  job: "BLM",
  level: 100,
  ownerHash: "a".repeat(64),
};

describe("timelines テーブル", () => {
  it("insert した行を select でき、省略した列は NULL・created_at は保存時刻になる", async () => {
    const db = createTestDb();
    await db.insert(timelines).values(ROW);

    const [saved] = await db.select().from(timelines).where(eq(timelines.id, ROW.id));

    expect(saved).toMatchObject({ ...ROW, parentId: null, title: null, contentId: null });
    expect(Math.abs(saved.createdAt - Date.now() / 1000)).toBeLessThan(60);
  });

  it("data が JSON でなければ CHECK 制約で弾く", async () => {
    const db = createTestDb();

    await expect(db.insert(timelines).values({ ...ROW, data: "not json" })).rejects.toThrow(
      /CHECK constraint failed: timelines_data_json_valid/,
    );
  });

  it("存在しない parent_id は外部キー制約で弾く", async () => {
    const db = createTestDb();

    await expect(db.insert(timelines).values({ ...ROW, parentId: "missing" })).rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });
});
