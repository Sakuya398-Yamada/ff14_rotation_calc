// user_identities.provider_user_id に入れる値。D1 やバックアップが漏れても、どの Discord アカウントが使ったかを分からなくするため、
// 生の ID は保存せず、Worker の secret DISCORD_ID_HMAC_KEY を鍵にした HMAC-SHA256 にする（#918）。
// 鍵は secret の文字列を UTF-8 にしたバイト列。手元で同じ値を出すのは scripts/discord-id-hmac.mjs（docs/deletion-requests.md）
export async function hmacDiscordUserId(key: string, discordUserId: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(discordUserId));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}
