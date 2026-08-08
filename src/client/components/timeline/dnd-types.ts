/** dnd-kit のドロップ先ID（タイムライン本体） */
export const TIMELINE_DROPZONE_ID = "timeline-dropzone";
/** dnd-kit のドロップ先ID（削除ゾーン） */
export const DELETE_ZONE_ID = "delete-zone";

/** パレットのスキルカードから開始したドラッグ */
export interface PaletteDragData {
  source: "palette";
  skillId: string;
  skillType: "gcd" | "ogcd";
}

/** タイムライン上の既存エントリから開始したドラッグ */
export interface TimelineEntryDragData {
  source: "timeline";
  uid: string;
  skillId: string;
  skillType: "gcd" | "ogcd";
}

export type TimelineDragData = PaletteDragData | TimelineEntryDragData;

/**
 * ドラッグ開始イベント（activatorEvent）と累積 delta から現在のポインタ clientX を復元する。
 * dnd-kit のイベントはポインタ座標を直接持たないため、開始座標 + delta で求める。
 * TouchEvent は jsdom に存在しない環境があるため typeof ガードを挟む。
 */
export function getDragClientX(activatorEvent: Event, deltaX: number): number | null {
  let startX: number | null = null;
  if (typeof TouchEvent !== "undefined" && activatorEvent instanceof TouchEvent) {
    startX = activatorEvent.touches[0]?.clientX ?? null;
  } else if (activatorEvent instanceof MouseEvent) {
    // PointerEvent は MouseEvent を継承しているためここで拾える
    startX = activatorEvent.clientX;
  }
  return startX === null ? null : startX + deltaX;
}
