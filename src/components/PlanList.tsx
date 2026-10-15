import { dataset } from '../data/dataset';
import { formatMyr, formatPedestrianSun } from '../lib/format';
import { pedestrianSunMinutesAvoided } from '../lib/optimizer';
import { useScenarioStore } from '../store/scenario';
import type { PlanResult } from '../types';
import { SourceBadge } from './SourceBadge';

const nameOf = (id: string): string =>
  dataset.interventions.find((i) => i.id === id)?.name ?? id;

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

export function PlanList({ plans }: { plans: readonly PlanResult[] }) {
  const selectedIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const applyPlan = useScenarioStore((s) => s.applyPlan);

  if (plans.length === 0) return null;
  return (
    <section aria-label="Recommended plans">
      <h3 className="card__title">Recommended plans</h3>
      <ol className="plans">
        {plans.map((plan, index) => {
          const active = sameSet(plan.interventionIds, selectedIds);
          const sun = formatPedestrianSun(pedestrianSunMinutesAvoided(plan, dataset.journeys));
          return (
            <li key={plan.interventionIds.join('|')}>
              <button
                type="button"
                className="plan"
                aria-pressed={active}
                onClick={() => applyPlan(plan.interventionIds)}
              >
                <span className="plan__rank">{index === 0 ? 'Best' : `Option ${index + 1}`}</span>
                <span className="plan__items">{plan.interventionIds.map(nameOf).join(' + ')}</span>
                <span className="plan__meta num">
                  {formatMyr(plan.installCost)} · {sun.value} {sun.unit}/day <SourceBadge source="estimated" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
