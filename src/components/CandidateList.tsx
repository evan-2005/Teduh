import { useInterventions } from '../hooks/useInterventions';
import { formatMyr } from '../lib/format';
import { isUserPlaced } from '../lib/userPlacement';
import { useScenarioStore } from '../store/scenario';
import type { Intervention, InterventionType } from '../types';
import { SourceBadge } from './SourceBadge';

const TYPE_LABEL: Readonly<Record<InterventionType, string>> = {
  tree: 'street trees',
  shelter: 'covered walkway',
};

function CandidateRow({ item }: { item: Intervention }) {
  const chosen = useScenarioStore((s) => s.scenario.selectedInterventionIds.includes(item.id));
  const toggle = useScenarioStore((s) => s.toggleIntervention);
  const openIntervention = useScenarioStore((s) => s.openIntervention);
  const removeUserItem = useScenarioStore((s) => s.removeUserItem);
  const yours = isUserPlaced(item.id);
  return (
    <li className="candidate-row">
      <label className="candidate">
        <input type="checkbox" checked={chosen} onChange={() => toggle(item.id)} />
        <span className="candidate__body">
          <span className="candidate__name">{item.name}</span>
          <span className="candidate__meta">
            <span className="num">{formatMyr(item.installCost)}</span> · {TYPE_LABEL[item.type]} ·{' '}
            {item.feasibility} <SourceBadge source={item.costSource} />
            {yours && <span className="badge badge--yours">yours</span>}
          </span>
        </span>
      </label>
      <span className="candidate__links">
        <button
          type="button"
          className="link-button candidate__details"
          aria-label={`Spec pack for ${item.name}`}
          onClick={() => openIntervention(item.id)}
        >
          Details
        </button>
        {yours && (
          <button
            type="button"
            className="link-button candidate__details"
            aria-label={`Remove ${item.name}`}
            onClick={() => removeUserItem(item.id)}
          >
            Remove
          </button>
        )}
      </span>
    </li>
  );
}

/** Tick candidates (suggested and your own) into the plan, or open one's spec pack. */
export function CandidateList() {
  const interventions = useInterventions();
  return (
    <fieldset className="field">
      <legend className="field__label">Candidates</legend>
      <ul className="candidates">
        {interventions.map((i) => (
          <CandidateRow key={i.id} item={i} />
        ))}
      </ul>
    </fieldset>
  );
}
