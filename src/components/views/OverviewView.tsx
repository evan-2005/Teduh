import type { NetworkView } from '../../hooks/useNetworkView';
import { useScenarioStore } from '../../store/scenario';
import type { PlanResult } from '../../types';
import { AreaCard } from '../AreaCard';
import { JourneyList } from '../JourneyList';
import { PlanSummary } from '../PlanSummary';
import { RouteComparison } from '../RouteComparison';
import { DemoButton, JourneySelect, TimeOfDayControl } from '../ScenarioControls';

interface OverviewViewProps {
  plan: PlanResult;
  journey: NetworkView['journey'];
  comparison: NetworkView['after']['comparison'];
}

/** Page 1: the area, the headline result, and how one walk changes. */
export function OverviewView({ plan, journey, comparison }: OverviewViewProps) {
  const setView = useScenarioStore((s) => s.setView);
  return (
    <div className="view">
      <AreaCard />
      <DemoButton />
      <PlanSummary plan={plan} />
      <button type="button" className="link-button view__next" onClick={() => setView('plan')}>
        Change the plan in the Plan builder →
      </button>

      <h2 className="panel__title">Walks</h2>
      <TimeOfDayControl />
      <JourneySelect />
      <RouteComparison journey={journey} comparison={comparison} />
      <JourneyList plan={plan} />
    </div>
  );
}
