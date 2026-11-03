import { eq } from "drizzle-orm";
import { sessions } from "../db/schema";
import type { AppDb } from "../env";
// セッショントークンも匿名トークンと同じ作り（32 バイトの乱数の base64url。DB には SHA-256 の hex だけを書く）
import { generateOwnerToken, hashOwnerToken } from "./owner-token";

const DAY = 24 * 60 * 60;
export const SESSION_TTL = 30 * DAY;
// 残りがこれを切ったリクエストでだけ延長する。毎リクエストは D1 に書かない（The Copenhagen Book「Sessions」）
const SESSION_REFRESH_THRESHOLD = 15 * DAY;
// 絶対期限。作成からこれを過ぎたら有効期限の内でも切り、延長もここで頭打ちにする
const SESSION_ABSOLUTE_TTL = 365 * DAY;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createSession(db: AppDb, userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = generateOwnerToken();
  const now = nowSeconds();
  const expiresAt = now + SESSION_TTL;
  await db.insert(sessions).values({ idHash: await hashOwnerToken(token), userId, expiresAt, createdAt: now });
  return { token, expiresAt };
}

/** 有効ならユーザーと期限（延長したら refreshed が true）。無いか期限切れなら null で、期限切れの行は消す */
export async function validateSession(
  db: AppDb,
  token: string,
): Promise<{ userId: string; expiresAt: number; refreshed: boolean } | null> {
  const idHash = await hashOwnerToken(token);
  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, createdAt: sessions.createdAt })
    .from(sessions)
    .where(eq(sessions.idHash, idHash))
    .limit(1);
  if (!row) return null;
  const now = nowSeconds();
  const absoluteExpiresAt = row.createdAt + SESSION_ABSOLUTE_TTL;
  if (now >= row.expiresAt || now >= absoluteExpiresAt) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }
  const expiresAt = Math.min(now + SESSION_TTL, absoluteExpiresAt);
  // 絶対期限の手前では、延ばしても今の期限を越えないことがある
  if (row.expiresAt - now >= SESSION_REFRESH_THRESHOLD || expiresAt <= row.expiresAt) {
    return { userId: row.userId, expiresAt: row.expiresAt, refreshed: false };
  }
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.idHash, idHash));
  return { userId: row.userId, expiresAt, refreshed: true };
}

export async function deleteSession(db: AppDb, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.idHash, await hashOwnerToken(token)));
}
