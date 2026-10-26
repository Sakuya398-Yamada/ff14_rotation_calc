// Cloudflare Turnstile のトークンをサーバー側で検証する（#479）。トークンは 300 秒・1 回限り
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare が定めるトークンの最大長
export const MAX_TURNSTILE_TOKEN_LENGTH = 2048;
const SITEVERIFY_TIMEOUT_MS = 10_000;

/** 不合格なら false。siteverify に届かない・200 以外のときは、利用者の失敗ではないので例外にする */
export async function verifyTurnstileToken(secret: string, token: string, remoteIp?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const res = await fetch(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`siteverify returned ${res.status}`);
  const result = (await res.json()) as { success?: unknown };
  return result.success === true;
}
