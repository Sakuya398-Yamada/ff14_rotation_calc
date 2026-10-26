import type { BuffDefinition, ComboError, ComboErrorKind } from "../types/skill";

const COMBO_ERROR_LABELS: Record<ComboErrorKind, string> = {
  missing: "バフ条件未達成",
  forbidden: "バフ効果中",
};

const KINDS = Object.keys(COMBO_ERROR_LABELS) as ComboErrorKind[];

/**
 * 詳細パネル用。種類ごとに「ラベル: バフ名, …」の 1 行にする。定義の無いバフは ID のまま出す。
 * OR 条件は「A・B のいずれか」にする（パネルはエラーどうしを " / " でつなぐので、候補の区切りに使わない）
 */
export function formatComboErrors(errors: ComboError[], buffDefMap: Map<string, BuffDefinition>): string[] {
  const nameOf = (buffId: string) => buffDefMap.get(buffId)?.name ?? buffId;
  return KINDS.flatMap((kind) => {
    const names = errors
      .filter((e) => e.kind === kind)
      .map((e) => (e.anyOf ? `${e.anyOf.map(nameOf).join("・")} のいずれか` : nameOf(e.buffId)));
    return names.length > 0 ? [`${COMBO_ERROR_LABELS[kind]}: ${names.join(", ")}`] : [];
  });
}

/** タイムラインのアイコンの title 用。含まれる種類ごとに「 ⚠ ラベル」をつなぐ */
export function formatComboErrorWarnings(errors: ComboError[]): string {
  return KINDS.filter((kind) => errors.some((e) => e.kind === kind))
    .map((kind) => ` ⚠ ${COMBO_ERROR_LABELS[kind]}`)
    .join("");
}
