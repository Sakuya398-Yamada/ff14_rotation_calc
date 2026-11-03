// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, fireEvent, act, cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  DndContext,
  MouseSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useTimelineDnd } from "../timeline/use-timeline-dnd";
import { TIMELINE_DROPZONE_ID, type TimelineEntryDragData } from "../timeline/dnd-types";
import { LANE_LABEL_WIDTH, PX_PER_SEC } from "../timeline/constants";
import { resolveTimeline } from "../../logic/resolve-timeline";
import { DEFAULT_STATS } from "../../logic/stat-calc";
import type { Skill, TimelineEntry, ResolvedTimelineEntry } from "../../types/skill";

/*
 * タイムライン内 D&D の挿入位置の回帰テスト（#583）。
 * 挿入インデックスは「見えている並び」（ドラッグ中のエントリを除いただけの元の並び）で判定する（#187 の修正）。
 * 挿入インジケーターの位置も同じ並びで決める（#190 の修正 = #193）。
 * どちらも、ドラッグ中のエントリを除いて再 resolve した並び（後続が前詰めされる）を使うと 1 スロットずれる。
 */

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    potency: 100,
    type: "gcd",
    target: "enemy",
    icon: "/icons/dummy.png",
    recastTime: 2.5,
    animationLock: 0.65,
    acquiredLevel: 1,
    ...overrides,
  } as Skill;
}

const gcdSkill = makeSkill({ id: "gcd" });
const ogcdSkill = makeSkill({ id: "ogcd", type: "ogcd", recastTime: 60 });
const skillMap = new Map([gcdSkill, ogcdSkill].map((s) => [s.id, s]));

/** Timeline.tsx の getResolvedEntryRecast と同じ式（Timeline の中で作って hook に渡しているので、テストでも同じものを渡す） */
const getResolvedEntryRecast = (entry: ResolvedTimelineEntry, skill: Skill): number =>
  skill.type === "gcd"
    ? Math.round((entry.gcdAvailableAt - entry.startTime) * 1000) / 1000
    : skill.recastTime;

/** jsdom はレイアウトを持たず、どのドロップ先にも当たらないので、常にタイムライン本体に当てる */
const collideWithTimeline: CollisionDetection = ({ droppableContainers }) =>
  droppableContainers
    .filter((container) => container.id === TIMELINE_DROPZONE_ID)
    .map((container) => ({ id: container.id }));

function TimelineDropZone() {
  const { setNodeRef } = useDroppable({ id: TIMELINE_DROPZONE_ID });
  return <div ref={setNodeRef} />;
}

function DraggableEntry({ entry }: { entry: TimelineEntry }) {
  const data: TimelineEntryDragData = {
    source: "timeline",
    uid: entry.uid,
    skillId: entry.skillId,
    skillType: skillMap.get(entry.skillId)!.type,
  };
  const { setNodeRef, listeners, attributes } = useDraggable({ id: `entry-${entry.uid}`, data });
  return <div ref={setNodeRef} data-testid={`entry-${entry.uid}`} {...listeners} {...attributes} />;
}

/** jsdom では getBoundingClientRect().left も scrollLeft も 0 なので、時刻 t のポインタ位置は LANE_LABEL_WIDTH + t * PX_PER_SEC */
const clientXAt = (seconds: number) => LANE_LABEL_WIDTH + seconds * PX_PER_SEC;

