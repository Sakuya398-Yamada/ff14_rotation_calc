import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// 中身は書き換えない（UPDATE する API を作らない）。設計の根拠は #462 の結論コメント「テーブル設計」
export const timelines = sqliteTable(
  "timelines",
  {
    // nanoid（21 文字）。共有 URL にそのまま使う
    id: text("id").primaryKey(),
    // 複製元。新規なら NULL
    parentId: text("parent_id").references((): AnySQLiteColumn => timelines.id),
    // data.version と同じ値。読み込み時に旧版から変換するときの判定に使う
    schemaVer: integer("schema_ver").notNull(),
    // PersistedAppState の JSON（localStorage と同じ形式）
    data: text("data").notNull(),
    // job・level は data から保存時にアプリが抜き出して書く。生成列にしないのは、式を後から変えられず、
    // schema_ver が上がって JSON のパスが変わると版ごとに式を書き分けることになるため
    job: text("job").notNull(),
    level: integer("level").notNull(),
    title: text("title"),
    contentId: text("content_id"),
    // 匿名トークンの SHA-256（hex）。トークンそのものは保存しない
    ownerHash: text("owner_hash").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // 「自分のタイムライン」一覧用。インデックスは 1 本ごとに保存 1 件あたりの D1 の書き込み行数が 1 増えるので、今使うものだけ張る。
    // 新しい順（ORDER BY created_at DESC）でも SQLite は昇順のインデックスを逆にたどるので DESC は付けない。
    // sql`... DESC` の式で書くと、テーブルを作り直すマイグレーションで drizzle-kit 0.31 が式を列名として quote し、壊れた CREATE INDEX を生成する
    index("idx_timelines_owner").on(t.ownerHash, t.createdAt),
    check("timelines_data_json_valid", sql`json_valid(${t.data})`),
  ],
);
