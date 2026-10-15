import { dataset } from '../data/dataset';
import { formatMyr } from '../lib/format';
import { useScenarioStore } from '../store/scenario';
import { SourceBadge } from './SourceBadge';

export function CandidateList() {
  const selectedIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const toggle = useScenarioStore((s) => s.toggleIntervention);
  const selectIntervention = useScenarioStore((s) => s.selectIntervention);

  return (
    <fieldset className="field">
      <legend className="field__label">Candidates</legend>
      <ul className="candidates">
        {dataset.interventions.map((i) => (
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
                  <span className="num">{formatMyr(i.installCost)}</span> · {i.type} ·{' '}
                  {i.feasibility} <SourceBadge source={i.costSource} />
                </span>
              </span>
            </label>
            <button
              type="button"
              className="link-button candidate__details"
              aria-label={`Fabrication details for ${i.name}`}
              onClick={() => selectIntervention(i.id)}
            >
              Details
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
