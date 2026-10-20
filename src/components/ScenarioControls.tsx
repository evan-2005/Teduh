import { useState } from 'react';
import { DEMO_TIME, DETOUR_STEP, MAX_DETOUR, TIME_RANGE, TIME_SLOTS } from '../config';
import { dataset, meta } from '../data/dataset';
import { demoWalkNames } from '../data/meta';
import { useDemoPreset } from '../hooks/useDemoPreset';
import { clockOf, isSlot, minutesOf } from '../lib/clock';
import { demoLabel, formatClock, formatMyr } from '../lib/format';
import { useScenarioStore } from '../store/scenario';
import type { PlanResult } from '../types';

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

/** The most anyone can type in: well above any area's slider range. */
const MAX_TYPED_BUDGET = 10_000_000;

/** A typed budget, kept whole and within 0..MAX_TYPED_BUDGET; null when it is not a number. */
export function parseBudget(text: string): number | null {
  const value = Number(text.replace(/[,\s]/g, ''));
  if (text.trim() === '' || !Number.isFinite(value) || value < 0) return null;
  return Math.min(MAX_TYPED_BUDGET, Math.max(0, Math.round(value)));
}

function BudgetInput() {
  const budget = useScenarioStore((s) => s.scenario.budget);
  const setScenario = useScenarioStore((s) => s.setScenario);
  // What the person is typing; the box shows the stored budget again once they leave it.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="budget-input">
      <span>RM</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_TYPED_BUDGET}
        step={meta.budget.step}
        value={draft ?? String(budget)}
        aria-label="Budget in ringgit"
        onChange={(e) => {
          setDraft(e.target.value);
          const value = parseBudget(e.target.value);
          if (value !== null) setScenario({ budget: value });
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

/** Budget slider, a box to type an exact amount, and the button that applies the best plan. */
export function BudgetControl({ plans }: { plans: readonly PlanResult[] }) {
  const budget = useScenarioStore((s) => s.scenario.budget);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const applyPlan = useScenarioStore((s) => s.applyPlan);
  const best = plans[0];
  return (
    <>
      <div className="field">
        <span className="field__label">
          Budget: <span className="num">{formatMyr(budget)}</span>
        </span>
        <div className="budget">
          <input
            type="range"
            min={0}
            max={Math.max(meta.budget.max, budget)}
            step={meta.budget.step}
            value={budget}
            aria-label="Budget"
            onChange={(e) => setScenario({ budget: Number(e.target.value) })}
          />
          <BudgetInput />
        </div>
      </div>
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

const START_MIN = minutesOf(TIME_RANGE.start);
const END_MIN = minutesOf(TIME_RANGE.end);

/** Time of day in half hours. Shade between the four snapshot times is interpolated. */
export function TimeOfDayControl() {
  const time = useScenarioStore((s) => s.scenario.time);
  const setScenario = useScenarioStore((s) => s.setScenario);
  return (
    <label className="field">
      <span className="field__label">
        Time of day: <span className="num">{formatClock(time)}</span>
      </span>
      <input
        type="range"
        min={START_MIN}
        max={END_MIN}
        step={TIME_RANGE.stepMinutes}
        value={minutesOf(time)}
        aria-label="Time of day"
        aria-valuetext={formatClock(time)}
        list="time-snapshots"
        onChange={(e) => setScenario({ time: clockOf(Number(e.target.value)) })}
      />
      <datalist id="time-snapshots">
        {TIME_SLOTS.map((t) => (
          <option key={t} value={minutesOf(t)} label={formatClock(t)} />
        ))}
      </datalist>
      <span className="time-ticks num" aria-hidden="true">
        {TIME_SLOTS.map((t) => (
          <span key={t} style={{ left: `${((minutesOf(t) - START_MIN) / (END_MIN - START_MIN)) * 100}%` }}>
            {formatClock(t)}
          </span>
        ))}
      </span>
      <span className="field__help">
        {isSlot(time)
          ? 'Shade at a modelled snapshot time.'
          : 'Between snapshot times, shade is interpolated from the two either side.'}
      </span>
    </label>
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