function setup(entries: TimelineEntry[], draggedUid: string) {
  const resolvedEntries = resolveTimeline(entries, skillMap, [], DEFAULT_STATS, [], [], []).entries;
  const onMoveEntry = vi.fn();
  const scrollRef = { current: document.createElement("div") };
  const shouldAutoScrollRef = { current: true };
  const dragged = entries.find((e) => e.uid === draggedUid)!;

  function Wrapper({ children }: { children: ReactNode }) {
    // activationConstraint なし: mousedown で即ドラッグ開始（timeline.test.tsx と同じ）
    const sensors = useSensors(useSensor(MouseSensor));
    return (
      <DndContext sensors={sensors} collisionDetection={collideWithTimeline}>
        <TimelineDropZone />
        <DraggableEntry entry={dragged} />
        {children}
      </DndContext>
    );
  }

  const { result } = renderHook(
    () =>
      useTimelineDnd({
        resolvedEntries,
        skillMap,
        resources: [],
        stats: DEFAULT_STATS,
        buffs: [],
        untargetableWindows: [],
        multiTargetWindows: [],
        getResolvedEntryRecast,
        scrollRef,
        shouldAutoScrollRef,
        onAddEntry: vi.fn(),
        onRemoveEntry: vi.fn(),
        onMoveEntry,
      }),
    { wrapper: Wrapper }
  );

  const startTime = resolvedEntries.find((e) => e.uid === draggedUid)!.startTime;

  /** ドラッグ中のエントリを時刻 seconds の位置まで動かし、挿入位置の計算（rAF）が済むまで待つ */
  async function dragTo(seconds: number) {
    const clientX = clientXAt(seconds);
    // dnd-kit の MouseSensor は mousedown を要素で、move/up を document で購読する
    fireEvent.mouseDown(screen.getByTestId(`entry-${draggedUid}`), { button: 0, clientX: clientXAt(startTime), clientY: 10 });
    // hook はポインタの clientX を window の pointermove で追っている
    fireEvent.pointerMove(window, { clientX, clientY: 10 });
    fireEvent.mouseMove(document, { clientX, clientY: 10 });
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    return clientX;
  }

  function drop(clientX: number) {
    fireEvent.mouseUp(document, { clientX, clientY: 10 });
  }

  return { result, resolvedEntries, onMoveEntry, dragTo, drop };
}

afterEach(cleanup);

describe("useTimelineDnd: タイムライン内 D&D の挿入位置（#190 の回帰）", () => {
  const entries: TimelineEntry[] = ["A", "B", "C", "D"].map((uid) => ({ uid, skillId: gcdSkill.id }));

  it("前提: A, B, C, D は 0 / 2.5 / 5 / 7.5 秒に並ぶ", () => {
    const { resolvedEntries } = setup(entries, "B");
    expect(resolvedEntries.map((e) => e.startTime)).toEqual([0, 2.5, 5, 7.5]);
  });

  // [ドラッグ先, 時刻（秒）, インジケーターの時刻（秒）, ドロップ後の位置, onMoveEntry の insertBeforeUid]
  it.each([
    ["C-D 間の左寄り", 6.3, 7.5, "D の前", "D"],
    ["C-D 間の中央", 7.0, 7.5, "D の前", "D"],
    ["D の左端ちょうど", 7.5, 7.5, "D の前", "D"],
    ["D の中央より先", 8.8, 10.0, "末尾", undefined],
  ] as const)(
    "B を %s（%s 秒）にドラッグすると、インジケーターが %s 秒に出て、ドロップで %sに入る",
    async (_place, seconds, indicatorSec, _dropAt, insertBefore) => {
      const { result, onMoveEntry, dragTo, drop } = setup(entries, "B");

      const clientX = await dragTo(seconds);
      expect(result.current.draggingEntryUid).toBe("B");
      expect(result.current.indicatorX).toBeCloseTo(indicatorSec * PX_PER_SEC, 6);

      drop(clientX);
      expect(onMoveEntry).toHaveBeenCalledExactlyOnceWith("B", insertBefore);
    }
  );
});

describe("useTimelineDnd: oGCD を挟む並びのタイムライン内 D&D（#190 の回帰）", () => {
  const entries: TimelineEntry[] = [
    { uid: "A", skillId: gcdSkill.id },
    { uid: "B", skillId: gcdSkill.id },
    { uid: "OG", skillId: ogcdSkill.id },
    { uid: "C", skillId: gcdSkill.id },
    { uid: "D", skillId: gcdSkill.id },
  ];

  it("前提: oGCD は B の直後（3.15 秒）、C と D は 5 / 7.5 秒に並ぶ", () => {
    const { resolvedEntries } = setup(entries, "B");
    expect(resolvedEntries.map((e) => e.startTime)).toEqual([0, 2.5, 3.15, 5, 7.5]);
  });

  it("B を C-D 間（7.0 秒）にドラッグすると、インジケーターが 7.5 秒に出て、ドロップで D の前に入る", async () => {
    const { result, onMoveEntry, dragTo, drop } = setup(entries, "B");

    const clientX = await dragTo(7.0);
    expect(result.current.indicatorX).toBeCloseTo(7.5 * PX_PER_SEC, 6);

    drop(clientX);
    expect(onMoveEntry).toHaveBeenCalledExactlyOnceWith("B", "D");
  });
});
