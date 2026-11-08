import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { MeResponse } from "../../client/logic/account";
import { userIdentities, users } from "../db/schema";
import type { AppDb, Bindings } from "../env";
import { hmacDiscordUserId } from "../services/discord-id";
import { buildAuthorizeUrl, createPkce, fetchDiscordUserId } from "../services/discord-oauth";
import { generateOwnerToken, hashOwnerToken, isOwnerToken } from "../services/owner-token";
import { createSession, deleteSession, validateSession } from "../services/session";
import { linkOwner } from "../services/user-owners";
import { clearOwnerCookie, readOwnerToken, setOwnerCookie } from "./owner-cookie";
import { requireJson } from "./require-json";

type RouteEnv = { Bindings: Bindings };

const SESSION_COOKIE = "session";
// 認可画面から戻るまでのあいだだけ、state・code_verifier・戻るパスを持つ
const OAUTH_COOKIE = "discord_oauth";
const OAUTH_COOKIE_MAX_AGE = 10 * 60;
// Discord のアプリに登録するリダイレクト URI のパス。登録は完全一致なので、オリジンごとに 1 つ登録する
const CALLBACK_PATH = "/api/auth/discord/callback";

const oauthCookieSchema = z.object({ state: z.string(), verifier: z.string(), returnTo: z.string() });

/** ログイン後に戻るパス。同じオリジンの相対パスだけを通し、それ以外はトップにする */
export function safeReturnPath(value: string | undefined, origin: string): string {
  if (!value?.startsWith("/")) return "/";
  // `//host`・`/\host`・タブや改行を挟んだものは、URL として解決すると別のオリジンになるので、ここで落ちる
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return "/";
  }
  const path = url.pathname + url.search + url.hash;
  // `/.//host` のようなドットセグメントは、解決するとオリジンが同じままパスが `//host` になり、Location に入れると別のホストとして読まれる。
  // 解決でバックスラッシュは `/` に変わるので、`//` だけを見ればよい
  return url.origin === origin && !path.startsWith("//") ? path : "/";
}

/** ID が無ければログインできない環境（null）。ID があるのに secret か HMAC の鍵が無いのは設定の誤りなので、例外（既定の onError がログに出して 500）にする */
function getDiscordConfig(c: Context<RouteEnv>): { clientId: string; clientSecret: string; idHmacKey: string } | null {
  const clientId = c.env.DISCORD_CLIENT_ID;
  if (!clientId) return null;
  const clientSecret = c.env.DISCORD_CLIENT_SECRET;
  if (!clientSecret) throw new Error("DISCORD_CLIENT_SECRET is not set");
  // 削除の依頼のときに手元で計算する scripts/discord-id-hmac.mjs と同じく、前後の空白・改行は除く（貼り付けで混ざっても値がずれないように）
  const idHmacKey = c.env.DISCORD_ID_HMAC_KEY?.trim();
  if (!idHmacKey) throw new Error("DISCORD_ID_HMAC_KEY is not set");
  return { clientId, clientSecret, idHmacKey };
}

function readOAuthCookie(c: Context) {
  const raw = getCookie(c, OAUTH_COOKIE, "host");
  if (raw === undefined) return undefined;
  try {
    const result = oauthCookieSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** Cookie のセッショントークン。無いか、形が不正なら undefined */
function readSessionToken(c: Context): string | undefined {
  const token = getCookie(c, SESSION_COOKIE, "host");
  return token !== undefined && isOwnerToken(token) ? token : undefined;
}

function setSessionCookie(c: Context, token: string, expiresAt: number) {
  const maxAge = expiresAt - Math.floor(Date.now() / 1000);
  setCookie(c, SESSION_COOKIE, token, { prefix: "host", httpOnly: true, sameSite: "Lax", maxAge });
}

function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { prefix: "host", httpOnly: true, sameSite: "Lax" });
}

/**
 * ログイン中ならユーザーの ID（/api/me の loggedIn と同じ判定）。延長したら Cookie を付け直し、無効なセッションの Cookie は消す。
 * ID が無い環境ではログインできないので、セッションの Cookie が残っていてもログインしていないものとし、DB を読まない
 */
export async function currentUserId<E extends { Bindings: Bindings }>(c: Context<E>, db: AppDb): Promise<string | undefined> {
  if (!c.env.DISCORD_CLIENT_ID) return undefined;
  const token = readSessionToken(c);
  if (token === undefined) return undefined;
  const session = await validateSession(db, token);
  if (!session) {
    clearSessionCookie(c);
    return undefined;
  }
  if (session.refreshed) setSessionCookie(c, token, session.expiresAt);
  return session.userId;
}

