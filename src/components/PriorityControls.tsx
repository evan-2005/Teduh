import { useState } from 'react';
import { dataset } from '../data/dataset';
import { formatMultiplier } from '../lib/format';
import { DEFAULT_WEIGHT, MAX_WEIGHT, MIN_WEIGHT, parseWeight, WEIGHT_STEP } from '../lib/priority';
import { useScenarioStore } from '../store/scenario';
import type { Destination } from '../types';

// Priorities weight where people walk to, so list only the places that end a journey.
const endpoints = new Set(dataset.journeys.map((j) => j.destinationId));
const targets = dataset.neighbourhood.destinations.filter((d) => endpoints.has(d.id));

interface WeightRowProps {
  destination: Destination;
  weight: number;
  onChange: (weight: number) => void;
}

/** One destination: a slider, and a box to type an exact weight. */
function WeightRow({ destination, weight, onChange }: WeightRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputId = `weight-${destination.id}`;
  return (
    <div className="field field--tight priority">
      <span className="field__row">
        <label htmlFor={inputId}>{destination.name}</label>
        <input
          className="priority__value num"
          type="text"
          inputMode="decimal"
          aria-label={`${destination.name} weight`}
          value={draft ?? formatMultiplier(weight)}
          onFocus={() => setDraft(String(weight))}
          onChange={(e) => {
            setDraft(e.target.value);
            const value = parseWeight(e.target.value);
            if (value !== null) onChange(value);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </span>
      <input
        id={inputId}
        type="range"
        min={MIN_WEIGHT}
        max={MAX_WEIGHT}
        step={WEIGHT_STEP}
        value={weight}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function PriorityControls() {
  const weights = useScenarioStore((s) => s.scenario.priorityWeights);
  const setWeight = useScenarioStore((s) => s.setPriorityWeight);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const changed = Object.values(weights).some((w) => w !== DEFAULT_WEIGHT);

  return (
    <fieldset className="field">
      <legend className="field__label">Priorities</legend>
      <p className="field__help">
        How much walks to each place count when choosing a plan: ×0 ignores them, ×{MAX_WEIGHT} counts them {MAX_WEIGHT}{' '}
        times. Drag, or type a number.
      </p>
      {targets.map((d) => (
        <WeightRow key={d.id} destination={d} weight={weights[d.id] ?? DEFAULT_WEIGHT} onChange={(w) => setWeight(d.id, w)} />
      ))}
      {changed && (
        <button type="button" className="link-button" onClick={() => setScenario({ priorityWeights: {} })}>
          Reset priorities to ×1
        </button>
      )}
    </fieldset>
  );
}
