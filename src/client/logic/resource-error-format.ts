import i18next from "i18next";
import type { ResourceDefinition, ResourceError, ResourceErrorKind } from "../types/skill";

/** 表示する順番 */
const KINDS: ResourceErrorKind[] = ["insufficient", "overMax"];

function label(kind: ResourceErrorKind): string {
  return i18next.t(`resourceErrorFormat.labels.${kind}` as const);
}

/** 詳細パネル用。種類ごとに「ラベル: リソース名, …」の 1 行にする。定義の無いリソースは ID のまま出す */
export function formatResourceErrors(
  errors: ResourceError[],
  resourceDefMap: Map<string, ResourceDefinition>
): string[] {
  return KINDS.flatMap((kind) => {
    const names = errors
      .filter((e) => e.kind === kind)
      .map((e) => resourceDefMap.get(e.resourceId)?.name ?? e.resourceId);
    return names.length > 0 ? [`${label(kind)}: ${names.join(", ")}`] : [];
  });
}

/** タイムラインのアイコンの title 用。含まれる種類ごとに「 ⚠ ラベル」をつなぐ */
export function formatResourceErrorWarnings(errors: ResourceError[]): string {
  return KINDS.filter((kind) => errors.some((e) => e.kind === kind))
    .map((kind) => ` ⚠ ${label(kind)}`)
    .join("");
}
