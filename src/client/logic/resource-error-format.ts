import type { ResourceDefinition, ResourceError, ResourceErrorKind } from "../types/skill";

const RESOURCE_ERROR_LABELS: Record<ResourceErrorKind, string> = {
  insufficient: "リソース不足",
  overMax: "リソース超過",
};

const KINDS = Object.keys(RESOURCE_ERROR_LABELS) as ResourceErrorKind[];

/** 詳細パネル用。種類ごとに「ラベル: リソース名, …」の 1 行にする。定義の無いリソースは ID のまま出す */
export function formatResourceErrors(
  errors: ResourceError[],
  resourceDefMap: Map<string, ResourceDefinition>
): string[] {
  return KINDS.flatMap((kind) => {
    const names = errors
      .filter((e) => e.kind === kind)
      .map((e) => resourceDefMap.get(e.resourceId)?.name ?? e.resourceId);
    return names.length > 0 ? [`${RESOURCE_ERROR_LABELS[kind]}: ${names.join(", ")}`] : [];
  });
}

/** タイムラインのアイコンの title 用。含まれる種類ごとに「 ⚠ ラベル」をつなぐ */
export function formatResourceErrorWarnings(errors: ResourceError[]): string {
  return KINDS.filter((kind) => errors.some((e) => e.kind === kind))
    .map((kind) => ` ⚠ ${RESOURCE_ERROR_LABELS[kind]}`)
    .join("");
}
