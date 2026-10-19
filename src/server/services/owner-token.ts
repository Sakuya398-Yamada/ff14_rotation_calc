// 匿名トークン: 32 バイトの乱数を base64url（パディング無し）にした 43 文字。DB には SHA-256 の hex だけを書く（#462）
const OWNER_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isOwnerToken(value: string): boolean {
  return OWNER_TOKEN_RE.test(value);
}

export function generateOwnerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashOwnerToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
