import type { PlanResult } from '../../types';
import { CandidateList } from '../CandidateList';
import { UnitCostEditor } from '../CostControls';
import { PlaceYourOwn } from '../PlaceYourOwn';
import { PlanList } from '../PlanList';
import { PlannerControls } from '../PlannerControls';
import { Contributions, PlanSummary } from '../PlanSummary';
import { PriorityControls } from '../PriorityControls';
import { BudgetControl, DetourControl } from '../ScenarioControls';

interface PlanBuilderViewProps {
  plans: readonly PlanResult[];
  selectedPlan: PlanResult;
}

/** Page 2: budget, site-planning choices, priorities, and picking what goes in the plan. */
export function PlanBuilderView({ plans, selectedPlan }: PlanBuilderViewProps) {
  return (
    <div className="view">
      <PlanSummary plan={selectedPlan} />

      <section className="view__group" aria-label="Budget">
        <h2 className="panel__title">Budget</h2>
        <BudgetControl plans={plans} />
        <PlanList plans={plans} />
      </section>

      <section className="view__group" aria-label="What to build">
        <h2 className="panel__title">What to build</h2>
        <PlannerControls />
        <UnitCostEditor />
        <PlaceYourOwn />
        <CandidateList />
        <Contributions plan={selectedPlan} />
      </section>

      <section className="view__group" aria-label="Who walks where">
        <h2 className="panel__title">Who walks where</h2>
        <DetourControl />
        <PriorityControls />
      </section>
    </div>
  );
}
