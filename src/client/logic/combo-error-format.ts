import i18next from "i18next";
import type { BuffDefinition, ComboError, ComboErrorKind } from "../types/skill";

/** 表示する順番 */
const KINDS: ComboErrorKind[] = ["missing", "forbidden"];

function label(kind: ComboErrorKind): string {
  return i18next.t(`comboErrorFormat.labels.${kind}` as const);
}

/**
 * 詳細パネル用。種類ごとに「ラベル: バフ名, …」の 1 行にする。定義の無いバフは ID のまま出す。
 * OR 条件は「A・B のいずれか」にする（パネルはエラーどうしを " / " でつなぐので、候補の区切りに使わない）
 */
export function formatComboErrors(errors: ComboError[], buffDefMap: Map<string, BuffDefinition>): string[] {
  const nameOf = (buffId: string) => buffDefMap.get(buffId)?.name ?? buffId;
  return KINDS.flatMap((kind) => {
    const names = errors
      .filter((e) => e.kind === kind)
      .map((e) =>
        e.anyOf
          ? i18next.t("comboErrorFormat.anyOf", { names: e.anyOf.map(nameOf).join(i18next.t("comboErrorFormat.anyOfSeparator")) })
          : nameOf(e.buffId)
      );
    return names.length > 0 ? [`${label(kind)}: ${names.join(", ")}`] : [];
  });
}

/** タイムラインのアイコンの title 用。含まれる種類ごとに「 ⚠ ラベル」をつなぐ */
export function formatComboErrorWarnings(errors: ComboError[]): string {
  return KINDS.filter((kind) => errors.some((e) => e.kind === kind))
    .map((kind) => ` ⚠ ${label(kind)}`)
    .join("");
}
