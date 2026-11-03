import i18next from "i18next";
import type { JobId } from "../data/job-registry";
import type { ResourceError, ResourceErrorKind } from "../types/skill";
import { resourceName } from "./display-names";

/** 表示する順番 */
const KINDS: ResourceErrorKind[] = ["insufficient", "overMax"];

function label(kind: ResourceErrorKind): string {
  return i18next.t(`resourceErrorFormat.labels.${kind}` as const);
}

/** 詳細パネル用。種類ごとに「ラベル: リソース名, …」の 1 行にする。辞書に無いリソースは ID のまま出す */
export function formatResourceErrors(errors: ResourceError[], jobId: JobId): string[] {
  return KINDS.flatMap((kind) => {
    const names = errors
      .filter((e) => e.kind === kind)
      .map((e) => resourceName(i18next.t, jobId, e.resourceId));
    return names.length > 0 ? [`${label(kind)}: ${names.join(", ")}`] : [];
  });
}

/** タイムラインのアイコンの title 用。含まれる種類ごとに「 ⚠ ラベル」をつなぐ */
export function formatResourceErrorWarnings(errors: ResourceError[]): string {
  return KINDS.filter((kind) => errors.some((e) => e.kind === kind))
    .map((kind) => ` ⚠ ${label(kind)}`)
    .join("");
}
