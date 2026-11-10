import type { RecastStateAt, ResolvedTimelineEntry, Skill, TimelineStateAt } from "../types/skill";

/**
 * リキャストのレーンに描く区間（スキル ID → 使った順の区間）。固有リキャスト（cooldown）のあるスキルを、エラー無しで使ったエントリだけ。
 * キーは実行したスキル（自動変化の後）の ID で、最初に使った順に並ぶ
 */
export function buildCooldownSpans(
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>
): Map<string, { startTime: number; endTime: number; icon: string }[]> {
  const spans: Map<string, { startTime: number; endTime: number; icon: string }[]> = new Map();
  for (const entry of resolvedEntries) {
    const skill = skillMap.get(entry.resolvedSkillId) ?? skillMap.get(entry.skillId);
    if (!skill || skill.cooldown === undefined) continue;
    // エラーなしで実行されたスキルのみクールダウンを記録
    if (entry.recastError || entry.resourceErrors.length > 0 || entry.comboErrors.length > 0 || entry.untargetableError) continue;
    if (!spans.has(skill.id)) {
      spans.set(skill.id, []);
    }
    spans.get(skill.id)!.push({
      startTime: entry.startTime,
      endTime: entry.cooldownEndTime ?? Math.round((entry.startTime + skill.cooldown) * 1000) / 1000,
      icon: skill.icon,
    });
  }
  return spans;
}

/**
 * 時刻 state.time のリキャストの状態（#1000）。並ぶスキルはリキャストのレーンの行と同じ（buildCooldownSpans のキー）。
 * 使用可能か・残りチャージ・残り秒数は計算の状態（resolveStateAt）から求め、t までの短縮だけを反映する（ゲーム内の表示と同じ）。
 * 実際に戻る時刻は、t より後の短縮も込みのレーンの区間（resolvedEntries は全体の計算結果）の終わりから求める。
 * cooldownGroup を共有するスキルは、グループのスキル全部の区間で数える
 */
export function getRecastStatesAt(
  state: TimelineStateAt,
  resolvedEntries: ResolvedTimelineEntry[],
  skillMap: Map<string, Skill>
): RecastStateAt[] {
  const time = state.time;
  const spans = buildCooldownSpans(resolvedEntries, skillMap);
  const chargeKeyOf = (skillId: string) => {
    const skill = skillMap.get(skillId);
    return skill?.cooldownGroup ?? skillId;
  };
  return [...spans.keys()].map((skillId) => {
    const chargeKey = chargeKeyOf(skillId);
    const maxCharges = skillMap.get(skillId)?.maxCharges ?? 1;
    const charge = state.charges[chargeKey];
    const charges = charge?.charges ?? maxCharges;
    const nextChargeAt = charge?.nextChargeAt ?? null;
    const coveringEnds = [...spans]
      .filter(([id]) => chargeKeyOf(id) === chargeKey)
      .flatMap(([, s]) => s)
      .filter((s) => s.startTime <= time && time < s.endTime)
      .map((s) => s.endTime);
    return {
      skillId,
      available: charges > 0,
      remaining: nextChargeAt === null ? 0 : Math.round((nextChargeAt - time) * 1000) / 1000,
      ...(coveringEnds.length > 0 ? { actualEndTime: Math.min(...coveringEnds) } : {}),
      ...(maxCharges > 1 ? { charges, maxCharges } : {}),
    };
  });
}
