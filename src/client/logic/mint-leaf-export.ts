import type { ResolvedTimelineEntry, Skill } from "../types/skill";

/** Mint Leaf（https://mint-leaf.thebalanceffxiv.com/）の Import / Export 欄に貼るテキスト。書式は #834 のコメント */
export interface MintLeafExport {
  /** 1 行に 1 アクション。書き出すものが無ければ空文字 */
  text: string;
  /** gameActionId が無いので書き出さなかったスキルの ID（resolvedSkillId）。重複なしで、出てきた順 */
  skippedSkillIds: string[];
}

/**
 * 解決済みのタイムラインを Mint Leaf のテキストにする（#834）。
 * ID は自動変化した後のスキルから引く。GCD のリキャスト・詠唱は、スキルスピードやバフを反映したこのツールの計算値を書く。
 * 開始時刻・oGCD を挟むタイミング・バフは書式に載せない（oGCD はいつも normal）
 */
export function toMintLeafText(entries: ResolvedTimelineEntry[], skillMap: Map<string, Skill>): MintLeafExport {
  const lines: string[] = [];
  const skipped = new Set<string>();
  for (const entry of entries) {
    const skill = skillMap.get(entry.resolvedSkillId);
    if (skill?.gameActionId === undefined) {
      skipped.add(entry.resolvedSkillId);
      continue;
    }
    lines.push(
      skill.type === "gcd"
        ? `${skill.gameActionId} GCD ${formatSeconds(entry.gcdRecast)} ${formatSeconds(entry.castTime)}`
        : `${skill.gameActionId} oGCD normal`,
    );
  }
  return { text: lines.join("\n"), skippedSkillIds: [...skipped] };
}

/**
 * 小数 2 桁に丸める。resolveTimeline の時間はミリ秒単位なので、先にミリ秒に丸めて、
 * 秒の計算に出る浮動小数の誤差（2.125 が 2.1249999… になる）で 2 桁の丸めがずれないようにする
 */
function formatSeconds(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  return String(Math.round(ms / 10) / 100);
}
