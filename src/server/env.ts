import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

// @cloudflare/workers-types や wrangler types は Request などをグローバルに宣言し、client と共用の tsconfig の DOM 型とぶつかるので、使う分だけをここに書く
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export type Bindings = {
  // drizzle-orm/d1 の drizzle() に渡すだけなので型は付けない
  DB: unknown;
  // Static Assets（wrangler.jsonc の assets.binding）
  ASSETS: AssetsBinding;
  TIMELINE_RATE_LIMITER: RateLimiter;
  // Worker の secret。ローカルは .dev.vars、PR プレビューは wrangler.jsonc の previews.vars（どちらもテスト用）から読む
  TURNSTILE_SECRET_KEY?: string;
  // Discord のログイン。ID は wrangler.jsonc の vars、secret は Worker の secret（ローカルはどちらも .dev.vars に書ける）。
  // ID が無い環境（PR のプレビュー）ではログインの API が 404 になる（#876）
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  // Discord のユーザー ID を HMAC にする鍵（Worker の secret。ローカルは .dev.vars）。ログインできる環境では必須（#918）
  DISCORD_ID_HMAC_KEY?: string;
};

// 本番の D1（async）とテストの better-sqlite3（sync）のどちらも入る。await で使えるクエリビルダーだけを呼ぶ
export type AppDb = BaseSQLiteDatabase<"sync" | "async", unknown>;
