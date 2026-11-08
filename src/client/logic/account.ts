/** GET /api/me の応答（サーバーも satisfies でこの形に合わせる） */
export type MeResponse = { loginAvailable: boolean; loggedIn: boolean };

/** unavailable はログインできない環境（PR のプレビュー）か、/api/me を取得できなかったとき */
export type AccountStatus = "unavailable" | "loggedOut" | "loggedIn";

export async function fetchAccountStatus(deps: { signal?: AbortSignal } = {}): Promise<AccountStatus> {
  try {
    const res = await fetch("/api/me", { signal: deps.signal });
    if (!res.ok) return "unavailable";
    const body = (await res.json()) as Partial<MeResponse>;
    if (typeof body.loginAvailable !== "boolean" || typeof body.loggedIn !== "boolean") return "unavailable";
    if (!body.loginAvailable) return "unavailable";
    return body.loggedIn ? "loggedIn" : "loggedOut";
  } catch {
    return "unavailable";
  }
}

/** ログアウトできたら true */
export async function logout(deps: { signal?: AbortSignal } = {}): Promise<boolean> {
  try {
    // サーバーは CSRF 対策で JSON の Content-Type だけを受け付ける（本文は無い）
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: deps.signal,
    });
    return res.status === 204;
  } catch {
    return false;
  }
}

/** ログインを始める URL。ログインした後は returnTo のパスに戻る */
export function loginUrl(returnTo: string): string {
  return `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
}
