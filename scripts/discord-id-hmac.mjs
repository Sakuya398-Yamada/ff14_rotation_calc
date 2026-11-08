// Discord のユーザー ID から、user_identities.provider_user_id の値（DISCORD_ID_HMAC_KEY を鍵にした HMAC-SHA256 の hex）を手元で出す。
// 削除の依頼を受けたときに、送り主の行を探すのに使う（docs/deletion-requests.md）。Worker の src/server/services/discord-id.ts と同じ計算。
// 使い方: node scripts/discord-id-hmac.mjs <Discord のユーザー ID>  （鍵は聞かれたら貼り付ける。引数にするとコマンドの履歴に残るため）
import { createHmac } from "node:crypto";
import { createInterface } from "node:readline/promises";

const discordUserId = process.argv[2] ?? "";
if (!/^\d+$/.test(discordUserId)) {
  console.error("使い方: node scripts/discord-id-hmac.mjs <Discord のユーザー ID（数字だけ）>");
  process.exit(1);
}

// 値だけを標準出力に出すため、問いかけは標準エラーに出す
const rl = createInterface({ input: process.stdin, output: process.stderr });
const key = (await rl.question("DISCORD_ID_HMAC_KEY の値を貼り付けて Enter: ")).trim();
rl.close();
if (key === "") {
  console.error("鍵が空です");
  process.exit(1);
}
console.log(createHmac("sha256", key).update(discordUserId).digest("hex"));
