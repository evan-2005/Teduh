import { DEMO_TIME, TIME_SLOTS } from '../config';
import { dataset, meta } from '../data/dataset';
import { demoWalkNames } from '../data/meta';
import { useDemoPreset } from '../hooks/useDemoPreset';
import { demoLabel, formatMyr } from '../lib/format';
import { useScenarioStore } from '../store/scenario';
import type { PlanResult } from '../types';

const MAX_DETOUR = 0.5;
const DETOUR_STEP = 0.05;
const PERCENT = 100;

const DEMO_LABEL = demoLabel(
  DEMO_TIME,
  demoWalkNames(dataset.neighbourhood, dataset.journeys, meta.demoJourneyId),
);

const destinationName = (id: string): string =>
  dataset.neighbourhood.destinations.find((d) => d.id === id)?.name ?? id;

/** One click back to the demo scenario: 2 pm, the demo walk, budget and best plan. */
export function DemoButton() {
  const loadDemoPreset = useDemoPreset();
  return (
    <button type="button" className="button" onClick={loadDemoPreset}>
      {DEMO_LABEL}
    </button>
  );
}

/** Budget slider and the button that applies the best plan within it. */
export function BudgetControl({ plans }: { plans: readonly PlanResult[] }) {
  const budget = useScenarioStore((s) => s.scenario.budget);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const applyPlan = useScenarioStore((s) => s.applyPlan);
  const best = plans[0];
  return (
    <>
      <label className="field">
        <span className="field__label">
          Budget: <span className="num">{formatMyr(budget)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={meta.budget.max}
          step={meta.budget.step}
          value={budget}
          onChange={(e) => setScenario({ budget: Number(e.target.value) })}
        />
      </label>
      <button
        type="button"
        className="button button--primary"
        disabled={!best}
        onClick={() => best && applyPlan(best.interventionIds)}
      >
        Recommend a plan
      </button>
      {!best && <p className="panel__hint">Nothing affordable helps at this budget and time.</p>}
    </>
  );
}

export function TimeOfDayControl() {
  const time = useScenarioStore((s) => s.scenario.time);
  const setScenario = useScenarioStore((s) => s.setScenario);
  return (
    <fieldset className="field">
      <legend className="field__label">Time of day</legend>
      <div className="segmented" role="radiogroup" aria-label="Time of day">
        {TIME_SLOTS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={time === t}
            className="segmented__option num"
            onClick={() => setScenario({ time: t })}
          >
            {t}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function DetourControl() {
  const detourLimit = useScenarioStore((s) => s.scenario.detourLimit);
  const setScenario = useScenarioStore((s) => s.setScenario);
  return (
    <label className="field">
      <span className="field__label">
        Detour limit: <span className="num">{Math.round(detourLimit * PERCENT)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={MAX_DETOUR}
        step={DETOUR_STEP}
        value={detourLimit}
        onChange={(e) => setScenario({ detourLimit: Number(e.target.value) })}
      />
      <span className="field__help">How much longer than the shortest walk a shadier route may be.</span>
    </label>
  );
}

export function JourneySelect() {
  const journeyId = useScenarioStore((s) => s.selectedJourneyId);
  const selectJourney = useScenarioStore((s) => s.selectJourney);
  return (
    <label className="field">
      <span className="field__label">Map journey</span>
      <select
        className="journey-select"
        value={journeyId ?? ''}
        onChange={(e) => selectJourney(e.target.value || null)}
      >
        {dataset.journeys.map((j) => (
          <option key={j.id} value={j.id}>
            {destinationName(j.originId)} → {destinationName(j.destinationId)}
          </option>
        ))}
      </select>
    </label>
  );
}
