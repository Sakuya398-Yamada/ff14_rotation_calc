import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Skill, ResolvedTimelineEntry } from "../types/skill";
import "./timeline.css";

/** 1秒あたりのピクセル数 */
const PX_PER_SEC = 80;

/** スキルアイコンのサイズ（px） */
const ICON_SIZE = 40;

/** レーンの高さ（px） */
const LANE_HEIGHT = 72;

/** 時間軸の高さ（px） */
const RULER_HEIGHT = 28;

/** レーンラベルの幅（px） */
const LANE_LABEL_WIDTH = 52;

interface TimelineProps {
  skills: Skill[];
  resolvedEntries: ResolvedTimelineEntry[];
  onAddEntry: (skillId: string, insertIndex?: number) => void;
  onRemoveEntry: (uid: string) => void;
  totalPotency: number;
}

/**
 * ドラッグ中のマウスX座標から挿入インデックスを計算する。
 * resolvedEntriesの各エントリの中央位置と比較し、挿入位置を決定する。
 */
function calcInsertIndex(
  mouseX: number,
  scrollLeft: number,
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>
): number {
  // タイムラインコンテンツ上の実際のX座標（スクロール考慮、レーンラベル分を引く）
  const contentX = mouseX + scrollLeft - LANE_LABEL_WIDTH;
  const time = contentX / PX_PER_SEC;

  if (resolvedEntries.length === 0) return 0;

  // 各エントリの中央時刻と比較して挿入位置を決定
  for (let i = 0; i < resolvedEntries.length; i++) {
    const entry = resolvedEntries[i];
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;
    const centerTime = entry.startTime + skill.recastTime / 2;
    if (time < centerTime) {
      return i;
    }
  }

  // 末尾に追加
  return resolvedEntries.length;
}

/**
 * 挿入インジケーターのX座標（px）を算出する。
 */
function calcInsertIndicatorX(
  insertIndex: number,
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>
): number {
  if (resolvedEntries.length === 0) return 0;

  if (insertIndex <= 0) {
    // 先頭に挿入
    return resolvedEntries[0].startTime * PX_PER_SEC - 4;
  }

  if (insertIndex >= resolvedEntries.length) {
    // 末尾に挿入
    const last = resolvedEntries[resolvedEntries.length - 1];
    const skill = skillMap.get(last.skillId);
    return (last.startTime + (skill?.recastTime ?? 0)) * PX_PER_SEC + 4;
  }

  // 中間に挿入: 前のエントリの終了位置と次のエントリの開始位置の中間
  const prevEntry = resolvedEntries[insertIndex - 1];
  const prevSkill = skillMap.get(prevEntry.skillId);
  const prevEnd = prevEntry.startTime + (prevSkill?.recastTime ?? 0);
  const nextStart = resolvedEntries[insertIndex].startTime;
  return ((prevEnd + nextStart) / 2) * PX_PER_SEC;
}

