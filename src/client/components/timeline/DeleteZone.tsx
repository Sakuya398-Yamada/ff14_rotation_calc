import { useDroppable } from "@dnd-kit/core";
import { DELETE_ZONE_ID } from "./dnd-types";
import { styles } from "./styles";

interface DeleteZoneProps {
  overDeleteZone: boolean;
}

/** タイムライン内エントリのドラッグ中のみ表示される削除ドロップゾーン */
export function DeleteZone({ overDeleteZone }: DeleteZoneProps) {
  const { setNodeRef } = useDroppable({ id: DELETE_ZONE_ID });
  return (
    <div
      ref={setNodeRef}
      style={{
        ...styles.deleteDropZone,
        ...(overDeleteZone ? styles.deleteDropZoneActive : {}),
      }}
    >
      <div style={styles.deleteDropZoneIcon} aria-hidden>×</div>
      <div style={styles.deleteDropZoneLabel}>ここにドロップして削除</div>
    </div>
  );
}
