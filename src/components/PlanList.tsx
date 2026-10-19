import { dataset } from '../data/dataset';
import { useInterventions } from '../hooks/useInterventions';
import { formatMyr, formatPedestrianSun } from '../lib/format';
import { pedestrianSunMinutesAvoided } from '../lib/optimizer';
import { useScenarioStore } from '../store/scenario';
import type { Intervention, PlanResult } from '../types';
import { SourceBadge } from './SourceBadge';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "1 covered walkway + 3 tree rows": the shape of a plan at a glance. */
function summarise(ids: readonly string[], byId: ReadonlyMap<string, Intervention>): string {
  const shelters = ids.filter((id) => byId.get(id)?.type === 'shelter').length;
  const trees = ids.length - shelters;
  return [
    shelters > 0 ? plural(shelters, 'covered walkway', 'covered walkways') : null,
    trees > 0 ? plural(trees, 'tree row', 'tree rows') : null,
  ]
    .filter(Boolean)
    .join(' + ');
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

export function PlanList({ plans }: { plans: readonly PlanResult[] }) {
  const selectedIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const applyPlan = useScenarioStore((s) => s.applyPlan);
  const interventions = useInterventions();
  const byId = new Map(interventions.map((i) => [i.id, i]));
  const nameOf = (id: string): string => byId.get(id)?.name ?? id;

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
                <span className="plan__items">{summarise(plan.interventionIds, byId)}</span>
                <span className="plan__names">{plan.interventionIds.map(nameOf).join('; ')}</span>
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
