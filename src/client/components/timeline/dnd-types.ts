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
 * ドラッグ開始イベント（activatorEvent）からポインタ clientX を取り出す。
 * 以降のポインタ座標は use-timeline-dnd 側の window リスナーで追跡する
 * （dnd-kit の delta はスクロール補正込みのため clientX の復元には使えない）。
 * TouchEvent は jsdom に存在しない環境があるため typeof ガードを挟む。
 */
export function getEventClientX(activatorEvent: Event): number | null {
  if (typeof TouchEvent !== "undefined" && activatorEvent instanceof TouchEvent) {
    return activatorEvent.touches[0]?.clientX ?? null;
  }
  if (activatorEvent instanceof MouseEvent) {
    // PointerEvent は MouseEvent を継承しているためここで拾える
    return activatorEvent.clientX;
  }
  return null;
}
