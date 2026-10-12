import { JOB_DATA } from "./job-registry";
import type { JobId } from "./job-registry";

/** ジョブピッカーのロール区分（FF14 本体と同じ分け方） */
export type JobRole = "tank" | "healer" | "melee" | "ranged" | "caster";

/** ロールの表示名と色。色は FF14 本体の慣例（タンク青・ヒーラー緑・DPS 赤）で、テーマに依存しない */
export const JOB_ROLES: { id: JobRole; label: string; color: string }[] = [
  { id: "tank", label: "タンク", color: "#3a64b8" },
  { id: "healer", label: "ヒーラー", color: "#357a45" },
  { id: "melee", label: "近接DPS", color: "#b23a3a" },
  { id: "ranged", label: "遠隔物理DPS", color: "#b23a3a" },
  { id: "caster", label: "遠隔魔法DPS", color: "#b23a3a" },
];

export interface CatalogJob {
  id: string;
  name: string;
  abbreviation: string;
  role: JobRole;
}

/**
 * 全戦闘ジョブの一覧（未実装ジョブを含む）。ジョブピッカーで「未対応」表示に使う。
 * 実装済みジョブの名前は JOB_DATA と揃える。
 */
export const JOB_CATALOG: CatalogJob[] = [
  { id: "pld", name: "ナイト", abbreviation: "PLD", role: "tank" },
  { id: "war", name: "戦士", abbreviation: "WAR", role: "tank" },
  { id: "drk", name: "暗黒騎士", abbreviation: "DRK", role: "tank" },
  { id: "gnb", name: "ガンブレイカー", abbreviation: "GNB", role: "tank" },
  { id: "whm", name: "白魔道士", abbreviation: "WHM", role: "healer" },
  { id: "sch", name: "学者", abbreviation: "SCH", role: "healer" },
  { id: "ast", name: "占星術師", abbreviation: "AST", role: "healer" },
  { id: "sge", name: "賢者", abbreviation: "SGE", role: "healer" },
  { id: "mnk", name: "モンク", abbreviation: "MNK", role: "melee" },
  { id: "drg", name: "竜騎士", abbreviation: "DRG", role: "melee" },
  { id: "nin", name: "忍者", abbreviation: "NIN", role: "melee" },
  { id: "sam", name: "侍", abbreviation: "SAM", role: "melee" },
  { id: "rpr", name: "リーパー", abbreviation: "RPR", role: "melee" },
  { id: "vpr", name: "ヴァイパー", abbreviation: "VPR", role: "melee" },
  { id: "brd", name: "詩人", abbreviation: "BRD", role: "ranged" },
  { id: "mch", name: "機工士", abbreviation: "MCH", role: "ranged" },
  { id: "dnc", name: "踊り子", abbreviation: "DNC", role: "ranged" },
  { id: "blm", name: "黒魔道士", abbreviation: "BLM", role: "caster" },
  { id: "smn", name: "召喚士", abbreviation: "SMN", role: "caster" },
  { id: "rdm", name: "赤魔道士", abbreviation: "RDM", role: "caster" },
  { id: "pct", name: "ピクトマンサー", abbreviation: "PCT", role: "caster" },
];

export function isImplementedJob(id: string): id is JobId {
  return id in JOB_DATA;
}
