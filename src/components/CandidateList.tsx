import { useInterventions } from '../hooks/useInterventions';
import { formatMyr } from '../lib/format';
import { useScenarioStore } from '../store/scenario';
import type { InterventionType } from '../types';
import { SourceBadge } from './SourceBadge';

const TYPE_LABEL: Readonly<Record<InterventionType, string>> = {
  tree: 'street trees',
  shelter: 'covered walkway',
};

/** Tick candidates into the plan, or open one's spec pack. */
export function CandidateList() {
  const selectedIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const toggle = useScenarioStore((s) => s.toggleIntervention);
  const openIntervention = useScenarioStore((s) => s.openIntervention);
  const interventions = useInterventions();

  return (
    <fieldset className="field">
      <legend className="field__label">Candidates</legend>
      <ul className="candidates">
        {interventions.map((i) => (
          <li key={i.id} className="candidate-row">
            <label className="candidate">
              <input
                type="checkbox"
                checked={selectedIds.includes(i.id)}
                onChange={() => toggle(i.id)}
              />
              <span className="candidate__body">
                <span className="candidate__name">{i.name}</span>
                <span className="candidate__meta">
                  <span className="num">{formatMyr(i.installCost)}</span> · {TYPE_LABEL[i.type]} ·{' '}
                  {i.feasibility} <SourceBadge source={i.costSource} />
                </span>
              </span>
            </label>
            <button
              type="button"
              className="link-button candidate__details"
              aria-label={`Spec pack for ${i.name}`}
              onClick={() => openIntervention(i.id)}
            >
              Details
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
