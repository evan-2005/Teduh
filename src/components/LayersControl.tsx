import { useState } from 'react';
import { useScenarioStore, type ContextLayers } from '../store/scenario';
import type { AreaContext } from '../types';
import { BASEMAP_CHOICES } from './basemaps';

const TOGGLES: readonly { key: keyof ContextLayers; label: string }[] = [
  { key: 'buildings', label: 'Buildings' },
  { key: 'greens', label: 'Parks and fields' },
  { key: 'landmarks', label: 'Landmarks' },
  { key: 'trees', label: 'Mapped trees' },
];

interface LayersControlProps {
  /** Null while loading or when the dataset has no area context. */
  context: AreaContext | null;
}

/** Map-corner panel: pick a background map and switch area layers on or off. */
export function LayersControl({ context }: LayersControlProps) {
  const [open, setOpen] = useState(false);
  const basemap = useScenarioStore((s) => s.basemap);
  const setBasemap = useScenarioStore((s) => s.setBasemap);
  const layers = useScenarioStore((s) => s.contextLayers);
  const setLayers = useScenarioStore((s) => s.setContextLayers);

  return (
    <div className="layers">
      <button
        type="button"
        className="layers__toggle"
        aria-expanded={open}
        aria-controls="layers-panel"
        onClick={() => setOpen((o) => !o)}
      >
        Map layers
      </button>
      {open && (
        <div id="layers-panel" className="layers__panel">
          <fieldset className="field">
            <legend className="field__label">Background</legend>
            <div
              className="segmented segmented--stack"
              role="radiogroup"
              aria-label="Background map"
              style={{ gridTemplateColumns: `repeat(${BASEMAP_CHOICES.length}, 1fr)` }}
            >
              {BASEMAP_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={basemap.style === choice.value}
                  className="segmented__option"
                  onClick={() => setBasemap({ style: choice.value })}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={basemap.opacity}
              disabled={basemap.style === 'none'}
              aria-label="Background opacity"
              onChange={(e) => setBasemap({ opacity: Number(e.target.value) })}
            />
            <p className="card__hint">Background maps need the internet. Area layers work offline.</p>
          </fieldset>

          {context ? (
            <fieldset className="field">
              <legend className="field__label">Area layers</legend>
              {TOGGLES.filter((t) => t.key !== 'trees' || context.trees.length > 0).map((t) => (
                <label key={t.key} className="field__inline">
                  <input
                    type="checkbox"
                    checked={layers[t.key]}
                    onChange={(e) => setLayers({ [t.key]: e.target.checked })}
                  />
                  {t.label}
                </label>
              ))}
              {context.trees.length === 0 && (
                <p className="card__hint">No trees are mapped in this area.</p>
              )}
            </fieldset>
          ) : (
            <p className="card__hint">This dataset has no area layers.</p>
          )}
        </div>
      )}
    </div>
  );
}
