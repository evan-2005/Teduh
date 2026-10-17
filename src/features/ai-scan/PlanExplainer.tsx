import { useEffect, useRef, useState } from 'react';
import { dataset } from '../../data/dataset';
import { useInterventions } from '../../hooks/useInterventions';
import { createLatestTracker } from '../../lib/latest';
import { pedestrianSunMinutesAvoided } from '../../lib/optimizer';
import type { PlanResult } from '../../types';
import { requestExplanation } from './client';
import type { ExplainResponse } from './schemas';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; response: ExplainResponse };

/** A written summary of the chosen plan, built only from numbers the calculator produced. */
export function PlanExplainer({ plan }: { plan: PlanResult }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const interventions = useInterventions();
  // Names carry figures ("13 trees", "69 m") the explainer may repeat, so send the current ones.
  const namesById = Object.fromEntries(interventions.map((i) => [i.id, i.name]));
  // Any change to the plan's figures or names (spacing, species, walkway length) drops the summary.
  const planKey = [
    ...plan.interventionIds.map((id) => namesById[id] ?? id),
    plan.installCost,
    plan.sunMinutesAvoidedPerDay,
  ].join('|');
  const requests = useRef(createLatestTracker());

  // A summary describes one plan: drop it, and ignore any reply still on its way, when the
  // selection changes.
  useEffect(() => {
    requests.current.cancel();
    setStatus({ kind: 'idle' });
  }, [planKey]);

  const explain = async () => {
    const isCurrent = requests.current.start();
    setStatus({ kind: 'loading' });
    try {
      const response = await requestExplanation({
        ...plan,
        interventionNames: namesById,
        pedestrianSunMinutesAvoided: pedestrianSunMinutesAvoided(plan, dataset.journeys),
      });
      if (isCurrent()) setStatus({ kind: 'done', response });
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
      setStatus({ kind: 'error', message });
    }
  };

  return (
    <section className="card" aria-label="Plan explainer">
      <h3 className="card__title">Plan explainer</h3>
      <button
        type="button"
        className="button"
        disabled={plan.interventionIds.length === 0 || status.kind === 'loading'}
        onClick={explain}
      >
        {status.kind === 'loading' ? 'Writing…' : 'Explain this plan'}
      </button>
      {plan.interventionIds.length === 0 && (
        <p className="card__hint">Choose a plan first.</p>
      )}
      {status.kind === 'error' && (
        <p className="scan__error" role="alert">
          {status.message}
        </p>
      )}
      {status.kind === 'done' && (
        <>
          <p>
            {status.response.isMock && <span className="badge badge--estimated">template</span>}
            {status.response.summary}
          </p>
          <p className="card__hint">
            {status.response.source
              ? `Written by ${status.response.source} from the numbers above.`
              : 'Generated from the numbers above.'}
          </p>
        </>
      )}
    </section>
  );
}
