import { WHM_ATTACK_SKILLS } from "./whm-skills";
import { WHM_RESOURCES } from "./whm-resources";
import { WHM_BUFFS } from "./whm-buffs";
import { DRG_ATTACK_SKILLS } from "./drg-skills";
import { DRG_RESOURCES } from "./drg-resources";
import { DRG_BUFFS } from "./drg-buffs";
import { BRD_ATTACK_SKILLS } from "./brd-skills";
import { BRD_RESOURCES } from "./brd-resources";
import { BRD_BUFFS } from "./brd-buffs";
import { PCT_ATTACK_SKILLS } from "./pct-skills";
import { PCT_RESOURCES } from "./pct-resources";
import { PCT_BUFFS } from "./pct-buffs";
import { BLM_ATTACK_SKILLS } from "./blm-skills";
import { BLM_RESOURCES } from "./blm-resources";
import { BLM_BUFFS } from "./blm-buffs";
import { SAM_ATTACK_SKILLS } from "./sam-skills";
import { SAM_RESOURCES } from "./sam-resources";
import { SAM_BUFFS } from "./sam-buffs";
import { MNK_ATTACK_SKILLS } from "./mnk-skills";
import { MNK_RESOURCES } from "./mnk-resources";
import { MNK_BUFFS } from "./mnk-buffs";
import { SCH_ATTACK_SKILLS } from "./sch-skills";
import { SCH_RESOURCES } from "./sch-resources";
import { SCH_BUFFS } from "./sch-buffs";
import { AST_ATTACK_SKILLS } from "./ast-skills";
import { AST_RESOURCES } from "./ast-resources";
import { AST_BUFFS } from "./ast-buffs";
import { SGE_ATTACK_SKILLS } from "./sge-skills";
import { SGE_RESOURCES } from "./sge-resources";
import { SGE_BUFFS } from "./sge-buffs";
import { PLD_ATTACK_SKILLS } from "./pld-skills";
import { PLD_RESOURCES } from "./pld-resources";
import { PLD_BUFFS } from "./pld-buffs";
import { WAR_ATTACK_SKILLS } from "./war-skills";
import { WAR_RESOURCES } from "./war-resources";
import { WAR_BUFFS } from "./war-buffs";
import { GNB_ATTACK_SKILLS } from "./gnb-skills";
import { GNB_RESOURCES } from "./gnb-resources";
import { GNB_BUFFS } from "./gnb-buffs";
import type { Skill, BuffDefinition, ResourceDefinition } from "../types/skill";

/** ジョブID */
export type JobId = "whm" | "drg" | "brd" | "pct" | "blm" | "sam" | "mnk" | "sch" | "ast" | "sge" | "pld" | "war" | "gnb";

/** ジョブデータ定義 */
export interface JobData {
  abbreviation: string;
  skills: Skill[];
  buffs: BuffDefinition[];
  resources: ResourceDefinition[];
}

/**
 * ジョブデータレジストリ（実装済みジョブ）。
 * ジョブピッカーの表示順・ロールは job-catalog.ts の JOB_CATALOG で決まる。ここにジョブを追加したら JOB_CATALOG にも揃える。
 */
export const JOB_DATA: Record<JobId, JobData> = {
  whm: { abbreviation: "WHM", skills: WHM_ATTACK_SKILLS, buffs: WHM_BUFFS, resources: WHM_RESOURCES },
  drg: { abbreviation: "DRG", skills: DRG_ATTACK_SKILLS, buffs: DRG_BUFFS, resources: DRG_RESOURCES },
  brd: { abbreviation: "BRD", skills: BRD_ATTACK_SKILLS, buffs: BRD_BUFFS, resources: BRD_RESOURCES },
  pct: { abbreviation: "PCT", skills: PCT_ATTACK_SKILLS, buffs: PCT_BUFFS, resources: PCT_RESOURCES },
  blm: { abbreviation: "BLM", skills: BLM_ATTACK_SKILLS, buffs: BLM_BUFFS, resources: BLM_RESOURCES },
  sam: { abbreviation: "SAM", skills: SAM_ATTACK_SKILLS, buffs: SAM_BUFFS, resources: SAM_RESOURCES },
  mnk: { abbreviation: "MNK", skills: MNK_ATTACK_SKILLS, buffs: MNK_BUFFS, resources: MNK_RESOURCES },
  sch: { abbreviation: "SCH", skills: SCH_ATTACK_SKILLS, buffs: SCH_BUFFS, resources: SCH_RESOURCES },
  ast: { abbreviation: "AST", skills: AST_ATTACK_SKILLS, buffs: AST_BUFFS, resources: AST_RESOURCES },
  sge: { abbreviation: "SGE", skills: SGE_ATTACK_SKILLS, buffs: SGE_BUFFS, resources: SGE_RESOURCES },
  pld: { abbreviation: "PLD", skills: PLD_ATTACK_SKILLS, buffs: PLD_BUFFS, resources: PLD_RESOURCES },
  war: { abbreviation: "WAR", skills: WAR_ATTACK_SKILLS, buffs: WAR_BUFFS, resources: WAR_RESOURCES },
  gnb: { abbreviation: "GNB", skills: GNB_ATTACK_SKILLS, buffs: GNB_BUFFS, resources: GNB_RESOURCES },
};
