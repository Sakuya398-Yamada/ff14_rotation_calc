import i18next from "i18next";
import type { JobId } from "../data/job-registry";
import type { ActiveBuff, BuffDefinition, BuffEffect, ResolvedTimelineEntry, Skill } from "../types/skill";
import { buffName, resourceName, skillName } from "./display-names";

function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function describeEffectBody(effect: BuffEffect): string | null {
  switch (effect.type) {
    case "potency":
      return i18next.t("buffFormat.effects.potency", { value: effect.value.toFixed(2) });
    case "potencyAdd":
      return i18next.t("buffFormat.effects.potencyAdd", { value: effect.value });
    case "critRate":
      return `CRT+${formatRate(effect.value)}`;
    case "dhRate":
      return `DH+${formatRate(effect.value)}`;
    case "speed":
      return `GCD×${effect.value}`;
    case "guaranteedCrit":
      return i18next.t("buffFormat.effects.guaranteedCrit");
    case "guaranteedDh":
      return i18next.t("buffFormat.effects.guaranteedDh");
    case "instantCast":
      return i18next.t("buffFormat.effects.instantCast");
    default:
      // コンボ判定・リソース操作など計算の内部挙動を表す種別は、利用者向けの要約に出さない
      return null;
  }
}

function describeEffect(effect: BuffEffect): string | null {
  const body = describeEffectBody(effect);
  if (body === null) return null;
  return effect.appliesToSkillIds ? i18next.t("buffFormat.someSkills", { effect: body }) : body;
}

/** バフ効果の利用者向け要約（重複は除く）。表示できる効果が無ければ空配列 */
export function describeBuffEffects(def: BuffDefinition): string[] {
  const labels = def.effects.map(describeEffect).filter((label): label is string => label !== null);
  return [...new Set(labels)];
}

/** スキル使用時点での残り時間。永続バフは "∞" */
export function formatBuffRemaining(activeBuff: ActiveBuff, useTime: number): string {
  if (!Number.isFinite(activeBuff.endTime)) return "∞";
  return `${Math.max(0, activeBuff.endTime - useTime).toFixed(1)}s`;
}

function formatPercentRounded(rate: number, fractionDigits: number): string {
  const scale = 10 ** fractionDigits;
  // 1 − 0.65² = 0.5774999999999999 を 57.7 に、0.575 を 57 にしないよう、浮動小数の誤差を落としてから四捨五入する
  return `${(Math.round(Number((rate * (100 * scale)).toPrecision(12))) / scale).toFixed(fractionDigits)}%`;
}

/** 発動確率を小数第1位までの % にする */
export function formatProcRate(rate: number): string {
  return formatPercentRounded(rate, 1);
}

/** 発動確率を整数の % にする（バフバーのラベル用） */
export function formatProcRateShort(rate: number): string {
  return formatPercentRounded(rate, 0);
}

/** 期待値の補正に使った発動確率。例: "ホークアイ発動確率 35.0%（不発時はバーストショット）" */
export function formatConsumedProc(
  consumedProc: NonNullable<ResolvedTimelineEntry["consumedProc"]>,
  jobId: JobId,
): string {
  const name = buffName(i18next.t, jobId, consumedProc.buffId);
  const rate = formatProcRate(consumedProc.procRate);
  return consumedProc.fallbackSkillId
    ? i18next.t("buffFormat.consumedProcWithFallback", {
        name,
        rate,
        skill: skillName(i18next.t, jobId, consumedProc.fallbackSkillId),
      })
    : i18next.t("buffFormat.consumedProc", { name, rate });
}

/** 確率で得るリソースを消費したときの、期待値の補正に使った確率。例: "幻扇がある確率 50.0%" (#1005) */
export function formatConsumedResourceProc(
  consumedResourceProc: NonNullable<ResolvedTimelineEntry["consumedResourceProc"]>,
  jobId: JobId,
): string {
  return i18next.t("buffFormat.consumedResourceProc", {
    name: resourceName(i18next.t, jobId, consumedResourceProc.resourceId),
    rate: formatProcRate(consumedResourceProc.procRate),
  });
}

/** 効いているバフに重ねて無駄になる確率付与。例: "ホークアイ上書き確率 12.3%" (#842) */
export function formatWastedProc(
  wastedProc: NonNullable<ResolvedTimelineEntry["wastedProc"]>,
  jobId: JobId,
): string {
  const name = buffName(i18next.t, jobId, wastedProc.buffId);
  return i18next.t("buffFormat.wastedProc", { name, rate: formatProcRate(wastedProc.rate) });
}

/** 発生の有無を指定できない確率付与のバフ。黒魔道士のファイアスターターは #838 で対象外にした */
const PROC_OUTCOME_EXCLUDED_BUFF_IDS: ReadonlySet<string> = new Set(["firestarter"]);

/** 確率付与のバフの発生の有無を指定できるか（上書き確率もこれに当たるバフだけ出す） */
export function isProcOutcomeBuff(buffId: string): boolean {
  return !PROC_OUTCOME_EXCLUDED_BUFF_IDS.has(buffId);
}

/**
 * スキルが発生の有無を指定できる確率付与を持つなら、その付与するバフか得るリソースの表示名を返す (#838 / #1005)。
 * 見るのは buffApplicationProcRates が 1 未満のバフと、procRate が 1 未満の獲得。コンボで付く分はコンボが成立したときだけ見る。
 * 指定は解決でそのスキルの確率付与すべてに効くが、名前は最初に当たった 1 つだけ返す（確率付与を 2 つ持つスキルは今のデータに無い）。
 * レベル調整後のスキルを渡す（Lv76 未満のバイト系はホークアイを付与しない）
 */
export function getProcOutcomeName(skill: Skill, jobId: JobId, comboEstablished: boolean): string | undefined {
  const buffIds = [...(skill.buffApplications ?? []), ...(comboEstablished ? skill.comboBuffApplications ?? [] : [])];
  const buffId = buffIds.find((id) => {
    const rate = skill.buffApplicationProcRates?.[id];
    return rate !== undefined && rate < 1 && isProcOutcomeBuff(id);
  });
  if (buffId !== undefined) return buffName(i18next.t, jobId, buffId);

  const changes = [...(skill.resourceChanges ?? []), ...(comboEstablished ? skill.comboResourceChanges ?? [] : [])];
  const change = changes.find((c) => c.amount > 0 && c.procRate !== undefined && c.procRate < 1);
  return change ? resourceName(i18next.t, jobId, change.resourceId) : undefined;
}

/** TimelineEntry.procOccurred の表示名。name は getProcOutcomeName の名前。例: "ホークアイ: 発生" */
export function formatProcOccurred(procOccurred: boolean, name: string): string {
  return i18next.t(procOccurred ? "buffFormat.procOccurred" : "buffFormat.procNotOccurred", { name });
}
