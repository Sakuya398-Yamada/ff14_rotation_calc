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
import type { Skill, BuffDefinition, ResourceDefinition } from "../types/skill";

/** ジョブID */
export type JobId = "whm" | "drg" | "brd" | "pct" | "blm" | "sam" | "mnk";

/** ジョブデータ定義 */
export interface JobData {
  name: string;
  abbreviation: string;
  skills: Skill[];
  buffs: BuffDefinition[];
  resources: ResourceDefinition[];
}

/**
 * ジョブデータレジストリ。
 * キーの記述順がジョブセレクタの表示順になる（JOB_OPTIONS が派生元として参照する）。
 */
export const JOB_DATA: Record<JobId, JobData> = {
  whm: { name: "白魔道士", abbreviation: "WHM", skills: WHM_ATTACK_SKILLS, buffs: WHM_BUFFS, resources: WHM_RESOURCES },
  drg: { name: "竜騎士", abbreviation: "DRG", skills: DRG_ATTACK_SKILLS, buffs: DRG_BUFFS, resources: DRG_RESOURCES },
  brd: { name: "詩人", abbreviation: "BRD", skills: BRD_ATTACK_SKILLS, buffs: BRD_BUFFS, resources: BRD_RESOURCES },
  pct: { name: "ピクトマンサー", abbreviation: "PCT", skills: PCT_ATTACK_SKILLS, buffs: PCT_BUFFS, resources: PCT_RESOURCES },
  blm: { name: "黒魔道士", abbreviation: "BLM", skills: BLM_ATTACK_SKILLS, buffs: BLM_BUFFS, resources: BLM_RESOURCES },
  sam: { name: "侍", abbreviation: "SAM", skills: SAM_ATTACK_SKILLS, buffs: SAM_BUFFS, resources: SAM_RESOURCES },
  mnk: { name: "モンク", abbreviation: "MNK", skills: MNK_ATTACK_SKILLS, buffs: MNK_BUFFS, resources: MNK_RESOURCES },
};

/** ジョブセレクタ表示用の選択肢（JOB_DATA のキー順から派生） */
export const JOB_OPTIONS: { id: JobId; name: string }[] = (
  Object.keys(JOB_DATA) as JobId[]
).map((id) => ({ id, name: JOB_DATA[id].name }));
