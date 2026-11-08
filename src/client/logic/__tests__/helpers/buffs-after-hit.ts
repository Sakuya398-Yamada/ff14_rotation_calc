import type { ActiveBuff, BuffDefinition, ResolvedTimelineEntry } from "../../../types/skill";

/**
 * このエントリの効果が着弾した後のバフ（#948）。
 * 詠唱のあるスキルと着弾までの遅れを設定したスキルが付けるバフは着弾時刻に付くので、付けたエントリの activeBuffs
 * （実行後のスナップショット）には入らず、hitAppliedBuffs にある。着弾での付与は同じバフを付け直し、同じ排他グループの
 * バフを外すので、activeBuffs からそれらを除いて hitAppliedBuffs を足す。
 * 「付けない」「段階を維持する」を確かめるときに activeBuffs だけを見ると、着弾で付いた・付け替わった分が見えず、
 * 誤っていても通ってしまう
 */
export function buffsAfterHit(
  entry: Pick<ResolvedTimelineEntry, "activeBuffs" | "hitAppliedBuffs">,
  buffs: BuffDefinition[],
): ActiveBuff[] {
  const landed = entry.hitAppliedBuffs ?? [];
  if (landed.length === 0) return entry.activeBuffs;
  const groups = new Map(buffs.map((b) => [b.id, b.exclusiveGroup]));
  const replaced = (buffId: string) =>
    landed.some((l) => {
      const group = groups.get(l.buffId);
      return l.buffId === buffId || (group !== undefined && group === groups.get(buffId));
    });
  return [...landed, ...entry.activeBuffs.filter((ab) => !replaced(ab.buffId))];
}

export function hasBuffAfterHit(
  entry: Pick<ResolvedTimelineEntry, "activeBuffs" | "hitAppliedBuffs">,
  buffs: BuffDefinition[],
  buffId: string,
): boolean {
  return buffsAfterHit(entry, buffs).some((ab) => ab.buffId === buffId);
}
