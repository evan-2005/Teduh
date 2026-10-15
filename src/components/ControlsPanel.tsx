import { DEMO_TIME, TIME_SLOTS } from '../config';
import { dataset, meta } from '../data/dataset';
import { demoWalkNames } from '../data/meta';
import { demoLabel, formatMyr } from '../lib/format';
import { useDemoPreset } from '../hooks/useDemoPreset';
import { useScenarioStore } from '../store/scenario';
import type { PlanResult } from '../types';
import { CandidateList } from './CandidateList';
import { AreaCard } from './AreaCard';
import { PriorityControls } from './PriorityControls';

const MAX_DETOUR = 0.5;
const DETOUR_STEP = 0.05;

const DEMO_LABEL = demoLabel(
  DEMO_TIME,
  demoWalkNames(dataset.neighbourhood, dataset.journeys, meta.demoJourneyId),
);

const destinationName = (id: string): string =>
  dataset.neighbourhood.destinations.find((d) => d.id === id)?.name ?? id;

interface ControlsPanelProps {
  plans: readonly PlanResult[];
}

export function ControlsPanel({ plans }: ControlsPanelProps) {
  const scenario = useScenarioStore((s) => s.scenario);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const applyPlan = useScenarioStore((s) => s.applyPlan);
  const journeyId = useScenarioStore((s) => s.selectedJourneyId);
  const selectJourney = useScenarioStore((s) => s.selectJourney);
  const best = plans[0];
  const loadDemoPreset = useDemoPreset();

  return (
    <div className="controls">
      <AreaCard />
      <h2 className="panel__title">Controls</h2>

      <button type="button" className="button" onClick={loadDemoPreset}>
        {DEMO_LABEL}
      </button>

      <label className="field">
        <span className="field__label">
          Budget: <span className="num">{formatMyr(scenario.budget)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={meta.budget.max}
          step={meta.budget.step}
          value={scenario.budget}
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

      <fieldset className="field">
        <legend className="field__label">Time of day</legend>
        <div className="segmented" role="radiogroup" aria-label="Time of day">
          {TIME_SLOTS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={scenario.time === t}
              className="segmented__option num"
              onClick={() => setScenario({ time: t })}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span className="field__label">
          Detour limit: <span className="num">{Math.round(scenario.detourLimit * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={MAX_DETOUR}
          step={DETOUR_STEP}
          value={scenario.detourLimit}
          onChange={(e) => setScenario({ detourLimit: Number(e.target.value) })}
        />
      </label>

      <PriorityControls />
      <CandidateList />

      <label className="field">
        <span className="field__label">Map journey</span>
        <select value={journeyId ?? ''} onChange={(e) => selectJourney(e.target.value || null)}>
          {dataset.journeys.map((j) => (
            <option key={j.id} value={j.id}>
              {destinationName(j.originId)} → {destinationName(j.destinationId)}
            </option>
          ))}
        </select>
      </label>

    </div>
  );
}
