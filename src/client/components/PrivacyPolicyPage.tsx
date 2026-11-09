import { useEffect, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n";
import { languageBasePath, privacyPolicyPath } from "../logic/language-path";
import { SettingsButton } from "./SettingsButton";

const OPERATOR_NAME = "Sakuya398-Yamada";
// 削除の依頼を受ける Discord のアカウント（DM の送り主の ID で、削除する Discord ID の持ち主か確かめられる。#879）
const DISCORD_CONTACT = "sakuyuno";
const ISSUES_URL = "https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues";

// 文面の決まり（#992）。ほかのページのやさしい言い回し（「このツール」「消します」）に戻さない
// - 日本語はである調。前文で定義した語（運営者・本ツール・利用者・本ポリシー）と、アクセスログの条で定義した「アクセスログ」を使う
// - 用語: 使い道 → 利用目的、使う → 利用する（情報・外部サービス）／使用する（Cookie）、期限が切れる → 失効する、
//   渡る → 送信される、と → 及び、〜してください → 〜すること／〜ものとする
// - サーバー上のデータを消すのは「消去」、利用者が本ツールでする削除と Cookie を消すのは「削除」
//   （本ツールで削除してもデータは残るので、言い分ける。手続きの名前の「削除の依頼」はそのまま）
// - 英語は we（運営者）・you（利用者）・the Service（本ツール）・this Policy を使う
// - 見出しの番号は ARTICLES の並びから振る。条を足すときは ARTICLES と下の JSX に同じ順で足す。
//   本文から条を指すときは、番号を文面に書かず articleReference で入れる
// 文面を変えたら最終改定日を書き換える（制定日は変えない）
const ESTABLISHED_ON = new Date(Date.UTC(2026, 10, 6));
const LAST_REVISED_ON = new Date(Date.UTC(2026, 10, 9));

const ARTICLES = [
  "stored",
  "accessLogs",
  "browserStorage",
  "use",
  "external",
  "cookies",
  "retention",
  "deletion",
  "contact",
  "changes",
] as const;
type ArticleId = (typeof ARTICLES)[number];

const STORED_ITEMS = ["timelines", "ownerHash", "discordId", "accountLink", "sessions"] as const;

// 名前はサーバーの setCookie（src/server/routes/owner-cookie.ts・auth.ts）に揃える。prefix: "host" で __Host- が付く
const COOKIES = [
  { name: "__Host-owner", id: "owner" },
  { name: "__Host-session", id: "session" },
  { name: "__Host-discord_oauth", id: "discordOauth" },
] as const;

const EXTERNAL_SERVICES = [
  { id: "cloudflare", policyUrl: "https://www.cloudflare.com/privacypolicy/" },
  { id: "turnstile", policyUrl: "https://www.cloudflare.com/turnstile-privacy-policy/" },
  { id: "discord", policyUrl: "https://discord.com/privacy" },
  { id: "googleFonts", policyUrl: "https://policies.google.com/privacy" },
] as const;

const DELETION_TARGETS = ["account", "anonymous"] as const;

const RETENTION_ITEMS = ["timelines", "account", "sessions", "backup", "accessLogs"] as const;

export function PrivacyPolicyPage() {
  const { t } = useTranslation();
  const lang = useLanguage();
  const otherLang = lang === "en" ? "ja" : "en";

  useEffect(() => {
    document.title = t("privacyPolicyPage.documentTitle");
  }, [t]);

  const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" });
  const articleNumber = (id: ArticleId) => ARTICLES.indexOf(id) + 1;
  const articleHeading = (id: ArticleId) => (
    <h2 style={styles.heading}>
      {t("privacyPolicyPage.articleHeading", {
        number: articleNumber(id),
        title: t(`privacyPolicyPage.${id}.heading` as const),
      })}
    </h2>
  );
  const deletionArticle = t("privacyPolicyPage.articleReference", { number: articleNumber("deletion") });

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <a href={languageBasePath(lang)} style={styles.siteName}>
          {t("privacyPolicyPage.siteName")}
        </a>
        <SettingsButton languageHref={privacyPolicyPath(otherLang)} />
      </header>
      <main style={styles.main}>
        <h1 style={styles.title}>{t("privacyPolicyPage.title")}</h1>
        <p>{t("privacyPolicyPage.intro", { name: OPERATOR_NAME })}</p>
        <p style={styles.muted}>
          <span>{t("privacyPolicyPage.establishedOn", { date: dateFormat.format(ESTABLISHED_ON) })}</span>
          <br />
          <span>{t("privacyPolicyPage.lastRevisedOn", { date: dateFormat.format(LAST_REVISED_ON) })}</span>
        </p>

        <section>
          {articleHeading("stored")}
          <p>{t("privacyPolicyPage.stored.intro")}</p>
          <dl>
            {STORED_ITEMS.map((id) => (
              <div key={id}>
                <dt style={styles.term}>{t(`privacyPolicyPage.stored.${id}Label` as const)}</dt>
                <dd style={styles.description}>{t(`privacyPolicyPage.stored.${id}` as const)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* wrangler.jsonc の observability と、本番のログで確かめた項目に揃える（#976） */}
        <section>
          {articleHeading("accessLogs")}
          <p>{t("privacyPolicyPage.accessLogs.body")}</p>
          <p>{t("privacyPolicyPage.accessLogs.redacted")}</p>
        </section>

        <section>
          {articleHeading("browserStorage")}
          <p>{t("privacyPolicyPage.browserStorage.body")}</p>
        </section>

        <section>
          {articleHeading("use")}
          <p>{t("privacyPolicyPage.use.body")}</p>
        </section>

        <section>
          {articleHeading("external")}
          <dl>
            {EXTERNAL_SERVICES.map(({ id, policyUrl }) => (
              <div key={id}>
                <dt style={styles.term}>{t(`privacyPolicyPage.external.${id}Label` as const)}</dt>
                <dd style={styles.description}>
                  {t(`privacyPolicyPage.external.${id}` as const)}{" "}
                  <a href={policyUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {t(`privacyPolicyPage.external.${id}Policy` as const)}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          {articleHeading("cookies")}
          <p>{t("privacyPolicyPage.cookies.intro")}</p>
          <dl>
            {COOKIES.map(({ name, id }) => (
              <div key={id}>
                <dt style={styles.term}>
                  <code style={styles.code}>{name}</code>
                </dt>
                <dd style={styles.description}>{t(`privacyPolicyPage.cookies.${id}` as const)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          {articleHeading("retention")}
          <ul style={styles.list}>
            {RETENTION_ITEMS.map((id) => (
              <li key={id}>{t(`privacyPolicyPage.retention.${id}` as const, { deletionArticle })}</li>
            ))}
          </ul>
        </section>

        <section>
          {articleHeading("deletion")}
          <p>{t("privacyPolicyPage.deletion.how", { discord: DISCORD_CONTACT })}</p>
          <dl>
            {DELETION_TARGETS.map((id) => (
              <div key={id}>
                <dt style={styles.term}>{t(`privacyPolicyPage.deletion.${id}Label` as const)}</dt>
                <dd style={styles.description}>{t(`privacyPolicyPage.deletion.${id}` as const)}</dd>
              </div>
            ))}
          </dl>
          <p>{t("privacyPolicyPage.deletion.copies")}</p>
        </section>

        <section>
          {articleHeading("contact")}
          <p>
            {t("privacyPolicyPage.contact.body")}{" "}
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {t("privacyPolicyPage.contact.issuesLink")}
            </a>
          </p>
        </section>

        <section>
          {articleHeading("changes")}
          <p>{t("privacyPolicyPage.changes.body")}</p>
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-2) var(--space-4)",
    padding: "var(--space-3) var(--space-4)",
    backgroundColor: "var(--color-surface)",
    borderBottom: "1px solid var(--color-line)",
  },
  siteName: {
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: "var(--color-text)",
    textDecoration: "none",
  },
  main: {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "var(--space-5) var(--space-4) var(--space-6)",
    fontSize: "14px",
    lineHeight: 1.8,
  },
  title: {
    margin: "0 0 var(--space-3)",
    fontSize: "24px",
  },
  heading: {
    margin: "var(--space-6) 0 var(--space-2)",
    paddingBottom: "var(--space-1)",
    fontSize: "17px",
    borderBottom: "1px solid var(--color-line)",
  },
  muted: {
    color: "var(--color-muted)",
    fontSize: "13px",
  },
  term: {
    fontWeight: 700,
    marginTop: "var(--space-3)",
  },
  description: {
    margin: 0,
  },
  code: {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
  },
  list: {
    paddingLeft: "var(--space-5)",
  },
  link: {
    color: "var(--color-accent)",
  },
} satisfies Record<string, CSSProperties>;
