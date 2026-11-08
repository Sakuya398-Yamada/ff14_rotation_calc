// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import i18next from "i18next";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PrivacyPolicyPage } from "../PrivacyPolicyPage";

afterEach(cleanup);

// サーバーが setCookie する名前（src/server/routes/owner-cookie.ts・auth.ts。prefix: "host" で __Host- が付く）
const COOKIE_NAMES = ["__Host-owner", "__Host-session", "__Host-discord_oauth"];

describe("PrivacyPolicyPage", () => {
  it("日本語の見出しと <title> を出し、英語版とトップへリンクする", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("プライバシーポリシー");
    expect(document.title).toBe("プライバシーポリシー | FF14 Rotation Calculator");
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/privacy");
    expect(screen.getByRole("link", { name: "FF14 Rotation Calculator" })).toHaveAttribute("href", "/");
  });

  it.each(COOKIE_NAMES)("Cookie の %s を書いている", (name) => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("削除の依頼先に Discord の sakuyuno、問い合わせ先に GitHub の Issue を書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(/sakuyuno/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub の Issue" })).toHaveAttribute(
      "href",
      "https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues"
    );
  });

  // src/server/services/discord-id.ts（#918）
  it("Discord のユーザー ID はそのまま保存せず、HMAC-SHA256 にした値を保存すると書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText("Discord のユーザー ID から作った値")).toBeInTheDocument();
    expect(screen.getByText(/ユーザー ID もそのままは保存せず、運営者だけが持つ鍵で HMAC-SHA256 にかけた値を保存します/)).toBeInTheDocument();
  });

  // Cron Trigger で 1 日 1 回消す（src/server/index.ts の scheduled。#919）
  it("ログアウトせずに期限が切れたセッションの記録も、1 日 1 回消すと書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(/ログアウトせずに期限が切れたものも 1 日 1 回まとめて消します/)).toBeInTheDocument();
  });

  describe("英語", () => {
    beforeEach(() => i18next.changeLanguage("en"));
    afterEach(() => i18next.changeLanguage("ja"));

    it("英語の見出しと <title> を出し、日本語版とトップへリンクする", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy policy");
      expect(document.title).toBe("Privacy policy | FFXIV Rotation Calculator");
      expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute("href", "/privacy");
      expect(screen.getByRole("link", { name: "FFXIV Rotation Calculator" })).toHaveAttribute("href", "/en/");
    });

    it.each(COOKIE_NAMES)("Cookie の %s を書いている", (name) => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText(name)).toBeInTheDocument();
    });

    it("削除の依頼先に Discord の sakuyuno、問い合わせ先に GitHub の Issue を書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText(/sakuyuno/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "GitHub Issues" })).toHaveAttribute(
        "href",
        "https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues"
      );
    });

    it("Discord のユーザー ID はそのまま保存せず、HMAC-SHA256 にした値を保存すると書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText("Value derived from your Discord user ID")).toBeInTheDocument();
      expect(screen.getByText(/Your user ID itself is not stored either: the tool stores its HMAC-SHA256/)).toBeInTheDocument();
    });

    it("ログアウトせずに期限が切れたセッションの記録も、1 日 1 回消すと書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText(/records of sessions that expired without logging out are deleted once a day/)).toBeInTheDocument();
    });
  });
});
