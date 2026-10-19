import { MAX_CANOPY_YEAR } from '../config';
import { useGrowthPlayback } from '../hooks/useGrowthPlayback';
import { useScenarioStore } from '../store/scenario';
import type { CanopyMode, MapMode } from '../types';

const MODES: readonly { value: MapMode; label: string }[] = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'swipe', label: 'Swipe' },
];

const CANOPIES: readonly { value: CanopyMode; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: 'future', label: 'Future' },
];

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div
      className="segmented segmented--inline"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="segmented__option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Map Restoration controls: before/after/swipe, now/future canopy and the growth slider. */
export function MapToolbar() {
  const scenario = useScenarioStore((s) => s.scenario);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const { playing, toggle } = useGrowthPlayback();
  const isFuture = scenario.canopy === 'future';
  // "Now" is today's canopy whatever the slider last held, so show year 0 rather than a stale year.
  const shownYear = isFuture ? scenario.canopyYear : 0;

  const chooseCanopy = (canopy: CanopyMode) => {
    if (canopy === 'now' && playing) toggle();
    // Future at year 0 would look identical to Now, so jump to maturity.
    const canopyYear = canopy === 'future' && scenario.canopyYear === 0 ? MAX_CANOPY_YEAR : scenario.canopyYear;
    setScenario({ canopy, canopyYear });
  };

  return (
    <div className="map-toolbar">
      <Segmented
        label="Map mode"
        options={MODES}
        value={scenario.mapMode}
        onChange={(mapMode) => setScenario({ mapMode })}
      />
      <Segmented label="Canopy" options={CANOPIES} value={scenario.canopy} onChange={chooseCanopy} />
      <label className="map-toolbar__year">
        <span className="num">Year {Math.round(shownYear)}</span>
        <input
          type="range"
          min={0}
          max={MAX_CANOPY_YEAR}
          step={1}
          value={shownYear}
          disabled={!isFuture}
          aria-label="Canopy growth year"
          onChange={(e) => setScenario({ canopyYear: Number(e.target.value) })}
        />
      </label>
      <button type="button" className="map-toolbar__play" onClick={toggle} aria-pressed={playing}>
        {playing ? 'Pause' : 'Grow'}
      </button>
    </div>
  );
}
