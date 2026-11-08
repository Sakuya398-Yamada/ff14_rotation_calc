import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, pointerWithin } from "@dnd-kit/core";
import type { DragStartEvent } from "@dnd-kit/core";
import type { TimelineDragData } from "./timeline/dnd-types";
import { SkillPalette } from "./SkillPalette";
import { Timeline } from "./Timeline";
import { SkillDetailPanel } from "./SkillDetailPanel";
import { SettingsDialog } from "./SettingsDialog";
import { SaveTimelineDialog } from "./SaveTimelineDialog";
import { MyTimelinesDialog } from "./MyTimelinesDialog";
import { AccountControl } from "./AccountControl";
import { SummaryBar } from "./SummaryBar";
import { JobPicker } from "./JobPicker";
import "./layout.css";
import { loadSettings, saveSettings, applySettings, prefersDarkScheme } from "../logic/app-settings";
import { resolveTimeline } from "../logic/resolve-timeline";
import { calcRangePps, calcTimelineSummary } from "../logic/timeline-summary";
import { JOB_DATA } from "../data/job-registry";
import { contentName, skillName } from "../logic/display-names";
import { DEFAULT_STATS } from "../logic/stat-calc";
import { getSkillsForLevel, getBuffsForLevel, getResourcesForLevel, getAllSkillMapForLevel } from "../logic/skill-level";
import { loadAppState, saveAppState, computeNextUid } from "../logic/timeline-storage";
import type { AppStateSnapshot, PersistedAppState } from "../logic/timeline-storage";
import { getSharedTimelineId, loadSharedTimeline } from "../logic/shared-timeline";
import { fetchAccountStatus, type AccountStatus } from "../logic/account";
import { alternateLanguagePath, languageBasePath, privacyPolicyPath } from "../logic/language-path";
import { useLanguage } from "../i18n";
import type { SharedLoadError } from "../logic/shared-timeline";
import type { JobId } from "../data/job-registry";
import type { Skill, TimelineEntry, CharacterStats, BossUntargetableWindow, MultiTargetWindow, PpsRange, PlayerLevel } from "../types/skill";

// 既存の `import type { JobId } from "./App"` を壊さないための再エクスポート
export type { JobId } from "../data/job-registry";

let nextUid = 1;

/** 保存の debounce 間隔（ミリ秒）。連続操作中の書き込み頻度を抑える */
const SAVE_DEBOUNCE_MS = 500;

