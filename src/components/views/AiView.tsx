import { AiStatusCard, PlanExplainer, ShadeScanPanel } from '../../features/ai-scan';
import type { PlanResult } from '../../types';
import { PlanSummary } from '../PlanSummary';

/** Page 4: survey photos into confirmed shade, and a written summary of the plan. */
export function AiView({ plan }: { plan: PlanResult }) {
  return (
    <div className="view">
      <AiStatusCard />
      <ShadeScanPanel />
      <PlanSummary plan={plan} />
      <PlanExplainer plan={plan} />
    </div>
  );
}
