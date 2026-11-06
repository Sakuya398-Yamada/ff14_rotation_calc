import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// 中身は書き換えない（UPDATE するのは削除の印の deleted_at だけ。#832）。設計の根拠は #462 の結論コメント「テーブル設計」
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
    // 論理削除した時刻（unixepoch() の秒）。NULL なら削除していない。行を消さないのは、
    // parent_id で参照する子（ほかの人の保存も）があると外部キーで消せず、削除したことも共有 URL で伝えるため（#832）
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    // 「自分のタイムライン」一覧用。インデックスは 1 本ごとに保存 1 件あたりの D1 の書き込み行数が 1 増えるので、今使うものだけ張る。
    // 新しい順（ORDER BY created_at DESC）でも SQLite は昇順のインデックスを逆にたどるので DESC は付けない。
    // sql`... DESC` の式で書くと、テーブルを作り直すマイグレーションで drizzle-kit 0.31 が式を列名として quote し、壊れた CREATE INDEX を生成する
    index("idx_timelines_owner").on(t.ownerHash, t.createdAt),
    check("timelines_data_json_valid", sql`json_valid(${t.data})`),
  ],
);

// ログインしたユーザー。個人情報を持たないよう、メールアドレス・表示名は置かない（#651 の結論コメント「データモデル」）
export const users = sqliteTable("users", {
  // nanoid（21 文字）
  id: text("id").primaryKey(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// プロバイダのアカウントとユーザーの対応。プロバイダを足すときは行を足すだけで済む
export const userIdentities = sqliteTable(
  "user_identities",
  {
    // 今は "discord" だけ
    provider: text("provider").notNull(),
    // Discord は snowflake の id（username は一意でないので使わない）
    providerUserId: text("provider_user_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerUserId] })],
);

// ログインのセッション。期限の判定と延長は src/server/services/session.ts
export const sessions = sqliteTable("sessions", {
  // セッショントークンの SHA-256（hex）。トークンそのものは保存しない
  idHash: text("id_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  // unixepoch の秒
  expiresAt: integer("expires_at").notNull(),
  // 絶対期限の起点。expires_at と同じ時計で比べるので、アプリが書く（既定値は手で入れた行のため）
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// 匿名トークンとユーザーの対応。ログインしたら、その匿名トークンで保存したタイムラインもアカウントから見えるようにする。
// timelines は書き換えず、ここに行を足すだけで紐づける（#651 の結論コメント「データモデル」「匿名データの移行」）
export const userOwners = sqliteTable(
  "user_owners",
  {
    // timelines.owner_hash と同じ値。1 つの匿名トークンは 1 人のユーザーにだけ紐づく
    ownerHash: text("owner_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    linkedAt: integer("linked_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  // ログイン中の一覧・削除で、ユーザーの owner_hash を引く
  (t) => [index("idx_user_owners_user").on(t.userId)],
);
