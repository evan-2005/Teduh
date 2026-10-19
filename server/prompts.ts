import type { ExplainRequest } from '../src/features/ai-scan/schemas';
import type { TimeSlot } from '../src/types';

/** Prompts and plan facts shared by every AI provider. */

export function shadePrompt(time: TimeSlot): string {
  return `You are helping survey a footpath. The photo was taken at about ${time} local time. Look at it and estimate how shaded the walking surface is.
Reply with JSON only, no prose and no code fences, in exactly this shape:
{"shadeFraction": <0 to 1, fraction of the walking surface in shade>, "shadeSources": [<short labels such as "tree canopy", "shop awning", "building">], "obstacles": [<anything blocking the path, e.g. "parked motorcycle">], "confidence": "low" | "medium" | "high", "notes": "<one or two sentences>"}
Shade only. Do not comment on temperature, comfort or safety. If the photo is unclear, use low confidence.`;
}

export const EXPLAIN_SYSTEM = `You write short summaries of shade-planning results for township managers.
Use only the numbers in the JSON you are given. Never invent or estimate other figures.
Write 4 to 6 plain sentences. State the main assumptions: illustrative survey snapshots, estimated costs, shade is not the same as comfort.
Do not claim any temperature reduction, health benefit or safety benefit, and do not use the words temperature, cool, cooler, health, healthy, safe or safety.`;

interface Facts {
  interventions: string[];
  installCostMyr: number;
  annualUpkeepMyr: number;
  pedestrianSunMinutesAvoidedPerDay: number;
  journeysImproved: number;
  journeysTotal: number;
  biggestContributor: { name: string; minutesPerDay: number } | null;
}

/** The only numbers the explainer may use, derived from the plan. */
export function planFacts(plan: ExplainRequest): Facts {
  const nameOf = (id: string): string => plan.interventionNames?.[id] ?? id;
  const top = Object.entries(plan.contributions).sort((a, b) => b[1] - a[1])[0];
  return {
    interventions: plan.interventionIds.map(nameOf),
    installCostMyr: Math.round(plan.installCost),
    annualUpkeepMyr: Math.round(plan.annualMaintenance),
    pedestrianSunMinutesAvoidedPerDay: Math.round(
      plan.pedestrianSunMinutesAvoided ?? plan.sunMinutesAvoidedPerDay,
    ),
    journeysImproved: plan.journeysImproved.length,
    journeysTotal: plan.journeys.length,
    biggestContributor: top ? { name: nameOf(top[0]), minutesPerDay: Math.round(top[1]) } : null,
  };
}

const MINUTES_PER_HOUR = 60;

/** Sun-minutes shown as hours to one decimal place, e.g. 2820 -> "47.0". */
export const sunHours = (minutes: number): string => (minutes / MINUTES_PER_HOUR).toFixed(1);

/** Deterministic summary built only from the plan's numbers. */
export function templateSummary(plan: ExplainRequest): string {
  const f = planFacts(plan);
  const hours = sunHours(f.pedestrianSunMinutesAvoidedPerDay);
  const lead = f.biggestContributor
    ? ` The largest single contribution comes from ${f.biggestContributor.name}.`
    : '';
  return (
    `This plan installs ${f.interventions.join(', ')} for about RM ${f.installCostMyr.toLocaleString('en-US')}, ` +
    `with RM ${f.annualUpkeepMyr.toLocaleString('en-US')} a year in upkeep. ` +
    `It avoids roughly ${hours} pedestrian-hours in direct sun per day and improves ` +
    `${f.journeysImproved} of ${f.journeysTotal} modelled journeys.${lead} ` +
    'These figures come from illustrative shade snapshots and estimated costs, ' +
    'and shade is not the same as comfort or safety.'
  );
}
