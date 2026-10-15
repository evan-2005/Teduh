import { ControlsPanel } from './components/ControlsPanel';
import { MapView } from './components/MapView';
import { RouteComparison } from './components/RouteComparison';
import { ENABLE_AI, FOOTER_DISCLAIMER } from './config';
import { PlanExplainer, ShadeScanPanel } from './features/ai-scan';
import { FabricationPanel } from './features/fabrication';
import { useNetworkView } from './hooks/useNetworkView';

export function App() {
  const { shade, journey, comparison } = useNetworkView();
  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="brand">Teduh</h1>
        <p className="tagline">Small changes. Cooler journeys.</p>
      </header>

      <aside className="shell__controls" aria-label="Controls">
        <ControlsPanel />
      </aside>

      <main className="shell__map" aria-label="Map">
        <MapView shade={shade} comparison={comparison} />
      </main>

      <aside className="shell__results" aria-label="Results">
        <h2 className="panel__title">Results</h2>
        <RouteComparison journey={journey} comparison={comparison} />
        <FabricationPanel />
        {ENABLE_AI && <ShadeScanPanel />}
        {ENABLE_AI && <PlanExplainer />}
      </aside>

      <footer className="shell__footer">{FOOTER_DISCLAIMER}</footer>
    </div>
  );
}
