import { dataset } from '../data/dataset';
import { formatMyr, formatPedestrianSun } from '../lib/format';
import { pedestrianSunMinutesAvoided } from '../lib/optimizer';
import { useScenarioStore } from '../store/scenario';
import type { DataSource, PlanResult } from '../types';
import { JourneyList } from './JourneyList';
import { PlanList } from './PlanList';
import { SourceBadge } from './SourceBadge';

interface ResultsPanelProps {
  plans: readonly PlanResult[];
  selectedPlan: PlanResult;
}

const nameOf = (id: string): string =>
  dataset.interventions.find((i) => i.id === id)?.name ?? id;

const costSources = (ids: readonly string[]): DataSource[] => [
  ...new Set(dataset.interventions.filter((i) => ids.includes(i.id)).map((i) => i.costSource)),
];

export function ResultsPanel({ plans, selectedPlan }: ResultsPanelProps) {
  const budget = useScenarioStore((s) => s.scenario.budget);
  const hasSelection = selectedPlan.interventionIds.length > 0;
  const sun = formatPedestrianSun(pedestrianSunMinutesAvoided(selectedPlan, dataset.journeys));
  const overBudget = selectedPlan.installCost > budget;
  const contributions = Object.entries(selectedPlan.contributions).sort((a, b) => b[1] - a[1]);

  return (
    <div className="results">
      <h2 className="panel__title">Results</h2>

      <section className="headline" aria-label="Headline result">
        {hasSelection ? (
          <>
            <p className="headline__value num">{sun.value}</p>
            <p className="headline__unit">
              {sun.unit} in direct sun avoided / day
              <SourceBadge source="estimated" />
            </p>
          </>
        ) : (
          <p className="panel__hint">Tick candidates, or press “Recommend a plan”.</p>
        )}
      </section>

      {hasSelection && (
        <dl className="costs">
          <dt>Install cost</dt>
          <dd className={`num${overBudget ? ' costs--over' : ''}`}>
            {formatMyr(selectedPlan.installCost)} of {formatMyr(budget)}
            {overBudget && <span> · over budget</span>}
          </dd>
          <dt>Upkeep</dt>
          <dd className="num">{formatMyr(selectedPlan.annualMaintenance)} / year</dd>
          <dt>Cost data</dt>
          <dd>
            {costSources(selectedPlan.interventionIds).map((s) => (
              <SourceBadge key={s} source={s} />
            ))}
          </dd>
          <dt>Journeys improved</dt>
          <dd className="num">
            {selectedPlan.journeysImproved.length} of {selectedPlan.journeys.length}
          </dd>
        </dl>
      )}

      {hasSelection && contributions.length > 1 && (
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
      )}

      <PlanList plans={plans} />
      <JourneyList plan={selectedPlan} />
    </div>
  );
}
