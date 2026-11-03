import type { ParseKeys, TFunction } from "i18next";
import { CONTENT_CATALOG } from "../data/content-catalog";
import type { ContentCategory } from "../data/content-catalog";
import { JOB_CATALOG } from "../data/job-catalog";
import type { JobRole } from "../data/job-catalog";
import type { JobId } from "../data/job-registry";
import type { Language } from "./language-path";

/**
 * データの ID から表示名を引く（#846）。名前は辞書の catalog と job-<ジョブ ID> の名前空間にあり、データには持たない。
 * ID を組み立てるキーは型でキーの有無を確かめられないので、全 ID に ja と en があることを display-names.test.ts で確かめる。
 * 辞書に無い ID（テストのフィクスチャなど）は ID をそのまま返す。
 */

type JobNamespace = `job-${JobId}`;

function jobText(t: TFunction, jobId: JobId, key: string, id: string): string {
  return t(key as ParseKeys<JobNamespace>, { ns: `job-${jobId}`, defaultValue: id });
}

export function skillName(t: TFunction, jobId: JobId, id: string): string {
  return jobText(t, jobId, `skills.${id}.name`, id);
}

export function buffName(t: TFunction, jobId: JobId, id: string): string {
  return jobText(t, jobId, `buffs.${id}.name`, id);
}

/** レーンのラベル。`\n` で 2 行に分けてあることがある */
export function buffShortName(t: TFunction, jobId: JobId, id: string): string {
  return jobText(t, jobId, `buffs.${id}.shortName`, id);
}

export function resourceName(t: TFunction, jobId: JobId, id: string): string {
  return jobText(t, jobId, `resources.${id}.name`, id);
}

/** レーンのラベル。`\n` で 2 行に分けてあることがある */
export function resourceShortName(t: TFunction, jobId: JobId, id: string): string {
  return jobText(t, jobId, `resources.${id}.shortName`, id);
}

/**
 * ジョブ名。保存データから来る ID も受け取るので、カタログに無い ID はそのまま返す。
 * `lng` を渡すと、表示中の言語にかかわらずその言語の名前を返す（ジョブ選択の検索で日英の両方を引く）
 */
export function jobName(t: TFunction, id: string, lng?: Language): string {
  if (!JOB_CATALOG.some((job) => job.id === id)) return id;
  return t(`jobs.${id}.name` as ParseKeys<"catalog">, { ns: "catalog", ...(lng ? { lng } : {}) });
}

export function roleName(t: TFunction, role: JobRole): string {
  return t(`roles.${role}.name`, { ns: "catalog" });
}

/** コンテンツ名。共有データから来る ID も受け取るので、マスタに無い ID はそのまま返す */
export function contentName(t: TFunction, id: string): string {
  if (!CONTENT_CATALOG.some((content) => content.id === id)) return id;
  return t(`contents.${id}.name` as ParseKeys<"catalog">, { ns: "catalog" });
}

export function contentCategoryName(t: TFunction, category: ContentCategory): string {
  return t(`contentCategories.${category}.name`, { ns: "catalog" });
}