export function Timeline({
  skills,
  resolvedEntries,
  onAddEntry,
  onRemoveEntry,
  totalPotency,
}: TimelineProps) {
  const [dragOver, setDragOver] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 末尾追加時のみ自動スクロールするためのフラグ */
  const shouldAutoScrollRef = useRef(true);

  const handleRemoveEntry = useCallback(
    (uid: string) => {
      shouldAutoScrollRef.current = false;
      onRemoveEntry(uid);
    },
    [onRemoveEntry]
  );

  const skillMap = useMemo(
    () => new Map(skills.map((s) => [s.id, s])),
    [skills]
  );

  const gcdEntries: (ResolvedTimelineEntry & { skill: Skill })[] = [];
  const ogcdEntries: (ResolvedTimelineEntry & { skill: Skill })[] = [];
  for (const entry of resolvedEntries) {
    const skill = skillMap.get(entry.skillId);
    if (!skill) continue;
    if (skill.type === "gcd") {
      gcdEntries.push({ ...entry, skill });
    } else {
      ogcdEntries.push({ ...entry, skill });
    }
  }

  const totalDuration = useMemo(() => {
    if (resolvedEntries.length === 0) return 0;
    let maxEnd = 0;
    for (const entry of resolvedEntries) {
      const skill = skillMap.get(entry.skillId);
      if (!skill) continue;
      const end = entry.startTime + skill.recastTime;
      if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
  }, [resolvedEntries, skillMap]);

  const timelineWidth = Math.max(totalDuration * PX_PER_SEC + 100, 600);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const maxTime = Math.ceil(totalDuration + 1);
    for (let t = 0; t <= maxTime; t += 0.5) {
      ticks.push(t);
    }
    return ticks;
  }, [totalDuration]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      shouldAutoScrollRef.current = true;
      return;
    }
    if (scrollRef.current && resolvedEntries.length > 0) {
      const last = resolvedEntries[resolvedEntries.length - 1];
      const skill = skillMap.get(last.skillId);
      const endPx = (last.startTime + (skill?.recastTime ?? 0)) * PX_PER_SEC;
      const container = scrollRef.current;
      if (endPx > container.scrollLeft + container.clientWidth - 100) {
        container.scrollLeft = endPx - container.clientWidth + 150;
      }
    }
  }, [resolvedEntries, skillMap]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);

      if (scrollRef.current && resolvedEntries.length > 0) {
        const rect = scrollRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const idx = calcInsertIndex(
          mouseX,
          scrollRef.current.scrollLeft,
          resolvedEntries,
          skillMap
        );
        setInsertIndex(idx);
      } else {
        setInsertIndex(null);
      }
    },
    [resolvedEntries, skillMap]
  );

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
    setInsertIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const skillId = e.dataTransfer.getData("application/skill-id");
      if (!skillId) {
        setInsertIndex(null);
        return;
      }

      if (scrollRef.current && resolvedEntries.length > 0) {
        const rect = scrollRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const idx = calcInsertIndex(
          mouseX,
          scrollRef.current.scrollLeft,
          resolvedEntries,
          skillMap
        );
        const isInsertMiddle = idx < resolvedEntries.length;
        if (isInsertMiddle) {
          shouldAutoScrollRef.current = false;
        }
        onAddEntry(skillId, isInsertMiddle ? idx : undefined);
      } else {
        onAddEntry(skillId);
      }
      setInsertIndex(null);
    },
    [onAddEntry, resolvedEntries, skillMap]
  );

  // 挿入インジケーターのX座標
  const indicatorX = useMemo(() => {
    if (insertIndex === null) return null;
    return calcInsertIndicatorX(insertIndex, resolvedEntries, skillMap);
  }, [insertIndex, resolvedEntries, skillMap]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>タイムライン</h2>
        <div style={styles.potencyDisplay}>
          合計威力: <span style={styles.potencyValue}>{totalPotency}</span>
        </div>
      </div>

      <div
        style={{
          ...styles.dropZone,
          ...(dragOver ? styles.dropZoneActive : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {resolvedEntries.length === 0 ? (
          <div style={styles.placeholder}>
            スキルパレットからドラッグ＆ドロップしてスキルを追加
          </div>
        ) : (
          <div ref={scrollRef} className="timeline-scroll" style={styles.scrollContainer}>
            <div style={{ ...styles.timelineContent, width: timelineWidth }}>
              {/* 挿入インジケーター */}
              {indicatorX !== null && (
                <div
                  style={{
                    ...styles.insertIndicator,
                    left: LANE_LABEL_WIDTH + indicatorX,
                  }}
                />
              )}

              {/* GCD行 */}
              <div style={styles.lane}>
                <div style={styles.laneLabel}>GCD</div>
                <div style={styles.laneContent}>
                  {gcdEntries.map((entry) => (
                    <div
                      key={entry.uid}
                      style={{
                        ...styles.skillBlock,
                        left: entry.startTime * PX_PER_SEC,
                        width: entry.skill.recastTime * PX_PER_SEC,
                      }}
                    >
                      <div
                        style={styles.recastBar}
                        title={`リキャスト: ${entry.skill.recastTime}s`}
                      />
                      <div
                        style={styles.animLockBar}
                        title={`アニメーションロック: ${entry.skill.animationLock}s`}
                      >
                        <div
                          style={{
                            ...styles.animLockFill,
                            width:
                              (entry.skill.animationLock /
                                entry.skill.recastTime) *
                                100 +
                              "%",
                          }}
                        />
                      </div>
                      <div
                        style={styles.skillIcon}
                        title={`${entry.skill.name} (威力: ${entry.skill.potency}) [${entry.startTime.toFixed(2)}s]`}
                        onClick={() => handleRemoveEntry(entry.uid)}
                      >
                        <img
                          src={entry.skill.icon}
                          alt={entry.skill.name}
                          style={styles.iconImage}
                        />
                      </div>
                      <div style={styles.skillPotency}>
                        {entry.skill.potency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* oGCD行 */}
              <div style={styles.lane}>
                <div style={styles.laneLabel}>oGCD</div>
                <div style={styles.laneContent}>
                  {ogcdEntries.map((entry) => (
                    <div
                      key={entry.uid}
                      style={{
                        ...styles.ogcdBlock,
                        left: entry.startTime * PX_PER_SEC,
                      }}
                    >
                      <div
                        style={styles.ogcdIcon}
                        title={`${entry.skill.name} (威力: ${entry.skill.potency}) [${entry.startTime.toFixed(2)}s]`}
                        onClick={() => handleRemoveEntry(entry.uid)}
                      >
                        <img
                          src={entry.skill.icon}
                          alt={entry.skill.name}
                          style={styles.iconImage}
                        />
                      </div>
                      <div style={styles.skillPotency}>
                        {entry.skill.potency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 時間軸ルーラー */}
              <div style={styles.ruler}>
                <div style={styles.rulerLabel} />
                <div style={styles.rulerContent}>
                  {rulerTicks.map((t) => {
                    const isMajor = t % 1 === 0;
                    return (
                      <div
                        key={t}
                        style={{
                          ...styles.rulerTick,
                          left: t * PX_PER_SEC,
                          height: isMajor ? "12px" : "6px",
                        }}
                      >
                        <div style={styles.rulerTickLine} />
                        {isMajor && (
                          <div style={styles.rulerTickLabel}>{t}s</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.hint}>クリックでスキルを削除</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    color: "#e0e0e0",
  },
  potencyDisplay: {
    fontSize: "16px",
    color: "#aaa",
  },
  potencyValue: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#ffd700",
  },
  dropZone: {
    flex: 1,
    border: "2px dashed #444",
    borderRadius: "8px",
    transition: "border-color 0.2s, background-color 0.2s",
    minHeight: "200px",
    overflow: "auto",
  },
  dropZoneActive: {
    borderColor: "#ffd700",
    backgroundColor: "rgba(255, 215, 0, 0.05)",
  },
  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: "160px",
    color: "#666",
    fontSize: "14px",
  },
  scrollContainer: {
    overflowX: "auto",
    overflowY: "hidden",
    height: "100%",
    padding: "12px 0",
  },
  timelineContent: {
    position: "relative",
    minWidth: "100%",
    paddingLeft: 0,
  },
  insertIndicator: {
    position: "absolute",
    top: 0,
    bottom: RULER_HEIGHT,
    width: "2px",
    backgroundColor: "#ffd700",
    zIndex: 10,
    pointerEvents: "none",
    boxShadow: "0 0 6px rgba(255, 215, 0, 0.6)",
  },
  lane: {
    display: "flex",
    height: LANE_HEIGHT,
    position: "relative",
    marginBottom: "4px",
  },
  laneLabel: {
    width: LANE_LABEL_WIDTH,
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: "bold",
    color: "#888",
    textTransform: "uppercase" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
  },
  laneContent: {
    position: "relative",
    flex: 1,
    borderBottom: "1px solid #2a2a4a",
  },
  skillBlock: {
    position: "absolute",
    top: "4px",
    height: LANE_HEIGHT - 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  recastBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    backgroundColor: "rgba(100, 149, 237, 0.3)",
    borderRadius: "2px",
  },
  animLockBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "4px",
    borderRadius: "2px",
    overflow: "hidden",
  },
  animLockFill: {
    height: "100%",
    backgroundColor: "rgba(255, 100, 100, 0.6)",
    borderRadius: "2px",
  },
  skillIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: "6px",
    overflow: "hidden",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.2)",
    marginTop: "8px",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  ogcdBlock: {
    position: "absolute",
    top: "8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  ogcdIcon: {
    width: ICON_SIZE - 4,
    height: ICON_SIZE - 4,
    borderRadius: "50%",
    overflow: "hidden",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.2)",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  iconImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
  },
  skillPotency: {
    fontSize: "9px",
    color: "#888",
    marginTop: "2px",
    textAlign: "center" as const,
  },
  ruler: {
    display: "flex",
    height: RULER_HEIGHT,
    position: "relative",
    borderTop: "1px solid #444",
    marginTop: "4px",
  },
  rulerLabel: {
    width: LANE_LABEL_WIDTH,
    flexShrink: 0,
  },
  rulerContent: {
    position: "relative",
    flex: 1,
  },
  rulerTick: {
    position: "absolute",
    top: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  rulerTickLine: {
    width: "1px",
    height: "100%",
    backgroundColor: "#555",
  },
  rulerTickLabel: {
    fontSize: "10px",
    color: "#777",
    marginTop: "2px",
    whiteSpace: "nowrap" as const,
  },
  hint: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#555",
    textAlign: "center" as const,
  },
};