/** providerUserId は Discord のユーザー ID の HMAC（hmacDiscordUserId）。生の ID は渡さない */
async function findOrCreateUser(db: AppDb, providerUserId: string): Promise<string> {
  const [identity] = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(and(eq(userIdentities.provider, "discord"), eq(userIdentities.providerUserId, providerUserId)))
    .limit(1);
  if (identity) return identity.userId;
  const userId = nanoid();
  await db.insert(users).values({ id: userId });
  await db.insert(userIdentities).values({ provider: "discord", providerUserId, userId });
  return userId;
}

// /api/auth にマウントする
export function createAuthRoute(getDb: (env: Bindings) => AppDb) {
  return new Hono<RouteEnv>()
    .get("/discord", async (c) => {
      const config = getDiscordConfig(c);
      if (!config) return c.json({ error: "not_found" }, 404);
      const origin = new URL(c.req.url).origin;
      const state = generateOwnerToken();
      const { verifier, challenge } = await createPkce();
      const returnTo = safeReturnPath(c.req.query("returnTo"), origin);
      setCookie(c, OAUTH_COOKIE, JSON.stringify({ state, verifier, returnTo }), {
        prefix: "host",
        httpOnly: true,
        // Discord からの戻りはトップレベルの GET の遷移なので、Lax でも送られる
        sameSite: "Lax",
        maxAge: OAUTH_COOKIE_MAX_AGE,
      });
      return c.redirect(
        buildAuthorizeUrl({
          clientId: config.clientId,
          redirectUri: new URL(CALLBACK_PATH, origin).toString(),
          state,
          codeChallenge: challenge,
        }),
      );
    })
    .get("/discord/callback", async (c) => {
      const config = getDiscordConfig(c);
      if (!config) return c.json({ error: "not_found" }, 404);
      const origin = new URL(c.req.url).origin;
      const oauth = readOAuthCookie(c);
      // 1 回限り。成否に関わらず消す
      deleteCookie(c, OAUTH_COOKIE, { prefix: "host", httpOnly: true, sameSite: "Lax" });
      const returnTo = safeReturnPath(oauth?.returnTo, origin);
      const { code, state } = c.req.query();
      // Discord で拒否された（code が無く error が付く）・別のブラウザで始めた・期限が切れた・偽の戻りは、ログインせずに戻す
      if (!oauth || !code || state !== oauth.state) return c.redirect(returnTo);

      const discordUserId = await fetchDiscordUserId({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code,
        redirectUri: new URL(CALLBACK_PATH, origin).toString(),
        codeVerifier: oauth.verifier,
      });
      const db = getDb(c.env);
      const userId = await findOrCreateUser(db, await hmacDiscordUserId(config.idHmacKey, discordUserId));
      // このブラウザで匿名のまま保存したタイムラインも、アカウントから見えるようにする。確認は挟まない（#651）
      const ownerToken = readOwnerToken(c);
      if (ownerToken !== undefined && (await linkOwner(db, await hashOwnerToken(ownerToken), userId)) !== userId) {
        // 別のユーザーに紐づいた匿名トークン（共用の PC で前の人が使っていたものなど）。前の人の保存は取り込まず、
        // このブラウザには新しい匿名トークンを渡す。新しいトークンは、ログイン中に保存したときに紐づく
        setOwnerCookie(c, generateOwnerToken());
      }
      // ログインのたびに新しいトークンにする（セッション固定攻撃の対策）。前のセッションは使わなくなるので消す
      const previousToken = readSessionToken(c);
      if (previousToken !== undefined) await deleteSession(db, previousToken);
      const session = await createSession(db, userId);
      setSessionCookie(c, session.token, session.expiresAt);
      return c.redirect(returnTo);
    })
    // 保存の API と同じ CSRF 対策。ID が無い環境でも、残ったセッションを消せるように 404 にしない
    .post("/logout", csrf(), requireJson, async (c) => {
      const token = readSessionToken(c);
      if (token !== undefined) {
        await deleteSession(getDb(c.env), token);
        // 匿名トークンはログインで（その後の保存でも）アカウントに紐づいているので、消しても保存はアカウントに残る。
        // 共用の PC で、次の人にこのブラウザの一覧を見せないために消す。セッションの Cookie が無ければ、ログインしていない人の
        // 匿名トークン（どのアカウントにも紐づいていないことがある）なので消さない
        clearOwnerCookie(c);
      }
      clearSessionCookie(c);
      return c.body(null, 204);
    });
}

// /api/me にマウントする
export function createMeRoute(getDb: (env: Bindings) => AppDb) {
  return new Hono<RouteEnv>().get("/", async (c) => {
    if (!c.env.DISCORD_CLIENT_ID) return c.json({ loginAvailable: false, loggedIn: false } satisfies MeResponse);
    const userId = await currentUserId(c, getDb(c.env));
    return c.json({ loginAvailable: true, loggedIn: userId !== undefined } satisfies MeResponse);
  });
}
