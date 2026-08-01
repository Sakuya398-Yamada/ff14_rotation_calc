import type { ResolvedTimelineEntry } from "../../types/skill";
import type { ResourceGroup } from "./types";
import { styles } from "./styles";
import { PX_PER_SEC, RESOURCE_DOT_SIZE, RESOURCE_DOT_GAP } from "./constants";

interface ResourceLanesProps {
  resourceGroups: ResourceGroup[];
  resolvedEntries: ResolvedTimelineEntry[];
  labelBg: string;
}

/** リソースゲージ行（displayGroup 単位で1行ずつ描画） */
export function ResourceLanes({ resourceGroups, resolvedEntries, labelBg }: ResourceLanesProps) {
  return (
    <>
      {resourceGroups.map((group) => (
        <div key={group.key} style={styles.resourceLane}>
          <div style={{ ...styles.resourceLaneLabel, backgroundColor: labelBg }} title={group.resources.map((r) => r.name).join(" / ")}>
            {group.label}
          </div>
          <div style={styles.resourceLaneContent}>
            {resolvedEntries.map((entry) => {
              const hasError = group.resources.some((r) => entry.resourceErrors.includes(r.id));
              return (
                <div
                  key={entry.uid}
                  style={{
                    ...styles.resourceMarker,
                    left: entry.startTime * PX_PER_SEC,
                  }}
                  title={
                    group.groupMaxStacks !== undefined
                      ? group.resources.map((r) => `${r.name}: ${entry.resourceSnapshot[r.id] ?? 0}`).join(" / ") +
                        ` (合計 ${group.resources.reduce((s, r) => s + (entry.resourceSnapshot[r.id] ?? 0), 0)}/${group.groupMaxStacks})` +
                        (hasError ? " (不足)" : "")
                      : group.resources.map((r) => `${r.name}: ${entry.resourceSnapshot[r.id] ?? 0}/${r.maxStacks}`).join(", ") +
                        (hasError ? " (不足)" : "")
                  }
                >
                  <div style={styles.resourceDots}>
                    {group.groupMaxStacks !== undefined ? (() => {
                      // 統合スロット描画: displayGroupPriority 昇順でスロットを埋め、残りは空ドット
                      const groupMax = group.groupMaxStacks;
                      const slotColors: string[] = [];
                      for (const res of group.sortedResources) {
                        const count = entry.resourceSnapshot[res.id] ?? 0;
                        for (let i = 0; i < count && slotColors.length < groupMax; i++) {
                          slotColors.push(res.color);
                        }
                      }
                      while (slotColors.length < groupMax) {
                        slotColors.push("rgba(255,255,255,0.15)");
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
                      const count = entry.resourceSnapshot[res.id] ?? 0;
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
                      const displayMax = res.displayMaxStacks ?? res.maxStacks;
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
                                      : "rgba(255,255,255,0.15)",
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
