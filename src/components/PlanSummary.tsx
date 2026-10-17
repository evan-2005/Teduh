import { dataset } from '../data/dataset';
import { useInterventionNames, useInterventions } from '../hooks/useInterventions';
import { formatMyr, formatPedestrianSun } from '../lib/format';
import { pedestrianSunMinutesAvoided } from '../lib/optimizer';
import { useScenarioStore } from '../store/scenario';
import type { DataSource, PlanResult } from '../types';
import { SourceBadge } from './SourceBadge';

interface PlanProps {
  plan: PlanResult;
}

/** Headline figure and costs for the chosen plan. */
export function PlanSummary({ plan }: PlanProps) {
  const budget = useScenarioStore((s) => s.scenario.budget);
  const interventions = useInterventions();
  const hasSelection = plan.interventionIds.length > 0;
  const sun = formatPedestrianSun(pedestrianSunMinutesAvoided(plan, dataset.journeys));
  const overBudget = plan.installCost > budget;
  const costSources: DataSource[] = [
    ...new Set(interventions.filter((i) => plan.interventionIds.includes(i.id)).map((i) => i.costSource)),
  ];

  if (!hasSelection) {
    return (
      <section className="headline" aria-label="Headline result">
        <p className="panel__hint">No plan chosen. Open the Plan builder to pick one.</p>
      </section>
    );
  }
  return (
    <>
      <section className="headline" aria-label="Headline result">
        <p className="headline__value num">{sun.value}</p>
        <p className="headline__unit">
          {sun.unit} in direct sun avoided / day
          <SourceBadge source="estimated" />
        </p>
      </section>
      <dl className="costs">
        <dt>Install cost</dt>
        <dd className={`num${overBudget ? ' costs--over' : ''}`}>
          {formatMyr(plan.installCost)} of {formatMyr(budget)}
          {overBudget && <span> · over budget</span>}
        </dd>
        <dt>Upkeep</dt>
        <dd className="num">{formatMyr(plan.annualMaintenance)} / year</dd>
        <dt>Cost data</dt>
        <dd>
          {costSources.map((s) => (
            <SourceBadge key={s} source={s} />
          ))}
        </dd>
        <dt>Journeys improved</dt>
        <dd className="num">
          {plan.journeysImproved.length} of {plan.journeys.length}
        </dd>
      </dl>
    </>
  );
}

/** What each chosen item adds to the plan, biggest first. */
export function Contributions({ plan }: PlanProps) {
  const nameOf = useInterventionNames();
  const contributions = Object.entries(plan.contributions).sort((a, b) => b[1] - a[1]);
  if (plan.interventionIds.length === 0 || contributions.length < 2) return null;
  return (
    <section aria-label="Contribution of each intervention">
      <h3 className="card__title">
        What each one adds <SourceBadge source="estimated" />
      </h3>
      <ul className="contributions">
        {contributions.map(([id, minutes]) => (
          <li key={id}>
            <span>{nameOf(id)}</span>
            <span className="num">{Math.round(minutes)} min/day</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
