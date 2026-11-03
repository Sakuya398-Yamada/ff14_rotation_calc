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

describe("共有 URL（/t/*・/en/t/*）を検索結果から外す", () => {
  const ID = "V1StGXR8_Z5jdHi6B-myT";

  it.each([`/t/${ID}`, `/t/${ID}/`])("%s には、アセットの / の HTML を noindex を付けて返す", async (path) => {
    const { env, fetch } = envWithAssets();
    const res = await app.request(`http://localhost${path}`, { headers: { "If-None-Match": '"etag"' } }, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = fetch.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe("/");
    expect(request.headers.get("If-None-Match")).toBe('"etag"');
  });

  it.each([`/en/t/${ID}`, `/en/t/${ID}/`])("%s には noindex を付ける", async (path) => {
    const { env } = envWithAssets();
    const res = await app.request(`http://localhost${path}`, {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("/en/ には noindex を付けない", async () => {
    const { env } = envWithAssets();
    const res = await app.request("http://localhost/en/", {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it.each([`/t/${ID}`, `/en/t/${ID}`])("%s: アセットの応答のヘッダーが書き換えられなくても noindex を付ける", async (path) => {
    // Workers の ASSETS.fetch の応答と同じく、ヘッダーが immutable な Response（data: URL の fetch の結果）を返す
    const fetch = vi.fn(async (_request: Request) => globalThis.fetch("data:text/html,<html></html>"));
    const env = { DB: undefined, TIMELINE_RATE_LIMITER: { limit: vi.fn() }, ASSETS: { fetch } } satisfies Bindings;
    const res = await app.request(`http://localhost${path}`, {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Content-Type")).toBe("text/html");
    expect(await res.text()).toBe("<html></html>");
  });
});
