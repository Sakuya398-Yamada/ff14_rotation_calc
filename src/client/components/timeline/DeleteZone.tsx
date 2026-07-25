import { styles } from "./styles";

interface DeleteZoneProps {
  overDeleteZone: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

/** タイムライン内エントリのドラッグ中のみ表示される削除ドロップゾーン */
export function DeleteZone({
  overDeleteZone,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: DeleteZoneProps) {
  return (
    <div
      style={{
        ...styles.deleteDropZone,
        ...(overDeleteZone ? styles.deleteDropZoneActive : {}),
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div style={styles.deleteDropZoneIcon} aria-hidden>×</div>
      <div style={styles.deleteDropZoneLabel}>ここにドロップして削除</div>
    </div>
  );
}
