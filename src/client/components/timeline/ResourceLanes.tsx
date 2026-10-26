import type { ActiveBuff, ResolvedTimelineEntry, ResourceSnapshot, ResourceTick } from "../../types/skill";
import type { ResourceGroup } from "./types";
import { styles } from "./styles";
import { PX_PER_SEC, RESOURCE_DOT_SIZE, RESOURCE_DOT_GAP } from "./constants";
import { getEffectiveMaxStacks } from "../../logic/resolve-timeline";

/** 未充填スロットの色。リソース色はデータ固定だが、空スロットは背景に馴染ませるためテーマに従う */
const EMPTY_SLOT_COLOR = "var(--color-line)";

interface ResourceMarker {
  key: string;
  time: number;
  snapshot: ResourceSnapshot;
  /** 表示上の上限（whileBuffModifiers の maxStacks）を決めるバフ */
  activeBuffs: ActiveBuff[];
  hasError: boolean;
}

/**
 * エントリごとのマーカーに、自動生成の付与（showAutoGenerateTicks。黙想）の段差を足す。
 * 付与は 1 リソース分の値しか持たないので、1 リソースだけのレーンに限る。
 * 付与の直後に置いた行動とはマーカーが重なり得るので、付与を先に並べてエントリのマーカーを上に描く
 */
function getMarkers(group: ResourceGroup, entries: ResolvedTimelineEntry[], ticks: ResourceTick[]): ResourceMarker[] {
  const entryMarkers: ResourceMarker[] = entries.map((entry) => ({
    key: entry.uid,
    time: entry.startTime,
    snapshot: entry.resourceSnapshot,
    activeBuffs: entry.activeBuffs,
    hasError: group.resources.some((r) => entry.resourceErrors.includes(r.id)),
  }));
  if (group.resources.length !== 1) return entryMarkers;
  const resourceId = group.resources[0].id;
  const tickMarkers: ResourceMarker[] = ticks
    .filter((tick) => tick.resourceId === resourceId)
    .map((tick) => ({
      key: `tick-${resourceId}-${tick.time}`,
      time: tick.time,
      snapshot: { [resourceId]: tick.value },
      // 付与はバフを持たないので基底の上限で描く（付与を描くリソースは whileBuffModifiers を持たない）
      activeBuffs: [],
      hasError: false,
    }));
  return [...tickMarkers, ...entryMarkers];
}

/** 上限が 0 の時点（賢人のバラード中・歌なしの詩心など、そのリソースを使わない時間帯）のマーカーは描かない */
function isMarkerVisible(group: ResourceGroup, m: ResourceMarker): boolean {
  return group.groupMaxStacks !== undefined || group.resources.some((r) => getEffectiveMaxStacks(r, m.activeBuffs) > 0);
}

interface ResourceLanesProps {
  resourceGroups: ResourceGroup[];
  resolvedEntries: ResolvedTimelineEntry[];
  resourceTicks: ResourceTick[];
  labelBg: string;
}

/** リソースゲージ行（displayGroup 単位で1行ずつ描画） */
export function ResourceLanes({ resourceGroups, resolvedEntries, resourceTicks, labelBg }: ResourceLanesProps) {
  return (
    <>
      {resourceGroups.map((group) => (
        <div key={group.key} style={styles.resourceLane}>
          <div style={{ ...styles.resourceLaneLabel, backgroundColor: labelBg }} title={group.resources.map((r) => r.name).join(" / ")}>
            {group.label}
          </div>
          <div style={styles.resourceLaneContent}>
            {getMarkers(group, resolvedEntries, resourceTicks).filter((m) => isMarkerVisible(group, m)).map((m) => {
              const hasError = m.hasError;
              return (
                <div
                  key={m.key}
                  style={{
                    ...styles.resourceMarker,
                    left: m.time * PX_PER_SEC,
                  }}
                  title={
                    group.groupMaxStacks !== undefined
                      ? group.resources.map((r) => `${r.name}: ${m.snapshot[r.id] ?? 0}`).join(" / ") +
                        ` (合計 ${group.resources.reduce((s, r) => s + (m.snapshot[r.id] ?? 0), 0)}/${group.groupMaxStacks})` +
                        (hasError ? " (不足)" : "")
                      : group.resources.map((r) => `${r.name}: ${m.snapshot[r.id] ?? 0}/${getEffectiveMaxStacks(r, m.activeBuffs)}`).join(", ") +
                        (hasError ? " (不足)" : "")
                  }
                >
                  <div style={styles.resourceDots}>
                    {group.groupMaxStacks !== undefined ? (() => {
                      // 統合スロット描画: displayGroupPriority 昇順でスロットを埋め、残りは空ドット
                      const groupMax = group.groupMaxStacks;
                      const slotColors: string[] = [];
                      for (const res of group.sortedResources) {
                        const count = m.snapshot[res.id] ?? 0;
                        for (let i = 0; i < count && slotColors.length < groupMax; i++) {
                          slotColors.push(res.color);
                        }
                      }
                      while (slotColors.length < groupMax) {
                        slotColors.push(EMPTY_SLOT_COLOR);
                      }
                      const stacksPerRow = group.stacksPerRow ?? groupMax;
                      const gridWidth = stacksPerRow * RESOURCE_DOT_SIZE + (stacksPerRow - 1) * RESOURCE_DOT_GAP;
                      return (
                        <div style={{ ...styles.resourceDotGrid, width: gridWidth }}>
                          {slotColors.map((color, i) => (
                            <div
                              key={i}
                              style={{ ...styles.resourceDot, backgroundColor: color }}
                            />
                          ))}
                        </div>
                      );
                    })() : group.resources.map((res) => {
                      const count = m.snapshot[res.id] ?? 0;
                      if (res.maxStacks > 10) {
                        return (
                          <div key={res.id} style={styles.resourceGauge}>
                            <div
                              style={{
                                ...styles.resourceGaugeFill,
                                width: `${(count / res.maxStacks) * 100}%`,
                                backgroundColor: res.color,
                              }}
                            />
                            <span style={styles.resourceGaugeLabel}>{count}</span>
                          </div>
                        );
                      }
                      // displayMaxStacks 指定時はドット数を絞り、超過分は overflowColor で同じドットを塗り直す
                      const displayMax = res.displayMaxStacks ?? getEffectiveMaxStacks(res, m.activeBuffs);
                      const stacksPerRow = res.stacksPerRow ?? displayMax;
                      const gridWidth = stacksPerRow * RESOURCE_DOT_SIZE + (stacksPerRow - 1) * RESOURCE_DOT_GAP;
                      return (
                        <div
                          key={res.id}
                          style={{
                            ...styles.resourceDotGrid,
                            width: gridWidth,
                          }}
                        >
                          {Array.from({ length: displayMax }, (_, i) => (
                            <div
                              key={`${res.id}-${i}`}
                              style={{
                                ...styles.resourceDot,
                                backgroundColor:
                                  count > displayMax + i
                                    ? (res.overflowColor ?? res.color)
                                    : i < count
                                      ? res.color
                                      : EMPTY_SLOT_COLOR,
                              }}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {hasError && (
                    <div style={styles.resourceErrorMark}>!</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
