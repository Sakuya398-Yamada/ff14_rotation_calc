import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { CONTENT_CATALOG, CONTENT_CATEGORIES } from "../data/content-catalog";
import {
  MAX_TITLE_LENGTH,
  SAVE_ERROR_MESSAGES,
  buildShareUrl,
  saveTimeline,
  type SaveError,
} from "../logic/shared-timeline";
import type { AppStateSnapshot } from "../logic/timeline-storage";
import "./save-timeline-dialog.css";

interface SaveTimelineDialogProps {
  open: boolean;
  snapshot: AppStateSnapshot;
  /** 複製元のタイムラインの ID（無ければ null） */
  parentId: string | null;
  /** 保存できたら、保存したタイムラインの ID を渡す */
  onSaved: (id: string) => void;
  onClose: () => void;
  /** 閉じたときにフォーカスを戻す要素（開いたボタン） */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function SaveTimelineDialog({ open, snapshot, parentId, onSaved, onClose, returnFocusRef }: SaveTimelineDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  // 送信中の保存。閉じたときに中断する
  const saveControllerRef = useRef<AbortController | null>(null);
  const [title, setTitle] = useState("");
  // "" は指定なし
  const [contentId, setContentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const titleId = useId();
  const contentFieldId = useId();
  const urlId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      titleInputRef.current?.focus();
    } else if (!open && dialog.open) {
      saveControllerRef.current?.abort();
      saveControllerRef.current = null;
      // 次に開いたときは入力から始める（タイトルとコンテンツは残す）。閉じている間に戻すので、開いた時点で入力欄にフォーカスできる
      setSaving(false);
      setError(null);
      setShareUrl(null);
      setCopyState("idle");
      dialog.close();
      // モーダル中は外側の要素にフォーカスできないため、close() の後で戻す
      returnFocusRef.current?.focus();
    }
  }, [open, returnFocusRef]);

  // 保存ボタンが消えてフォーカスを失うので、次に押すコピーボタンへ移す。
  // useEffect だと DOM の更新より後のタスクで走り、その間フォーカスが body に外れる
  useLayoutEffect(() => {
    if (shareUrl !== null) copyButtonRef.current?.focus();
  }, [shareUrl]);

  const handleSave = async () => {
    const controller = new AbortController();
    saveControllerRef.current = controller;
    setSaving(true);
    setError(null);
    const outcome = await saveTimeline(
      { state: snapshot, title, parentId, contentId: contentId || null },
      { signal: controller.signal }
    );
    // 閉じて中断された保存の結果は捨てる（状態は閉じたときに戻してある）
    if (controller.signal.aborted) return;
    saveControllerRef.current = null;
    setSaving(false);
    if (outcome.kind === "saved") {
      setShareUrl(buildShareUrl(window.location.origin, outcome.id));
      onSaved(outcome.id);
    } else if (outcome.kind === "error") {
      setError(outcome.error);
    }
  };

  const handleCopy = async () => {
    if (shareUrl === null) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
    } catch {
      // http のページや権限が無いときはクリップボードが使えないので、選択して手でコピーしてもらう
      setCopyState("failed");
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="save-timeline-dialog"
      aria-labelledby="save-timeline-dialog-title"
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
        <h2 id="save-timeline-dialog-title" style={styles.title}>
          タイムラインを保存して共有
        </h2>
        <button type="button" aria-label="保存・共有を閉じる" onClick={onClose} style={styles.iconButton}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      {shareUrl === null ? (
        <>
          {/* form にしないのは、IME の変換確定の Enter で、書き換えられない行を書きかけのタイトルで保存しないため */}
          <div style={styles.body}>
            <p style={styles.text}>
              保存すると共有 URL を発行します。URL を知っている人は誰でも、このタイムラインを開けます。
            </p>
            <div style={styles.field}>
              <label htmlFor={titleId} style={styles.label}>
                タイトル（任意）
              </label>
              <input
                ref={titleInputRef}
                id={titleId}
                type="text"
                value={title}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(e) => setTitle(e.target.value)}
                style={styles.input}
              />
              <span style={styles.note}>
                {MAX_TITLE_LENGTH} 文字まで。タイトルとタイムラインの内容は、保存後は変更できません（編集して保存し直すと、別の URL になります）
              </span>
            </div>
            <div style={styles.field}>
              <label htmlFor={contentFieldId} style={styles.label}>
                コンテンツ（任意）
              </label>
              <select
                id={contentFieldId}
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
                style={styles.input}
              >
                <option value="">指定なし</option>
                {CONTENT_CATEGORIES.map((category) => (
                  <optgroup key={category.id} label={category.label}>
                    {CONTENT_CATALOG.filter((c) => c.category === category.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {error !== null && (
              <p role="alert" style={styles.error}>
                {SAVE_ERROR_MESSAGES[error]}
              </p>
            )}
          </div>
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.secondaryButton}>
              閉じる
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} style={styles.primaryButton}>
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={styles.body}>
            <p role="status" style={styles.text}>
              保存しました。この URL で、保存したタイムラインを開けます。
            </p>
            <div style={styles.field}>
              <label htmlFor={urlId} style={styles.label}>
                共有 URL
              </label>
              <div style={styles.urlRow}>
                <input
                  ref={urlInputRef}
                  id={urlId}
                  type="text"
                  value={shareUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  style={styles.input}
                />
                <button ref={copyButtonRef} type="button" onClick={() => void handleCopy()} style={styles.secondaryButton}>
                  {copyState === "copied" ? "コピーしました" : "コピー"}
                </button>
              </div>
            </div>
            {copyState === "failed" && (
              <p role="alert" style={styles.error}>
                コピーできませんでした。URL を選択してコピーしてください。
              </p>
            )}
          </div>
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.primaryButton}>
              閉じる
            </button>
          </div>
        </>
      )}
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
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
  },
  input: {
    flex: "1 1 auto",
    minWidth: 0,
    height: "40px",
    padding: "0 var(--space-3)",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    fontSize: "13px",
  },
  note: {
    fontSize: "11px",
    lineHeight: 1.5,
    color: "var(--color-muted)",
  },
  urlRow: {
    display: "flex",
    gap: "var(--space-2)",
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
