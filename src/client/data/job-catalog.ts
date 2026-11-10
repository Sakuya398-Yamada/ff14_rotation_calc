import { JOB_DATA } from "./job-registry";
import type { JobId } from "./job-registry";

/** ジョブピッカーのロール区分（FF14 本体と同じ分け方） */
export type JobRole = "tank" | "healer" | "melee" | "ranged" | "caster";

/** ロールの並びと色。名前は辞書の catalog にある。色は FF14 本体の慣例（タンク青・ヒーラー緑・DPS 赤）で、テーマに依存しない */
export const JOB_ROLES: { id: JobRole; color: string }[] = [
  { id: "tank", color: "#3a64b8" },
  { id: "healer", color: "#357a45" },
  { id: "melee", color: "#b23a3a" },
  { id: "ranged", color: "#b23a3a" },
  { id: "caster", color: "#b23a3a" },
];

export interface CatalogJob {
  id: string;
  /** 公式の略称が未発表のジョブ（8.0 の新ジョブ）は持たない。バッジは色だけになる（#1003） */
  abbreviation?: string;
  role: JobRole;
  /** エヴォルヴモードにしか無いジョブ。エヴォルヴを実装したら、エヴォルヴ側の一覧に移す（#1002・#1003） */
  evolvedOnly?: boolean;
}

/**
 * 全戦闘ジョブの一覧（未実装ジョブを含む）。ジョブピッカーで「未対応」表示に使う。
 * 名前は辞書の catalog（`jobs.<id>.name`）にある。実装済みジョブの略称は JOB_DATA と揃える。
 */
export const JOB_CATALOG: CatalogJob[] = [
  { id: "pld", abbreviation: "PLD", role: "tank" },
  { id: "war", abbreviation: "WAR", role: "tank" },
  { id: "drk", abbreviation: "DRK", role: "tank" },
  { id: "gnb", abbreviation: "GNB", role: "tank" },
  { id: "bastion", role: "tank", evolvedOnly: true },
  { id: "whm", abbreviation: "WHM", role: "healer" },
  { id: "sch", abbreviation: "SCH", role: "healer" },
  { id: "ast", abbreviation: "AST", role: "healer" },
  { id: "sge", abbreviation: "SGE", role: "healer" },
  { id: "mnk", abbreviation: "MNK", role: "melee" },
  { id: "drg", abbreviation: "DRG", role: "melee" },
  { id: "nin", abbreviation: "NIN", role: "melee" },
  { id: "sam", abbreviation: "SAM", role: "melee" },
  { id: "rpr", abbreviation: "RPR", role: "melee" },
  { id: "vpr", abbreviation: "VPR", role: "melee" },
  { id: "brd", abbreviation: "BRD", role: "ranged" },
  { id: "mch", abbreviation: "MCH", role: "ranged" },
  { id: "dnc", abbreviation: "DNC", role: "ranged" },
  { id: "zephyr", role: "ranged", evolvedOnly: true },
  { id: "blm", abbreviation: "BLM", role: "caster" },
  { id: "smn", abbreviation: "SMN", role: "caster" },
  { id: "rdm", abbreviation: "RDM", role: "caster" },
  { id: "pct", abbreviation: "PCT", role: "caster" },
];

export function isImplementedJob(id: string): id is JobId {
  return Object.hasOwn(JOB_DATA, id);
}