export function App() {
  const { t } = useTranslation();
  const lang = useLanguage();
  const otherLang = lang === "en" ? "ja" : "en";
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [myTimelinesOpen, setMyTimelinesOpen] = useState(false);
  const myTimelinesButtonRef = useRef<HTMLButtonElement>(null);
  // 取得できるまでは、ログインできないものとして何も出さない
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("unavailable");

  useEffect(() => {
    const controller = new AbortController();
    void fetchAccountStatus({ signal: controller.signal }).then((status) => {
      if (!controller.signal.aborted) setAccountStatus(status);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    saveSettings(settings);
    applySettings(settings, prefersDarkScheme());
    if (settings.theme !== "system" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSchemeChange = (e: MediaQueryListEvent) => applySettings(settings, e.matches);
    mediaQuery.addEventListener("change", handleSchemeChange);
    return () => mediaQuery.removeEventListener("change", handleSchemeChange);
  }, [settings]);

  // 初回マウント時に LocalStorage から復元（復元不能時は null → 各 state の初期値にフォールバック）
  const [restored] = useState(() => {
    const state = loadAppState();
    if (state) {
      // 復元した entries の uid と新規採番が衝突しないようカウンタを進める
      nextUid = Math.max(nextUid, computeNextUid(state.entries));
    }
    return state;
  });

  const [selectedJob, setSelectedJob] = useState<JobId>(restored?.selectedJob ?? "whm");
  const [level, setLevel] = useState<PlayerLevel>(restored?.level ?? 100);
  const [entries, setEntries] = useState<TimelineEntry[]>(restored?.entries ?? []);
  const [stats, setStats] = useState<CharacterStats>(restored?.stats ?? DEFAULT_STATS);
  const [untargetableWindows, setUntargetableWindows] = useState<BossUntargetableWindow[]>(restored?.untargetableWindows ?? []);
  const [multiTargetWindows, setMultiTargetWindows] = useState<MultiTargetWindow[]>(restored?.multiTargetWindows ?? []);
  const [ppsRange, setPpsRange] = useState<PpsRange | null>(null);
  const [selectedEntryUid, setSelectedEntryUid] = useState<string | null>(null);
  // 保存するときに複製元（parentId）として付ける ID。共有 URL から開いたタイムラインの ID で、保存したら保存した ID に置き換える
  // （続けて保存すると、前の保存が複製元になる）。ジョブを変えると外す。リロードでは引き継がない
  const [sourceTimelineId, setSourceTimelineId] = useState<string | null>(null);
  const [sharedLoadError, setSharedLoadError] = useState<SharedLoadError | null>(null);
  // 共有 URL から開いたタイムラインのタイトルとコンテンツ。ジョブを変えるか保存すると、別のタイムラインになるので外す
  const [sharedInfo, setSharedInfo] = useState<{ title: string | null; contentId: string | null } | null>(null);
  // 言語のリンクの移り先と、ログインした後に戻るパスを作る。replaceState では再描画されないので、書き換えたときに一緒に更新する
  const [pathname, setPathname] = useState(() => window.location.pathname);
  // 共有タイムラインの取得が終わった時点のエントリで上書きの確認を判定するため、最新の値を持っておく
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // 「戻る」で bfcache から戻ったページの状態は、離れていたあいだに移り先（言語のリンクの先など）で保存した内容より古い。
  // 保存すると移り先で編集した分を上書きするので、保存を止めて読み込み直す
  const restoredFromBfcacheRef = useRef(false);
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      restoredFromBfcacheRef.current = true;
      window.location.reload();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // 状態変更を debounce しつつ LocalStorage へ保存。
  // debounce 待ち中（直前 500ms 以内）のリロード・タブクローズでも取りこぼさないよう、
  // pagehide で即時フラッシュする
  useEffect(() => {
    const flush = () => {
      if (restoredFromBfcacheRef.current) return;
      saveAppState({ selectedJob, level, entries, stats, untargetableWindows, multiTargetWindows });
    };
    const timer = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
    };
  }, [selectedJob, level, entries, stats, untargetableWindows, multiTargetWindows]);

  const saveSnapshot = useMemo<AppStateSnapshot>(
    () => ({ selectedJob, level, entries, stats, untargetableWindows, multiTargetWindows }),
    [selectedJob, level, entries, stats, untargetableWindows, multiTargetWindows]
  );

  const jobData = JOB_DATA[selectedJob];

  const handleJobChange = useCallback((jobId: JobId) => {
    setSelectedJob(jobId);
    // ジョブ変更時にタイムラインをリセット（異なるジョブのスキルは互換性がない）
    setEntries([]);
    setPpsRange(null);
    setSelectedEntryUid(null);
    // 中身が別のタイムラインになるので、複製元も外す
    setSourceTimelineId(null);
    setSharedInfo(null);
  }, []);

  const handleSaved = useCallback((id: string) => {
    setSourceTimelineId(id);
    setSharedInfo(null);
  }, []);

  const applyAppState = useCallback((state: PersistedAppState) => {
    nextUid = Math.max(nextUid, computeNextUid(state.entries));
    setSelectedJob(state.selectedJob);
    setLevel(state.level);
    setEntries(state.entries);
    setStats(state.stats);
    setUntargetableWindows(state.untargetableWindows);
    setMultiTargetWindows(state.multiTargetWindows);
    setPpsRange(null);
    setSelectedEntryUid(null);
  }, []);

  // 共有 URL（/t/<id>）で開かれたら、保存済みのタイムラインを読み込んで置き換える
  useEffect(() => {
    const id = getSharedTimelineId(window.location.pathname);
    if (id === null) return;
    const controller = new AbortController();
    void loadSharedTimeline(id, {
      signal: controller.signal,
      hasWorkingEntries: () => entriesRef.current.length > 0,
      confirmOverwrite: () =>
        window.confirm(i18next.t("app.confirmOpenShared")),
    }).then((outcome) => {
      if (controller.signal.aborted) return;
      if (outcome.kind === "error") {
        // 通信エラーならリロードでやり直せるよう、URL は残す
        setSharedLoadError(outcome.error);
        return;
      }
      // 残すと、リロードのたびに読み込み直して、編集した内容を置き換えようとする
      window.history.replaceState(null, "", languageBasePath(lang));
      setPathname(languageBasePath(lang));
      if (outcome.kind === "apply") {
        applyAppState(outcome.state);
        setSourceTimelineId(outcome.id);
        const { title, contentId } = outcome;
        setSharedInfo(title !== null || contentId !== null ? { title, contentId } : null);
      }
    });
    return () => controller.abort();
  }, [applyAppState, lang]);

  // レベルに応じたバフ・リソースをフィルタ
  const levelBuffs = useMemo(
    () => getBuffsForLevel(jobData.buffs, level),
    [jobData.buffs, level]
  );
  const levelResources = useMemo(
    () => getResourcesForLevel(jobData.resources, level),
    [jobData.resources, level]
  );

  // レベルに応じたスキルをフィルタ・威力調整
  const availableBuffIds = useMemo(
    () => new Set(levelBuffs.map((b) => b.id)),
    [levelBuffs]
  );
  const availableResourceIds = useMemo(
    () => new Set(levelResources.map((r) => r.id)),
    [levelResources]
  );
  const skills = useMemo(
    () => getSkillsForLevel(jobData.skills, level, availableBuffIds, availableResourceIds),
    [jobData.skills, level, availableBuffIds, availableResourceIds]
  );

  // パレット用のフィルタ済みスキルマップ
  const skillMap = useMemo(
    () => new Map(skills.map((s) => [s.id, s])),
    [skills]
  );

  // 全スキルマップ（autoTransform対象等を含む。タイムライン解決・表示用）
  const allSkillMap = useMemo(
    () => getAllSkillMapForLevel(jobData.skills, skills, level, availableBuffIds, availableResourceIds),
    [jobData.skills, skills, level, availableBuffIds, availableResourceIds]
  );

  const timelineResult = useMemo(
    () => resolveTimeline(entries, allSkillMap, levelResources, stats, levelBuffs, untargetableWindows, multiTargetWindows),
    [entries, allSkillMap, levelResources, stats, levelBuffs, untargetableWindows, multiTargetWindows]
  );

  const resolvedEntries = timelineResult.entries;

  const handleAddEntry = useCallback((skillId: string, insertBeforeUid?: string) => {
    const uid = `entry-${nextUid++}`;
    setEntries((prev) => {
      if (insertBeforeUid) {
        const targetIndex = prev.findIndex((e) => e.uid === insertBeforeUid);
        if (targetIndex >= 0) {
          const next = [...prev];
          next.splice(targetIndex, 0, { uid, skillId });
          return next;
        }
      }
      return [...prev, { uid, skillId }];
    });
  }, []);

  const handleRemoveEntry = useCallback((uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
    setSelectedEntryUid((prev) => (prev === uid ? null : prev));
  }, []);

  const handleMoveEntry = useCallback((uid: string, insertBeforeUid?: string) => {
    if (insertBeforeUid === uid) return;
    setEntries((prev) => {
      const fromIdx = prev.findIndex((e) => e.uid === uid);
      if (fromIdx < 0) return prev;
      // D&D での並び替え時は、過去に設定した manualStartTime をリセットして自動計算に戻す
      // （Issue #175 仕様: 並び替えで位置が変わるならマニュアル時刻の意味が薄れる）
      const { manualStartTime: _drop, ...rest } = prev[fromIdx];
      void _drop;
      const entry: TimelineEntry = rest;
      const without = [...prev.slice(0, fromIdx), ...prev.slice(fromIdx + 1)];
      if (insertBeforeUid) {
        const toIdx = without.findIndex((e) => e.uid === insertBeforeUid);
        if (toIdx < 0) return prev;
        return [...without.slice(0, toIdx), entry, ...without.slice(toIdx)];
      }
      return [...without, entry];
    });
  }, []);

  // dnd-kit センサー設定（Issue #284: タッチ操作対応）
  // MouseSensor: distance 制約でクリック（エントリ選択）とドラッグを区別する
  // TouchSensor: 長押し（delay）でドラッグ開始し、通常のタップ・スクロールと区別する
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  /** ドラッグ中のスキル（DragOverlay 表示用。null = 非ドラッグ） */
  const [activeDragSkill, setActiveDragSkill] = useState<Skill | null>(null);

  const handleDndDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as TimelineDragData | undefined;
      if (!data) return;
      setActiveDragSkill(allSkillMap.get(data.skillId) ?? null);
    },
    [allSkillMap]
  );

  const handleDndDragFinish = useCallback(() => {
    setActiveDragSkill(null);
  }, []);

  const handleManualStartTimeChange = useCallback(
    (uid: string, manualStartTime: number | undefined) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.uid !== uid) return e;
          if (manualStartTime === undefined) {
            // undefined を渡されたら manualStartTime キー自体を削除（型上 optional のため省略形が正）
            const { manualStartTime: _drop, ...rest } = e;
            void _drop;
            return rest;
          }
          return { ...e, manualStartTime };
        })
      );
    },
    []
  );

  const handleProcOccurredChange = useCallback(
    (uid: string, procOccurred: boolean | undefined) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.uid !== uid) return e;
          if (procOccurred === undefined) {
            const { procOccurred: _drop, ...rest } = e;
            void _drop;
            return rest;
          }
          return { ...e, procOccurred };
        })
      );
    },
    []
  );

  const summary = useMemo(
    () => calcTimelineSummary(timelineResult, allSkillMap, stats),
    [timelineResult, allSkillMap, stats]
  );

  const buffDefMap = useMemo(
    () => new Map(levelBuffs.map((b) => [b.id, b])),
    [levelBuffs]
  );

  const selectedEntry = useMemo(() => {
    if (selectedEntryUid === null) return null;
    return resolvedEntries.find((e) => e.uid === selectedEntryUid) ?? null;
  }, [resolvedEntries, selectedEntryUid]);

  const selectedSkill = useMemo(() => {
    if (!selectedEntry) return null;
    return allSkillMap.get(selectedEntry.resolvedSkillId) ?? null;
  }, [selectedEntry, allSkillMap]);

  // 範囲選択PPS
  const rangePps = useMemo(() => {
    if (!ppsRange) return null;
    return calcRangePps(timelineResult, allSkillMap, ppsRange, stats);
  }, [timelineResult, allSkillMap, ppsRange, stats]);

  return (
    <div className="app-root" style={styles.app}>
      <header className="app-header" style={styles.header}>
        <h1 style={styles.headerTitle}>{t("app.siteName")}</h1>
        <JobPicker
          selectedJob={selectedJob}
          level={level}
          onJobChange={handleJobChange}
          onLevelChange={setLevel}
        />
        <button
          ref={saveButtonRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setSaveOpen(true)}
          style={styles.saveButton}
        >
          {t("app.saveAndShare")}
        </button>
        <button
          ref={myTimelinesButtonRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setMyTimelinesOpen(true)}
          style={styles.saveButton}
        >
          {t("app.myTimelines")}
        </button>
        <a
          href={alternateLanguagePath(pathname)}
          hrefLang={otherLang}
          lang={otherLang}
          style={styles.languageLink}
        >
          {t("app.languageLink")}
        </a>
        <button
          ref={settingsButtonRef}
          type="button"
          aria-label={t("app.settings")}
          title={t("app.settings")}
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
          style={styles.settingsButton}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <AccountControl status={accountStatus} returnTo={pathname} onLoggedOut={() => setAccountStatus("loggedOut")} />
      </header>
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
        returnFocusRef={settingsButtonRef}
      />
      <SaveTimelineDialog
        open={saveOpen}
        snapshot={saveSnapshot}
        parentId={sourceTimelineId}
        onSaved={handleSaved}
        onClose={() => setSaveOpen(false)}
        returnFocusRef={saveButtonRef}
      />
      <MyTimelinesDialog
        open={myTimelinesOpen}
        onClose={() => setMyTimelinesOpen(false)}
        returnFocusRef={myTimelinesButtonRef}
        accountStatus={accountStatus}
        returnTo={pathname}
      />
      {sharedLoadError !== null && (
        <div style={styles.sharedLoadError}>
          <span role="alert">{t(`sharedTimeline.loadErrors.${sharedLoadError}` as const)}</span>
          <button
            type="button"
            aria-label={t("app.closeSharedLoadError")}
            onClick={() => setSharedLoadError(null)}
            style={styles.sharedLoadErrorClose}
          >
            ×
          </button>
        </div>
      )}
      {sharedInfo !== null && (
        <section aria-label={t("app.sharedInfo")} style={styles.sharedInfo}>
          <div style={styles.sharedInfoText}>
            {sharedInfo.contentId !== null && <span>{contentName(t, sharedInfo.contentId)}</span>}
            {sharedInfo.title !== null && <span style={styles.sharedInfoTitle}>{sharedInfo.title}</span>}
          </div>
          <button
            type="button"
            aria-label={t("app.closeSharedInfo")}
            onClick={() => setSharedInfo(null)}
            style={styles.sharedLoadErrorClose}
          >
            ×
          </button>
        </section>
      )}
      <SummaryBar
        totalExpectedPotency={summary.totalExpectedPotency}
        dotExpectedPotency={summary.dotExpectedPotency}
        overallPps={summary.overallPps}
        rangePps={rangePps}
        ppsRange={ppsRange}
        duration={summary.duration}
        lastDotTickTime={summary.lastDotTickTime}
      />
      <DndContext
        sensors={dndSensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDndDragStart}
        onDragEnd={handleDndDragFinish}
        onDragCancel={handleDndDragFinish}
      >
      <div className="app-main" style={styles.main}>
        <SkillPalette
          jobId={selectedJob}
          skills={skills}
          stats={stats}
          onStatsChange={setStats}
        />
        <div className="app-work-area" style={styles.workArea}>
          <div style={styles.timelineSlot}>
            <Timeline
              jobId={selectedJob}
              skills={skills}
              allSkillMap={allSkillMap}
              resolvedEntries={resolvedEntries}
              onAddEntry={handleAddEntry}
              onRemoveEntry={handleRemoveEntry}
              onMoveEntry={handleMoveEntry}
              resources={levelResources}
              buffs={levelBuffs}
              stats={stats}
              dotTicks={timelineResult.dotTicks}
              resourceTicks={timelineResult.resourceTicks}
              activeDoTs={timelineResult.activeDoTs}
              untargetableWindows={untargetableWindows}
              onUntargetableWindowsChange={setUntargetableWindows}
              multiTargetWindows={multiTargetWindows}
              onMultiTargetWindowsChange={setMultiTargetWindows}
              rangePps={rangePps}
              ppsRange={ppsRange}
              onPpsRangeChange={setPpsRange}
              lastGcdEndTime={timelineResult.lastGcdEndTime}
              selectedEntryUid={selectedEntryUid}
              onSelectEntry={setSelectedEntryUid}
            />
          </div>
          {selectedEntry && selectedSkill && (
            <SkillDetailPanel
              entry={selectedEntry}
              resolvedSkill={selectedSkill}
              jobId={selectedJob}
              buffDefMap={buffDefMap}
              stats={stats}
              onClose={() => setSelectedEntryUid(null)}
              onManualStartTimeChange={handleManualStartTimeChange}
              onProcOccurredChange={handleProcOccurredChange}
            />
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragSkill && (
          <div style={styles.dragOverlayIcon}>
            <img
              src={activeDragSkill.icon}
              alt={skillName(t, selectedJob, activeDragSkill.id)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              draggable={false}
            />
          </div>
        )}
      </DragOverlay>
      </DndContext>
      <footer style={styles.footer}>
        <small style={styles.contact}>
          {t("app.contactLabel")}{" "}
          <a
            style={styles.contactLink}
            href="https://github.com/Sakuya398-Yamada/ff14_rotation_calc"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>{" "}
          |{" "}
          <a
            style={styles.contactLink}
            href="https://github.com/Sakuya398-Yamada/ff14_rotation_calc/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Issue
          </a>{" "}
          | {t("app.mailLabel")}{" "}
          <a style={styles.contactLink} href="mailto:forestry.for@gmail.com">
            forestry.for@gmail.com
          </a>{" "}
          |{" "}
          <a style={styles.contactLink} href={privacyPolicyPath(lang)}>
            {t("app.privacyPolicy")}
          </a>
        </small>
        <small style={styles.copyright}>
          Copyright (C) SQUARE ENIX CO., LTD. All Rights Reserved.
        </small>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "var(--space-2) var(--space-4)",
    backgroundColor: "var(--color-surface)",
    borderBottom: "1px solid var(--color-line)",
  },
  headerTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: "var(--color-text)",
  },
  saveButton: {
    height: "40px",
    padding: "0 var(--space-3)",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontFamily: "inherit",
    fontSize: "13px",
    cursor: "pointer",
  },
  languageLink: {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    height: "40px",
    padding: "0 var(--space-3)",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    fontSize: "13px",
    textDecoration: "none",
  },
  settingsButton: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  sharedLoadError: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    padding: "var(--space-2) var(--space-4)",
    borderBottom: "1px solid var(--color-error)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-error)",
    fontSize: "13px",
  },
  sharedLoadErrorClose: {
    flexShrink: 0,
    width: "28px",
    height: "28px",
    border: "1px solid var(--color-field)",
    borderRadius: "var(--radius-md)",
    background: "var(--color-raised)",
    color: "var(--color-text)",
    cursor: "pointer",
  },
  sharedInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    padding: "var(--space-2) var(--space-4)",
    borderBottom: "1px solid var(--color-line)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text)",
    fontSize: "13px",
  },
  sharedInfoText: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: "var(--space-3)",
    minWidth: 0,
  },
  sharedInfoTitle: {
    fontSize: "11px",
    color: "var(--color-muted)",
    overflowWrap: "anywhere",
  },
  main: {
    display: "flex",
    flex: 1,
  },
  workArea: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  // Timeline のルートは横方向の flex: 1 で伸びる作りのため、縦方向の伸縮はこの行ラッパーが受け持つ
  timelineSlot: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
  dragOverlayIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "4px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.6)",
    cursor: "grabbing",
  },
  footer: {
    padding: "var(--space-2) var(--space-6)",
    backgroundColor: "var(--color-surface)",
    borderTop: "1px solid var(--color-line)",
    textAlign: "center" as const,
  },
  contact: {
    display: "block",
    fontSize: "11px",
    color: "var(--color-muted)",
    marginBottom: "2px",
  },
  contactLink: {
    color: "var(--color-accent)",
    textDecoration: "none",
  },
  copyright: {
    fontSize: "11px",
    color: "var(--color-muted)",
  },
};
