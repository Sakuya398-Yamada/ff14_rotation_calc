import { useEffect, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n";
import { languageBasePath, privacyPolicyPath } from "../logic/language-path";
import { SettingsButton } from "./SettingsButton";

const OPERATOR_NAME = "Sakuya398-Yamada";
// 削除の依頼を受ける Discord のアカウント（DM の送り主の ID で、削除する Discord ID の持ち主か確かめられる。#879）
const DISCORD_CONTACT = "sakuyuno";
const ISSUES_URL = "https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues";
// 施行日。内容を変えたら書き換える
const ENACTED_ON = new Date(Date.UTC(2026, 10, 9));

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

  const enactedOn = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(ENACTED_ON);

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
        <p>{t("privacyPolicyPage.intro")}</p>
        <p style={styles.muted}>{t("privacyPolicyPage.enactedOn", { date: enactedOn })}</p>

        <section>
          <h2 style={styles.heading}>{t("privacyPolicyPage.operator.heading")}</h2>
          <p>{t("privacyPolicyPage.operator.body", { name: OPERATOR_NAME })}</p>
        </section>

        <section>
          <h2 style={styles.heading}>{t("privacyPolicyPage.stored.heading")}</h2>
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
          <h2 style={styles.heading}>{t("privacyPolicyPage.accessLogs.heading")}</h2>
          <p>{t("privacyPolicyPage.accessLogs.body")}</p>
          <p>{t("privacyPolicyPage.accessLogs.redacted")}</p>
        </section>

        <section>
          <h2 style={styles.heading}>{t("privacyPolicyPage.cookies.heading")}</h2>
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
          <h2 style={styles.heading}>{t("privacyPolicyPage.browserStorage.heading")}</h2>
          <p>{t("privacyPolicyPage.browserStorage.body")}</p>
        </section>

        <section>
          <h2 style={styles.heading}>{t("privacyPolicyPage.external.heading")}</h2>
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
          <h2 style={styles.heading}>{t("privacyPolicyPage.use.heading")}</h2>
          <p>{t("privacyPolicyPage.use.body")}</p>
        </section>

        <section>
          <h2 style={styles.heading}>{t("privacyPolicyPage.retention.heading")}</h2>
          <ul style={styles.list}>
            {RETENTION_ITEMS.map((id) => (
              <li key={id}>{t(`privacyPolicyPage.retention.${id}` as const)}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 style={styles.heading}>{t("privacyPolicyPage.deletion.heading")}</h2>
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
          <h2 style={styles.heading}>{t("privacyPolicyPage.contact.heading")}</h2>
          <p>
            {t("privacyPolicyPage.contact.body")}{" "}
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {t("privacyPolicyPage.contact.issuesLink")}
            </a>
          </p>
        </section>

        <section>
          <h2 style={styles.heading}>{t("privacyPolicyPage.changes.heading")}</h2>
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
