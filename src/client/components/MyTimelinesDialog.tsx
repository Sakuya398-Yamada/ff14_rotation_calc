import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import { useLanguage } from "../i18n";
import { deleteMyTimeline, fetchMyTimelines, type DeleteMyTimelineError, type MyTimelineItem } from "../logic/my-timelines";
import { buildShareUrl } from "../logic/shared-timeline";
import { jobName } from "../logic/display-names";
import "./my-timelines-dialog.css";

interface MyTimelinesDialogProps {
  open: boolean;
  onClose: () => void;
  /** 閉じたときにフォーカスを戻す要素（開いたボタン） */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function MyTimelinesDialog({ open, onClose, returnFocusRef }: MyTimelinesDialogProps) {
  const { t } = useTranslation();
  const lang = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 取得中の一覧。閉じたときに中断する
  const loadControllerRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // 送信中の削除。閉じたときに中断する
  const deleteControllerRef = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // 削除に失敗した行の id。削除中はボタンを無効にするので、ブラウザがフォーカスを外す。押せるようになってから戻す
  const refocusDeleteIdRef = useRef<string | null>(null);
  // 「もっと見る」で足した先頭の行の id。最後のページでは押したボタンが消えてフォーカスが外れるので、足した行へ移す
  const focusIdRef = useRef<string | null>(null);
  // 1 ページ目を読み込むまでは null
  const [items, setItems] = useState<MyTimelineItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // 削除の送信中の行の id。送信中は、ほかの行も削除させない
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<DeleteMyTimelineError | null>(null);
  // 最後にコピーを試した行とその結果。表示するのはその 1 行分だけ
  const [copyState, setCopyState] = useState<{ id: string; status: "copied" | "failed" } | null>(null);
  const copyFallbackInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (cursor: string | null) => {
    const controller = new AbortController();
    loadControllerRef.current = controller;
    setLoading(true);
    setError(false);
    const outcome = await fetchMyTimelines(cursor, { signal: controller.signal });
    // 閉じて中断された取得の結果は捨てる（状態は閉じたときに戻してある）
    if (controller.signal.aborted) return;
    loadControllerRef.current = null;
    setLoading(false);
    if (outcome.kind === "loaded") {
      if (cursor !== null) focusIdRef.current = outcome.items[0]?.id ?? null;
      setItems((prev) => (cursor === null || prev === null ? outcome.items : [...prev, ...outcome.items]));
      setNextCursor(outcome.nextCursor);
    } else if (outcome.kind === "error") {
      setError(true);
    }
  }, []);

  const handleDelete = async (item: MyTimelineItem) => {
    if (!window.confirm(t("myTimelinesDialog.confirmDelete", { title: item.title ?? t("myTimelinesDialog.untitled") }))) return;
    const controller = new AbortController();
    deleteControllerRef.current = controller;
    setDeletingId(item.id);
    setDeleteError(null);
    const outcome = await deleteMyTimeline(item.id, { signal: controller.signal });
    // 閉じて中断された削除の結果は捨てる（状態は閉じたときに戻してある）
    if (controller.signal.aborted) return;
    deleteControllerRef.current = null;
    setDeletingId(null);
    if (outcome.kind === "error") {
      refocusDeleteIdRef.current = item.id;
      setDeleteError(outcome.error);
      return;
    }
    if (outcome.kind !== "deleted" || items === null) return;
    // 押したボタンは行ごと消えるので、次の行（無ければ前の行）へ、行が無くなれば閉じるボタンへフォーカスを移す
    const index = items.findIndex((i) => i.id === item.id);
    const neighbor = items[index + 1] ?? items[index - 1];
    if (neighbor) focusIdRef.current = neighbor.id;
    else closeButtonRef.current?.focus();
    setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
  };

