import { useEffect, useState } from 'react';
import { dataset } from '../../data/dataset';
import { pedestrianSunMinutesAvoided } from '../../lib/optimizer';
import type { PlanResult } from '../../types';
import { requestExplanation } from './client';
import type { ExplainResponse } from './schemas';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; response: ExplainResponse };

const namesById = Object.fromEntries(dataset.interventions.map((i) => [i.id, i.name]));

/** A written summary of the chosen plan, built only from numbers the calculator produced. */
export function PlanExplainer({ plan }: { plan: PlanResult }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const planKey = plan.interventionIds.join('|');

  // A summary describes one plan; drop it when the selection changes.
  useEffect(() => setStatus({ kind: 'idle' }), [planKey]);

  const explain = async () => {
    setStatus({ kind: 'loading' });
    try {
      const response = await requestExplanation({
        ...plan,
        interventionNames: namesById,
        pedestrianSunMinutesAvoided: pedestrianSunMinutesAvoided(plan, dataset.journeys),
      });
      setStatus({ kind: 'done', response });
    } catch (error) {
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
          <p className="card__hint">Generated from the numbers above.</p>
        </>
      )}
    </section>
  );
}
