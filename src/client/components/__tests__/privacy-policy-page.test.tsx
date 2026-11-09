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

const articleHeadings = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

describe("PrivacyPolicyPage", () => {
  it("日本語の見出しと <title> を出し、トップへリンクする", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("プライバシーポリシー");
    expect(document.title).toBe("プライバシーポリシー | FF14 Rotation Calculator");
    expect(screen.getByRole("link", { name: "FF14 Rotation Calculator" })).toHaveAttribute("href", "/");
  });

  // 番号は ARTICLES の並びから振るので、JSX の節の順番とずれると番号と見出しが食い違う（#992）
  it("見出しに、条の並びの順に第1条から番号を振る", () => {
    render(<PrivacyPolicyPage />);
    expect(articleHeadings()).toEqual([
      "第1条（サーバーに保存する情報）",
      "第2条（アクセスログ）",
      "第3条（ブラウザ内にのみ保存する情報）",
      "第4条（利用目的）",
      "第5条（外部サービスの利用）",
      "第6条（Cookie）",
      "第7条（保存期間）",
      "第8条（削除の依頼）",
      "第9条（お問い合わせ窓口）",
      "第10条（本ポリシーの改定）",
    ]);
  });

  it("前文で、個人の開発者を運営者と定義している", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(/^個人の開発者である Sakuya398-Yamada（以下「運営者」という。）は、/)).toBeInTheDocument();
  });

  it("制定日と最終改定日を並べて出す", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText("制定日: 2026年11月6日")).toBeInTheDocument();
    expect(screen.getByText(/^最終改定日: \d{4}年\d{1,2}月\d{1,2}日$/)).toBeInTheDocument();
  });

  it("保存期間の条から、削除の依頼の条を番号で指す", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(/データの完全な消去を希望する場合は、第8条に定める方法により依頼すること。/)).toBeInTheDocument();
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
    expect(screen.getByText("Discord のユーザー ID から生成した値")).toBeInTheDocument();
    expect(screen.getByText(/ユーザー ID もそのままは保存せず、運営者のみが保有する鍵で HMAC-SHA256 にかけた値を保存する/)).toBeInTheDocument();
  });

  // Cron Trigger で 1 日 1 回消す（src/server/index.ts の scheduled。#919）
  it("ログアウトせずに期限が切れたセッションの記録も、1 日 1 回消すと書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText(/ログアウトせずに失効したものも 1 日 1 回まとめて消去する/)).toBeInTheDocument();
  });

  // wrangler.jsonc の observability（呼び出しごとの記録を残し、クエリ文字列を伏せる）と、本番のログで確かめた項目（#976）
  it("アクセスの記録として、IP アドレス・位置・ブラウザの情報を Workers Logs に保存すると書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole("heading", { level: 2, name: "第2条（アクセスログ）" })).toBeInTheDocument();
    expect(
      screen.getByText(/次の記録（以下「アクセスログ」という。）を Cloudflare（Workers Logs）に保存する。日時、URL、IP アドレス、IP アドレスから推定した位置（国・地域・市区町村・郵便番号・緯度経度）及び回線の事業者、ブラウザの情報（User-Agent・言語・参照元のページ）、通信の暗号化（TLS）の情報/)
    ).toBeInTheDocument();
    expect(screen.getByText(/ログイン並びに本ツールの動作の確認及び障害の調査のためにのみ利用する/)).toBeInTheDocument();
  });

  it("アクセスの記録に Cookie の値は残さず、共有 URL の ID とクエリ文字列は伏せると書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText("アクセスログには Cookie の値を記録しない。共有 URL に含まれるタイムラインの ID 及び URL のクエリ文字列は、伏せた上で保存する。")
    ).toBeInTheDocument();
  });

  it("アクセスの記録は最長 7 日で消え、削除の依頼を受けても期間が過ぎるまで残ると書いている", () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText(/アクセスログは、最長 7 日で Cloudflare により自動で消去される。アクセスログを 1 件ずつ消去することはできないため、削除の依頼を受けた場合も、この期間が経過するまで残る/)
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

    it("見出しに、条の並びの順に 1. から番号を振る", () => {
      render(<PrivacyPolicyPage />);
      expect(articleHeadings()).toEqual([
        "1. Information we store",
        "2. Access logs",
        "3. Information kept only in your browser",
        "4. How we use information",
        "5. Third-party services",
        "6. Cookies",
        "7. Data retention",
        "8. Deletion requests",
        "9. Contact us",
        "10. Changes to this policy",
      ]);
    });

    it("前文で、個人の開発者を we と定義している", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText(/describes how Sakuya398-Yamada, an individual developer \("we", "us" or "our"\),/)).toBeInTheDocument();
    });

    it("制定日と最終改定日を並べて出す", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText("First published: November 6, 2026")).toBeInTheDocument();
      expect(screen.getByText(/^Last updated: [A-Z][a-z]+ \d{1,2}, \d{4}$/)).toBeInTheDocument();
    });

    it("保存期間の条から、削除の依頼の条を番号で指す", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText(/To have it erased completely, send a request as described in Section 8\./)).toBeInTheDocument();
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
      expect(screen.getByText(/We do not store your user ID itself either: we store its HMAC-SHA256/)).toBeInTheDocument();
    });

    it("ログアウトせずに期限が切れたセッションの記録も、1 日 1 回消すと書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByText(/we delete the records of sessions that expired without logging out once a day/)).toBeInTheDocument();
    });

    it("アクセスの記録として、IP アドレス・位置・ブラウザの情報を Workers Logs に保存すると書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(screen.getByRole("heading", { level: 2, name: "2. Access logs" })).toBeInTheDocument();
      expect(
        screen.getByText(/we record the following information \("access logs"\) in Cloudflare \(Workers Logs\) for each request that reaches the Service's server \(Cloudflare Workers\): the date and time, the URL, your IP address, the location estimated from your IP address \(country, region, city, postal code and latitude\/longitude\) and your network provider, your browser information \(user agent, language and referring page\), the encryption \(TLS\) details of the connection/)
      ).toBeInTheDocument();
      expect(screen.getByText(/to log you in, and to check that the Service works and investigate failures/)).toBeInTheDocument();
    });

    it("アクセスの記録に Cookie の値は残さず、共有 URL の ID とクエリ文字列は伏せると書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(
        screen.getByText("We do not record cookie values in access logs. We hide the timeline IDs in share URLs and the query strings of URLs before storing the records.")
      ).toBeInTheDocument();
    });

    it("アクセスの記録は最長 7 日で消え、削除の依頼を受けても期間が過ぎるまで残ると書いている", () => {
      render(<PrivacyPolicyPage />);
      expect(
        screen.getByText(/Cloudflare deletes access logs automatically after at most 7 days\. They cannot be deleted one by one, so they remain until then even if you request deletion/)
      ).toBeInTheDocument();
    });
  });
});
