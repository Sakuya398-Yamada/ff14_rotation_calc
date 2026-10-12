import { useEffect, useId, useRef, useState } from "react";
import type { JobId } from "../data/job-registry";
import type { PlayerLevel } from "../types/skill";
import { JOB_CATALOG, JOB_ROLES, isImplementedJob } from "../data/job-catalog";
import type { CatalogJob } from "../data/job-catalog";
import { loadRecentJobs, pushRecentJob, saveRecentJobs } from "../logic/recent-jobs";

const SUPPORTED_LEVELS: PlayerLevel[] = [70, 80, 90, 100];

interface JobPickerProps {
  selectedJob: JobId;
  level: PlayerLevel;
  onJobChange: (jobId: JobId) => void;
  onLevelChange: (level: PlayerLevel) => void;
}

function matchesQuery(job: CatalogJob, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return job.name.toLowerCase().includes(q) || job.abbreviation.toLowerCase().includes(q);
}

function roleOf(job: CatalogJob) {
  return JOB_ROLES.find((r) => r.id === job.role)!;
}

/** ヘッダーのジョブ・レベル選択（ボタン＋ロール別パネル） */
export function JobPicker({ selectedJob, level, onJobChange, onLevelChange }: JobPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<JobId[]>(loadRecentJobs);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  const current = JOB_CATALOG.find((j) => j.id === selectedJob)!;
  const currentRole = roleOf(current);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const pickJob = (jobId: JobId) => {
    const next = pushRecentJob(recent, jobId);
    setRecent(next);
    saveRecentJobs(next);
    if (jobId !== selectedJob) onJobChange(jobId);
    close(true);
  };

  const filtered = JOB_CATALOG.filter((job) => matchesQuery(job, query));

  return (
    <div ref={rootRef} style={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`ジョブとレベルを選択（現在: ${current.name} Lv${level}）`}
        onClick={() => (open ? close(false) : setOpen(true))}
        style={styles.trigger}
      >
        <span className="num" style={{ ...styles.badge, backgroundColor: currentRole.color }}>
          {current.abbreviation}
        </span>
        <span style={styles.triggerText}>
          <span style={styles.triggerName}>{current.name}</span>
          <span className="num" style={styles.triggerMeta}>
            {currentRole.label} · Lv{level}
          </span>
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="ジョブとレベルを選択"
          style={styles.panel}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            // SkillDetailPanel は document で Esc を拾って閉じるため、ここで止める
            e.stopPropagation();
            close(true);
          }}
        >
          <fieldset style={styles.levelFieldset}>
            <legend style={styles.legend}>レベル</legend>
            <div style={styles.segmented}>
              {SUPPORTED_LEVELS.map((lv) => {
                const on = lv === level;
                return (
                  <button
                    key={lv}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onLevelChange(lv)}
                    className="num"
                    style={on ? styles.segmentOn : styles.segment}
                  >
                    {lv}
                  </button>
                );
              })}
            </div>
            <span style={styles.note}>Lv100 以外のスキルの有無・威力は参考値（α版）</span>
            {level < 100 && (
              <span style={styles.warning}>Lv{level}の威力値は正確でない可能性があります</span>
            )}
          </fieldset>

          <label style={styles.search}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <span style={styles.visuallyHidden}>ジョブを検索</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ジョブ名・略称で絞り込み（例: 黒, BLM）"
              style={styles.searchInput}
            />
          </label>

          {query.trim() === "" && recent.length > 0 && (
            <div style={styles.group}>
              <span style={styles.groupLabel}>最近使ったジョブ</span>
              <div style={styles.recentRow}>
                {recent.map((id) => {
                  const job = JOB_CATALOG.find((j) => j.id === id)!;
                  return (
                    <button key={id} type="button" onClick={() => pickJob(id)} style={styles.recentButton}>
                      {job.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filtered.length === 0 && <p style={styles.empty}>該当するジョブがありません</p>}

          {JOB_ROLES.map((role) => {
            const jobs = filtered.filter((j) => j.role === role.id);
            if (jobs.length === 0) return null;
            return (
              <div key={role.id} style={styles.group}>
                <span style={styles.groupLabel}>
                  <span aria-hidden="true" style={{ ...styles.roleSwatch, backgroundColor: role.color }} />
                  {role.label}
                </span>
                <div style={styles.jobGrid}>
                  {jobs.map((job) => {
                    const implemented = isImplementedJob(job.id);
                    const on = job.id === selectedJob;
                    return (
                      <button
                        key={job.id}
                        type="button"
                        disabled={!implemented}
                        aria-pressed={on}
                        onClick={() => implemented && pickJob(job.id as JobId)}
                        title={implemented ? job.name : `${job.name}（未対応）`}
                        style={{
                          ...styles.jobButton,
                          ...(on ? styles.jobButtonOn : {}),
                          ...(implemented ? {} : styles.jobButtonDisabled),
                        }}
                      >
                        <span className="num" style={{ ...styles.badgeSmall, backgroundColor: role.color }}>
                          {job.abbreviation}
                        </span>
                        <span style={styles.jobText}>
                          {job.name}
                          {!implemented && <span style={styles.unsupported}>未対応</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const segmentBase: React.CSSProperties = {
  minWidth: "52px",
  minHeight: "32px",
  borderRadius: "var(--radius-md)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "transparent",
  background: "transparent",
  color: "var(--color-text)",
  fontSize: "12px",
  cursor: "pointer",
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    marginLeft: "auto",
  },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "40px",
    padding: "0 var(--space-3) 0 6px",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  badge: {
    width: "28px",
    height: "28px",
    borderRadius: "var(--radius-md)",
    color: "var(--color-on-strong)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 700,
  },
  triggerText: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    lineHeight: 1.25,
  },
  triggerName: {
    fontSize: "13px",
    fontWeight: 500,
  },
  triggerMeta: {
    fontSize: "10px",
    color: "var(--color-muted)",
  },
  panel: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    zIndex: 50,
    width: "600px",
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 96px)",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: "var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    border: "1px solid var(--color-line)",
    borderRadius: "10px",
    background: "var(--color-surface)",
    color: "var(--color-text)",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.18)",
  },
  levelFieldset: {
    margin: 0,
    padding: "0 0 14px",
    border: "none",
    borderBottom: "1px solid var(--color-line-soft)",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "var(--space-2) var(--space-3)",
  },
  legend: {
    float: "left",
    padding: 0,
    marginRight: "var(--space-1)",
    fontSize: "12px",
    fontWeight: 700,
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "var(--space-1)",
    padding: "var(--space-1)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-bg)",
  },
  segment: segmentBase,
  segmentOn: {
    ...segmentBase,
    background: "var(--color-raised)",
    borderColor: "var(--color-field)",
  },
  note: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
  warning: {
    flexBasis: "100%",
    fontSize: "11px",
    color: "var(--color-warning)",
  },
  search: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    height: "40px",
    padding: "0 var(--space-3)",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-muted)",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
  searchInput: {
    flex: "1 1 auto",
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: "var(--color-text)",
    fontFamily: "inherit",
    fontSize: "13px",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  groupLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    color: "var(--color-muted)",
  },
  roleSwatch: {
    width: "8px",
    height: "8px",
    borderRadius: "2px",
  },
  recentRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  recentButton: {
    minHeight: "32px",
    padding: "0 10px",
    border: "1px solid var(--color-field)",
    borderRadius: "16px",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    fontSize: "12px",
    cursor: "pointer",
  },
  empty: {
    margin: 0,
    fontSize: "12px",
    color: "var(--color-muted)",
  },
  jobGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "6px",
  },
  jobButton: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    minHeight: "40px",
    padding: "0 var(--space-2)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    fontSize: "12px",
    textAlign: "left",
    cursor: "pointer",
  },
  jobButtonOn: {
    borderColor: "var(--color-accent)",
    background: "var(--color-bg)",
  },
  jobButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  badgeSmall: {
    width: "26px",
    height: "26px",
    flexShrink: 0,
    borderRadius: "5px",
    color: "var(--color-on-strong)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "9px",
    fontWeight: 700,
  },
  jobText: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.2,
    minWidth: 0,
  },
  unsupported: {
    fontSize: "10px",
    color: "var(--color-muted)",
  },
};
