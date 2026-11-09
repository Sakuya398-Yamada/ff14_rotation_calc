// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, beforeAll } from "vitest";
import i18next from "i18next";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PrivacyPolicyPage } from "../PrivacyPolicyPage";
import { loadSettings } from "../../logic/app-settings";

// jsdom は HTMLDialogElement の showModal / close を実装していないため最小限の代替を入れる
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

// サーバーが setCookie する名前（src/server/routes/owner-cookie.ts・auth.ts。prefix: "host" で __Host- が付く）
const COOKIE_NAMES = ["__Host-owner", "__Host-session", "__Host-discord_oauth"];

describe("PrivacyPolicyPage", () => {
  it("日本語の見出しと <title> を出し、トップへリンクする", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("プライバシーポリシー");
    expect(document.title).toBe("プライバシーポリシー | FF14 Rotation Calculator");
    expect(screen.getByRole("link", { name: "FF14 Rotation Calculator" })).toHaveAttribute("href", "/");
  });

  it("ヘッダーに言語のリンクが無く、歯車のボタンで開く設定ダイアログから英語版に移れる", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en/privacy");
  });

  it("設定ダイアログでテーマ・アクセントカラーを変えると、このページに反映され、アプリの画面が読む設定にも保存される", () => {
    render(<PrivacyPolicyPage />);
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(screen.getByLabelText("ライト"));
    fireEvent.click(screen.getByLabelText("緑"));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.accent).toBe("green");
    expect(loadSettings()).toEqual({ theme: "light", accent: "green" });
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

  // wrangler.jsonc の observability（呼び出しごとの記録を残し、クエリ文字列を伏せる）と、本番のログで確かめた項目（#976）
  it("アクセスの記録として、IP アドレス・位置・ブラウザの情報を Workers Logs に保存すると書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { level: 2, name: "アクセスの記録" })).toBeInTheDocument();
    expect(
      screen.getByText(/次の記録を Cloudflare（Workers Logs）に保存します。日時、URL、IP アドレス、IP アドレスから推定した位置（国・地域・市区町村・郵便番号・緯度経度）と回線の事業者、ブラウザの情報（User-Agent・言語・参照元のページ）、通信の暗号化（TLS）の情報/)
    ).toBeInTheDocument();
    expect(screen.getByText(/ログイン、このツールの動作の確認と障害の調査のためだけに使います/)).toBeInTheDocument();
  });

  it("アクセスの記録に Cookie の値は残さず、共有 URL の ID とクエリ文字列は伏せると書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText("Cookie の値は記録しません。共有 URL のタイムラインの ID と、URL のクエリ文字列は、伏せてから保存します。")
    ).toBeInTheDocument();
  });

  it("アクセスの記録は最長 7 日で消え、削除の依頼を受けても期間が過ぎるまで残ると書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText(/アクセスの記録は、最長 7 日で Cloudflare が自動で消します。記録を 1 件ずつ消すことはできないので、削除の依頼を受けても、期間が過ぎるまで残ります/)
    ).toBeInTheDocument();
  });

  describe("英語", () => {
    beforeEach(() => i18next.changeLanguage("en"));
    afterEach(() => i18next.changeLanguage("ja"));

    it("英語の見出しと <title> を出し、トップへリンクする", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy policy");
      expect(document.title).toBe("Privacy policy | FFXIV Rotation Calculator");
      expect(screen.getByRole("link", { name: "FFXIV Rotation Calculator" })).toHaveAttribute("href", "/en/");
    });

    it("ヘッダーに言語のリンクが無く、歯車のボタンで開く設定ダイアログから日本語版に移れる", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.queryByRole("link", { name: "日本語" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute("href", "/privacy");
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

    it("アクセスの記録として、IP アドレス・位置・ブラウザの情報を Workers Logs に保存すると書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByRole("heading", { level: 2, name: "Access logs" })).toBeInTheDocument();
      expect(
        screen.getByText(/is recorded in Cloudflare \(Workers Logs\) for each request that reaches this tool's server \(Cloudflare Workers\): the date and time, the URL, your IP address, the location estimated from your IP address \(country, region, city, postal code and latitude\/longitude\) and your network provider, your browser information \(user agent, language and referring page\), the encryption \(TLS\) details of the connection/)
      ).toBeInTheDocument();
      expect(screen.getByText(/to log you in, and to check that this tool works and investigate failures/)).toBeInTheDocument();
    });

    it("アクセスの記録に Cookie の値は残さず、共有 URL の ID とクエリ文字列は伏せると書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(
        screen.getByText("Cookie values are not recorded. The timeline IDs in share URLs and the query strings of URLs are hidden before the records are stored.")
      ).toBeInTheDocument();
    });

    it("アクセスの記録は最長 7 日で消え、削除の依頼を受けても期間が過ぎるまで残ると書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(
        screen.getByText(/Access logs are deleted automatically by Cloudflare after at most 7 days\. They cannot be deleted one by one, so they remain until then even if you request deletion/)
      ).toBeInTheDocument();
    });
  });
});
