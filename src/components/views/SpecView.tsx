import { FabricationPanel } from '../../features/fabrication';
import { useInterventions } from '../../hooks/useInterventions';
import { useScenarioStore } from '../../store/scenario';
import { InterventionFacts } from '../InterventionFacts';

/** Page 3: one candidate in detail, with its build spec pack. */
export function SpecView() {
  const interventions = useInterventions();
  const selectedId = useScenarioStore((s) => s.selectedInterventionId);
  const selectIntervention = useScenarioStore((s) => s.selectIntervention);
  const chosenIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const toggle = useScenarioStore((s) => s.toggleIntervention);
  const intervention = interventions.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="view">
      <label className="field">
        <span className="field__label">Candidate</span>
        <select value={selectedId ?? ''} onChange={(e) => selectIntervention(e.target.value || null)}>
          <option value="">Pick a tree row or walkway…</option>
          {interventions.map((i) => (
            <option key={i.id} value={i.id}>
              {chosenIds.includes(i.id) ? '● ' : ''}
              {i.name}
            </option>
          ))}
        </select>
        <span className="field__help">Or click a tree, walkway or marker on the map. ● = in the plan.</span>
      </label>

      {intervention && (
        <section className="card" aria-label="Candidate details">
          <h3 className="card__title">{intervention.name}</h3>
          <InterventionFacts intervention={intervention} />
          <label className="field__inline">
            <input
              type="checkbox"
              checked={chosenIds.includes(intervention.id)}
              onChange={() => toggle(intervention.id)}
            />
            In the plan
          </label>
        </section>
      )}

      <FabricationPanel />
    </div>
  );
}
