import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

// @cloudflare/workers-types や wrangler types は Request などをグローバルに宣言し、client と共用の tsconfig の DOM 型とぶつかるので、使う分だけをここに書く
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type Bindings = {
  // drizzle-orm/d1 の drizzle() に渡すだけなので型は付けない
  DB: unknown;
  TIMELINE_RATE_LIMITER: RateLimiter;
  // Worker の secret。ローカルは .dev.vars から読む。PR プレビューには無い
  TURNSTILE_SECRET_KEY?: string;
};

// 本番の D1（async）とテストの better-sqlite3（sync）のどちらも入る。await で使えるクエリビルダーだけを呼ぶ
export type AppDb = BaseSQLiteDatabase<"sync" | "async", unknown>;
