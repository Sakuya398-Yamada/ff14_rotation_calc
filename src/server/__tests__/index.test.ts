import { describe, expect, it, vi } from "vitest";
import type { Bindings } from "../env";
import app from "../index";

function envWithAssets() {
  const fetch = vi.fn(async (_request: Request) => new Response("<html lang=\"en\"></html>", { status: 200 }));
  const env = { DB: undefined, TIMELINE_RATE_LIMITER: { limit: vi.fn() }, ASSETS: { fetch } } satisfies Bindings;
  return { env, fetch };
}

describe("英語のページ（/en/*）", () => {
  it.each(["/en/", "/en/t/V1StGXR8_Z5jdHi6B-myT", "/en/t/V1StGXR8_Z5jdHi6B-myT/"])(
    "%s には、アセットの /en/ の HTML を返す",
    async (path) => {
      const { env, fetch } = envWithAssets();
      const res = await app.request(`http://localhost${path}`, { headers: { "If-None-Match": '"etag"' } }, env);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html lang="en"></html>');
      expect(fetch).toHaveBeenCalledTimes(1);
      const request = fetch.mock.calls[0][0];
      expect(new URL(request.url).pathname).toBe("/en/");
      // 条件付きの GET が 304 で返せるよう、元のヘッダーを引き継ぐ
      expect(request.headers.get("If-None-Match")).toBe('"etag"');
    }
  );

  it("/en/ 配下でない API はアセットを取らない", async () => {
    const { env, fetch } = envWithAssets();
    const res = await app.request("http://localhost/api/health", {}, env);

    expect(res.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });
});
