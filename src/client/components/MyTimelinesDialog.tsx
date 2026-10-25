import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { JOB_CATALOG } from "../data/job-catalog";
import { MY_TIMELINES_ERROR_MESSAGE, fetchMyTimelines, type MyTimelineItem } from "../logic/my-timelines";
import { buildShareUrl } from "../logic/shared-timeline";
import "./my-timelines-dialog.css";

interface MyTimelinesDialogProps {
  open: boolean;
  onClose: () => void;
  /** 閉じたときにフォーカスを戻す要素（開いたボタン） */
  returnFocusRef: RefObject<HTMLElement | null>;
}

function jobName(job: string): string {
  return JOB_CATALOG.find((j) => j.id === job)?.name ?? job;
}

export function MyTimelinesDialog({ open, onClose, returnFocusRef }: MyTimelinesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 取得中の一覧。閉じたときに中断する
  const loadControllerRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // 「もっと見る」で足した先頭の行の id。最後のページでは押したボタンが消えてフォーカスが外れるので、足した行へ移す
  const focusIdRef = useRef<string | null>(null);
  // 1 ページ目を読み込むまでは null
  const [items, setItems] = useState<MyTimelineItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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
      setItems(null);
      setNextCursor(null);
      setLoading(false);
      setError(false);
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
          保存したタイムライン
        </h2>
        <button type="button" aria-label="保存したタイムラインを閉じる" onClick={onClose} style={styles.iconButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div style={styles.body}>
        <p style={styles.note}>
          このブラウザで保存したタイムラインを、新しい順に表示します。ブラウザのサイトデータを消すと、ここには表示されなくなります（共有 URL からは開けます）。
        </p>
        {items === null ? (
          !error && <p style={styles.text}>読み込み中…</p>
        ) : items.length === 0 ? (
          <p style={styles.text}>このブラウザで保存したタイムラインはありません。</p>
        ) : (
          <ul ref={listRef} style={styles.list}>
            {items.map((item) => (
              <li key={item.id}>
                {/* ページを移動して共有 URL の読み込み（作業中の置き換えの確認を含む）に任せる。リンクなので新しいタブでも開ける */}
                <a href={buildShareUrl(window.location.origin, item.id)} data-timeline-id={item.id} style={styles.link}>
                  <span style={styles.itemTitle}>{item.title ?? "（無題）"}</span>
                  <span style={styles.itemMeta}>
                    {jobName(item.job)} Lv{item.level}・
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" style={styles.error}>
            {MY_TIMELINES_ERROR_MESSAGE}
          </p>
        )}
      </div>
      <div style={styles.footer}>
        {nextCursor !== null && (
          <button type="button" onClick={() => void load(nextCursor)} disabled={loading} style={styles.secondaryButton}>
            {loading ? "読み込み中…" : "もっと見る"}
          </button>
        )}
        <button type="button" onClick={onClose} style={styles.primaryButton}>
          閉じる
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
  link: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
    padding: "var(--space-3)",
    border: "1px solid var(--color-line-soft)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
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
};