  const handleCopy = async (item: MyTimelineItem) => {
    let status: "copied" | "failed";
    try {
      await navigator.clipboard.writeText(buildShareUrl(window.location.origin, item.id, lang));
      status = "copied";
    } catch {
      // http のページや権限が無いときはクリップボードが使えないので、URL を出して手でコピーしてもらう
      status = "failed";
    }
    // 書き込みを待つ間に閉じたら、結果を出さない（状態は閉じたときに戻してある）
    if (!dialogRef.current?.open) return;
    setCopyState({ id: item.id, status });
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // 開くたびに取り直す（前に開いてから保存したものも出す）
      void load(null);
    } else if (!open && dialog.open) {
      loadControllerRef.current?.abort();
      loadControllerRef.current = null;
      deleteControllerRef.current?.abort();
      deleteControllerRef.current = null;
      setItems(null);
      setNextCursor(null);
      setLoading(false);
      setError(false);
      setDeletingId(null);
      setDeleteError(null);
      setCopyState(null);
      dialog.close();
      // モーダル中は外側の要素にフォーカスできないため、close() の後で戻す
      returnFocusRef.current?.focus();
    }
  }, [open, returnFocusRef, load]);

  // useEffect だと DOM の更新より後のタスクで走り、その間フォーカスが body に外れる
  useLayoutEffect(() => {
    const id = focusIdRef.current;
    if (id === null) return;
    focusIdRef.current = null;
    listRef.current?.querySelector<HTMLElement>(`a[data-timeline-id="${id}"]`)?.focus();
  }, [items]);

  useLayoutEffect(() => {
    const id = refocusDeleteIdRef.current;
    if (id === null || deletingId !== null) return;
    refocusDeleteIdRef.current = null;
    listRef.current?.querySelector<HTMLElement>(`button[data-delete-id="${id}"]`)?.focus();
  }, [deletingId]);

  // 失敗したときに出す URL の欄は、出してからでないとフォーカスできない
  useLayoutEffect(() => {
    if (copyState?.status !== "failed") return;
    copyFallbackInputRef.current?.focus();
    copyFallbackInputRef.current?.select();
  }, [copyState]);

  // コピーに失敗した行。削除して一覧から消えたら、URL の欄も出さない
  const copyFailedItem = copyState?.status === "failed" ? items?.find((i) => i.id === copyState.id) : undefined;

  return (
    <dialog
      ref={dialogRef}
      className="my-timelines-dialog"
      aria-labelledby="my-timelines-dialog-title"
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
        <h2 id="my-timelines-dialog-title" style={styles.title}>
          {t("myTimelinesDialog.title")}
        </h2>
        <button type="button" aria-label={t("myTimelinesDialog.close")} onClick={onClose} style={styles.iconButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div style={styles.body}>
        <p style={styles.note}>
          {t("myTimelinesDialog.intro")}
        </p>
        {items === null ? (
          !error && <p style={styles.text}>{t("myTimelinesDialog.loading")}</p>
        ) : items.length === 0 ? (
          <p style={styles.text}>{t("myTimelinesDialog.empty")}</p>
        ) : (
          <ul ref={listRef} style={styles.list}>
            {items.map((item) => (
              <li key={item.id} style={styles.item}>
                {/* ページを移動して共有 URL の読み込み（作業中の置き換えの確認を含む）に任せる。リンクなので新しいタブでも開ける */}
                <a href={buildShareUrl(window.location.origin, item.id, lang)} data-timeline-id={item.id} style={styles.link}>
                  <span style={styles.itemTitle}>{item.title ?? t("myTimelinesDialog.untitled")}</span>
                  <span style={styles.itemMeta}>
                    {t("myTimelinesDialog.jobLevel", { job: jobName(t, item.job), level: item.level })}
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </span>
                </a>
                <button
                  type="button"
                  aria-label={t(
                    copyState?.id === item.id && copyState.status === "copied"
                      ? "myTimelinesDialog.copiedLabel"
                      : "myTimelinesDialog.copyLabel",
                    { title: item.title ?? t("myTimelinesDialog.untitled") }
                  )}
                  onClick={() => void handleCopy(item)}
                  style={styles.copyButton}
                >
                  {copyState?.id === item.id && copyState.status === "copied"
                    ? t("myTimelinesDialog.copied")
                    : t("myTimelinesDialog.copy")}
                </button>
                <button
                  type="button"
                  data-delete-id={item.id}
                  aria-label={t("myTimelinesDialog.deleteLabel", { title: item.title ?? t("myTimelinesDialog.untitled") })}
                  onClick={() => void handleDelete(item)}
                  disabled={deletingId !== null}
                  style={styles.deleteButton}
                >
                  {deletingId === item.id ? t("myTimelinesDialog.deleting") : t("myTimelinesDialog.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {copyFailedItem && (
          <>
            <p role="alert" style={styles.error}>
              {t("myTimelinesDialog.copyFailed")}
            </p>
            <input
              ref={copyFallbackInputRef}
              type="text"
              value={buildShareUrl(window.location.origin, copyFailedItem.id, lang)}
              readOnly
              aria-label={t("myTimelinesDialog.shareUrlLabel", { title: copyFailedItem.title ?? t("myTimelinesDialog.untitled") })}
              onFocus={(e) => e.currentTarget.select()}
              style={styles.input}
            />
          </>
        )}
        {error && (
          <p role="alert" style={styles.error}>
            {t("myTimelines.loadError")}
          </p>
        )}
        {deleteError !== null && (
          <p role="alert" style={styles.error}>
            {t(`myTimelinesDialog.deleteErrors.${deleteError}` as const)}
          </p>
        )}
      </div>
      <div style={styles.footer}>
        {nextCursor !== null && (
          <button type="button" onClick={() => void load(nextCursor)} disabled={loading} style={styles.secondaryButton}>
            {loading ? t("myTimelinesDialog.loading") : t("myTimelinesDialog.loadMore")}
          </button>
        )}
        <button ref={closeButtonRef} type="button" onClick={onClose} style={styles.primaryButton}>
          {t("myTimelinesDialog.closeButton")}
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

const rowButtonBase: React.CSSProperties = {
  ...buttonBase,
  minHeight: "32px",
  padding: "0 var(--space-3)",
  border: "1px solid var(--color-field)",
  background: "transparent",
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
  note: {
    margin: 0,
    fontSize: "11px",
    lineHeight: 1.5,
    color: "var(--color-muted)",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    maxHeight: "50vh",
    margin: 0,
    padding: 0,
    overflowY: "auto",
    listStyle: "none",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    paddingRight: "var(--space-3)",
    border: "1px solid var(--color-line-soft)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
  },
  link: {
    flex: "1 1 auto",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    padding: "var(--space-3)",
    borderRadius: "var(--radius-lg)",
    color: "var(--color-text)",
    textDecoration: "none",
  },
  itemTitle: {
    fontSize: "13px",
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
  itemMeta: {
    fontSize: "11px",
    color: "var(--color-muted)",
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
  secondaryButton: {
    ...buttonBase,
    border: "1px solid var(--color-field)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
  },
  input: {
    height: "40px",
    padding: "0 var(--space-3)",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    fontSize: "13px",
  },
  copyButton: {
    ...rowButtonBase,
    color: "var(--color-text)",
  },
  deleteButton: {
    ...rowButtonBase,
    color: "var(--color-error)",
  },
};
