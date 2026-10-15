import { dataset } from '../data/dataset';
import { formatMultiplier } from '../lib/format';
import { useScenarioStore } from '../store/scenario';

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 3;
const WEIGHT_STEP = 0.5;
const DEFAULT_WEIGHT = 1;

const targets = dataset.neighbourhood.destinations.filter((d) => d.kind !== 'home');

export function PriorityControls() {
  const weights = useScenarioStore((s) => s.scenario.priorityWeights);
  const setWeight = useScenarioStore((s) => s.setPriorityWeight);

  return (
    <fieldset className="field">
      <legend className="field__label">Priorities</legend>
      {targets.map((d) => {
        const weight = weights[d.id] ?? DEFAULT_WEIGHT;
        return (
          <label key={d.id} className="field field--tight">
            <span className="field__row">
              <span>{d.name}</span>
              <span className="num">{formatMultiplier(weight)}</span>
            </span>
            <input
              type="range"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT}
              step={WEIGHT_STEP}
              value={weight}
              onChange={(e) => setWeight(d.id, Number(e.target.value))}
            />
          </label>
        );
      })}
    </fieldset>
  );
}
