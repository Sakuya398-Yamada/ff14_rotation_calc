import { describe, expect, it, vi } from "vitest";
import type { Bindings } from "../env";
import worker from "../index";
import { deleteExpiredSessions } from "../services/session";

// 消す条件は src/server/services/__tests__/session.test.ts で確かめる。ここでは Cron Trigger の呼び出しがそこへ届くかだけを見る
vi.mock("../services/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/session")>()),
  deleteExpiredSessions: vi.fn(async () => {}),
}));

describe("Cron Trigger（scheduled）", () => {
  it("期限が切れたセッションの行を消す", async () => {
    const env = { DB: {}, TIMELINE_RATE_LIMITER: { limit: vi.fn() }, ASSETS: { fetch: vi.fn() } } satisfies Bindings;

    await worker.scheduled({}, env);

    expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);
  });
});
