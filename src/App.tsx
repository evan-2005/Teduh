import { ENABLE_AI, FOOTER_DISCLAIMER } from './config';
import { loadDataset } from './data/load';
import { FabricationPanel } from './features/fabrication';
import { PlanExplainer, ShadeScanPanel } from './features/ai-scan';

// Loaded once at startup; throws a readable error if data/*.json is invalid.
const dataset = loadDataset();

export function App() {
  const { segments, destinations } = dataset.neighbourhood;
  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="brand">Teduh</h1>
        <p className="tagline">Small changes. Cooler journeys.</p>
      </header>

      <aside className="shell__controls" aria-label="Controls">
        <h2 className="panel__title">Controls</h2>
        <p className="panel__hint">Budget, time, detour and priorities arrive in Phase 3.</p>
      </aside>

      <main className="shell__map" aria-label="Map">
        <div className="map-placeholder">
          <h2 className="panel__title">Map</h2>
          <p className="panel__hint">
            Seed data loaded: {segments.length} path segments, {destinations.length} destinations,{' '}
            {dataset.interventions.length} candidate interventions.
          </p>
        </div>
      </main>

      <aside className="shell__results" aria-label="Results">
        <h2 className="panel__title">Results</h2>
        <p className="panel__hint">Plan metrics arrive in Phase 3.</p>
        <FabricationPanel />
        {ENABLE_AI && <ShadeScanPanel />}
        {ENABLE_AI && <PlanExplainer />}
      </aside>

      <footer className="shell__footer">{FOOTER_DISCLAIMER}</footer>
    </div>
  );
}
