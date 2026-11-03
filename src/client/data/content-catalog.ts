/**
 * コンテンツのマスタ。保存するタイムラインに付けるコンテンツ（content_id）の選択肢。
 * - パッチ 7.57 まで反映済み（#483）。新しい零式・絶が来たら、その都度 Issue を起票して追加する
 * - id は D1 の timelines.content_id に残るので、変えたり消したりしない
 * - 保存 API の検証（src/server/routes/timelines-schema.ts）もこのファイルを import するので、ここからは何も import しない
 * - 名前は辞書の catalog（`contents.<id>.name`）にある。日本語はコンテンツファインダーの表示どおり（零式の区切りは全角コロン、数字は半角）
 */

export type ContentCategory = "savage" | "ultimate";

/** 区分の並び。選択欄ではこの順に並べる。名前は辞書の catalog（`contentCategories.<id>.name`）にある */
export const CONTENT_CATEGORIES: ContentCategory[] = ["savage", "ultimate"];

export interface CatalogContent {
  id: string;
  category: ContentCategory;
}

export const CONTENT_CATALOG: CatalogContent[] = [
  // 至天の座アルカディア零式: ライトヘビー級（7.05）・クルーザー級（7.2）・ヘビー級（7.4）
  { id: "m1s", category: "savage" },
  { id: "m2s", category: "savage" },
  { id: "m3s", category: "savage" },
  { id: "m4s", category: "savage" },
  { id: "m5s", category: "savage" },
  { id: "m6s", category: "savage" },
  { id: "m7s", category: "savage" },
  { id: "m8s", category: "savage" },
  { id: "m9s", category: "savage" },
  { id: "m10s", category: "savage" },
  { id: "m11s", category: "savage" },
  { id: "m12s", category: "savage" },
  // 絶は実装順（4.11・4.31・5.11・6.11・6.31・7.11・7.51）。過去の拡張の絶はレベルシンクで今も遊ばれている
  { id: "ucob", category: "ultimate" },
  { id: "uwu", category: "ultimate" },
  { id: "tea", category: "ultimate" },
  { id: "dsr", category: "ultimate" },
  { id: "top", category: "ultimate" },
  { id: "fru", category: "ultimate" },
  // 略称（DMU / UMAD）が定着していないので、英語名（Dancing Mad）から取る
  { id: "dancing-mad", category: "ultimate" },
];
