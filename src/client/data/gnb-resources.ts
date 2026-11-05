import type { ResourceDefinition } from "../types/skill";

/**
 * ガンブレイカー（GNB）リソース定義
 * ソイル（カートリッジ）: ソリッドバレル・デーモンスローターのコンボ成立（各 +1）とブラッドソイル（+2。Lv88 から +3）で得て、
 * バーストストライク・ビートファング・フェイテッドサークル（各 1）とダブルダウン（2）で消費する。
 * 最大は 2（Lv88 の特性ソイルチャージ効果アップから 3）、ブラッドソイルの効果中は 4（同 6）。
 * ブラッドソイルの効果が切れたときに上限を超えて残っていた分の扱いは、出典で確かめられなかったので表さない（そのまま残る）
 */
export const GNB_RESOURCES: ResourceDefinition[] = [
  {
    id: "cartridge",
    maxStacks: 2,
    color: "#5c6bc0",
    acquiredLevel: 30,
    whileBuffModifiers: [{ buffId: "bloodfest", maxStacks: 4 }],
    traitOverrides: [{ traitLevel: 88, maxStacks: 3, whileBuffModifiers: [{ buffId: "bloodfest", maxStacks: 6 }] }],
  },
];
