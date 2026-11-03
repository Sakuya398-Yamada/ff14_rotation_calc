import { z } from "zod";
import { encodeBase64Url, generateOwnerToken } from "./owner-token";

// Discord の OAuth 2.0（認可コード + PKCE）。ライブラリを使わない理由は #651 の結論コメント「実装の方法」
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const CURRENT_USER_URL = "https://discord.com/api/v10/users/@me";
// User-Agent が無いか形が違うリクエストは弾かれることがある（Discord の API Reference「User Agent」の書式）
const USER_AGENT = "DiscordBot (https://github.com/Sakuya398-Yamada/ff14_rotation_calc, 1.0.0)";
const REQUEST_TIMEOUT_MS = 10_000;

const tokenResponseSchema = z.object({ access_token: z.string().min(1) });
// snowflake（64 ビットの整数の 10 進）
const currentUserSchema = z.object({ id: z.string().regex(/^\d{1,20}$/) });

/** PKCE（RFC 7636）の code_verifier と S256 の code_challenge。verifier は 43 文字の base64url で、RFC の 43〜128 文字に収まる */
export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateOwnerToken();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: encodeBase64Url(new Uint8Array(digest)) };
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    scope: "identify",
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** 認可コードをアクセストークンに換え、Discord のユーザー ID を返す。Discord に届かない・200 以外・形の違う応答は、利用者の失敗ではないので例外にする */
export async function fetchDiscordUserId(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<string> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      // トークンのエンドポイントは application/x-www-form-urlencoded しか受け付けない
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${params.clientId}:${params.clientSecret}`)}`,
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!tokenRes.ok) throw new Error(`Discord token endpoint returned ${tokenRes.status}`);
  const { access_token } = tokenResponseSchema.parse(await tokenRes.json());

  const userRes = await fetch(CURRENT_USER_URL, {
    headers: { Authorization: `Bearer ${access_token}`, "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!userRes.ok) throw new Error(`Discord users/@me returned ${userRes.status}`);
  return currentUserSchema.parse(await userRes.json()).id;
}
