import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hmacDiscordUserId } from "../discord-id";

const SCRIPT = fileURLToPath(new URL("../../../../scripts/discord-id-hmac.mjs", import.meta.url));
const KEY = "test-id-hmac-key";
const DISCORD_ID = "80351110224678912";

function runScript(args: string[], input: string) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: "utf8" });
}

describe("hmacDiscordUserId", () => {
  it("鍵の文字列を UTF-8 にしたバイト列で HMAC-SHA256 を取り、小文字の hex にする", async () => {
    // RFC 4231 の Test Case 2（鍵とデータが ASCII の文字列）
    expect(await hmacDiscordUserId("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});

// 削除の依頼を受けたときに、送り主の ID から行を探すのに使う（docs/deletion-requests.md）。Worker と値がずれると行が見つからない
describe("scripts/discord-id-hmac.mjs", () => {
  it("標準入力で受け取った鍵で、Worker と同じ値を出す（鍵の前後の空白と改行は除く）", async () => {
    const result = runScript([DISCORD_ID], ` ${KEY}\r\n`);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${await hmacDiscordUserId(KEY, DISCORD_ID)}\n`);
  });

  it.each([["sakuyuno"], [""]])("ID が数字だけでなければ（%j）、鍵を読まずに終了コード 1 で終わる", (id) => {
    const result = runScript(id === "" ? [] : [id], `${KEY}\n`);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("鍵が空なら、値を出さずに終了コード 1 で終わる", () => {
    const result = runScript([DISCORD_ID], "\n");

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
});
