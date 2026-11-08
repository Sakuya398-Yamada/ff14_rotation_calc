import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAccountStatus, loginUrl, logout, type MeResponse } from "../account";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

beforeEach(() => {
  fetchMock = vi.fn(async () => jsonResponse({ loginAvailable: true, loggedIn: false } satisfies MeResponse));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAccountStatus", () => {
  it.each([
    [{ loginAvailable: true, loggedIn: true }, "loggedIn"],
    [{ loginAvailable: true, loggedIn: false }, "loggedOut"],
    [{ loginAvailable: false, loggedIn: false }, "unavailable"],
  ] satisfies [MeResponse, string][])("/api/me が %o なら %s", async (body, expected) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
    const controller = new AbortController();
    expect(await fetchAccountStatus({ signal: controller.signal })).toBe(expected);
    expect(fetchMock).toHaveBeenCalledWith("/api/me", { signal: controller.signal });
  });

  it("応答がエラーなら、ログインできないものとする", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "internal" }, 500));
    expect(await fetchAccountStatus()).toBe("unavailable");
  });

  it("応答の形が違えば、ログインできないものとする", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ loginAvailable: "yes", loggedIn: true }));
    expect(await fetchAccountStatus()).toBe("unavailable");
  });

  it("通信に失敗したら、ログインできないものとする", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await fetchAccountStatus()).toBe("unavailable");
  });
});

describe("logout", () => {
  it("JSON の Content-Type を付けて /api/auth/logout に POST し、204 なら true", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const controller = new AbortController();
    expect(await logout({ signal: controller.signal })).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
  });

  it("204 以外なら false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unsupported_media_type" }, 415));
    expect(await logout()).toBe(false);
  });

  it("通信に失敗したら false", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await logout()).toBe(false);
  });
});

describe("loginUrl", () => {
  it("戻るパスを returnTo に付ける", () => {
    expect(loginUrl("/en/t/V1StGXR8_Z5jdHi6B-myT")).toBe("/api/auth/discord?returnTo=%2Fen%2Ft%2FV1StGXR8_Z5jdHi6B-myT");
  });
});
