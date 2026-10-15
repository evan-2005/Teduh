import { ControlsPanel } from './components/ControlsPanel';
import { MapView } from './components/MapView';
import { ResultsPanel } from './components/ResultsPanel';
import { RouteComparison } from './components/RouteComparison';
import { ENABLE_AI, FOOTER_DISCLAIMER } from './config';
import { PlanExplainer, ShadeScanPanel } from './features/ai-scan';
import { FabricationPanel } from './features/fabrication';
import { useNetworkView } from './hooks/useNetworkView';
import { useOptimizer } from './hooks/useOptimizer';
import { useScenarioStore } from './store/scenario';

export function App() {
  const { before, after, journey } = useNetworkView();
  const mapMode = useScenarioStore((s) => s.scenario.mapMode);
  const comparison = mapMode === 'before' ? before.comparison : after.comparison;
  const { plans, selectedPlan } = useOptimizer();
  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="brand">Teduh</h1>
        <p className="tagline">Small changes. Cooler journeys.</p>
      </header>

      <aside className="shell__controls" aria-label="Controls">
        <ControlsPanel plans={plans} />
      </aside>

      <main className="shell__map" aria-label="Map">
        <MapView before={before} after={after} />
      </main>

      <aside className="shell__results" aria-label="Results">
        <ResultsPanel plans={plans} selectedPlan={selectedPlan} />
        <RouteComparison journey={journey} comparison={comparison} />
        <FabricationPanel />
        {ENABLE_AI && <ShadeScanPanel />}
        {ENABLE_AI && <PlanExplainer plan={selectedPlan} />}
      </aside>

      <footer className="shell__footer">{FOOTER_DISCLAIMER}</footer>
    </div>
  );
}
