import { eq } from "drizzle-orm";
import { userOwners } from "../db/schema";
import type { AppDb } from "../env";

/**
 * 匿名トークン（の owner_hash）をユーザーに紐づけ、紐づいている先のユーザーを返す。
 * すでに紐づいていれば書かずに、その先を返す（別のユーザーのこともある）
 */
export async function linkOwner(db: AppDb, ownerHash: string, userId: string): Promise<string> {
  // 先に読んでから書くと、同時のログインで両方が「まだ無い」と読み、負けた側が紐づいていないのに気付かない
  const inserted = await db
    .insert(userOwners)
    .values({ ownerHash, userId })
    .onConflictDoNothing({ target: userOwners.ownerHash })
    .returning({ userId: userOwners.userId });
  if (inserted.length > 0) return userId;
  const [row] = await db
    .select({ userId: userOwners.userId })
    .from(userOwners)
    .where(eq(userOwners.ownerHash, ownerHash))
    .limit(1);
  return row.userId;
}

/** 匿名トークン（の owner_hash）が、どれかのユーザーに紐づいているか */
export async function isLinkedOwner(db: AppDb, ownerHash: string): Promise<boolean> {
  const [row] = await db
    .select({ ownerHash: userOwners.ownerHash })
    .from(userOwners)
    .where(eq(userOwners.ownerHash, ownerHash))
    .limit(1);
  return row !== undefined;
}

/** ユーザーに紐づいた owner_hash を選ぶサブクエリ（`inArray(timelines.ownerHash, ...)` に渡す） */
export function selectOwnerHashesOf(db: AppDb, userId: string) {
  return db.select({ ownerHash: userOwners.ownerHash }).from(userOwners).where(eq(userOwners.userId, userId));
}
