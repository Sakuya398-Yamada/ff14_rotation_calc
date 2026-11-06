import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { isOwnerToken } from "../services/owner-token";

// 匿名トークンの Cookie（__Host-owner）。保存・一覧・削除と、ログイン・ログアウトで使う

// RFC 6265bis の上限の 400 日
const OWNER_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/** Cookie の匿名トークン。無いか、形が不正なら undefined */
export function readOwnerToken(c: Context): string | undefined {
  const token = getCookie(c, "owner", "host");
  return token !== undefined && isOwnerToken(token) ? token : undefined;
}

export function setOwnerCookie(c: Context, token: string) {
  setCookie(c, "owner", token, { prefix: "host", httpOnly: true, sameSite: "Lax", maxAge: OWNER_COOKIE_MAX_AGE });
}

export function clearOwnerCookie(c: Context) {
  deleteCookie(c, "owner", { prefix: "host", httpOnly: true, sameSite: "Lax" });
}
