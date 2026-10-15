import { TIME_SLOTS } from '../config';
import { dataset } from '../data/dataset';
import { useScenarioStore } from '../store/scenario';

const MAX_DETOUR = 0.5;
const DETOUR_STEP = 0.05;

const destinationName = (id: string): string =>
  dataset.neighbourhood.destinations.find((d) => d.id === id)?.name ?? id;

// Phase 2 subset: journey, time, detour, basemap. Budget, priorities and candidates arrive in Phase 3.
export function ControlsPanel() {
  const scenario = useScenarioStore((s) => s.scenario);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const journeyId = useScenarioStore((s) => s.selectedJourneyId);
  const selectJourney = useScenarioStore((s) => s.selectJourney);
  const basemap = useScenarioStore((s) => s.basemap);
  const setBasemap = useScenarioStore((s) => s.setBasemap);

  return (
    <div className="controls">
      <h2 className="panel__title">Controls</h2>

      <label className="field">
        <span className="field__label">Journey</span>
        <select value={journeyId ?? ''} onChange={(e) => selectJourney(e.target.value || null)}>
          {dataset.journeys.map((j) => (
            <option key={j.id} value={j.id}>
              {destinationName(j.originId)} → {destinationName(j.destinationId)}
            </option>
          ))}
        </select>
      </label>

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

      <fieldset className="field">
        <legend className="field__label">Basemap</legend>
        <label className="field__inline">
          <input
            type="checkbox"
            checked={basemap.visible}
            onChange={(e) => setBasemap({ visible: e.target.checked })}
          />
          Show basemap
        </label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.1}
          value={basemap.opacity}
          disabled={!basemap.visible}
          aria-label="Basemap opacity"
          onChange={(e) => setBasemap({ opacity: Number(e.target.value) })}
        />
      </fieldset>
    </div>
  );
}
