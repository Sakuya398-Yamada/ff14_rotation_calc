/**
 * コンテンツのマスタ。保存するタイムラインに付けるコンテンツ（content_id）の選択肢。
 * - パッチ 7.57 まで反映済み（#483）。新しい零式・絶が来たら、その都度 Issue を起票して追加する
 * - id は D1 の timelines.content_id に残るので、変えたり消したりしない
 * - 保存 API の検証（src/server/routes/timelines-schema.ts）もこのファイルを import するので、ここからは何も import しない
 * - name はコンテンツファインダーの表示どおり（零式の区切りは全角コロン、数字は半角）
 */

export type ContentCategory = "savage" | "ultimate";

/** 区分の表示名。選択欄ではこの順に並べる */
export const CONTENT_CATEGORIES: { id: ContentCategory; label: string }[] = [
  { id: "savage", label: "零式" },
  { id: "ultimate", label: "絶" },
];

export interface CatalogContent {
  id: string;
  name: string;
  category: ContentCategory;
}

export const CONTENT_CATALOG: CatalogContent[] = [
  // 至天の座アルカディア零式: ライトヘビー級（7.05）・クルーザー級（7.2）・ヘビー級（7.4）
  { id: "m1s", name: "至天の座アルカディア零式：ライトヘビー級1", category: "savage" },
  { id: "m2s", name: "至天の座アルカディア零式：ライトヘビー級2", category: "savage" },
  { id: "m3s", name: "至天の座アルカディア零式：ライトヘビー級3", category: "savage" },
  { id: "m4s", name: "至天の座アルカディア零式：ライトヘビー級4", category: "savage" },
  { id: "m5s", name: "至天の座アルカディア零式：クルーザー級1", category: "savage" },
  { id: "m6s", name: "至天の座アルカディア零式：クルーザー級2", category: "savage" },
  { id: "m7s", name: "至天の座アルカディア零式：クルーザー級3", category: "savage" },
  { id: "m8s", name: "至天の座アルカディア零式：クルーザー級4", category: "savage" },
  { id: "m9s", name: "至天の座アルカディア零式：ヘビー級1", category: "savage" },
  { id: "m10s", name: "至天の座アルカディア零式：ヘビー級2", category: "savage" },
  { id: "m11s", name: "至天の座アルカディア零式：ヘビー級3", category: "savage" },
  { id: "m12s", name: "至天の座アルカディア零式：ヘビー級4", category: "savage" },
  // 絶は実装順（4.11・4.31・5.11・6.11・6.31・7.11・7.51）。過去の拡張の絶はレベルシンクで今も遊ばれている
  { id: "ucob", name: "絶バハムート討滅戦", category: "ultimate" },
  { id: "uwu", name: "絶アルテマウェポン破壊作戦", category: "ultimate" },
  { id: "tea", name: "絶アレキサンダー討滅戦", category: "ultimate" },
  { id: "dsr", name: "絶竜詩戦争", category: "ultimate" },
  { id: "top", name: "絶オメガ検証戦", category: "ultimate" },
  { id: "fru", name: "絶もうひとつの未来", category: "ultimate" },
  // 略称（DMU / UMAD）が定着していないので、英語名（Dancing Mad）から取る
  { id: "dancing-mad", name: "絶妖星乱舞", category: "ultimate" },
];

/** コンテンツの表示名。マスタに無い ID はそのまま返す */
export function contentName(id: string): string {
  return CONTENT_CATALOG.find((c) => c.id === id)?.name ?? id;
}
