import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import type { JobId } from "../data/job-registry";
import { skillName } from "../logic/display-names";
import { toMintLeafText } from "../logic/mint-leaf-export";
import type { ResolvedTimelineEntry, Skill } from "../types/skill";
import "./mint-leaf-export-dialog.css";

const MINT_LEAF_URL = "https://mint-leaf.thebalanceffxiv.com/";

interface MintLeafExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** 閉じたときにフォーカスを戻す要素（開いたボタン） */
  returnFocusRef: RefObject<HTMLElement | null>;
  jobId: JobId;
  entries: ResolvedTimelineEntry[];
  skillMap: Map<string, Skill>;
}

export function MintLeafExportDialog({ open, onClose, returnFocusRef, jobId, entries, skillMap }: MintLeafExportDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const textId = useId();
  const { text, skippedSkillIds } = useMemo(() => toMintLeafText(entries, skillMap), [entries, skillMap]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      setCopyState("idle");
      dialog.close();
      // モーダル中は外側の要素にフォーカスできないため、close() の後で戻す
      returnFocusRef.current?.focus();
    }
  }, [open, returnFocusRef]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      if (!dialogRef.current?.open) return;
      setCopyState("copied");
    } catch {
      if (!dialogRef.current?.open) return;
      // http のページや権限が無いときはクリップボードが使えないので、選択して手でコピーしてもらう
      setCopyState("failed");
      textRef.current?.focus();
      textRef.current?.select();
    }
  };

  const canCopy = text !== "";

  return (
    <dialog
      ref={dialogRef}
      className="mint-leaf-export-dialog"
      aria-labelledby="mint-leaf-export-dialog-title"
      style={styles.dialog}
      onCancel={(e) => {
        // Esc はブラウザに閉じさせず、open state 経由で閉じる（state と DOM の open を一致させるため）
        e.preventDefault();
        onClose();
      }}
      // SkillDetailPanel は document で Esc / 外側クリックを拾って閉じるため、ダイアログ内の操作を document に伝播させない
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={styles.header}>
        <h2 id="mint-leaf-export-dialog-title" style={styles.title}>
          {t("mintLeafExportDialog.title")}
        </h2>
        <button type="button" aria-label={t("mintLeafExportDialog.close")} onClick={onClose} style={styles.iconButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div style={styles.body}>
        <p style={styles.text}>
          {t("mintLeafExportDialog.introBeforeLink")}
          <a href={MINT_LEAF_URL} target="_blank" rel="noopener noreferrer" style={styles.link}>
            Mint Leaf
          </a>
          {t("mintLeafExportDialog.introAfterLink")}
        </p>
        <ul style={styles.notes}>
          <li>{t("mintLeafExportDialog.headerNote")}</li>
          <li>{t("mintLeafExportDialog.scopeNote")}</li>
        </ul>
        <div style={styles.field}>
          <label htmlFor={textId} style={styles.label}>
            {t("mintLeafExportDialog.textLabel")}
          </label>
          <textarea
            ref={textRef}
            id={textId}
            value={text}
            readOnly
            rows={8}
            onFocus={(e) => e.currentTarget.select()}
            style={styles.textarea}
          />
        </div>
        {!canCopy && <p style={styles.text}>{t("mintLeafExportDialog.empty")}</p>}
        {skippedSkillIds.length > 0 && (
          <p style={styles.warning}>
            {t("mintLeafExportDialog.skipped", {
              names: skippedSkillIds.map((id) => skillName(t, jobId, id)).join(", "),
            })}
          </p>
        )}
        {copyState === "failed" && (
          <p role="alert" style={styles.error}>
            {t("mintLeafExportDialog.copyFailed")}
          </p>
        )}
      </div>
      <div style={styles.footer}>
        <button type="button" onClick={onClose} style={styles.secondaryButton}>
          {t("mintLeafExportDialog.closeButton")}
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!canCopy}
          style={canCopy ? styles.primaryButton : { ...styles.primaryButton, ...styles.disabledButton }}
        >
          {copyState === "copied" ? t("mintLeafExportDialog.copied") : t("mintLeafExportDialog.copy")}
        </button>
      </div>
    </dialog>
  );
}

const buttonBase: React.CSSProperties = {
  flexShrink: 0,
  minHeight: "36px",
  padding: "0 var(--space-4)",
  borderRadius: "var(--radius-md)",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
};

const styles: Record<string, React.CSSProperties> = {
  dialog: {
    width: "480px",
    maxWidth: "calc(100vw - 32px)",
    padding: 0,
    borderRadius: "12px",
    border: "1px solid var(--color-line)",
    background: "var(--color-surface)",
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
    boxShadow: "0 20px 48px rgba(0, 0, 0, 0.25)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "var(--space-3) var(--space-3) var(--space-3) var(--space-5)",
    borderBottom: "1px solid var(--color-line-soft)",
  },
  title: {
    margin: 0,
    flex: "1 1 auto",
    fontSize: "15px",
    fontWeight: 700,
  },
  iconButton: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "var(--radius-md)",
    background: "transparent",
    color: "var(--color-muted)",
    cursor: "pointer",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
    padding: "var(--space-5)",
  },
  text: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.6,
  },
  link: {
    color: "inherit",
    textDecoration: "underline",
  },
  notes: {
    margin: 0,
    paddingLeft: "var(--space-5)",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "var(--color-muted)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
  },
  textarea: {
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    lineHeight: 1.5,
    resize: "vertical",
  },
  warning: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.6,
    color: "var(--color-warning)",
  },
  error: {
    margin: 0,
    fontSize: "13px",
    color: "var(--color-error)",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "var(--space-2)",
    padding: "var(--space-3) var(--space-5)",
    borderTop: "1px solid var(--color-line-soft)",
  },
  primaryButton: {
    ...buttonBase,
    border: "none",
    background: "var(--color-text)",
    color: "var(--color-bg)",
  },
  disabledButton: {
    opacity: 0.5,
    cursor: "default",
  },
  secondaryButton: {
    ...buttonBase,
    border: "1px solid var(--color-field)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
  },
};
