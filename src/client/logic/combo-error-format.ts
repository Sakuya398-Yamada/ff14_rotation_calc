import i18next from "i18next";
import type { JobId } from "../data/job-registry";
import type { ComboError, ComboErrorKind } from "../types/skill";
import { buffName } from "./display-names";

/** 表示する順番 */
const KINDS: ComboErrorKind[] = ["missing", "forbidden"];

function label(kind: ComboErrorKind): string {
  return i18next.t(`comboErrorFormat.labels.${kind}` as const);
}

/**
 * 詳細パネル用。種類ごとに「ラベル: バフ名, …」の 1 行にする。辞書に無いバフは ID のまま出す。
 * OR 条件は「A・B のいずれか」にする（パネルはエラーどうしを " / " でつなぐので、候補の区切りに使わない）
 */
export function formatComboErrors(errors: ComboError[], jobId: JobId): string[] {
  const nameOf = (buffId: string) => buffName(i18next.t, jobId, buffId);
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
